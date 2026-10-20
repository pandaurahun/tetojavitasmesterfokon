// Central marketing/analytics module. Loads and fires only in production
// builds, and only after the relevant consent category is granted — no
// script is fetched, no cookie is set, before that. Google Consent Mode v2
// (gtag) and Meta's fbq('consent') API carry the per-category signal once
// consent is known; ConsentBanner (components/site) is the UI that calls the
// exported grant/revoke functions below.

const GA_ID = import.meta.env["VITE_GA_MEASUREMENT_ID"] as string | undefined;
const ADS_ID = import.meta.env["VITE_GOOGLE_ADS_ID"] as string | undefined;
const PIXEL_ID = import.meta.env["VITE_META_PIXEL_ID"] as string | undefined;
const SITE_VERIFICATION = import.meta.env["VITE_GOOGLE_SITE_VERIFICATION"] as string | undefined;

const ADS_LABELS: Record<ConversionEvent, string | undefined> = {
  lead_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_LEAD_SUBMIT"] as string | undefined,
  callback_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_CALLBACK_SUBMIT"] as string | undefined,
  quote_request_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_QUOTE_REQUEST_SUBMIT"] as
    string | undefined,
  phone_click: import.meta.env["VITE_GOOGLE_ADS_LABEL_PHONE_CLICK"] as string | undefined,
};

const ENABLED = import.meta.env.PROD;
const CONSENT_KEY = "consent_v1";
const SITE_ORIGIN = "https://tetojavitasmesterfokon.hu";

// Path prefixes that carry a secret bearer token in the URL itself (a
// field-quote's public sign/decide-later link is the only one today, but
// any future capability-URL route belongs here too). The token is the
// ENTIRE access control for that customer's private quote — viewing AND
// signing/declining it — so it must never be sent to GA4/Meta, which would
// hand it to anyone with dashboard access (e.g. a marketing freelancer).
const SENSITIVE_PATH_PREFIXES = ["/ajanlat/"];

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

type ConversionEvent = "lead_submit" | "callback_submit" | "quote_request_submit" | "phone_click";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

// What the business has actually configured — not whether the visitor has
// consented. Safe to expose client-side: these booleans reveal nothing, the
// real IDs are already public in the loaded scripts once consent is granted.
export function getTrackingStatus() {
  return {
    ga4: Boolean(GA_ID),
    googleAds: Boolean(ADS_ID),
    metaPixel: Boolean(PIXEL_ID),
    searchConsoleVerification: Boolean(SITE_VERIFICATION),
  };
}

type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: FbqFunction;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

let coreInitialized = false;
let googleLoaded = false;
let metaLoaded = false;

function loadScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

// Must push the real `arguments` object, not a rest-param array — gtag.js's
// own command parser expects arguments-shaped entries (this is Google's
// literal canonical snippet); a genuine Array is processed differently and
// silently never reaches the point of sending an actual collect request.
// eslint-disable-next-line prefer-rest-params
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function ensureGoogleLoaded() {
  if (googleLoaded || (!GA_ID && !ADS_ID)) return;
  // Belt-and-suspenders: the googleLoaded flag is a correct, synchronous
  // guard on its own, but also check the DOM in case anything outside this
  // module's control ever ends up calling in twice.
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    googleLoaded = true;
    return;
  }
  googleLoaded = true;
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID ?? ADS_ID}`);
  if (GA_ID) gtag("config", GA_ID, { send_page_view: false });
  if (ADS_ID) gtag("config", ADS_ID);
}

function ensureMetaLoaded() {
  if (metaLoaded || !PIXEL_ID || window.fbq) return;
  metaLoaded = true;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as FbqFunction;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;

  loadScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", PIXEL_ID);
}

function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

export function getConsentState(): ConsentState | null {
  return readConsent();
}

export function hasConsent(category: "analytics" | "marketing"): boolean {
  return readConsent()?.[category] === true;
}

function applySignals(state: ConsentState) {
  window.gtag?.("consent", "update", {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
  });
  window.fbq?.("consent", state.marketing ? "grant" : "revoke");
}

function setConsent(partial: Partial<Pick<ConsentState, "analytics" | "marketing">>) {
  if (!ENABLED) return;
  const current = readConsent() ?? { analytics: false, marketing: false, decidedAt: "" };
  const next: ConsentState = { ...current, ...partial, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. — consent just won't persist across sessions */
  }
  // Consent signal must land in the dataLayer BEFORE config/init — gtag
  // processes commands strictly in order, so a config queued while consent
  // is still "default" (denied) initializes in denied mode, and a later
  // update can't retroactively fix that already-processed command.
  applySignals(next);
  if (next.analytics || next.marketing) ensureGoogleLoaded();
  if (next.marketing) ensureMetaLoaded();
  // The page the visitor is already on never got its page_view sent — the
  // initial mount's attempt ran before consent existed and was correctly
  // (silently) skipped. Send it now, for the current URL, so that pageview
  // isn't lost. Route-change navigations after this remain covered by the
  // pathname effect in __root.tsx as before.
  trackPageView(window.location.pathname, document.title);
}

export function grantAnalyticsConsent() {
  setConsent({ analytics: true });
}
export function revokeAnalyticsConsent() {
  setConsent({ analytics: false });
}
export function grantMarketingConsent() {
  setConsent({ marketing: true });
}
export function revokeMarketingConsent() {
  setConsent({ marketing: false });
}
export function acceptAllConsent() {
  setConsent({ analytics: true, marketing: true });
}
export function acceptNecessaryOnlyConsent() {
  setConsent({ analytics: false, marketing: false });
}

// Called once on app mount. Never fetches a script by itself — only wires
// the dataLayer/consent-default stub and, if a return visitor already
// decided, re-applies that decision (which does load scripts, same as a
// fresh grant would).
export function initAnalytics() {
  if (!ENABLED || coreInitialized) return;
  coreInitialized = true;

  window.gtag = gtag;
  gtag("js", new Date());
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });

  const stored = readConsent();
  if (stored) {
    if (stored.analytics || stored.marketing) ensureGoogleLoaded();
    if (stored.marketing) ensureMetaLoaded();
    applySignals(stored);
  }
}

export function trackPageView(path: string, title: string) {
  if (!ENABLED) return;
  // Meta's fbevents.js auto-captures document.location.href on its own for
  // every PageView, regardless of what's passed here — so redacting the
  // token out of `path` would only fix the GA4 call below and still leak it
  // via Meta. Skipping the pageview entirely for this route is the only fix
  // that actually covers both.
  if (isSensitivePath(path)) return;
  if (GA_ID && hasConsent("analytics")) {
    window.gtag?.("event", "page_view", {
      page_path: path,
      // Built from the route path rather than read off window.location —
      // right after a client-side navigation the router's own state (and
      // thus our `path` argument) is ahead of the History API by a tick.
      page_location: SITE_ORIGIN + path,
      page_title: title,
    });
  }
  if (hasConsent("marketing")) window.fbq?.("track", "PageView");
}

function fireConversion(event: ConversionEvent) {
  if (!hasConsent("marketing")) return;
  const label = ADS_LABELS[event];
  if (ADS_ID && label) {
    window.gtag?.("event", "conversion", { send_to: `${ADS_ID}/${label}` });
  }
}

export function trackLeadSubmit() {
  if (!ENABLED) return;
  if (hasConsent("analytics")) window.gtag?.("event", "lead_submit");
  fireConversion("lead_submit");
}

export function trackCallbackSubmit() {
  if (!ENABLED) return;
  if (hasConsent("analytics")) window.gtag?.("event", "callback_submit");
  if (hasConsent("marketing")) window.fbq?.("track", "Contact");
  fireConversion("callback_submit");
}

export function trackQuoteRequestSubmit() {
  if (!ENABLED) return;
  if (hasConsent("analytics")) window.gtag?.("event", "quote_request_submit");
  if (hasConsent("marketing")) window.fbq?.("track", "Lead");
  fireConversion("quote_request_submit");
}

export function trackPhoneClick() {
  if (!ENABLED) return;
  if (hasConsent("analytics")) window.gtag?.("event", "phone_click");
  fireConversion("phone_click");
}
