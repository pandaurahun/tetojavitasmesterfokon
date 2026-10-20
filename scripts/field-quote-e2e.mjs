#!/usr/bin/env node
// End-to-end checks for the Helyszíni ajánlat (field quote) module and the
// public lead wizard backend, run against a RUNNING LOCAL `wrangler dev`.
//
//   npx wrangler dev --config wrangler.jsonc --port 8787     # in one terminal
//   E2E_EMAIL=... E2E_PASSWORD=... node scripts/field-quote-e2e.mjs
//
// Needs a LOCAL test admin (see docs/backup-recovery.md for the PBKDF2 insert
// recipe). Refuses to run against anything but localhost, and only ever
// deletes rows it created itself.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://127.0.0.1:8787";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set E2E_EMAIL and E2E_PASSWORD (a LOCAL test admin).");
  process.exit(2);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error("Refusing to run against a non-local BASE:", BASE);
  process.exit(2);
}

const { computeFieldQuoteTotals } = await import(
  pathToFileURL(path.join(ROOT, "src/lib/field-quote-calc.ts")).href
);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
}
const section = (title) => console.log(`\n== ${title}`);

// ---- helpers -------------------------------------------------------------
let cookie = "";
async function raw(method, url, { body, headers = {}, auth = true } = {}) {
  const h = { ...headers };
  if (cookie && auth) h.cookie = cookie;
  let payload;
  if (body instanceof Uint8Array) payload = body;
  else if (body !== undefined) {
    h["content-type"] ??= "application/json";
    payload = JSON.stringify(body);
  }
  // After the Worker refuses an oversize upload mid-stream it closes that
  // connection; the HTTP client may still hand the dead socket to the NEXT
  // request, which then fails before reaching the server. Any HTTP client
  // retries that for idempotent requests, so this does too (GET only —
  // never re-sending a POST/PUT/DELETE behind the test's back).
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(BASE + url, { method, headers: h, body: payload });
    } catch (error) {
      const code = error?.cause?.code ?? error?.code;
      const reset = code === "ECONNRESET" || code === "UND_ERR_SOCKET";
      if (method === "GET" && reset && attempt < 2) continue;
      throw error;
    }
  }
}
async function api(method, url, opts) {
  const res = await raw(method, url, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text, headers: res.headers };
}
// For bodies far larger than the limit: the Worker answers 413 straight from
// Content-Length and stops reading, so depending on timing the client sees the
// 413 *or* the connection being reset mid-upload. Both mean "refused".
async function apiOversize(method, url, opts) {
  try {
    return await api(method, url, opts);
  } catch (error) {
    const code = error?.cause?.code ?? error?.code;
    if (code === "ECONNRESET" || code === "UND_ERR_SOCKET" || /fetch failed/.test(String(error))) {
      return { status: 413, reset: true, json: undefined, text: "", headers: new Headers() };
    }
    throw error;
  } finally {
    // Give the HTTP client a moment to notice the closed connection and drop
    // it, so the next request (of any method) opens a fresh one.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
async function bin(url, opts) {
  const res = await raw("GET", url, opts);
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    bytes: new Uint8Array(await res.arrayBuffer()),
  };
}

const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
function d1(sql) {
  const out = execFileSync(
    process.execPath,
    [
      WRANGLER,
      "d1",
      "execute",
      "tetojavitasmesterfokon",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--json",
      "--command",
      sql,
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed.flatMap((r) => r.results ?? []);
}
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PNG = new Uint8Array(Buffer.from(PNG_B64, "base64"));
const sigBody = (over = {}) => ({
  signatureDataUrl: `data:image/png;base64,${PNG_B64}`,
  pdfBase64: Buffer.from(`%PDF-1.7\n${"x".repeat(400)}\n%%EOF\n`).toString("base64"),
  acceptedStatement: true,
  ...over,
});

const created = []; // field quote ids this run created
const createdLeads = [];
const CALC_ITEMS = [
  { name: "Cserépfedés – tetőfedés", qty: 100, unit: "m²", unitPrice: 5000, vat: 27 },
  { name: "Függő ereszcsatorna", qty: 20, unit: "fm", unitPrice: 8000, vat: 27 },
  { name: "Műszaki átadás, felmérő díj", qty: 1, unit: "átalány", unitPrice: 50000, vat: 27 },
];
const quoteBody = (over = {}) => ({
  customerName: "Teszt Elek",
  customerPhone: "+36 30 123 4567",
  customerEmail: "teszt@example.com",
  customerZip: "5000",
  customerCity: "Szolnok",
  customerAddress: "Teszt utca 1.",
  billingName: "Teszt Elek Számla Kft.",
  billingAddress: "5000 Szolnok, Számla köz 2.",
  customerNote: "BELSO-LEAD-NOTE-MARKER",
  propertyType: "Családi ház",
  roofType: "Nyeregtető",
  roofCovering: "Cserép",
  estimatedSize: "120",
  sizeUnit: "m²",
  roofCondition: "Közepes",
  surveyNote: "BELSO-SURVEY-MARKER",
  discountValue: 0,
  validityDate: "2026-12-31",
  expectedStart: "2 héten belül",
  expectedDuration: "3 nap",
  paymentTerms: "50% előleg, 50% átadáskor.",
  customerNotes: "Ügyfélnek szóló megjegyzés: tető, függő, műszaki.",
  items: CALC_ITEMS,
  ...over,
});
async function createQuote(over) {
  const r = await api("POST", "/api/admin/field-quotes", { body: quoteBody(over) });
  if (r.json?.id) created.push(r.json.id);
  return r;
}

let adminId = "";
try {
  // =========================================================================
  section("0. Worker runtime / public surface");
  for (const p of ["/", "/admin/login", "/ajanlatkeres", "/kapcsolat", "/szolgaltatasok"]) {
    const r = await raw("GET", p, { auth: false });
    await r.arrayBuffer();
    check(`GET ${p} -> 200`, r.status === 200, `status ${r.status}`);
  }
  {
    const r = await raw("GET", "/nincs-ilyen-oldal", { auth: false });
    await r.arrayBuffer();
    check("unknown route -> 404 (not 200/500)", r.status === 404, `status ${r.status}`);
    const h = (await raw("GET", "/", { auth: false })).headers;
    const csp = h.get("content-security-policy") ?? "";
    check(
      "CSP served with 'unsafe-inline' for hydration + analytics.google.com",
      csp.includes("'unsafe-inline'") && csp.includes("analytics.google.com"),
      csp.slice(0, 120),
    );
    check(
      "X-Frame-Options / HSTS / Referrer-Policy present",
      h.get("x-frame-options") && h.get("strict-transport-security") && h.get("referrer-policy"),
    );
  }

  // =========================================================================
  section("1. Auth");
  {
    const noAuth = await api("GET", "/api/admin/field-quotes", { auth: false });
    check("list without session -> 401", noAuth.status === 401, `status ${noAuth.status}`);
    const noAuthPost = await api("POST", "/api/admin/field-quotes", {
      auth: false,
      body: quoteBody(),
    });
    check(
      "create without session -> 401",
      noAuthPost.status === 401,
      `status ${noAuthPost.status}`,
    );
    const t0 = Date.now();
    const login = await raw("POST", "/api/admin/login", {
      auth: false,
      body: { email: EMAIL, password: PASSWORD },
    });
    await login.text();
    const ms = Date.now() - t0;
    const sc = login.headers.getSetCookie?.() ?? [];
    cookie = sc.map((c) => c.split(";")[0]).join("; ");
    check(
      `admin login -> 200 with session cookie (${ms} ms)`,
      login.status === 200 && cookie.includes("tetomester_session"),
      `status ${login.status}`,
    );
    check("login latency < 5 s (PBKDF2 under workerd)", ms < 5000, `${ms} ms`);
    adminId = d1(`SELECT id FROM admins WHERE email = '${EMAIL.replace(/'/g, "''")}'`)[0]?.id ?? "";
    check("test admin row found in local D1", Boolean(adminId));
  }

  // =========================================================================
  section("2. List + dashboard (real D1)");
  {
    const l0 = await api("GET", "/api/admin/field-quotes");
    check(
      "list GET -> 200 {items}",
      l0.status === 200 && Array.isArray(l0.json?.items),
      `status ${l0.status}`,
    );
    const d = await api("GET", "/api/admin/field-quotes/dashboard");
    check(
      "dashboard GET -> 200 with numeric stats",
      d.status === 200 &&
        [
          "todayCount",
          "signedCount",
          "pendingCount",
          "declinedCount",
          "todayValue",
          "acceptedValue",
        ].every((k) => typeof d.json?.[k] === "number"),
      JSON.stringify(d.json),
    );
  }

  // =========================================================================
  section("3. Catalog (seed present in local D1)");
  let catalogId = "";
  {
    const c = await api("GET", "/api/admin/field-quotes/catalog");
    check(
      "catalog list has the seeded items",
      c.status === 200 && (c.json?.items?.length ?? 0) >= 12,
      `count ${c.json?.items?.length}`,
    );
    const s = await api(
      "GET",
      `/api/admin/field-quotes/catalog/search?q=${encodeURIComponent("kémény")}`,
    );
    check(
      "catalog search 'kémény' finds Kémény bádogozás",
      s.status === 200 && s.json?.items?.some((i) => /Kémény/.test(i.name)),
      JSON.stringify(s.json).slice(0, 120),
    );
    catalogId = s.json?.items?.[0]?.id ?? "";
    const pk = await api("GET", "/api/admin/field-quotes/packages");
    check(
      "packages list has seeded packages",
      pk.status === 200 && (pk.json?.items?.length ?? 0) >= 2,
    );
    const pt = await api("GET", "/api/admin/field-quotes/payment-templates");
    check(
      "payment templates list has seeded templates",
      pt.status === 200 && (pt.json?.items?.length ?? 0) >= 2,
    );
    const st = await api("GET", "/api/admin/field-quotes/settings");
    check(
      "settings: maxDiscountPercent / defaultValidityDays / acceptance text",
      st.status === 200 &&
        typeof st.json?.maxDiscountPercent === "number" &&
        st.json?.acceptanceStatement?.length > 10,
      JSON.stringify(st.json).slice(0, 100),
    );
  }

  // =========================================================================
  section("4. Create -> redirect target -> reload (customer, survey, billing)");
  let q1 = null;
  {
    const r = await createQuote();
    q1 = r.json;
    check(
      "create -> 201 with id + HJA-YYYY-NNNNNN number",
      r.status === 201 && /^HJA-\d{4}-\d{6}$/.test(q1?.number ?? ""),
      `status ${r.status} ${r.text.slice(0, 120)}`,
    );
    check(
      "new quote is DRAFT v1, rootId == id",
      q1?.status === "DRAFT" && q1?.version === 1 && q1?.rootId === q1?.id,
    );
    const g = await api("GET", `/api/admin/field-quotes/${q1.id}`);
    check(
      "GET /:id returns the very same id (create -> redirect -> load)",
      g.status === 200 && g.json?.id === q1.id,
    );
    const f = g.json ?? {};
    const sent = quoteBody();
    const fields = [
      "customerName",
      "customerPhone",
      "customerEmail",
      "customerZip",
      "customerCity",
      "customerAddress",
      "billingName",
      "billingAddress",
      "customerNote",
      "propertyType",
      "roofType",
      "roofCovering",
      "estimatedSize",
      "sizeUnit",
      "roofCondition",
      "surveyNote",
      "validityDate",
      "expectedStart",
      "expectedDuration",
      "paymentTerms",
      "customerNotes",
    ];
    const lost = fields.filter((k) => f[k] !== sent[k]);
    check(
      "every customer/survey/billing/terms field persisted + reloads identically",
      lost.length === 0,
      `lost/changed: ${lost.join(", ")}`,
    );
    check(
      "3 items persisted with qty/unit/price/vat intact",
      f.items?.length === 3 &&
        f.items.every(
          (it, i) =>
            it.qty === CALC_ITEMS[i].qty &&
            it.unitPrice === CALC_ITEMS[i].unitPrice &&
            it.vat === 27 &&
            it.unit === CALC_ITEMS[i].unit,
        ),
    );
    const row = d1(
      `SELECT customer_name, billing_name, property_type, estimated_size, size_unit FROM field_quotes WHERE id = '${q1.id}'`,
    )[0];
    check(
      "real D1 row exists (customer_name/billing_name/survey columns)",
      row?.customer_name === "Teszt Elek" &&
        row?.billing_name === "Teszt Elek Számla Kft." &&
        row?.property_type === "Családi ház" &&
        row?.estimated_size === "120",
      JSON.stringify(row),
    );
  }

  // =========================================================================
  section("5. Totals (100x5000 + 20x8000 + 1x50000, 27% VAT)");
  {
    const t = computeFieldQuoteTotals(CALC_ITEMS, undefined, 0);
    check(
      "net 710 000 / VAT 191 700 / gross 901 700 exactly",
      t.net === 710000 && t.vat === 191700 && t.gross === 901700,
      JSON.stringify(t),
    );
    const drift = computeFieldQuoteTotals(
      [
        { qty: 3, unitPrice: 33.33, vat: 27 },
        { qty: 0.1, unitPrice: 3, vat: 27 },
        { qty: 7, unitPrice: 0.07, vat: 5 },
      ],
      "percent",
      7,
    );
    const whole = [drift.net, drift.discount, drift.netAfterDiscount, drift.vat, drift.gross].every(
      Number.isInteger,
    );
    check(
      "no floating-point drift: awkward decimals still give whole-forint totals",
      whole,
      JSON.stringify(drift),
    );
    check(
      "invariant gross == netAfterDiscount + vat (exact)",
      drift.gross === drift.netAfterDiscount + drift.vat &&
        drift.netAfterDiscount === drift.net - drift.discount,
    );
  }

  // =========================================================================
  section("6. Server-enforced catalog pricing + discount cap");
  {
    const forged = await createQuote({
      items: [
        {
          catalogItemId: catalogId,
          name: "Kémény (hamisított ár)",
          qty: 1,
          unit: "ezer",
          unitPrice: 1,
          vat: 5,
        },
      ],
    });
    const it = forged.json?.items?.[0];
    check(
      "tampered catalog price/vat/unit overridden by the server catalog",
      forged.status === 201 && it?.unitPrice === 35000 && it?.vat === 27 && it?.unit === "db",
      JSON.stringify(it),
    );
    const ok5 = await createQuote({ discountType: "percent", discountValue: 5 });
    check(
      "5% discount (cap 10%) accepted",
      ok5.status === 201,
      `status ${ok5.status} ${ok5.text.slice(0, 100)}`,
    );
    const bad25 = await api("POST", "/api/admin/field-quotes", {
      body: quoteBody({ discountType: "percent", discountValue: 25 }),
    });
    check(
      "25% discount without approval -> 409 (API level)",
      bad25.status === 409,
      `status ${bad25.status}`,
    );
    const fixedBig = await api("POST", "/api/admin/field-quotes", {
      body: quoteBody({ discountType: "fixed", discountValue: 300000 }),
    });
    check(
      "fixed discount > cap (as % of net) -> 409",
      fixedBig.status === 409,
      `status ${fixedBig.status}`,
    );
    const ok25 = await createQuote({
      discountType: "percent",
      discountValue: 25,
      discountOverCapApprovedBy: "Teszt Elek jóváhagyta",
    });
    check(
      "25% with an approval note accepted and the note stored",
      ok25.status === 201 && ok25.json?.discountOverCapApprovedBy === "Teszt Elek jóváhagyta",
      `status ${ok25.status}`,
    );
  }

  // =========================================================================
  section("7. Save -> modify -> save -> refresh");
  {
    const upd = quoteBody({
      customerName: "Módosított Elek",
      customerPhone: "+36 20 999 8877",
      billingName: "Új Számlázó Zrt.",
      billingAddress: "1011 Budapest, Fő utca 1.",
      surveyNote: "BELSO-SURVEY-MARKER-2",
      roofCondition: "Rossz",
      items: [
        ...CALC_ITEMS.slice(0, 2),
        { name: "Új egyedi tétel", qty: 2.5, unit: "óra", unitPrice: 9500, vat: 27 },
      ],
    });
    const put = await api("PUT", `/api/admin/field-quotes/${q1.id}`, { body: upd });
    check(
      "PUT update -> 200",
      put.status === 200,
      `status ${put.status} ${put.text.slice(0, 100)}`,
    );
    const g = await api("GET", `/api/admin/field-quotes/${q1.id}`);
    const f = g.json ?? {};
    check(
      "after refresh every modified field persisted (name/phone/billing/survey/items)",
      f.customerName === "Módosított Elek" &&
        f.customerPhone === "+36 20 999 8877" &&
        f.billingName === "Új Számlázó Zrt." &&
        f.billingAddress === "1011 Budapest, Fő utca 1." &&
        f.surveyNote === "BELSO-SURVEY-MARKER-2" &&
        f.roofCondition === "Rossz" &&
        f.items?.length === 3 &&
        f.items[2]?.qty === 2.5 &&
        f.items[2]?.name === "Új egyedi tétel",
      JSON.stringify({ n: f.customerName, i: f.items?.length }),
    );
    check(
      "number + rootId stay stable across updates",
      f.number === q1.number && f.rootId === q1.rootId && f.version === 1,
    );
    const put2 = await api("PUT", `/api/admin/field-quotes/${q1.id}`, { body: quoteBody() });
    check("restoring the original payload works too", put2.status === 200);
  }

  // =========================================================================
  section("8. Field-quote photos (browser -> API -> R2 -> DB -> preview)");
  let photoId = "";
  let photoKey = "";
  {
    const cap = "Tetőfedés állapota, kémény hibás";
    const up = await api("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: PNG,
      headers: { "content-type": "image/png", "x-photo-caption": encodeURIComponent(cap) },
    });
    photoId = up.json?.photoId ?? "";
    photoKey = up.json?.key ?? "";
    check(
      "photo upload -> 201 {photoId,key,url}",
      up.status === 201 && photoId && photoKey.startsWith(`field-quotes/${q1.id}/photos/`),
      `status ${up.status} ${up.text.slice(0, 120)}`,
    );
    const media = await bin(up.json?.url ?? "/x");
    check(
      "R2 object readable via the admin media route (real bytes, image/png)",
      media.status === 200 && media.type === "image/png" && media.bytes.length === PNG.length,
      `status ${media.status} ${media.type} ${media.bytes.length}`,
    );
    const row = d1(
      `SELECT caption, storage_key FROM field_quote_photos WHERE id = '${photoId}'`,
    )[0];
    check(
      "DB stores the R2 key + the Hungarian caption intact (not just a filename)",
      row?.storage_key === photoKey && row?.caption === cap,
      JSON.stringify(row),
    );
    const g = await api("GET", `/api/admin/field-quotes/${q1.id}`);
    check(
      "GET quote lists the photo (preview source)",
      g.json?.photos?.some((p) => p.id === photoId && p.url === photoKey),
    );
    const badType = await api("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: PNG,
      headers: { "content-type": "text/html" },
    });
    check("non-image MIME rejected (415)", badType.status === 415, `status ${badType.status}`);
    const htmlAsPng = await api("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: new TextEncoder().encode("<html><script>alert(1)</script></html>"),
      headers: { "content-type": "image/png" },
    });
    check(
      "HTML labelled image/png is refused by content sniffing (415)",
      htmlAsPng.status === 415,
      `status ${htmlAsPng.status} ${htmlAsPng.text.slice(0, 80)}`,
    );
    const huge = await apiOversize("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: new Uint8Array(13 * 1024 * 1024),
      headers: { "content-type": "image/png" },
    });
    check(
      "oversize photo (13 MB) rejected (413 or connection refused)",
      huge.status === 413,
      `status ${huge.status}`,
    );
    const alive = await api("GET", "/api/admin/field-quotes/dashboard");
    check(
      "Worker still healthy after the oversize upload",
      alive.status === 200,
      `status ${alive.status}`,
    );
    const second = await api("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: PNG,
      headers: { "content-type": "image/png" },
    });
    check(
      "multiple photos per quote work",
      second.status === 201 && second.json?.photoId !== photoId,
    );
  }

  // =========================================================================
  section("9. Status transitions");
  {
    const ready = await api("PUT", `/api/admin/field-quotes/${q1.id}/status`, {
      body: { status: "READY" },
    });
    check("DRAFT -> READY", ready.status === 200, `status ${ready.status}`);
    const wait = await api("PUT", `/api/admin/field-quotes/${q1.id}/status`, {
      body: { status: "WAITING_FOR_SIGNATURE" },
    });
    check("READY -> WAITING_FOR_SIGNATURE", wait.status === 200);
    const sneaky = await api("PUT", `/api/admin/field-quotes/${q1.id}/status`, {
      body: { status: "SIGNED" },
    });
    check(
      "client cannot set SIGNED via the status endpoint (400)",
      sneaky.status === 400,
      `status ${sneaky.status}`,
    );
    const junk = await api("PUT", `/api/admin/field-quotes/${q1.id}/status`, {
      body: { status: "FOO" },
    });
    check("unknown status rejected (400)", junk.status === 400);
  }

  // =========================================================================
  section("10. Public secure link (customer-safe view, isolation, expiry)");
  let token = "";
  {
    const pl = await api("POST", `/api/admin/field-quotes/${q1.id}/public-link`, { body: {} });
    token = pl.json?.token ?? "";
    check(
      "public link generated: 48-hex token + /ajanlat/<token> url",
      pl.status === 200 && /^[a-f0-9]{48}$/.test(token) && pl.json?.url === `/ajanlat/${token}`,
      `status ${pl.status}`,
    );
    const pub = await api("GET", `/api/field-quotes/public/${token}`, { auth: false });
    check(
      "public GET works without any admin session",
      pub.status === 200 && pub.json?.quote?.id === q1.id,
    );
    const text = pub.text;
    const leaked = ["BELSO-SURVEY-MARKER", "BELSO-LEAD-NOTE-MARKER"].filter((m) =>
      text.includes(m),
    );
    const leakedKeys = [
      "surveyNote",
      'customerNote"',
      "discountOverCapApprovedBy",
      "leadId",
      "publicToken",
      "signatureKey",
    ].filter((k) => text.includes(`"${k.replace(/"/g, "")}"`));
    check(
      "customer view has NO internal notes / lead id / token / approval note / signature key",
      leaked.length === 0 && leakedKeys.length === 0,
      `leaked: ${[...leaked, ...leakedKeys].join(", ")}`,
    );
    check(
      "public view carries totals computed server-side",
      pub.json?.totals?.gross === computeFieldQuoteTotals(q1.items, undefined, 0).gross,
      JSON.stringify(pub.json?.totals),
    );
    const ghost = await api("GET", `/api/field-quotes/public/${"a".repeat(48)}`, { auth: false });
    check(
      "well-formed but unknown token -> generic 404",
      ghost.status === 404 && /nem található vagy a link lejárt/.test(ghost.text),
      ghost.text.slice(0, 80),
    );
    const malformed = await api("GET", `/api/field-quotes/public/${"z".repeat(10)}`, {
      auth: false,
    });
    check("malformed token -> 404", malformed.status === 404);
    const own = await bin(`/api/field-quotes/public/${token}/media/${photoKey}`, { auth: false });
    check(
      "token can read its own quote's photo",
      own.status === 200 && own.type === "image/png",
      `status ${own.status}`,
    );
    const other = await createQuote();
    const otherPhoto = await api("POST", `/api/admin/field-quotes/${other.json.id}/photos`, {
      body: PNG,
      headers: { "content-type": "image/png" },
    });
    const cross = await bin(`/api/field-quotes/public/${token}/media/${otherPhoto.json.key}`, {
      auth: false,
    });
    check(
      "token CANNOT read another customer's file (isolation)",
      cross.status === 404,
      `status ${cross.status}`,
    );
    const noAdminMedia = await bin(`/api/admin/field-quotes/media/${photoKey}`, { auth: false });
    check(
      "admin media route needs a session (401 without)",
      noAdminMedia.status === 401,
      `status ${noAdminMedia.status}`,
    );
    d1(
      `UPDATE field_quotes SET public_token_expires_at = ${Date.now() - 1000} WHERE id = '${q1.id}'`,
    );
    const expired = await api("GET", `/api/field-quotes/public/${token}`, { auth: false });
    check(
      "expired link -> same generic 404 (expiry works)",
      expired.status === 404,
      `status ${expired.status}`,
    );
    const expiredSign = await api("POST", `/api/field-quotes/public/${token}/signature`, {
      auth: false,
      body: sigBody(),
    });
    check(
      "expired link cannot sign either",
      expiredSign.status === 404,
      `status ${expiredSign.status}`,
    );
    const fresh = await api("POST", `/api/admin/field-quotes/${q1.id}/public-link`, { body: {} });
    token = fresh.json?.token ?? "";
    check("a new link can be generated again after expiry", fresh.status === 200 && token !== "");
  }

  // =========================================================================
  section("11. Signing (admin / customer mode), snapshot, SHA-256, PDF storage");
  {
    const noAccept = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody({ acceptedStatement: false }),
    });
    check(
      "signing without the acceptance checkbox -> 400",
      noAccept.status === 400,
      `status ${noAccept.status}`,
    );
    const badPng = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody({ signatureDataUrl: `data:image/png;base64,${"A".repeat(120)}` }),
    });
    check("garbage signature image -> 400", badPng.status === 400, `status ${badPng.status}`);
    const badPdf = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody({ pdfBase64: Buffer.from("x".repeat(300)).toString("base64") }),
    });
    check("non-PDF payload -> 400", badPdf.status === 400, `status ${badPdf.status}`);
    const truncatedPng = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody({
        signatureDataUrl: `data:image/png;base64,${Buffer.from(PNG.slice(0, 40)).toString("base64")}`,
      }),
    });
    check(
      "truncated PNG (no IEND) is not accepted as a signature -> 400",
      truncatedPng.status === 400,
      `status ${truncatedPng.status}`,
    );
    const truncatedPdf = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody({
        pdfBase64: Buffer.from(`%PDF-1.7\n${"x".repeat(400)}`).toString("base64"),
      }),
    });
    check(
      "truncated PDF (no %%EOF) -> 400",
      truncatedPdf.status === 400,
      `status ${truncatedPdf.status}`,
    );
    const stillNotSigned = (await api("GET", `/api/admin/field-quotes/${q1.id}`)).json?.status;
    check(
      "failed sign attempts leave the quote unsigned",
      stillNotSigned !== "SIGNED",
      stillNotSigned,
    );

    const sign = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody(),
    });
    check(
      "valid signature -> 200 + pdfUrl",
      sign.status === 200 && /\/pdf\//.test(sign.json?.pdfUrl ?? ""),
      `status ${sign.status} ${sign.text.slice(0, 120)}`,
    );
    const g = (await api("GET", `/api/admin/field-quotes/${q1.id}`)).json ?? {};
    check(
      "quote is SIGNED with signedAt, pdfKey and a 64-hex documentHash",
      g.status === "SIGNED" &&
        g.signedAt &&
        g.pdfKey &&
        /^[a-f0-9]{64}$/.test(g.documentHash ?? ""),
      JSON.stringify({ s: g.status, h: g.documentHash }),
    );
    const rec = d1(`SELECT * FROM field_quote_signatures WHERE field_quote_id = '${q1.id}'`);
    const r0 = rec[0] ?? {};
    check("exactly one signature record", rec.length === 1);
    check(
      "signature record: quote_number, version, signed_at, acceptance text, signature key, pdf key",
      r0.quote_number === q1.number &&
        r0.quote_version === 1 &&
        r0.signed_at > 0 &&
        r0.accepted_statement_text?.length > 10 &&
        r0.signature_storage_key?.includes("/signatures/") &&
        r0.pdf_storage_key?.includes("/pdf/"),
      JSON.stringify({ n: r0.quote_number, v: r0.quote_version }),
    );
    check(
      "document_hash == SHA-256(document_snapshot) (tamper-evident)",
      r0.document_hash === sha256(r0.document_snapshot ?? ""),
      r0.document_hash,
    );
    const snap = JSON.parse(r0.document_snapshot ?? "{}");
    const expected = computeFieldQuoteTotals(
      snap.items ?? [],
      snap.discount?.type ?? undefined,
      snap.discount?.value ?? 0,
    );
    check(
      "snapshot is canonical: has id/number/version/customer/items/totals/acceptance/signedAt",
      snap.quoteId === q1.id &&
        snap.quoteNumber === q1.number &&
        snap.quoteVersion === 1 &&
        snap.customer?.name &&
        snap.items?.length === 3 &&
        snap.acceptanceText &&
        snap.signedAt,
    );
    check(
      "snapshot totals == client-side totals function (server and client agree)",
      snap.totals?.gross === expected.gross &&
        snap.totals?.net === expected.net &&
        snap.totals?.vat === expected.vat,
      JSON.stringify({ s: snap.totals, c: expected }),
    );
    check(
      "snapshot excludes internal-only fields (no notes / token / lead id)",
      !JSON.stringify(snap).includes("BELSO-"),
    );
    check(
      "snapshot records WHO the quote is from (seller name, address, tax number)",
      typeof snap.seller?.name === "string" &&
        snap.seller.name.length > 0 &&
        typeof snap.seller?.taxNumber === "string" &&
        snap.seller.taxNumber.length > 0 &&
        typeof snap.seller?.address === "string",
      JSON.stringify(snap.seller),
    );
    const pdf = await bin(sign.json?.pdfUrl ?? "/x");
    check(
      "signed PDF served from R2 (application/pdf, %PDF header)",
      pdf.status === 200 &&
        pdf.type === "application/pdf" &&
        Buffer.from(pdf.bytes.slice(0, 5)).toString() === "%PDF-",
      `status ${pdf.status} ${pdf.type}`,
    );
    const sigObj = await bin(`/api/admin/field-quotes/media/${r0.signature_storage_key}`);
    check(
      "signature PNG stored in R2 and retrievable by an admin",
      sigObj.status === 200 && sigObj.type === "image/png",
    );

    // ---- SIGNED immutability, API level ----
    section("12. SIGNED immutability (direct API, bypassing the UI)");
    const put = await api("PUT", `/api/admin/field-quotes/${q1.id}`, {
      body: quoteBody({ customerName: "Hacked" }),
    });
    check("edit a SIGNED quote -> 409", put.status === 409, `status ${put.status}`);
    const items = await api("PUT", `/api/admin/field-quotes/${q1.id}`, {
      body: quoteBody({ items: [{ name: "x", qty: 1, unit: "db", unitPrice: 1, vat: 27 }] }),
    });
    check(
      "change items/amount of a SIGNED quote -> 409",
      items.status === 409,
      `status ${items.status}`,
    );
    const disc = await api("PUT", `/api/admin/field-quotes/${q1.id}`, {
      body: quoteBody({ discountType: "percent", discountValue: 5 }),
    });
    check("change discount of a SIGNED quote -> 409", disc.status === 409);
    const st = await api("PUT", `/api/admin/field-quotes/${q1.id}/status`, {
      body: { status: "DRAFT" },
    });
    check(
      "reopen a SIGNED quote via status endpoint -> 409",
      st.status === 409,
      `status ${st.status}`,
    );
    const dec = await api("POST", `/api/admin/field-quotes/${q1.id}/decline`, {
      body: { reason: "nem" },
    });
    check(
      "admin decline on a SIGNED quote -> 409 (regression guard)",
      dec.status === 409,
      `status ${dec.status}`,
    );
    const photo = await api("POST", `/api/admin/field-quotes/${q1.id}/photos`, {
      body: PNG,
      headers: { "content-type": "image/png" },
    });
    check("add a photo to a SIGNED quote -> 409", photo.status === 409, `status ${photo.status}`);
    const again = await api("POST", `/api/admin/field-quotes/${q1.id}/signature`, {
      body: sigBody(),
    });
    check(
      "second signature on a SIGNED quote -> 409 (not 500)",
      again.status === 409,
      `status ${again.status}`,
    );
    const pubDecline = await api("POST", `/api/field-quotes/public/${token}/decline`, {
      auth: false,
      body: { reason: "x" },
    });
    check(
      "public decline of a SIGNED quote -> 409",
      pubDecline.status === 409,
      `status ${pubDecline.status}`,
    );
    const pubSign = await api("POST", `/api/field-quotes/public/${token}/signature`, {
      auth: false,
      body: sigBody(),
    });
    check(
      "public re-sign of a SIGNED quote -> 409",
      pubSign.status === 409,
      `status ${pubSign.status}`,
    );
    const row = d1(`SELECT customer_name, status FROM field_quotes WHERE id = '${q1.id}'`)[0];
    check(
      "DB row unchanged by all of the above",
      row?.customer_name === "Teszt Elek" && row?.status === "SIGNED",
      JSON.stringify(row),
    );
    const afterHash = d1(
      `SELECT document_hash FROM field_quote_signatures WHERE field_quote_id = '${q1.id}'`,
    )[0]?.document_hash;
    check("signature record + hash unchanged", afterHash === r0.document_hash);
    const pubAfter = await api("GET", `/api/field-quotes/public/${token}`, { auth: false });
    check(
      "signed quote stays viewable on its link, shown as SIGNED",
      pubAfter.status === 200 && pubAfter.json?.quote?.status === "SIGNED",
    );

    // ---- versioning ----
    section("13. New version of a SIGNED quote");
    const nv = await api("POST", `/api/admin/field-quotes/${q1.id}/new-version`);
    if (nv.json?.id) created.push(nv.json.id);
    check(
      "new version -> 201, v2, same number, same root, DRAFT",
      nv.status === 201 &&
        nv.json?.version === 2 &&
        nv.json?.number === q1.number &&
        nv.json?.rootId === q1.rootId &&
        nv.json?.status === "DRAFT",
      `status ${nv.status} ${nv.text.slice(0, 100)}`,
    );
    check(
      "v2 starts with the same 3 items (editable copy)",
      nv.json?.items?.length === 3 && nv.json?.supersedesId === q1.id,
    );
    const v1 = (await api("GET", `/api/admin/field-quotes/${q1.id}`)).json;
    check(
      "v1 is untouched: still SIGNED, same hash",
      v1?.status === "SIGNED" && v1?.documentHash === r0.document_hash,
    );
    const v2edit = await api("PUT", `/api/admin/field-quotes/${nv.json.id}`, {
      body: quoteBody({ customerName: "Új verzió Elek" }),
    });
    check("v2 is editable", v2edit.status === 200);
    const listed =
      (await api("GET", "/api/admin/field-quotes?q=" + encodeURIComponent(q1.number))).json
        ?.items ?? [];
    check(
      "list shows only the latest version per quote",
      listed.filter((x) => x.rootId === q1.rootId).length === 1 &&
        listed.find((x) => x.rootId === q1.rootId)?.version === 2,
    );
  }

  // =========================================================================
  section("14. Double-sign race (two near-simultaneous requests)");
  {
    const q = await createQuote();
    const [a, b] = await Promise.all([
      api("POST", `/api/admin/field-quotes/${q.json.id}/signature`, { body: sigBody() }),
      api("POST", `/api/admin/field-quotes/${q.json.id}/signature`, { body: sigBody() }),
    ]);
    const statuses = [a.status, b.status].sort();
    check(
      "one request wins (200), the other is a clean 409 — never 500",
      statuses[0] === 200 && statuses[1] === 409,
      `got ${statuses.join(",")}  ${a.text.slice(0, 60)} | ${b.text.slice(0, 60)}`,
    );
    const n = d1(
      `SELECT COUNT(*) AS n FROM field_quote_signatures WHERE field_quote_id = '${q.json.id}'`,
    )[0]?.n;
    check("exactly one signature row exists after the race", n === 1, String(n));
  }

  // =========================================================================
  section("15. Quote-number concurrency (atomic counter)");
  {
    const N = 20;
    const batch = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        api("POST", "/api/admin/field-quotes", {
          body: quoteBody({ customerName: `Párhuzamos ${i}` }),
        }),
      ),
    );
    for (const r of batch) if (r.json?.id) created.push(r.json.id);
    const numbers = batch.map((r) => r.json?.number).filter(Boolean);
    check(
      `${N} parallel creates all succeeded`,
      batch.every((r) => r.status === 201),
      batch.map((r) => r.status).join(","),
    );
    check(
      "all numbers distinct (no duplicates)",
      new Set(numbers).size === numbers.length,
      numbers.join(","),
    );
    const dup = d1(
      `SELECT number, COUNT(*) AS c FROM field_quotes WHERE id = root_id GROUP BY number HAVING c > 1`,
    );
    check(
      "DB-level check: no two root quotes share a number",
      dup.length === 0,
      JSON.stringify(dup),
    );
  }

  // =========================================================================
  section("16. Public (decide-later) sign flow + decline flow");
  {
    const q = await createQuote({ surveyNote: "BELSO-X" });
    const pl = await api("POST", `/api/admin/field-quotes/${q.json.id}/public-link`, { body: {} });
    const t = pl.json.token;
    const ps = await api("POST", `/api/field-quotes/public/${t}/signature`, {
      auth: false,
      body: sigBody(),
    });
    check(
      "customer signs through the secure link -> 200",
      ps.status === 200,
      `status ${ps.status} ${ps.text.slice(0, 100)}`,
    );
    const ps2 = await api("POST", `/api/field-quotes/public/${t}/signature`, {
      auth: false,
      body: sigBody(),
    });
    check("second public signature -> 409", ps2.status === 409, `status ${ps2.status}`);
    const adm = (await api("GET", `/api/admin/field-quotes/${q.json.id}`)).json;
    check("admin sees it SIGNED", adm?.status === "SIGNED");
    const pdf = await bin(ps.json?.pdfUrl ?? "/x", { auth: false });
    check(
      "customer can download their own signed PDF via the link",
      pdf.status === 200 && pdf.type === "application/pdf",
      `status ${pdf.status}`,
    );
    const ev = d1(
      `SELECT actor FROM field_quote_events WHERE field_quote_id = '${q.json.id}' AND event_type = 'signature_recorded'`,
    )[0];
    check(
      "audit log records the customer as the signing actor",
      ev?.actor === "customer",
      JSON.stringify(ev),
    );

    const q2 = await createQuote();
    const dc = await api("POST", `/api/admin/field-quotes/${q2.json.id}/decline`, {
      body: { reason: "Túl magas ár" },
    });
    check("decline (DRAFT) -> 200", dc.status === 200, `status ${dc.status}`);
    const lst = (await api("GET", "/api/admin/field-quotes?status=DECLINED")).json?.items ?? [];
    check(
      "declined quote listed under the DECLINED filter with its reason",
      lst.some((x) => x.id === q2.json.id && x.declineReason === "Túl magas ár"),
    );
    const signDeclined = await api("POST", `/api/admin/field-quotes/${q2.json.id}/signature`, {
      body: sigBody(),
    });
    check(
      "a DECLINED quote cannot be signed (409)",
      signDeclined.status === 409,
      `status ${signDeclined.status}`,
    );
  }

  // =========================================================================
  section("17. Catalog / package / template management (create, EDIT, toggle, delete)");
  {
    const mk = await api("POST", "/api/admin/field-quotes/catalog", {
      body: {
        name: "E2E tétel",
        category: "Teszt",
        unit: "db",
        basePrice: 1000,
        vat: 27,
        active: true,
        sortOrder: 99,
      },
    });
    check("catalog item create -> 201", mk.status === 201 && mk.json?.id, `status ${mk.status}`);
    const id = mk.json?.id;
    const ed = await api("POST", "/api/admin/field-quotes/catalog", {
      body: {
        id,
        name: "E2E tétel (módosított)",
        category: "Teszt",
        unit: "m²",
        basePrice: 2500,
        vat: 27,
        active: true,
        sortOrder: 99,
      },
    });
    check(
      "catalog item EDIT (same id) persists new name/unit/price",
      ed.status === 201 &&
        ed.json?.name === "E2E tétel (módosított)" &&
        ed.json?.unit === "m²" &&
        ed.json?.basePrice === 2500,
      `status ${ed.status}`,
    );
    const used = await createQuote({
      items: [{ catalogItemId: id, name: "x", qty: 2, unit: "db", unitPrice: 1, vat: 5 }],
    });
    check(
      "edited catalog price flows into new quotes (2 x 2500)",
      used.json?.items?.[0]?.unitPrice === 2500 && used.json?.items?.[0]?.unit === "m²",
    );
    await api("POST", "/api/admin/field-quotes/catalog", {
      body: {
        id,
        name: "E2E tétel (módosított)",
        category: "Teszt",
        unit: "m²",
        basePrice: 2500,
        vat: 27,
        active: false,
        sortOrder: 99,
      },
    });
    const sr = await api(
      "GET",
      `/api/admin/field-quotes/catalog/search?q=${encodeURIComponent("E2E tétel")}`,
    );
    check(
      "deactivated item no longer appears in quote-time search",
      !sr.json?.items?.some((i) => i.id === id),
    );
    const all = await api("GET", "/api/admin/field-quotes/catalog");
    check(
      "...but is still listed (inactive) on the management screen",
      all.json?.items?.some((i) => i.id === id && i.active === false),
    );
    const pkg = await api("POST", "/api/admin/field-quotes/packages", {
      body: {
        name: "E2E csomag",
        active: true,
        sortOrder: 99,
        items: [{ catalogItemId: id, defaultQty: 3, sortOrder: 0 }],
      },
    });
    check("package create -> 201", pkg.status === 201, `status ${pkg.status}`);
    const pk = (await api("GET", "/api/admin/field-quotes/packages")).json?.items?.find(
      (p) => p.name === "E2E csomag",
    );
    check(
      "package lists its items with default quantity",
      pk?.items?.[0]?.catalogItemId === id && pk.items[0].defaultQty === 3,
    );
    const ghost = await api("POST", "/api/admin/field-quotes/catalog", {
      body: {
        id: "does-not-exist",
        name: "x",
        category: "x",
        unit: "db",
        basePrice: 1,
        vat: 27,
        active: true,
        sortOrder: 0,
      },
    });
    check(
      "editing an unknown catalog id -> 404 (not a 500)",
      ghost.status === 404,
      `status ${ghost.status}`,
    );
    const delUsed = await api("DELETE", `/api/admin/field-quotes/catalog/${id}`);
    check(
      "deleting a catalog item that a package still lists works (200, no FK error)",
      delUsed.status === 200,
      `status ${delUsed.status} ${delUsed.text.slice(0, 100)}`,
    );
    const pkAfter = (await api("GET", "/api/admin/field-quotes/packages")).json?.items?.find(
      (p) => p.id === pk?.id,
    );
    check(
      "...and the item has left that package",
      Boolean(pkAfter) && pkAfter.items.every((i) => i.catalogItemId !== id),
    );
    if (pk) await api("DELETE", `/api/admin/field-quotes/packages/${pk.id}`);
    const cfg = await api("PUT", "/api/admin/field-quotes/settings", {
      body: { maxDiscountPercent: 150, defaultValidityDays: 14, acceptanceStatement: "x" },
    });
    check(
      "settings validation rejects maxDiscountPercent 150 (400)",
      cfg.status === 400,
      `status ${cfg.status}`,
    );
  }

  // =========================================================================
  section("18. One corrupt record must not take down the whole list");
  {
    d1(
      `INSERT INTO field_quotes (id, number, version, root_id, status, customer_name, customer_phone, discount_value, acceptance_text, surveyor_admin_id, created_at, updated_at) VALUES ('e2e-corrupt','HJA-E2E-CORRUPT',1,'e2e-corrupt','DRAFT','Hibás Rekord','000',0,'','${adminId}','nem-szam','nem-szam')`,
    );
    const l = await api("GET", "/api/admin/field-quotes");
    check(
      "list still 200 with a corrupt row present",
      l.status === 200 && Array.isArray(l.json?.items),
      `status ${l.status} ${l.text.slice(0, 100)}`,
    );
    check("healthy quotes still listed next to it", (l.json?.items?.length ?? 0) > 3);
    const d = await api("GET", "/api/admin/field-quotes/dashboard");
    check("dashboard still 200 with a corrupt row present", d.status === 200, `status ${d.status}`);
  }

  // =========================================================================
  section("19. Public quote-request wizard backend: photos + idempotent submit");
  {
    const lead = (over = {}) => ({
      id: `e2e-lead-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      createdAt: "ez-nem-datum",
      name: "E2E Lead",
      phone: "+36 30 555 0101",
      email: "e2e-lead@example.com",
      city: "Szolnok",
      zip: "5000",
      street: "Teszt u. 1.",
      service: "tetofedes",
      urgency: "honapon-belul",
      status: "uj",
      source: "reszletes-ajanlatkero",
      owner: "Nincs hozzárendelve",
      message: `E2E üzenet ${Date.now()}`,
      files: [],
      notes: [],
      timeline: [],
      ...over,
    });
    d1(
      `DELETE FROM auth_attempts WHERE key IN ('${sha256("lead\nlocal")}','${sha256("lead-media\nlocal")}')`,
    );

    const m1 = await api("POST", "/api/leads/media", {
      auth: false,
      body: PNG,
      headers: { "content-type": "image/png" },
    });
    check(
      "public photo upload -> 201 + /api/media url",
      m1.status === 201 && /^\/api\/media\/media\/lead-uploads\//.test(m1.json?.url ?? ""),
      `status ${m1.status} ${m1.text.slice(0, 100)}`,
    );
    const back = await bin(m1.json?.url ?? "/x", { auth: false });
    check(
      "uploaded lead photo readable back with the real bytes",
      back.status === 200 && back.type === "image/png" && back.bytes.length === PNG.length,
      `status ${back.status}`,
    );
    const m2 = await api("POST", "/api/leads/media", {
      auth: false,
      body: PNG,
      headers: { "content-type": "image/jpeg" },
    });
    const m3 = await api("POST", "/api/leads/media", {
      auth: false,
      body: PNG,
      headers: { "content-type": "image/webp" },
    });
    check(
      "several photos in one wizard run -> distinct stored objects",
      new Set([m1.json?.url, m2.json?.url, m3.json?.url]).size === 3 &&
        m2.status === 201 &&
        m3.status === 201,
    );
    const bad = await api("POST", "/api/leads/media", {
      auth: false,
      body: PNG,
      headers: { "content-type": "application/x-msdownload" },
    });
    check("dangerous MIME type rejected (415)", bad.status === 415, `status ${bad.status}`);
    const htmlAsJpeg = await api("POST", "/api/leads/media", {
      auth: false,
      body: new TextEncoder().encode("<html><script>alert(1)</script></html>"),
      headers: { "content-type": "image/jpeg" },
    });
    check(
      "HTML labelled image/jpeg is refused on the public endpoint (415)",
      htmlAsJpeg.status === 415,
      `status ${htmlAsJpeg.status}`,
    );
    const mislabelled = await bin(m2.json?.url ?? "/x", { auth: false });
    check(
      "a PNG sent as image/jpeg is stored and served as the PNG it really is",
      mislabelled.status === 200 && mislabelled.type === "image/png",
      `status ${mislabelled.status} ${mislabelled.type}`,
    );
    const svg = await api("POST", "/api/leads/media", {
      auth: false,
      body: new TextEncoder().encode("<svg onload=alert(1)/>"),
      headers: { "content-type": "image/svg+xml" },
    });
    check(
      "SVG rejected on the public upload endpoint (415)",
      svg.status === 415,
      `status ${svg.status}`,
    );
    const big = await apiOversize("POST", "/api/leads/media", {
      auth: false,
      body: new Uint8Array(9 * 1024 * 1024),
      headers: { "content-type": "image/png" },
    });
    check(
      "oversize photo (9 MB) rejected (413 or connection refused)",
      big.status === 413,
      `status ${big.status}`,
    );

    const L = lead({
      files: [
        {
          id: "f1",
          name: "tető.png",
          size: 70,
          kind: "kep",
          url: m1.json?.url,
          dataUrl: `data:image/png;base64,${PNG_B64}`,
        },
        { id: "f2", name: "terv.pdf", size: 1000, kind: "dokumentum" },
      ],
    });
    createdLeads.push(L.id);
    const s1 = await api("POST", "/api/leads", { auth: false, body: L });
    check(
      "lead submit -> 201",
      s1.status === 201 && s1.json?.id === L.id,
      `status ${s1.status} ${s1.text.slice(0, 100)}`,
    );
    const stored = d1(`SELECT created_at, payload FROM leads WHERE id = '${L.id}'`)[0];
    const payload = JSON.parse(stored?.payload ?? "{}");
    check(
      "photo URL is linked to the lead; the base64 preview is NOT stored",
      payload.files?.[0]?.url === m1.json?.url && !JSON.stringify(payload).includes("base64"),
      JSON.stringify(payload.files).slice(0, 160),
    );
    check(
      "createdAt is stamped by the server (client value ignored)",
      /^\d{4}-\d{2}-\d{2}T/.test(stored?.created_at ?? "") &&
        payload.createdAt === stored?.created_at,
      stored?.created_at,
    );

    const s2 = await api("POST", "/api/leads", { auth: false, body: L });
    check(
      "same submission id again (refresh / double click) -> accepted, flagged duplicate",
      (s2.status === 200 || s2.status === 201) &&
        s2.json?.duplicate === true &&
        s2.json?.id === L.id,
      `status ${s2.status} ${s2.text.slice(0, 100)}`,
    );
    const rows = d1(`SELECT COUNT(*) AS n FROM leads WHERE id = '${L.id}'`)[0]?.n;
    check("exactly ONE lead row for that id", rows === 1, String(rows));

    const Lb = lead({
      phone: L.phone,
      email: L.email,
      service: L.service,
      city: L.city,
      message: L.message,
    });
    createdLeads.push(Lb.id);
    const s3 = await api("POST", "/api/leads", { auth: false, body: Lb });
    check(
      "identical content under a NEW id within minutes (stale client / lost response) -> deduplicated to the first lead",
      s3.json?.duplicate === true && s3.json?.id === L.id,
      `status ${s3.status} ${s3.text.slice(0, 120)}`,
    );
    const sameContent = d1(
      `SELECT COUNT(*) AS n FROM leads WHERE json_extract(payload,'$.message') = '${L.message.replace(/'/g, "''")}'`,
    )[0]?.n;
    check("still exactly one stored lead for that content", sameContent === 1, String(sameContent));

    const Lc = lead();
    createdLeads.push(Lc.id);
    const s4 = await api("POST", "/api/leads", { auth: false, body: Lc });
    check(
      "a genuinely different request is stored normally (201)",
      s4.status === 201 && s4.json?.duplicate !== true,
      `status ${s4.status}`,
    );
    const parallel = lead();
    createdLeads.push(parallel.id);
    const [p1, p2] = await Promise.all([
      api("POST", "/api/leads", { auth: false, body: parallel }),
      api("POST", "/api/leads", { auth: false, body: parallel }),
    ]);
    const pn = d1(`SELECT COUNT(*) AS n FROM leads WHERE id = '${parallel.id}'`)[0]?.n;
    check(
      "two truly simultaneous identical submits -> one row, both answered OK",
      pn === 1 && p1.status < 300 && p2.status < 300,
      `rows ${pn} statuses ${p1.status},${p2.status}`,
    );
    const lAdmin = await api("GET", "/api/admin/state");
    check(
      "new lead visible to the admin via the state endpoint",
      lAdmin.status === 200 && lAdmin.json?.leads?.some((x) => x.id === L.id),
    );
    const delWithPhoto = await api("DELETE", `/api/admin/leads/${L.id}`);
    check("admin deletes a lead that has photos -> 200", delWithPhoto.status === 200);
    const gonePhoto = await bin(m1.json?.url ?? "/x", { auth: false });
    check(
      "the deleted lead's uploaded photo is gone from R2 too (404)",
      gonePhoto.status === 404,
      `status ${gonePhoto.status}`,
    );
    const otherPhoto = await bin(m2.json?.url ?? "/x", { auth: false });
    check(
      "photos that belong to no deleted lead are untouched",
      otherPhoto.status === 200,
      `status ${otherPhoto.status}`,
    );
    const del = await api("DELETE", `/api/admin/leads/${Lc.id}`);
    check(
      "admin lead delete works (and needs a session)",
      del.status === 200 &&
        (await api("DELETE", `/api/admin/leads/${Lb.id}`, { auth: false })).status === 401,
    );
  }

  // =========================================================================
  section("20. Munkák (jobs): created only from a SIGNED quote, idempotent, audited");
  {
    const unauth = await api("GET", "/api/admin/jobs", { auth: false });
    check("job list needs a session (401)", unauth.status === 401, `status ${unauth.status}`);
    const unauthPost = await api("POST", "/api/admin/jobs", {
      auth: false,
      body: { fieldQuoteId: "x" },
    });
    check(
      "creating a job needs a session (401)",
      unauthPost.status === 401,
      `status ${unauthPost.status}`,
    );

    const draft = await createQuote();
    const fromDraft = await api("POST", "/api/admin/jobs", {
      body: { fieldQuoteId: draft.json.id },
    });
    check(
      "a job cannot start from an unsigned quote (409)",
      fromDraft.status === 409,
      `status ${fromDraft.status} ${fromDraft.text.slice(0, 100)}`,
    );
    const ghost = await api("POST", "/api/admin/jobs", {
      body: { fieldQuoteId: "nincs-ilyen-ajanlat" },
    });
    check("unknown quote -> 404", ghost.status === 404, `status ${ghost.status}`);
    const noBody = await api("POST", "/api/admin/jobs", { body: {} });
    check("missing quote id -> 400", noBody.status === 400, `status ${noBody.status}`);

    // a signed quote to start from
    const q = await createQuote({ customerName: "Munka Teszt" });
    const signed = await api("POST", `/api/admin/field-quotes/${q.json.id}/signature`, {
      body: sigBody(),
    });
    check("(setup) quote signed", signed.status === 200, `status ${signed.status}`);
    const snap = JSON.parse(
      d1(
        `SELECT document_snapshot FROM field_quote_signatures WHERE field_quote_id = '${q.json.id}'`,
      )[0]?.document_snapshot ?? "{}",
    );

    const made = await api("POST", "/api/admin/jobs", { body: { fieldQuoteId: q.json.id } });
    check(
      "job from a SIGNED quote -> 201 created",
      made.status === 201 && made.json?.created === true,
      `status ${made.status} ${made.text.slice(0, 120)}`,
    );
    const job = made.json?.job ?? {};
    check("job starts in PREPARATION", job.status === "PREPARATION");
    check(
      "contract amount comes from the signed snapshot (gross), not the client",
      job.contractAmount === snap.totals?.gross && job.contractAmount > 0,
      `${job.contractAmount} vs ${snap.totals?.gross}`,
    );
    check(
      "customer + address + quote link copied from the signed quote",
      job.customerName === "Munka Teszt" &&
        job.address === "5000 Szolnok Teszt utca 1." &&
        job.fieldQuoteId === q.json.id &&
        job.quoteNumber === q.json.number,
      JSON.stringify({ n: job.customerName, a: job.address }),
    );
    check(
      "signed PDF is reachable from the job (pdfKey)",
      typeof job.pdfKey === "string" && job.pdfKey.includes("/pdf/"),
    );

    const again = await api("POST", "/api/admin/jobs", { body: { fieldQuoteId: q.json.id } });
    check(
      "creating it again returns the SAME job (200, created:false)",
      again.status === 200 && again.json?.created === false && again.json?.job?.id === job.id,
      `status ${again.status}`,
    );

    // two truly simultaneous creates for another signed quote -> exactly one job
    const q2 = await createQuote({ customerName: "Munka Verseny" });
    await api("POST", `/api/admin/field-quotes/${q2.json.id}/signature`, { body: sigBody() });
    const [r1, r2] = await Promise.all([
      api("POST", "/api/admin/jobs", { body: { fieldQuoteId: q2.json.id } }),
      api("POST", "/api/admin/jobs", { body: { fieldQuoteId: q2.json.id } }),
    ]);
    const jobRows = d1(`SELECT COUNT(*) AS n FROM jobs WHERE field_quote_id = '${q2.json.id}'`)[0]
      ?.n;
    check(
      "two simultaneous creates -> exactly ONE job row, both answered OK",
      jobRows === 1 && r1.status < 300 && r2.status < 300 && r1.json?.job?.id === r2.json?.job?.id,
      `rows ${jobRows} statuses ${r1.status},${r2.status}`,
    );

    const got = await api("GET", `/api/admin/jobs/${job.id}`);
    check(
      "job readable with its event log",
      got.status === 200 && got.json?.events?.some((e) => e.eventType === "created"),
      `status ${got.status}`,
    );

    const upd = await api("PUT", `/api/admin/jobs/${job.id}`, {
      body: {
        status: "IN_PROGRESS",
        plannedStart: "2026-11-02",
        internalNote: "Állvány hétfőn.",
        workType: "Tetőfedés",
      },
    });
    check(
      "status / planned start / note update -> 200",
      upd.status === 200 &&
        upd.json?.job?.status === "IN_PROGRESS" &&
        upd.json?.job?.plannedStart === "2026-11-02" &&
        upd.json?.job?.internalNote === "Állvány hétfőn.",
      `status ${upd.status} ${upd.text.slice(0, 120)}`,
    );
    check(
      "the status change is in the audit log",
      upd.json?.events?.some(
        (e) => e.eventType === "status_changed" && /Előkészítés → Folyamatban/.test(e.detail ?? ""),
      ),
      JSON.stringify(upd.json?.events?.[0]),
    );
    const noop = await api("PUT", `/api/admin/jobs/${job.id}`, { body: { status: "IN_PROGRESS" } });
    const evCount = (await api("GET", `/api/admin/jobs/${job.id}`)).json?.events?.length;
    check(
      "saving the same values again logs nothing new",
      noop.status === 200 && evCount === upd.json?.events?.length,
      `${evCount} vs ${upd.json?.events?.length}`,
    );
    const cleared = await api("PUT", `/api/admin/jobs/${job.id}`, { body: { plannedStart: null } });
    check(
      "planned start can be cleared",
      cleared.status === 200 && !cleared.json?.job?.plannedStart,
    );

    const badStatus = await api("PUT", `/api/admin/jobs/${job.id}`, {
      body: { status: "TOTALLY_DONE" },
    });
    check("unknown status -> 400", badStatus.status === 400, `status ${badStatus.status}`);
    const badDate = await api("PUT", `/api/admin/jobs/${job.id}`, {
      body: { plannedStart: "holnap" },
    });
    check("malformed date -> 400", badDate.status === 400, `status ${badDate.status}`);
    const empty = await api("PUT", `/api/admin/jobs/${job.id}`, { body: {} });
    check("empty update -> 400", empty.status === 400, `status ${empty.status}`);
    const other = await api("PUT", "/api/admin/jobs/nincs-ilyen-munka", {
      body: { status: "CLOSED" },
    });
    check("updating an unknown job -> 404", other.status === 404, `status ${other.status}`);
    const csrf = await api("PUT", `/api/admin/jobs/${job.id}`, {
      body: { status: "CLOSED" },
      headers: { origin: "https://evil.example" },
    });
    check("cross-origin write is refused (403)", csrf.status === 403, `status ${csrf.status}`);
    const stillOpen = (await api("GET", `/api/admin/jobs/${job.id}`)).json?.job?.status;
    check("...and changed nothing", stillOpen === "IN_PROGRESS", stillOpen);

    const del = await api("DELETE", `/api/admin/jobs/${job.id}`);
    check(
      "jobs have no delete endpoint (a finished job is closed, never erased)",
      del.status === 404 || del.status === 405,
      `status ${del.status}`,
    );

    const listed = await api("GET", "/api/admin/jobs?status=IN_PROGRESS");
    check(
      "status filter lists it",
      listed.status === 200 &&
        listed.json?.items?.some((j) => j.id === job.id) &&
        listed.json.items.every((j) => j.status === "IN_PROGRESS"),
    );
    const v2 = await api("POST", `/api/admin/field-quotes/${q.json.id}/new-version`, {});
    if (v2.json?.id) created.push(v2.json.id);
    const afterVersion = await api("GET", `/api/admin/jobs/${job.id}`);
    check(
      "creating a new quote version leaves the job untouched",
      v2.status === 201 &&
        afterVersion.status === 200 &&
        afterVersion.json?.job?.fieldQuoteId === q.json.id,
      `v2 ${v2.status}`,
    );
  }
} finally {
  // ---- cleanup: only rows this run created ----
  try {
    const ids = [...created, "e2e-corrupt"].map((i) => `'${i}'`).join(",");
    if (created.length || true) {
      d1(
        `DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE field_quote_id IN (${ids}))`,
      );
      d1(`DELETE FROM jobs WHERE field_quote_id IN (${ids})`);
      d1(`DELETE FROM field_quote_events WHERE field_quote_id IN (${ids})`);
      d1(`DELETE FROM field_quote_signatures WHERE field_quote_id IN (${ids})`);
      d1(`DELETE FROM field_quote_photos WHERE field_quote_id IN (${ids})`);
      d1(`DELETE FROM field_quote_items WHERE field_quote_id IN (${ids})`);
      d1(`DELETE FROM field_quotes WHERE id IN (${ids})`);
    }
    if (createdLeads.length)
      d1(`DELETE FROM leads WHERE id IN (${createdLeads.map((i) => `'${i}'`).join(",")})`);
  } catch (error) {
    console.error("cleanup failed:", error.message);
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(` - ${f.name}${f.detail ? `  -> ${f.detail}` : ""}`);
  process.exit(1);
}
