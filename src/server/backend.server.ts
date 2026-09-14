import { env as cloudflareEnv } from "cloudflare:workers";
import {
  hydrateSiteState,
  initialState,
  siteStateFrom,
  type DemoState,
  type SiteState,
} from "@/demo/default-state";
import { articles } from "@/demo/data";
import { quoteTotals } from "@/demo/calc";
import type { Lead, Quote } from "@/demo/types";
import {
  bootstrapSchema,
  changePasswordSchema,
  demoStateSchema,
  leadSchema,
  loginSchema,
  siteStateSchema,
} from "./validation.server";

const SESSION_COOKIE = "tetomester_session";
const HOST_SESSION_COOKIE = `__Host-${SESSION_COOKIE}`;
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_LIMIT = 8;
const PASSWORD_ITERATIONS = 100_000;
const encoder = new TextEncoder();

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: string;
};

type SessionRow = {
  token_hash: string;
  admin_id: string;
  email: string;
  role: string;
  expires_at: number;
  last_seen_at: number;
};

type PayloadRow = { payload: string };
type AttemptRow = { attempts: number; window_started_at: number };

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function apiError(status: number, message: string): Response {
  return json({ error: message }, { status });
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (encoder.encode(body).byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(body);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function parseCookies(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(/;\s*/)) {
    const separator = part.indexOf("=");
    if (separator > 0) result.set(part.slice(0, separator), part.slice(separator + 1));
  }
  return result;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function sha256(value: string | Uint8Array): Promise<Uint8Array> {
  const input = typeof value === "string" ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(input)));
}

async function sha256Hex(value: string): Promise<string> {
  return Array.from(await sha256(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safeStringEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  return fixedLengthEqual(a, b);
}

function fixedLengthEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
      material,
      256,
    ),
  );
}

async function hashPassword(password: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return {
    hash: bytesToBase64Url(hash),
    salt: bytesToBase64Url(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

async function verifyPassword(password: string, admin: AdminRow | null): Promise<boolean> {
  const salt = admin
    ? base64UrlToBytes(admin.password_salt)
    : base64UrlToBytes("AAAAAAAAAAAAAAAAAAAAAA");
  const iterations = admin?.password_iterations ?? PASSWORD_ITERATIONS;
  const actual = await derivePassword(password, salt, iterations);
  const expected = admin ? base64UrlToBytes(admin.password_hash) : new Uint8Array(32);
  return fixedLengthEqual(actual, expected) && admin !== null;
}

function cookieName(request: Request): string {
  return new URL(request.url).protocol === "https:" ? HOST_SESSION_COOKIE : SESSION_COOKIE;
}

function sessionCookie(request: Request, token: string, maxAge = SESSION_SECONDS): string {
  const secure = new URL(request.url).protocol === "https:";
  return [
    `${cookieName(request)}=${token}`,
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

async function authenticate(request: Request, workerEnv: Env): Promise<SessionRow | null> {
  const token = parseCookies(request).get(cookieName(request));
  if (!token || token.length > 200) return null;
  const tokenHash = await sha256Hex(token);
  const row = await workerEnv.DB.prepare(
    `SELECT sessions.token_hash, sessions.admin_id, sessions.expires_at, sessions.last_seen_at,
            admins.email, admins.role
       FROM sessions
       JOIN admins ON admins.id = sessions.admin_id
      WHERE sessions.token_hash = ?1`,
  )
    .bind(tokenHash)
    .first<SessionRow>();
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at <= now) {
    await workerEnv.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  if (now - row.last_seen_at > 15 * 60 * 1_000) {
    await workerEnv.DB.prepare("UPDATE sessions SET last_seen_at = ?1 WHERE token_hash = ?2")
      .bind(now, tokenHash)
      .run();
  }
  return row;
}

function safeParsePayload<T>(
  payload: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(payload));
    return parsed.success && parsed.data ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadState(workerEnv: Env): Promise<DemoState> {
  const database = workerEnv.DB;
  const [siteResult, leadsResult, quotesResult] = await database.batch([
    database.prepare("SELECT payload FROM site_state WHERE id = 'main'"),
    database.prepare("SELECT payload FROM leads ORDER BY created_at DESC"),
    database.prepare("SELECT payload FROM quotes ORDER BY updated_at DESC"),
  ]);

  if (!siteResult || !leadsResult || !quotesResult) {
    throw new Error("A D1 lekérdezési csomag hiányos választ adott.");
  }

  const siteRow = siteResult.results[0] as PayloadRow | undefined;
  const storedSite = siteRow ? safeParsePayload<SiteState>(siteRow.payload, siteStateSchema) : null;
  const leads = leadsResult.results
    .map((row) => safeParsePayload<Lead>((row as PayloadRow).payload, leadSchema))
    .filter((lead): lead is Lead => lead !== null);
  const quotes = quotesResult.results
    .map((row) =>
      safeParsePayload<Quote>((row as PayloadRow).payload, demoStateSchema.shape.quotes.element),
    )
    .filter((quote): quote is Quote => quote !== null);

  const site = hydrateSiteState(storedSite ?? structuredClone(siteStateFrom(initialState)));
  return {
    ...site,
    leads: leads.length ? leads : structuredClone(initialState.leads),
    quotes: quotes.length ? quotes : structuredClone(initialState.quotes),
  };
}

async function saveState(state: DemoState, workerEnv: Env): Promise<void> {
  const database = workerEnv.DB;
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO site_state (id, payload, updated_at) VALUES ('main', ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      )
      .bind(JSON.stringify(siteStateFrom(state)), now),
    ...state.leads.map((lead) =>
      database
        .prepare(
          `INSERT INTO leads (id, created_at, payload, updated_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at,
             payload = excluded.payload, updated_at = excluded.updated_at`,
        )
        .bind(lead.id, lead.createdAt, JSON.stringify(lead), now),
    ),
    ...state.quotes.map((quote) =>
      database
        .prepare(
          `INSERT INTO quotes (id, payload, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        )
        .bind(quote.id, JSON.stringify(quote), now),
    ),
  ];
  await database.batch(statements);
}

// Quotes never store their totals — they're always derived from items, so a
// client bug can't leave a stale/wrong number sitting in D1. This still
// rejects nonsensical input (NaN/negative) instead of trusting the client.
function quoteCalculationsAreSane(quotes: Quote[]): boolean {
  return quotes.every((quote) => {
    const totals = quoteTotals(quote);
    return Object.values(totals).every((value) => Number.isFinite(value) && value >= -0.01);
  });
}

function publicState(state: DemoState): DemoState {
  const activeServiceIds = new Set(
    state.services.filter((service) => service.active).map((service) => service.id),
  );
  return {
    ...state,
    leads: [],
    quotes: [],
    services: state.services.filter((service) => service.active),
    fields: state.fields.filter(
      (field) => field.publicVisible && activeServiceIds.has(field.serviceId),
    ),
    projects: state.projects.filter((project) => project.published),
    content: state.content.filter((block) => block.visible),
    legal: state.legal.filter((document) => document.published),
  };
}

async function bootstrapAdmin(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const secret = workerEnv.BOOTSTRAP_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || secret.length < 32 || !(await safeStringEqual(supplied, secret))) {
    return apiError(403, "A kezdeti admin létrehozása nem engedélyezett.");
  }
  const existing = await workerEnv.DB.prepare("SELECT COUNT(*) AS count FROM admins").first<{
    count: number;
  }>();
  if ((existing?.count ?? 0) > 0) return apiError(409, "Az admin már létre lett hozva.");

  const parsed = bootstrapSchema.safeParse(await readJson(request, 4_096));
  if (!parsed.success) return apiError(400, "Érvénytelen e-mail cím vagy jelszó.");
  const password = await hashPassword(parsed.data.password);
  const now = Date.now();
  await workerEnv.DB.prepare(
    `INSERT INTO admins
      (id, email, password_hash, password_salt, password_iterations, role, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'owner', ?6, ?6)`,
  )
    .bind(
      crypto.randomUUID(),
      parsed.data.email.toLowerCase(),
      password.hash,
      password.salt,
      password.iterations,
      now,
    )
    .run();
  console.log(JSON.stringify({ event: "admin_bootstrapped", at: new Date(now).toISOString() }));
  return json({ ok: true }, { status: 201 });
}

async function login(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const parsed = loginSchema.safeParse(await readJson(request, 4_096));
  if (!parsed.success) return apiError(401, "Hibás e-mail cím vagy jelszó.");
  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const attemptKey = await sha256Hex(`${ip}\n${email}`);
  const attempt = await workerEnv.DB.prepare(
    "SELECT attempts, window_started_at FROM auth_attempts WHERE key = ?1",
  )
    .bind(attemptKey)
    .first<AttemptRow>();
  const now = Date.now();
  if (
    attempt &&
    now - attempt.window_started_at < LOGIN_WINDOW_MS &&
    attempt.attempts >= LOGIN_LIMIT
  ) {
    return apiError(429, "Túl sok próbálkozás. Próbáld újra később.");
  }

  const admin = await workerEnv.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, role
       FROM admins WHERE email = ?1`,
  )
    .bind(email)
    .first<AdminRow>();
  const valid = await verifyPassword(parsed.data.password, admin);
  if (!valid || !admin) {
    const nextAttempts =
      attempt && now - attempt.window_started_at < LOGIN_WINDOW_MS ? attempt.attempts + 1 : 1;
    const windowStarted =
      attempt && now - attempt.window_started_at < LOGIN_WINDOW_MS
        ? attempt.window_started_at
        : now;
    await workerEnv.DB.prepare(
      `INSERT INTO auth_attempts (key, attempts, window_started_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts,
         window_started_at = excluded.window_started_at`,
    )
      .bind(attemptKey, nextAttempts, windowStarted)
      .run();
    console.warn(JSON.stringify({ event: "admin_login_failed", at: new Date(now).toISOString() }));
    return apiError(401, "Hibás e-mail cím vagy jelszó.");
  }

  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  await workerEnv.DB.batch([
    workerEnv.DB.prepare(
      `INSERT INTO sessions
          (token_hash, admin_id, expires_at, created_at, last_seen_at, user_agent)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5)`,
    ).bind(
      tokenHash,
      admin.id,
      now + SESSION_SECONDS * 1_000,
      now,
      (request.headers.get("user-agent") ?? "").slice(0, 500),
    ),
    workerEnv.DB.prepare("DELETE FROM auth_attempts WHERE key = ?1").bind(attemptKey),
    workerEnv.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    workerEnv.DB.prepare("DELETE FROM auth_attempts WHERE window_started_at < ?1").bind(
      now - 24 * 60 * 60 * 1_000,
    ),
  ]);
  console.log(
    JSON.stringify({
      event: "admin_login_succeeded",
      adminId: admin.id,
      at: new Date(now).toISOString(),
    }),
  );
  return json(
    { user: { email: admin.email, role: admin.role } },
    { headers: { "Set-Cookie": sessionCookie(request, token), "Cache-Control": "no-store" } },
  );
}

async function logout(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const token = parseCookies(request).get(cookieName(request));
  if (token) {
    await workerEnv.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1")
      .bind(await sha256Hex(token))
      .run();
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": sessionCookie(request, "", 0), "Cache-Control": "no-store" },
  });
}

async function changePassword(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const session = await authenticate(request, workerEnv);
  if (!session) return apiError(401, "Bejelentkezés szükséges.");
  const parsed = changePasswordSchema.safeParse(await readJson(request, 4_096));
  if (!parsed.success) return apiError(400, "Érvénytelen jelszóadatok.");

  const admin = await workerEnv.DB.prepare(
    `SELECT id, email, password_hash, password_salt, password_iterations, role
       FROM admins WHERE id = ?1`,
  )
    .bind(session.admin_id)
    .first<AdminRow>();
  const valid = await verifyPassword(parsed.data.currentPassword, admin);
  if (!valid || !admin) return apiError(401, "A jelenlegi jelszó helytelen.");

  const next = await hashPassword(parsed.data.newPassword);
  const now = Date.now();
  const currentToken = parseCookies(request).get(cookieName(request)) ?? "";
  const currentTokenHash = await sha256Hex(currentToken);
  await workerEnv.DB.batch([
    workerEnv.DB.prepare(
      `UPDATE admins SET password_hash = ?1, password_salt = ?2, password_iterations = ?3, updated_at = ?4
        WHERE id = ?5`,
    ).bind(next.hash, next.salt, next.iterations, now, admin.id),
    workerEnv.DB.prepare(`DELETE FROM sessions WHERE admin_id = ?1 AND token_hash != ?2`).bind(
      admin.id,
      currentTokenHash,
    ),
  ]);
  console.log(
    JSON.stringify({
      event: "admin_password_changed",
      adminId: admin.id,
      at: new Date(now).toISOString(),
    }),
  );
  return json({ ok: true });
}

function mediaKey(pathname: string): string | null {
  const encoded = pathname.slice("/api/media/".length);
  let key: string;
  try {
    key = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!key.startsWith("media/") || key.includes("..") || !/^[a-zA-Z0-9/_\-.]+$/.test(key))
    return null;
  return key;
}

async function serveMedia(pathname: string, workerEnv: Env): Promise<Response> {
  const key = mediaKey(pathname);
  if (!key) return apiError(404, "A fájl nem található.");
  const object = await workerEnv.MEDIA.get(key);
  if (!object || !("body" in object)) return apiError(404, "A fájl nem található.");
  const headers = new Headers({
    ETag: object.httpEtag,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "script-src 'none'",
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

async function uploadMedia(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  if (!(await authenticate(request, workerEnv))) {
    return apiError(401, "Bejelentkezés szükséges.");
  }
  const mime =
    (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  const extension = extensions[mime];
  if (!extension) return apiError(415, "Csak JPEG, PNG, WebP, AVIF, SVG vagy ICO kép tölthető fel.");
  const size = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(size) || size <= 0) return apiError(411, "A fájlméret megadása szükséges.");
  if (size > 10 * 1024 * 1024) return apiError(413, "A kép legfeljebb 10 MB lehet.");
  if (!request.body) return apiError(400, "Üres fájl.");

  const date = new Date().toISOString().slice(0, 10);
  const key = `media/${date}/${crypto.randomUUID()}.${extension}`;
  const stored = await workerEnv.MEDIA.put(key, request.body, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" },
  });
  if (!stored) return apiError(500, "A kép mentése nem sikerült.");
  return json({ key, url: `/api/media/${key}` }, { status: 201 });
}

const SITE_ORIGIN = "https://tetojavitasmesterfokon.hu";

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (char) =>
    char === "<"
      ? "&lt;"
      : char === ">"
        ? "&gt;"
        : char === "&"
          ? "&amp;"
          : char === "'"
            ? "&apos;"
            : "&quot;",
  );
}

async function generateSitemap(workerEnv: Env): Promise<Response> {
  const state = await loadState(workerEnv);
  const urls = [
    "/",
    "/szolgaltatasok",
    ...state.services.filter((s) => s.active).map((s) => `/szolgaltatasok/${s.slug}`),
    "/referenciak",
    ...state.projects.filter((p) => p.published).map((p) => `/referenciak/${p.id}`),
    "/folyamat",
    "/tudastar",
    ...articles.map((a) => `/tudastar/${a.slug}`),
    "/kapcsolat",
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((path) => `  <url><loc>${xmlEscape(SITE_ORIGIN + path)}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function handleBackendRequest(
  request: Request,
  workerEnv?: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const runtimeEnv = workerEnv ?? cloudflareEnv;
  if (request.method === "GET" && url.pathname === "/sitemap.xml") {
    return await generateSitemap(runtimeEnv);
  }
  if (!url.pathname.startsWith("/api/")) return null;

  try {
    if (request.method === "GET" && url.pathname.startsWith("/api/media/")) {
      return await serveMedia(url.pathname, runtimeEnv);
    }
    if (request.method === "GET" && url.pathname === "/api/public-state") {
      return json(publicState(await loadState(runtimeEnv)), {
        headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/leads") {
      if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
      const parsed = leadSchema.safeParse(await readJson(request, 256_000));
      if (!parsed.success) return apiError(400, "Az ajánlatkérés adatai nem megfelelőek.");
      const lead: Lead = {
        ...parsed.data,
        files: parsed.data.files.map(({ dataUrl: _dataUrl, ...file }) => file),
      };
      await runtimeEnv.DB.prepare(
        `INSERT INTO leads (id, created_at, payload, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO NOTHING`,
      )
        .bind(lead.id, lead.createdAt, JSON.stringify(lead), Date.now())
        .run();
      return json({ ok: true, id: lead.id }, { status: 201 });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/bootstrap") {
      return await bootstrapAdmin(request, runtimeEnv);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/login") {
      return await login(request, runtimeEnv);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/logout") {
      return await logout(request, runtimeEnv);
    }
    if (request.method === "GET" && url.pathname === "/api/admin/session") {
      const session = await authenticate(request, runtimeEnv);
      if (!session) return apiError(401, "Bejelentkezés szükséges.");
      return json(
        { user: { email: session.email, role: session.role } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (request.method === "GET" && url.pathname === "/api/admin/state") {
      if (!(await authenticate(request, runtimeEnv))) {
        return apiError(401, "Bejelentkezés szükséges.");
      }
      return json(await loadState(runtimeEnv), { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/state") {
      if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
      if (!(await authenticate(request, runtimeEnv))) {
        return apiError(401, "Bejelentkezés szükséges.");
      }
      const parsed = demoStateSchema.safeParse(await readJson(request, 1_500_000));
      if (!parsed.success) return apiError(400, "A mentendő adatok nem megfelelőek.");
      if (!quoteCalculationsAreSane(parsed.data.quotes)) {
        return apiError(400, "Az árajánlat tételei érvénytelen összeget adnak.");
      }
      await saveState(parsed.data, runtimeEnv);
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/media") {
      return await uploadMedia(request, runtimeEnv);
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/password") {
      return await changePassword(request, runtimeEnv);
    }
    return apiError(404, "Az API-végpont nem található.");
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    console.error(
      JSON.stringify({
        event: "api_error",
        path: url.pathname,
        method: request.method,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return apiError(tooLarge ? 413 : 500, tooLarge ? "A kérés túl nagy." : "Szerverhiba történt.");
  }
}
