import { env as cloudflareEnv } from "cloudflare:workers";
import {
  hydrateSiteState,
  initialState,
  siteStateFrom,
  type DemoState,
  type SiteState,
} from "@/demo/default-state";
import { articles, priceBook } from "@/demo/data";
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
import { getAIProvider, generateQuoteDraft, generateSocialPost } from "./ai.server";
import {
  handleFieldQuoteAdminRequest,
  handleFieldQuotePublicRequest,
} from "./field-quote-routes.server";
import { describeError } from "@/lib/error-capture";
import { handleJobsAdminRequest } from "./jobs-routes.server";
import { checkImageUploadHeaders, readImageUploadBody } from "./image-upload.server";

const SESSION_COOKIE = "tetomester_session";
const HOST_SESSION_COOKIE = `__Host-${SESSION_COOKIE}`;
const SESSION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_LIMIT = 8;
// Per-(IP,email) alone lets an attacker with N source IPs get N×LOGIN_LIMIT
// guesses against the same admin — this second, IP-independent counter
// bounds total guesses against one email regardless of how many IPs they
// come from. Higher threshold than the per-IP one since it's shared across
// every legitimate IP the real owner might use (home/office/mobile) too.
const LOGIN_GLOBAL_LIMIT = 20;
// OWASP's 2023+ guidance for PBKDF2-SHA256 is ≥600,000 iterations; this was
// 100,000 originally. Existing admin rows keep whichever count they were
// hashed with (password_iterations is stored per-row) and verify correctly
// either way — login() transparently rehashes to the new count on the next
// successful login, so this is a zero-downtime, no-forced-reset upgrade.
const PASSWORD_ITERATIONS = 600_000;
const encoder = new TextEncoder();

type AdminRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: string;
};

export type SessionRow = {
  token_hash: string;
  admin_id: string;
  email: string;
  role: string;
  expires_at: number;
  last_seen_at: number;
};

type PayloadRow = { payload: string };
type AttemptRow = { attempts: number; window_started_at: number };

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(status: number, message: string): Response {
  return json({ error: message }, { status });
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (encoder.encode(body).byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(body);
}

export function sameOrigin(request: Request): boolean {
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

// Cloudflare's WebCrypto PBKDF2 has historically capped the iteration count
// (100,000 at one point). Newer runtimes accept more, and the local one
// does, but production's can't be verified from here — and a rejected
// derivation would otherwise turn every admin login (via the rehash) or
// password change into a 500, locking the owner out. So: try the strong
// count first and fall back to the proven one rather than ever failing.
const PASSWORD_ITERATIONS_FALLBACK = 100_000;

async function hashPassword(password: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  let iterations = PASSWORD_ITERATIONS;
  let hash: Uint8Array;
  try {
    hash = await derivePassword(password, salt, iterations);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "pbkdf2_iterations_unsupported",
        requested: iterations,
        fallback: PASSWORD_ITERATIONS_FALLBACK,
        error: describeError(error),
      }),
    );
    iterations = PASSWORD_ITERATIONS_FALLBACK;
    hash = await derivePassword(password, salt, iterations);
  }
  return {
    hash: bytesToBase64Url(hash),
    salt: bytesToBase64Url(salt),
    iterations,
  };
}

async function verifyPassword(password: string, admin: AdminRow | null): Promise<boolean> {
  const salt = admin
    ? base64UrlToBytes(admin.password_salt)
    : base64UrlToBytes("AAAAAAAAAAAAAAAAAAAAAA");
  // Unknown email: burn a derivation of comparable cost so response timing
  // doesn't reveal whether the account exists — but never let an
  // unsupported iteration count turn that path into a 500 (which would
  // itself reveal it).
  const iterations = admin?.password_iterations ?? PASSWORD_ITERATIONS;
  let actual: Uint8Array;
  try {
    actual = await derivePassword(password, salt, iterations);
  } catch (error) {
    if (admin) throw error;
    actual = await derivePassword(password, salt, PASSWORD_ITERATIONS_FALLBACK);
  }
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

export async function authenticate(request: Request, workerEnv: Env): Promise<SessionRow | null> {
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

// Just the site settings (company name, address, tax number, ...) — the same
// values `loadState` would return, without reading every lead and quote.
export async function loadSiteSettings(workerEnv: Env): Promise<DemoState["settings"]> {
  const row = await workerEnv.DB.prepare(
    "SELECT payload FROM site_state WHERE id = 'main'",
  ).first<PayloadRow>();
  const stored = row ? safeParsePayload<SiteState>(row.payload, siteStateSchema) : null;
  return hydrateSiteState(stored ?? structuredClone(siteStateFrom(initialState))).settings;
}

export async function loadState(workerEnv: Env): Promise<DemoState> {
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

// Reuses the same auth_attempts table the login lockout uses (generic
// key/attempts/window_started_at shape, not actually auth-specific) rather
// than standing up a parallel rate-limit table, just under its own key
// namespace (`scope`) so it can't collide with login's per-(IP,email) keys.
// Every call counts toward the limit (unlike login, which only counts
// failures) — the threat here is submission/upload volume, not credential
// guessing, so successes count too.
async function checkPublicRateLimit(
  db: D1Database,
  request: Request,
  scope: string,
  limit: number,
  windowMs = LOGIN_WINDOW_MS,
): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const key = await sha256Hex(`${scope}\n${ip}`);
  const now = Date.now();
  const row = await db
    .prepare("SELECT attempts, window_started_at FROM auth_attempts WHERE key = ?1")
    .bind(key)
    .first<AttemptRow>();
  if (row && now - row.window_started_at < windowMs && row.attempts >= limit) return false;
  const nextAttempts = row && now - row.window_started_at < windowMs ? row.attempts + 1 : 1;
  const windowStarted = row && now - row.window_started_at < windowMs ? row.window_started_at : now;
  await db
    .prepare(
      `INSERT INTO auth_attempts (key, attempts, window_started_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts,
         window_started_at = excluded.window_started_at`,
    )
    .bind(key, nextAttempts, windowStarted)
    .run();
  return true;
}

async function login(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const parsed = loginSchema.safeParse(await readJson(request, 4_096));
  if (!parsed.success) return apiError(401, "Hibás e-mail cím vagy jelszó.");
  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const attemptKey = await sha256Hex(`${ip}\n${email}`);
  const globalAttemptKey = await sha256Hex(`global\n${email}`);
  const [attempt, globalAttempt] = await Promise.all([
    workerEnv.DB.prepare("SELECT attempts, window_started_at FROM auth_attempts WHERE key = ?1")
      .bind(attemptKey)
      .first<AttemptRow>(),
    workerEnv.DB.prepare("SELECT attempts, window_started_at FROM auth_attempts WHERE key = ?1")
      .bind(globalAttemptKey)
      .first<AttemptRow>(),
  ]);
  const now = Date.now();
  const locked = (row: AttemptRow | null, limit: number) =>
    row !== null && now - row.window_started_at < LOGIN_WINDOW_MS && row.attempts >= limit;
  if (locked(attempt, LOGIN_LIMIT) || locked(globalAttempt, LOGIN_GLOBAL_LIMIT)) {
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
    const bump = (row: AttemptRow | null) => ({
      attempts: row && now - row.window_started_at < LOGIN_WINDOW_MS ? row.attempts + 1 : 1,
      windowStarted:
        row && now - row.window_started_at < LOGIN_WINDOW_MS ? row.window_started_at : now,
    });
    const next = bump(attempt);
    const nextGlobal = bump(globalAttempt);
    const upsert = `INSERT INTO auth_attempts (key, attempts, window_started_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts,
         window_started_at = excluded.window_started_at`;
    await workerEnv.DB.batch([
      workerEnv.DB.prepare(upsert).bind(attemptKey, next.attempts, next.windowStarted),
      workerEnv.DB.prepare(upsert).bind(
        globalAttemptKey,
        nextGlobal.attempts,
        nextGlobal.windowStarted,
      ),
    ]);
    console.warn(JSON.stringify({ event: "admin_login_failed", at: new Date(now).toISOString() }));
    return apiError(401, "Hibás e-mail cím vagy jelszó.");
  }

  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const statements: D1PreparedStatement[] = [
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
    workerEnv.DB.prepare("DELETE FROM auth_attempts WHERE key IN (?1, ?2)").bind(
      attemptKey,
      globalAttemptKey,
    ),
    workerEnv.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    workerEnv.DB.prepare("DELETE FROM auth_attempts WHERE window_started_at < ?1").bind(
      now - 24 * 60 * 60 * 1_000,
    ),
  ];
  if (admin.password_iterations < PASSWORD_ITERATIONS) {
    // Best-effort upgrade: a failure here must never block the login the
    // visitor just correctly authenticated, and the row is only rewritten
    // if the new hash is genuinely stronger than what's stored.
    try {
      const rehashed = await hashPassword(parsed.data.password);
      if (rehashed.iterations > admin.password_iterations) {
        statements.push(
          workerEnv.DB.prepare(
            `UPDATE admins SET password_hash = ?2, password_salt = ?3, password_iterations = ?4, updated_at = ?5 WHERE id = ?1`,
          ).bind(admin.id, rehashed.hash, rehashed.salt, rehashed.iterations, now),
        );
      }
    } catch (error) {
      console.warn(
        JSON.stringify({ event: "password_rehash_skipped", error: describeError(error) }),
      );
    }
  }
  await workerEnv.DB.batch(statements);
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

async function aiQuoteDraft(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  if (!(await authenticate(request, workerEnv))) {
    return apiError(401, "Bejelentkezés szükséges.");
  }
  const provider = getAIProvider(workerEnv);
  if (!provider) return apiError(501, "Az AI asszisztens nincs beállítva ezen a szerveren.");

  const body = (await readJson(request, 4_096)) as { leadId?: unknown };
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  if (!leadId) return apiError(400, "Hiányzó leadId.");

  const state = await loadState(workerEnv);
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return apiError(404, "A lead nem található.");

  try {
    const draft = await generateQuoteDraft(provider, {
      lead,
      priceBook,
      companyName: state.settings.company || "a vállalkozás",
      priorNotes: lead.notes.map((n) => `${n.date} — ${n.text}`),
    });
    return json(draft);
  } catch (error) {
    console.error(JSON.stringify({ event: "ai_quote_draft_failed", error: describeError(error) }));
    return apiError(502, "Az AI ajánlatjavaslat generálása nem sikerült.");
  }
}

async function aiSocialPost(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  if (!(await authenticate(request, workerEnv))) {
    return apiError(401, "Bejelentkezés szükséges.");
  }
  const provider = getAIProvider(workerEnv);
  if (!provider) return apiError(501, "Az AI asszisztens nincs beállítva ezen a szerveren.");

  const body = (await readJson(request, 4_096)) as { projectId?: unknown };
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) return apiError(400, "Hiányzó projectId.");

  const state = await loadState(workerEnv);
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return apiError(404, "A referencia nem található.");

  try {
    const draft = await generateSocialPost(provider, {
      project,
      companyName: state.settings.company || "a vállalkozás",
    });
    return json(draft);
  } catch (error) {
    console.error(JSON.stringify({ event: "ai_social_post_failed", error: describeError(error) }));
    return apiError(502, "A social poszt-javaslat generálása nem sikerült.");
  }
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
  if (!extension)
    return apiError(415, "Csak JPEG, PNG, WebP, AVIF, SVG vagy ICO kép tölthető fel.");
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

// Public, unauthenticated — the quote-request wizard runs before any
// account exists, so there is no session to require. Reuses the same
// MEDIA bucket and the existing public GET /api/media/:key for serving
// (same trust tier as any other site image), under its own prefix and a
// narrower image-only allowlist (no SVG/ICO — a phone photo is never going
// to be either, and SVG specifically carries script-injection risk this
// endpoint has no reason to accept). Same CSRF check as POST /api/leads.
async function uploadLeadMedia(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const maxBytes = 8 * 1024 * 1024;
  const headerCheck = checkImageUploadHeaders(request, maxBytes);
  if ("error" in headerCheck) return apiError(headerCheck.error.status, headerCheck.error.message);
  // Unauthenticated endpoint: the bytes must really be a raster image, not
  // just labelled as one (see image-upload.server.ts).
  const upload = await readImageUploadBody(request, maxBytes);
  if ("error" in upload) return apiError(upload.error.status, upload.error.message);
  const { bytes, mime, extension } = upload.image;

  const date = new Date().toISOString().slice(0, 10);
  const key = `media/lead-uploads/${date}/${crypto.randomUUID()}.${extension}`;
  const stored = await workerEnv.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" },
  });
  if (!stored) return apiError(500, "A kép mentése nem sikerült.");
  return json({ key, url: `/api/media/${key}` }, { status: 201 });
}

// R2 keys of the photos a visitor uploaded through the wizard, as referenced by
// the lead's own `files[].url`. Only the public lead-upload prefix qualifies —
// a crafted payload can't make a lead deletion remove any other object.
function leadPhotoKeys(payload: string): string[] {
  try {
    const files = (JSON.parse(payload) as { files?: { url?: unknown }[] }).files ?? [];
    const keys: string[] = [];
    for (const file of files) {
      const match =
        typeof file.url === "string"
          ? /^\/api\/media\/(media\/lead-uploads\/[A-Za-z0-9_\-/.]+)$/.exec(file.url)
          : null;
      const key = match?.[1];
      if (key && !key.includes("..")) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

const LEAD_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

// Submitting the quote-request form must be idempotent: a refresh after
// submit, a double click, or a retry after a lost response must not create a
// second lead for the same person. Two layers:
//   1. the client sends one stable id per submission, and the INSERT below is
//      `ON CONFLICT(id) DO NOTHING` — the atomic guard, so two simultaneous
//      requests can never both insert it;
//   2. a request whose content is identical to a lead stored a few minutes ago
//      (a stale client that lost its id) is folded into that lead.
// Either way the visitor gets the normal "ok" answer, flagged `duplicate`, so
// they see a confirmation rather than an error — and duplicates cost no rate-
// limit budget, since they create nothing.
async function createLead(request: Request, workerEnv: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
  const parsed = leadSchema.safeParse(await readJson(request, 256_000));
  // The charset check keeps every stored id deletable through the admin
  // route, which only accepts [A-Za-z0-9_-].
  if (!parsed.success || !/^[A-Za-z0-9_-]{1,120}$/.test(parsed.data.id)) {
    return apiError(400, "Az ajánlatkérés adatai nem megfelelőek.");
  }
  const submitted = parsed.data;
  const db = workerEnv.DB;

  let leadId = submitted.id;
  const sameId = await db
    .prepare("SELECT id, json_extract(payload, '$.phone') AS phone FROM leads WHERE id = ?1")
    .bind(submitted.id)
    .first<{ id: string; phone: string | null }>();
  if (sameId) {
    if (sameId.phone === submitted.phone) return json({ ok: true, id: sameId.id, duplicate: true });
    // Same id but a different person: a real request must never be dropped,
    // so it is stored under a fresh id instead.
    leadId = `${submitted.id.slice(0, 100)}-${crypto.randomUUID().slice(0, 8)}`;
  }

  const since = new Date(Date.now() - LEAD_DUPLICATE_WINDOW_MS).toISOString();
  const sameContent = await db
    .prepare(
      `SELECT id FROM leads
        WHERE created_at >= ?1
          AND json_extract(payload, '$.phone') = ?2
          AND json_extract(payload, '$.name') = ?3
          AND IFNULL(json_extract(payload, '$.email'), '') = ?4
          AND json_extract(payload, '$.service') = ?5
          AND json_extract(payload, '$.city') = ?6
          AND IFNULL(json_extract(payload, '$.message'), '') = ?7
        ORDER BY created_at ASC LIMIT 1`,
    )
    .bind(
      since,
      submitted.phone,
      submitted.name,
      submitted.email,
      submitted.service,
      submitted.city,
      submitted.message ?? "",
    )
    .first<{ id: string }>();
  if (sameContent) return json({ ok: true, id: sameContent.id, duplicate: true });

  if (!(await checkPublicRateLimit(db, request, "lead", 5))) {
    return apiError(429, "Túl sok próbálkozás. Próbáld újra később.");
  }

  // createdAt is stamped here, not taken from the (unauthenticated,
  // client-supplied) payload — the leads list sorts by this column, and an
  // unvalidated client string could corrupt that ordering. The wizard's own
  // client-side createdAt is only ever used for its local optimistic UI state,
  // never trusted for the persisted record.
  const lead: Lead = {
    ...submitted,
    id: leadId,
    createdAt: new Date().toISOString(),
    files: submitted.files.map(({ dataUrl: _dataUrl, ...file }) => file),
  };
  const inserted = await db
    .prepare(
      `INSERT INTO leads (id, created_at, payload, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(lead.id, lead.createdAt, JSON.stringify(lead), Date.now())
    .run();
  // Zero changed rows: an identical request inserted this id between our
  // check and our write (double click / two tabs). Same outcome as above.
  if (inserted.meta?.changes === 0) return json({ ok: true, id: lead.id, duplicate: true });
  return json({ ok: true, id: lead.id }, { status: 201 });
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
    if (url.pathname.startsWith("/api/field-quotes/public/")) {
      const response = await handleFieldQuotePublicRequest(request, url, runtimeEnv);
      if (response) return response;
    }
    if (url.pathname.startsWith("/api/admin/field-quotes")) {
      const response = await handleFieldQuoteAdminRequest(request, url, runtimeEnv);
      if (response) return response;
    }
    if (url.pathname === "/api/admin/jobs" || url.pathname.startsWith("/api/admin/jobs/")) {
      const response = await handleJobsAdminRequest(request, url, runtimeEnv);
      if (response) return response;
    }
    if (request.method === "GET" && url.pathname === "/api/public-state") {
      return json(publicState(await loadState(runtimeEnv)), {
        headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/leads/media") {
      if (!(await checkPublicRateLimit(runtimeEnv.DB, request, "lead-media", 20))) {
        return apiError(429, "Túl sok próbálkozás. Próbáld újra később.");
      }
      return await uploadLeadMedia(request, runtimeEnv);
    }
    if (request.method === "POST" && url.pathname === "/api/leads") {
      return await createLead(request, runtimeEnv);
    }
    // Leads live in their own D1 table, not the site_state blob, so
    // removing one from local admin state and saving the blob (like
    // services/projects do) would never actually delete the row — this is
    // the only way a lead's data can be removed at all today.
    if (request.method === "DELETE" && url.pathname.startsWith("/api/admin/leads/")) {
      if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
      if (!(await authenticate(request, runtimeEnv))) {
        return apiError(401, "Bejelentkezés szükséges.");
      }
      const leadId = url.pathname.slice("/api/admin/leads/".length);
      if (!leadId || leadId.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(leadId)) {
        return apiError(404, "Az érdeklődő nem található.");
      }
      // The visitor's own uploaded photos go with the lead (erasure should
      // not leave a stranger's house photos reachable by URL in R2).
      const row = await runtimeEnv.DB.prepare("SELECT payload FROM leads WHERE id = ?1")
        .bind(leadId)
        .first<PayloadRow>();
      await runtimeEnv.DB.prepare("DELETE FROM leads WHERE id = ?1").bind(leadId).run();
      const photoKeys = row ? leadPhotoKeys(row.payload) : [];
      if (photoKeys.length > 0) {
        await runtimeEnv.MEDIA.delete(photoKeys).catch((error) =>
          console.error(
            JSON.stringify({ event: "lead_photo_cleanup_failed", error: describeError(error) }),
          ),
        );
      }
      return json({ ok: true });
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
    if (request.method === "POST" && url.pathname === "/api/admin/ai/quote-draft") {
      return await aiQuoteDraft(request, runtimeEnv);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/ai/social-post") {
      return await aiSocialPost(request, runtimeEnv);
    }
    return apiError(404, "Az API-végpont nem található.");
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    console.error(
      JSON.stringify({
        event: "api_error",
        path: url.pathname,
        method: request.method,
        error: describeError(error),
      }),
    );
    return apiError(tooLarge ? 413 : 500, tooLarge ? "A kérés túl nagy." : "Szerverhiba történt.");
  }
}
