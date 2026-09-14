import type { LeadAttribution } from "@/demo/types";

const STORAGE_KEY = "attribution";

const PARAM_MAP: Record<keyof Omit<LeadAttribution, "landingPage" | "firstTouchAt">, string> = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
  gclid: "gclid",
  fbclid: "fbclid",
};

// Captures the FIRST attribution seen this session (sessionStorage) and never
// overwrites it — a later internal click with stale query params attached
// shouldn't erase how the visitor actually arrived.
export function captureAttributionFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
  } catch {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const found: LeadAttribution = {};
  for (const [key, param] of Object.entries(PARAM_MAP) as [keyof typeof PARAM_MAP, string][]) {
    const value = params.get(param);
    if (value) found[key] = value;
  }
  if (Object.keys(found).length === 0) return;

  found.landingPage = window.location.pathname;
  found.firstTouchAt = new Date().toISOString();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    /* private browsing etc. — attribution just won't persist */
  }
}

export function getStoredAttribution(): LeadAttribution | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadAttribution) : undefined;
  } catch {
    return undefined;
  }
}
