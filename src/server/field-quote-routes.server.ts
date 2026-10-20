import {
  apiError,
  authenticate,
  json,
  loadSiteSettings,
  readJson,
  sameOrigin,
} from "./backend.server";
import { describeError } from "@/lib/error-capture";
import { effectiveDiscountPercent } from "@/lib/field-quote-calc";
import { buildDocumentSnapshot, sha256Hex, type SellerIdentity } from "./field-quote-snapshot";
import {
  checkImageUploadHeaders,
  readCompletePng,
  readImageUploadBody,
} from "./image-upload.server";
import {
  addFieldQuotePhoto,
  computeTotals,
  createNewFieldQuoteVersion,
  declineFieldQuote,
  generatePublicToken,
  getFieldQuoteDashboardStats,
  listFieldQuotes,
  loadFieldQuote,
  loadFieldQuoteByToken,
  logFieldQuoteEvent,
  recordFieldQuoteSignature,
  removeFieldQuotePhoto,
  saveFieldQuote,
  setFieldQuoteStatus,
} from "./field-quote.server";
import {
  deleteCatalogItem,
  deletePackage,
  deletePaymentTemplate,
  getCatalogItemsByIds,
  getFieldQuoteSettings,
  listCatalogItems,
  listPackages,
  listPaymentTemplates,
  saveCatalogItem,
  saveFieldQuoteSettings,
  savePackage,
  savePaymentTemplate,
  searchCatalogItems,
} from "./quote-catalog.server";
import {
  catalogItemSaveSchema,
  fieldQuoteDeclineSchema,
  fieldQuoteSaveSchema,
  fieldQuoteSettingsSchema,
  fieldQuoteSignatureSchema,
  fieldQuoteStatusSchema,
  packageSaveSchema,
  paymentTemplateSaveSchema,
} from "./field-quote-validation.server";
import type { FieldQuote } from "@/demo/field-quote-types";

const FQ_PREFIX = "field-quotes/";
const ID = "[a-zA-Z0-9-]{1,80}";
const TOKEN = "[a-f0-9]{48}";

const RE_LIST = /^\/api\/admin\/field-quotes$/;
const RE_DASHBOARD = /^\/api\/admin\/field-quotes\/dashboard$/;
const RE_CATALOG = /^\/api\/admin\/field-quotes\/catalog$/;
const RE_CATALOG_SEARCH = /^\/api\/admin\/field-quotes\/catalog\/search$/;
const RE_CATALOG_ID = new RegExp(`^/api/admin/field-quotes/catalog/(${ID})$`);
const RE_PACKAGES = /^\/api\/admin\/field-quotes\/packages$/;
const RE_PACKAGE_ID = new RegExp(`^/api/admin/field-quotes/packages/(${ID})$`);
const RE_TEMPLATES = /^\/api\/admin\/field-quotes\/payment-templates$/;
const RE_TEMPLATE_ID = new RegExp(`^/api/admin/field-quotes/payment-templates/(${ID})$`);
const RE_SETTINGS = /^\/api\/admin\/field-quotes\/settings$/;
const RE_MEDIA = /^\/api\/admin\/field-quotes\/media\/(.+)$/;
const RE_QUOTE_ID = new RegExp(`^/api/admin/field-quotes/(${ID})$`);
const RE_QUOTE_STATUS = new RegExp(`^/api/admin/field-quotes/(${ID})/status$`);
const RE_QUOTE_NEW_VERSION = new RegExp(`^/api/admin/field-quotes/(${ID})/new-version$`);
const RE_QUOTE_PHOTOS = new RegExp(`^/api/admin/field-quotes/(${ID})/photos$`);
const RE_QUOTE_PHOTO_ID = new RegExp(`^/api/admin/field-quotes/(${ID})/photos/(${ID})$`);
const RE_QUOTE_SIGNATURE = new RegExp(`^/api/admin/field-quotes/(${ID})/signature$`);
const RE_QUOTE_DECLINE = new RegExp(`^/api/admin/field-quotes/(${ID})/decline$`);
const RE_QUOTE_PUBLIC_LINK = new RegExp(`^/api/admin/field-quotes/(${ID})/public-link$`);

const RE_PUBLIC_QUOTE = new RegExp(`^/api/field-quotes/public/(${TOKEN})$`);
const RE_PUBLIC_SIGNATURE = new RegExp(`^/api/field-quotes/public/(${TOKEN})/signature$`);
const RE_PUBLIC_DECLINE = new RegExp(`^/api/field-quotes/public/(${TOKEN})/decline$`);
const RE_PUBLIC_MEDIA = new RegExp(`^/api/field-quotes/public/(${TOKEN})/media/(.+)$`);

function safeKey(raw: string, requiredPrefix: string): string | null {
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!key.startsWith(requiredPrefix) || key.includes("..") || !/^[a-zA-Z0-9/_\-.]+$/.test(key))
    return null;
  return key;
}

async function serveFieldQuoteMedia(
  key: string,
  env: Env,
  cache: "private" | "public",
): Promise<Response> {
  const object = await env.MEDIA.get(key);
  if (!object || !("body" in object)) return apiError(404, "A fájl nem található.");
  const headers = new Headers({
    ETag: object.httpEtag,
    "Cache-Control":
      cache === "private" ? "private, max-age=0, must-revalidate" : "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "script-src 'none'",
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

// Fields an admin sees but a customer in "ügyfél mód" (or on the public
// decide-later link) must never receive: internal survey/lead notes, the
// discount-cap override trail, the CRM lead linkage, and the token itself.
function toCustomerSafeQuote(quote: FieldQuote) {
  const {
    surveyNote: _surveyNote,
    customerNote: _customerNote,
    discountOverCapApprovedBy: _cap,
    leadId: _leadId,
    publicToken: _token,
    publicTokenExpiresAt: _tokenExp,
    signatureKey: _sigKey,
    ...safe
  } = quote;
  return safe;
}

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

async function uploadFieldQuotePhoto(
  request: Request,
  env: Env,
  fieldQuoteId: string,
  actor: string,
): Promise<Response> {
  const headerCheck = checkImageUploadHeaders(request, MAX_PHOTO_BYTES);
  if ("error" in headerCheck) return apiError(headerCheck.error.status, headerCheck.error.message);
  const rawCaption = request.headers.get("x-photo-caption") ?? "";
  let decodedCaption = "";
  try {
    decodedCaption = decodeURIComponent(rawCaption);
  } catch {
    decodedCaption = rawCaption;
  }
  const caption = decodedCaption.slice(0, 300).trim() || undefined;

  const quote = await loadFieldQuote(env.DB, fieldQuoteId);
  if (!quote) return apiError(404, "A helyszíni ajánlat nem található.");
  if (quote.status === "SIGNED") return apiError(409, "Aláírt ajánlathoz nem adható új fénykép.");

  // Only now is the body read: a missing/signed quote is refused above
  // without buffering anything.
  const upload = await readImageUploadBody(request, MAX_PHOTO_BYTES);
  if ("error" in upload) return apiError(upload.error.status, upload.error.message);
  const { bytes, mime, extension } = upload.image;

  const key = `${FQ_PREFIX}${fieldQuoteId}/photos/${crypto.randomUUID()}.${extension}`;
  const stored = await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
  if (!stored) return apiError(500, "A fénykép mentése nem sikerült.");
  const photoId = await addFieldQuotePhoto(env.DB, fieldQuoteId, key, caption, actor);
  return json(
    { ok: true, photoId, key, url: `/api/admin/field-quotes/media/${key}` },
    { status: 201 },
  );
}

function truncatedUserAgent(request: Request): string {
  return (request.headers.get("user-agent") ?? "unknown").slice(0, 200);
}

// "%PDF-" header and an end-of-file marker near the tail — rejects arbitrary
// bytes and truncated uploads. (The PDF is client-rendered and not trusted as
// the legal record; the server-built snapshot + hash is. This only keeps
// junk out of storage.)
function looksLikeCompletePdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 5));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  return head === "%PDF-" && tail.includes("%%EOF");
}

function decodeBase64(value: string, maxBytes: number): Uint8Array | null {
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
    return bytes;
  } catch {
    return null;
  }
}

// The PDF is rendered in the browser (pdf-lib has no Node-native
// dependencies but its tslib CJS interop breaks inside the Workers runtime
// when bundled server-side — confirmed by a runtime crash, not a build
// error). The client builds it from data it just fetched from this same
// server, so the rendered numbers always match; `document_snapshot` below,
// computed here from the server's own authoritative quote, remains the
// actual legal record regardless of what the PDF rendering shows.
async function performFieldQuoteSignature(
  env: Env,
  quote: FieldQuote,
  signatureDataUrl: string,
  pdfBase64: string,
  actor: string,
  auditTag: string,
): Promise<{ pdfKey: string }> {
  if (quote.status === "SIGNED") throw new Error("ALREADY_SIGNED");
  if (quote.status === "DECLINED" || quote.status === "EXPIRED" || quote.status === "CANCELLED") {
    throw new Error("NOT_SIGNABLE");
  }
  const match = /^data:image\/png;base64,(.+)$/.exec(signatureDataUrl);
  if (!match || !match[1]) throw new Error("INVALID_SIGNATURE_IMAGE");
  const pngBytes = decodeBase64(match[1], 1_500_000);
  // The data-URL prefix proves nothing — the bytes must be a complete PNG.
  if (!pngBytes || !readCompletePng(pngBytes)) throw new Error("INVALID_SIGNATURE_IMAGE");

  const pdfBytes = decodeBase64(pdfBase64, 6_000_000);
  if (!pdfBytes || !looksLikeCompletePdf(pdfBytes)) throw new Error("INVALID_PDF");

  const totals = computeTotals(quote.items, quote.discountType, quote.discountValue);
  const signedAtIso = new Date().toISOString();
  const signedAtText = new Date(signedAtIso).toLocaleString("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const sigKey = `${FQ_PREFIX}${quote.id}/signatures/${crypto.randomUUID()}.png`;
  const pdfKey = `${FQ_PREFIX}${quote.id}/pdf/v${quote.version}-${crypto.randomUUID()}.pdf`;
  await env.MEDIA.put(sigKey, pngBytes, { httpMetadata: { contentType: "image/png" } });
  await env.MEDIA.put(pdfKey, pdfBytes, { httpMetadata: { contentType: "application/pdf" } });

  const settings = await loadSiteSettings(env);
  const seller: SellerIdentity = {
    name: settings.company,
    address: settings.address,
    taxNumber: settings.taxNumber,
    phone: settings.phone,
    email: settings.email,
  };
  const snapshot = buildDocumentSnapshot(quote, totals, signedAtIso, seller);
  const documentHash = await sha256Hex(snapshot);
  try {
    await recordFieldQuoteSignature(
      env.DB,
      quote.id,
      sigKey,
      pdfKey,
      quote.acceptanceText,
      snapshot,
      quote.surveyorAdminId,
      actor,
      quote.number,
      quote.version,
      documentHash,
    );
  } catch (error) {
    // The loser of a double-sign race (or any database failure) must not
    // leave its uploaded signature/PDF behind in R2.
    await env.MEDIA.delete([sigKey, pdfKey]).catch(() => undefined);
    throw error;
  }
  await logFieldQuoteEvent(env.DB, quote.id, "signed_device", actor, auditTag);

  return { pdfKey };
}

// The browser sends whatever price it last saw for a catalog item, which
// may be stale (someone edited the catalog) or, in principle, tampered
// with. For any item that references a catalog entry, the server — not the
// client — decides the actual price/VAT, the same hard guarantee the
// existing (legacy) quote system already makes. Items with no
// catalogItemId (custom line items) are left as the admin entered them,
// and a catalogItemId that no longer resolves (deleted catalog entry) is
// treated the same as a custom item rather than blocking the save.
async function applyAuthoritativeCatalogPricing<
  T extends { catalogItemId?: string | undefined; unitPrice: number; vat: number; unit: string },
>(env: Env, items: T[]): Promise<T[]> {
  const ids = items.map((i) => i.catalogItemId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return items;
  const catalog = await getCatalogItemsByIds(env.DB, ids);
  return items.map((item) => {
    const match = item.catalogItemId ? catalog.get(item.catalogItemId) : undefined;
    if (!match) return item;
    return { ...item, unitPrice: match.basePrice, vat: match.vat, unit: match.unit };
  });
}

// A percent-type discount is checked directly; a fixed-amount discount is
// converted to its equivalent percent-of-net so both discount styles share
// the same cap. Returns null when within the cap (or no override needed).
async function discountCapError(
  env: Env,
  items: { qty: number; unitPrice: number; vat: number }[],
  discountType: "percent" | "fixed" | undefined,
  discountValue: number,
  overrideApprovedBy: string | undefined,
): Promise<Response | null> {
  if (!discountType || discountValue <= 0) return null;
  if (overrideApprovedBy && overrideApprovedBy.trim().length > 0) return null;
  const settings = await getFieldQuoteSettings(env.DB);
  // Same helper the editor uses, so the UI warning and this server check can
  // never disagree about whether a discount is over the cap.
  const effectivePercent = effectiveDiscountPercent(items, discountType, discountValue);
  if (effectivePercent <= settings.maxDiscountPercent) return null;
  return apiError(
    409,
    `A kedvezmény (${effectivePercent.toFixed(1)}%) meghaladja az engedélyezett ${settings.maxDiscountPercent}%-os limitet. Jóváhagyás szükséges a mentéshez.`,
  );
}

function signatureErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "ALREADY_SIGNED") return apiError(409, "Ez az ajánlat már alá van írva.");
  if (message === "NOT_SIGNABLE")
    return apiError(409, "Ez az ajánlat jelen állapotában nem írható alá.");
  if (message === "INVALID_SIGNATURE_IMAGE") return apiError(400, "Az aláírás képe érvénytelen.");
  if (message === "INVALID_PDF") return apiError(400, "A dokumentum PDF-je érvénytelen.");
  // field_quote_signatures.field_quote_id is UNIQUE, so two near-simultaneous
  // signature submissions (double-tap, or a retried request after a slow
  // response) can race: both pass the status check above before either has
  // written, and the second INSERT then fails this constraint. No duplicate
  // signature is ever created — this just turns the loser's opaque D1 error
  // into the same clean "already signed" message the status check gives.
  if (message.includes("UNIQUE constraint failed") && message.includes("field_quote_signatures")) {
    return apiError(409, "Ez az ajánlat már alá van írva.");
  }
  console.error(
    JSON.stringify({ event: "field_quote_signature_failed", error: describeError(error) }),
  );
  return apiError(500, "Az aláírás rögzítése nem sikerült.");
}

// ---- Admin (session-cookie authenticated) ----------------------------------

export async function handleFieldQuoteAdminRequest(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/admin/field-quotes")) return null;

  const session = await authenticate(request, env);
  if (!session) return apiError(401, "Bejelentkezés szükséges.");
  const actor = session.admin_id;

  const mediaMatch = RE_MEDIA.exec(url.pathname);
  if (request.method === "GET" && mediaMatch?.[1]) {
    const key = safeKey(mediaMatch[1], FQ_PREFIX);
    if (!key) return apiError(404, "A fájl nem található.");
    return await serveFieldQuoteMedia(key, env, "private");
  }

  if (request.method === "GET" && RE_LIST.test(url.pathname)) {
    const status = url.searchParams.get("status")?.slice(0, 40) || undefined;
    const q = url.searchParams.get("q")?.slice(0, 200) || undefined;
    const items = await listFieldQuotes(env.DB, { status, q });
    return json({ items });
  }
  if (request.method === "POST" && RE_LIST.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = fieldQuoteSaveSchema.safeParse(await readJson(request, 400_000));
    if (!parsed.success) return apiError(400, "Az ajánlat adatai nem megfelelőek.");
    const items = await applyAuthoritativeCatalogPricing(env, parsed.data.items);
    const capError = await discountCapError(
      env,
      items,
      parsed.data.discountType,
      parsed.data.discountValue,
      parsed.data.discountOverCapApprovedBy,
    );
    if (capError) return capError;
    const settings = await getFieldQuoteSettings(env.DB);
    const saved = await saveFieldQuote(
      env.DB,
      { ...parsed.data, items, id: undefined },
      actor,
      settings.acceptanceStatement,
    );
    return json(saved, { status: 201 });
  }

  if (request.method === "GET" && RE_DASHBOARD.test(url.pathname)) {
    return json(await getFieldQuoteDashboardStats(env.DB));
  }

  if (request.method === "GET" && RE_CATALOG_SEARCH.test(url.pathname)) {
    const q = url.searchParams.get("q")?.slice(0, 200) ?? "";
    return json({ items: await searchCatalogItems(env.DB, q) });
  }
  if (request.method === "GET" && RE_CATALOG.test(url.pathname)) {
    return json({ items: await listCatalogItems(env.DB, false) });
  }
  if (request.method === "POST" && RE_CATALOG.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = catalogItemSaveSchema.safeParse(await readJson(request, 50_000));
    if (!parsed.success) return apiError(400, "A tétel adatai nem megfelelőek.");
    try {
      return json(await saveCatalogItem(env.DB, parsed.data), { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "CATALOG_ITEM_NOT_FOUND") {
        return apiError(404, "A katalógustétel nem található.");
      }
      throw error;
    }
  }
  const catalogIdMatch = RE_CATALOG_ID.exec(url.pathname);
  if (request.method === "DELETE" && catalogIdMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    await deleteCatalogItem(env.DB, catalogIdMatch[1]);
    return json({ ok: true });
  }

  if (request.method === "GET" && RE_PACKAGES.test(url.pathname)) {
    return json({ items: await listPackages(env.DB) });
  }
  if (request.method === "POST" && RE_PACKAGES.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = packageSaveSchema.safeParse(await readJson(request, 50_000));
    if (!parsed.success) return apiError(400, "A csomag adatai nem megfelelőek.");
    try {
      await savePackage(env.DB, parsed.data);
    } catch (error) {
      // A listed catalog item that was deleted in the meantime (another tab).
      if (describeError(error).includes("FOREIGN KEY")) {
        return apiError(400, "A csomag olyan tételt tartalmaz, ami már nincs a katalógusban.");
      }
      throw error;
    }
    return json({ ok: true }, { status: 201 });
  }
  const packageIdMatch = RE_PACKAGE_ID.exec(url.pathname);
  if (request.method === "DELETE" && packageIdMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    await deletePackage(env.DB, packageIdMatch[1]);
    return json({ ok: true });
  }

  if (request.method === "GET" && RE_TEMPLATES.test(url.pathname)) {
    return json({ items: await listPaymentTemplates(env.DB) });
  }
  if (request.method === "POST" && RE_TEMPLATES.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = paymentTemplateSaveSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) return apiError(400, "A fizetési sablon adatai nem megfelelőek.");
    await savePaymentTemplate(env.DB, parsed.data);
    return json({ ok: true }, { status: 201 });
  }
  const templateIdMatch = RE_TEMPLATE_ID.exec(url.pathname);
  if (request.method === "DELETE" && templateIdMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    await deletePaymentTemplate(env.DB, templateIdMatch[1]);
    return json({ ok: true });
  }

  if (request.method === "GET" && RE_SETTINGS.test(url.pathname)) {
    return json(await getFieldQuoteSettings(env.DB));
  }
  if (request.method === "PUT" && RE_SETTINGS.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = fieldQuoteSettingsSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) return apiError(400, "A beállítások nem megfelelőek.");
    await saveFieldQuoteSettings(env.DB, parsed.data);
    return json({ ok: true });
  }

  const newVersionMatch = RE_QUOTE_NEW_VERSION.exec(url.pathname);
  if (request.method === "POST" && newVersionMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const newId = await createNewFieldQuoteVersion(env.DB, newVersionMatch[1], actor);
    const created = await loadFieldQuote(env.DB, newId);
    if (!created) return apiError(500, "Az új verzió létrehozása nem sikerült.");
    return json(created, { status: 201 });
  }

  const statusMatch = RE_QUOTE_STATUS.exec(url.pathname);
  if (request.method === "PUT" && statusMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const quote = await loadFieldQuote(env.DB, statusMatch[1]);
    if (!quote) return apiError(404, "A helyszíni ajánlat nem található.");
    if (quote.status === "SIGNED") return apiError(409, "Aláírt ajánlat állapota nem módosítható.");
    const parsed = fieldQuoteStatusSchema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) return apiError(400, "Érvénytelen állapot.");
    await setFieldQuoteStatus(env.DB, statusMatch[1], parsed.data.status, actor);
    return json({ ok: true });
  }

  const photoIdMatch = RE_QUOTE_PHOTO_ID.exec(url.pathname);
  if (request.method === "DELETE" && photoIdMatch?.[1] && photoIdMatch[2]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const [fieldQuoteId, photoId] = [photoIdMatch[1], photoIdMatch[2]];
    const row = await env.DB.prepare(
      `SELECT storage_key FROM field_quote_photos WHERE id = ?1 AND field_quote_id = ?2`,
    )
      .bind(photoId, fieldQuoteId)
      .first<{ storage_key: string }>();
    await removeFieldQuotePhoto(env.DB, photoId, fieldQuoteId, actor);
    if (row?.storage_key) await env.MEDIA.delete(row.storage_key).catch(() => undefined);
    return json({ ok: true });
  }

  const photosMatch = RE_QUOTE_PHOTOS.exec(url.pathname);
  if (request.method === "POST" && photosMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    return await uploadFieldQuotePhoto(request, env, photosMatch[1], actor);
  }

  const signatureMatch = RE_QUOTE_SIGNATURE.exec(url.pathname);
  if (request.method === "POST" && signatureMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = fieldQuoteSignatureSchema.safeParse(await readJson(request, 8_500_000));
    if (!parsed.success) return apiError(400, "Az aláírás adatai nem megfelelőek.");
    const quote = await loadFieldQuote(env.DB, signatureMatch[1]);
    if (!quote) return apiError(404, "A helyszíni ajánlat nem található.");
    try {
      const result = await performFieldQuoteSignature(
        env,
        quote,
        parsed.data.signatureDataUrl,
        parsed.data.pdfBase64,
        actor,
        `admin:${truncatedUserAgent(request)}`,
      );
      return json({ ok: true, pdfUrl: `/api/admin/field-quotes/media/${result.pdfKey}` });
    } catch (error) {
      return signatureErrorResponse(error);
    }
  }

  const declineMatch = RE_QUOTE_DECLINE.exec(url.pathname);
  if (request.method === "POST" && declineMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const quote = await loadFieldQuote(env.DB, declineMatch[1]);
    if (!quote) return apiError(404, "A helyszíni ajánlat nem található.");
    if (quote.status === "SIGNED") return apiError(409, "Aláírt ajánlat nem utasítható el.");
    const parsed = fieldQuoteDeclineSchema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) return apiError(400, "Érvénytelen indoklás.");
    await declineFieldQuote(env.DB, declineMatch[1], parsed.data.reason, actor);
    return json({ ok: true });
  }

  const publicLinkMatch = RE_QUOTE_PUBLIC_LINK.exec(url.pathname);
  if (request.method === "POST" && publicLinkMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const settings = await getFieldQuoteSettings(env.DB);
    const body = (await readJson(request, 2_000).catch(() => ({}))) as { days?: unknown };
    const days =
      typeof body.days === "number" &&
      Number.isFinite(body.days) &&
      body.days > 0 &&
      body.days <= 365
        ? body.days
        : settings.defaultValidityDays;
    const token = await generatePublicToken(env.DB, publicLinkMatch[1], days);
    return json({
      token,
      url: `/ajanlat/${token}`,
      expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
    });
  }

  const quoteIdMatch = RE_QUOTE_ID.exec(url.pathname);
  if (request.method === "GET" && quoteIdMatch?.[1]) {
    const quote = await loadFieldQuote(env.DB, quoteIdMatch[1]);
    if (!quote) return apiError(404, "A helyszíni ajánlat nem található.");
    return json(quote);
  }
  if (request.method === "PUT" && quoteIdMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = fieldQuoteSaveSchema.safeParse(await readJson(request, 400_000));
    if (!parsed.success) return apiError(400, "Az ajánlat adatai nem megfelelőek.");
    const items = await applyAuthoritativeCatalogPricing(env, parsed.data.items);
    const capError = await discountCapError(
      env,
      items,
      parsed.data.discountType,
      parsed.data.discountValue,
      parsed.data.discountOverCapApprovedBy,
    );
    if (capError) return capError;
    try {
      const saved = await saveFieldQuote(
        env.DB,
        { ...parsed.data, items, id: quoteIdMatch[1] },
        actor,
        "",
      );
      return json(saved);
    } catch (error) {
      if (error instanceof Error && error.message === "SIGNED_IMMUTABLE") {
        return apiError(
          409,
          "Az ajánlat már alá van írva, ezért közvetlenül nem módosítható. Készíts új verziót.",
        );
      }
      throw error;
    }
  }

  return apiError(404, "Az API-végpont nem található.");
}

// ---- Public (secure-token gated, no admin session) -------------------------

export async function handleFieldQuotePublicRequest(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/field-quotes/public/")) return null;

  const mediaMatch = RE_PUBLIC_MEDIA.exec(url.pathname);
  if (request.method === "GET" && mediaMatch?.[1] && mediaMatch[2]) {
    const quote = await loadFieldQuoteByToken(env.DB, mediaMatch[1]);
    if (!quote) return apiError(404, "Az ajánlat nem található vagy a link lejárt.");
    const key = safeKey(mediaMatch[2], `${FQ_PREFIX}${quote.id}/`);
    if (!key) return apiError(404, "A fájl nem található.");
    return await serveFieldQuoteMedia(key, env, "private");
  }

  const signatureMatch = RE_PUBLIC_SIGNATURE.exec(url.pathname);
  if (request.method === "POST" && signatureMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const quote = await loadFieldQuoteByToken(env.DB, signatureMatch[1]);
    if (!quote) return apiError(404, "Az ajánlat nem található vagy a link lejárt.");
    const parsed = fieldQuoteSignatureSchema.safeParse(await readJson(request, 8_500_000));
    if (!parsed.success) return apiError(400, "Az aláírás adatai nem megfelelőek.");
    try {
      const result = await performFieldQuoteSignature(
        env,
        quote,
        parsed.data.signatureDataUrl,
        parsed.data.pdfBase64,
        "customer",
        `public:${truncatedUserAgent(request)}`,
      );
      return json({
        ok: true,
        pdfUrl: `/api/field-quotes/public/${signatureMatch[1]}/media/${result.pdfKey}`,
      });
    } catch (error) {
      return signatureErrorResponse(error);
    }
  }

  const declineMatch = RE_PUBLIC_DECLINE.exec(url.pathname);
  if (request.method === "POST" && declineMatch?.[1]) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const quote = await loadFieldQuoteByToken(env.DB, declineMatch[1]);
    if (!quote) return apiError(404, "Az ajánlat nem található vagy a link lejárt.");
    if (quote.status === "SIGNED") return apiError(409, "Ez az ajánlat már alá van írva.");
    const parsed = fieldQuoteDeclineSchema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) return apiError(400, "Érvénytelen indoklás.");
    await declineFieldQuote(env.DB, quote.id, parsed.data.reason, "customer");
    return json({ ok: true });
  }

  const quoteMatch = RE_PUBLIC_QUOTE.exec(url.pathname);
  if (request.method === "GET" && quoteMatch?.[1]) {
    const quote = await loadFieldQuoteByToken(env.DB, quoteMatch[1]);
    if (!quote) return apiError(404, "Az ajánlat nem található vagy a link lejárt.");
    const totals = computeTotals(quote.items, quote.discountType, quote.discountValue);
    return json(
      { quote: toCustomerSafeQuote(quote), totals },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return apiError(404, "Az API-végpont nem található.");
}
