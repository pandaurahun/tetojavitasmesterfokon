// Central marketing/analytics module. Loads and fires only in production
// builds. Google Consent Mode v2 (gtag) and Meta's fbq('consent') API start
// denied — no separate consent system is built here; a future consent
// banner should call grantMarketingConsent() once the visitor opts in.

const GA_ID = import.meta.env["VITE_GA_MEASUREMENT_ID"] as string | undefined;
const ADS_ID = import.meta.env["VITE_GOOGLE_ADS_ID"] as string | undefined;
const PIXEL_ID = import.meta.env["VITE_META_PIXEL_ID"] as string | undefined;

const ADS_LABELS: Record<ConversionEvent, string | undefined> = {
  lead_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_LEAD_SUBMIT"] as string | undefined,
  callback_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_CALLBACK_SUBMIT"] as string | undefined,
  quote_request_submit: import.meta.env["VITE_GOOGLE_ADS_LABEL_QUOTE_REQUEST_SUBMIT"] as
    | string
    | undefined,
  phone_click: import.meta.env["VITE_GOOGLE_ADS_LABEL_PHONE_CLICK"] as string | undefined,
};

const ENABLED = import.meta.env.PROD;
const CONSENT_KEY = "marketing_consent";
const SITE_ORIGIN = "https://tetojavitasmesterfokon.hu";

type ConversionEvent = "lead_submit" | "callback_submit" | "quote_request_submit" | "phone_click";

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

let initialized = false;

function loadScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
}

function initMetaPixel() {
  if (!PIXEL_ID || window.fbq) return;
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
  fbq("consent", "revoke");
  fbq("init", PIXEL_ID);
}

function hasStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function initAnalytics() {
  if (!ENABLED || initialized) return;
  initialized = true;

  window.gtag = gtag;
  gtag("js", new Date());
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });

  if (GA_ID) {
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
    gtag("config", GA_ID, { send_page_view: false });
  }
  if (ADS_ID) gtag("config", ADS_ID);
  initMetaPixel();

  if (hasStoredConsent()) grantMarketingConsent();
}

export function grantMarketingConsent() {
  if (!ENABLED) return;
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {
    /* private mode etc. — consent just won't persist across sessions */
  }
  window.gtag?.("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
  });
  window.fbq?.("consent", "grant");
}

export function revokeMarketingConsent() {
  if (!ENABLED) return;
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  window.fbq?.("consent", "revoke");
}

export function trackPageView(path: string, title: string) {
  if (!ENABLED) return;
  if (GA_ID) {
    window.gtag?.("event", "page_view", {
      page_path: path,
      // Built from the route path rather than read off window.location —
      // right after a client-side navigation the router's own state (and
      // thus our `path` argument) is ahead of the History API by a tick.
      page_location: SITE_ORIGIN + path,
      page_title: title,
    });
  }
  window.fbq?.("track", "PageView");
}

function fireConversion(event: ConversionEvent) {
  const label = ADS_LABELS[event];
  if (ADS_ID && label) {
    window.gtag?.("event", "conversion", { send_to: `${ADS_ID}/${label}` });
  }
}

export function trackLeadSubmit() {
  if (!ENABLED) return;
  window.gtag?.("event", "lead_submit");
  fireConversion("lead_submit");
}

export function trackCallbackSubmit() {
  if (!ENABLED) return;
  window.gtag?.("event", "callback_submit");
  window.fbq?.("track", "Contact");
  fireConversion("callback_submit");
}

export function trackQuoteRequestSubmit() {
  if (!ENABLED) return;
  window.gtag?.("event", "quote_request_submit");
  window.fbq?.("track", "Lead");
  fireConversion("quote_request_submit");
}

export function trackPhoneClick() {
  if (!ENABLED) return;
  window.gtag?.("event", "phone_click");
  fireConversion("phone_click");
}
