import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleBackendRequest } from "./server/backend.server";

type ServerEntry = {
  fetch: (request: Request, env?: Env, ctx?: ExecutionContext) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Belt-and-suspenders: admin/login must never be indexable even if a page's
// own <meta name="robots"> is missing or gets overridden — robots.txt alone
// is not enforcement, since it only asks crawlers not to fetch the page.
function withRobotsHeader(response: Response, pathname: string): Response {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, { status: response.status, headers });
}

// Site-wide hardening headers. Only set when a response hasn't already set
// its own value — a couple of routes (e.g. media serving) intentionally set
// a narrower, route-specific CSP and that must win over this default.
// script-src/connect-src/img-src/style-src/font-src are scoped to exactly
// the third-party origins this site actually loads (GA4 + Google Ads share
// gtag.js, Meta Pixel, Google Fonts) — see src/lib/analytics.ts and the
// font <link> in __root.tsx for the source of truth if those ever change.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    // 'unsafe-inline' is needed because TanStack Start's SSR injects an
    // inline <script> carrying per-request hydration data — its content
    // differs per page/request, so a fixed sha256 hash allowlist (the
    // stricter alternative) can't work here without a nonce threaded
    // through the framework's render pipeline, which this pass didn't
    // attempt. This still blocks an attacker from loading a script from an
    // arbitrary external domain, just not an inline one.
    "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://connect.facebook.net",
    // GA4's collect/beacon traffic goes to region-specific
    // *.analytics.google.com (e.g. region1.analytics.google.com) — a
    // DIFFERENT domain from the legacy google-analytics.com — confirmed by
    // a live runtime check (every page spammed connect-src violations).
    // Consent Mode's cookieless pings and Google signals also hit the
    // visitor's locale Google domain (google.hu/ccm/collect) and
    // doubleclick; listing them keeps measurement working without a
    // blanket `https:` on connect-src.
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com https://www.google.hu https://*.doubleclick.net https://connect.facebook.net https://www.facebook.com",
    // Images: any https origin (admins can paste an external image URL into
    // branding/projects, and Google's remarketing pixel loads from the
    // visitor's locale TLD, which can't be enumerated), plus data:/blob:
    // for in-browser previews. Images carry no script-execution risk.
    "img-src 'self' data: blob: https:",
    "frame-src 'self' https://td.doubleclick.net https://*.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),
};

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

const UNREAD_BODY_DRAIN_LIMIT = 2 * 1024 * 1024;

// A handler that rejects a request early (401/403/413/...) never reads its
// body. Production workerd copes with that, but wrangler's local dev proxy
// treats the leftover bytes as fatal ("Error inside ProxyWorker") and takes
// the whole `wrangler dev` session down with the NEXT request — reproduced
// deterministically with one unauthenticated POST. So consume a bounded
// amount of whatever is left before answering; anything larger is cancelled.
async function drainUnreadBody(request: Request): Promise<void> {
  const body = request.body;
  if (!body || request.bodyUsed || body.locked) return;
  try {
    const reader = body.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      total += value.byteLength;
      if (total > UNREAD_BODY_DRAIN_LIMIT) {
        await reader.cancel();
        return;
      }
    }
  } catch {
    /* the client already went away — nothing left to drain */
  }
}

export default {
  async fetch(request: Request, env?: Env, ctx?: ExecutionContext) {
    try {
      const url = new URL(request.url);
      if (url.hostname === "www.tetojavitasmesterfokon.hu") {
        url.hostname = "tetojavitasmesterfokon.hu";
        return Response.redirect(url, 301);
      }

      const apiResponse = await handleBackendRequest(request, env);
      if (apiResponse) {
        await drainUnreadBody(request);
        return withSecurityHeaders(withRobotsHeader(apiResponse, url.pathname));
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      await drainUnreadBody(request);
      return withSecurityHeaders(
        withRobotsHeader(await normalizeCatastrophicSsrResponse(response), url.pathname),
      );
    } catch (error) {
      console.error(error);
      await drainUnreadBody(request);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
