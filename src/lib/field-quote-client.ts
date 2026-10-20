import type {
  CatalogItem,
  FieldQuote,
  FieldQuoteSettings,
  FieldQuoteTotals,
  PaymentTemplate,
  QuotePackage,
} from "@/demo/field-quote-types";

export class FieldQuoteApiError extends Error {
  status: number;
  code?: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FieldQuoteApiError(
      res.status,
      (payload as { error?: string }).error ?? "A kérés nem sikerült.",
    );
  }
  return payload as T;
}

const adminBase = "/api/admin/field-quotes";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export const fieldQuoteApi = {
  list: (filters: { status?: string | undefined; q?: string | undefined } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.q) params.set("q", filters.q);
    const qs = params.toString();
    return call<{ items: FieldQuote[] }>(`${adminBase}${qs ? `?${qs}` : ""}`);
  },
  dashboard: () =>
    call<{
      todayCount: number;
      signedCount: number;
      pendingCount: number;
      declinedCount: number;
      todayValue: number;
      acceptedValue: number;
    }>(`${adminBase}/dashboard`),
  get: (id: string) => call<FieldQuote>(`${adminBase}/${id}`),
  create: (input: Record<string, unknown>) =>
    call<FieldQuote>(adminBase, { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: Record<string, unknown>) =>
    call<FieldQuote>(`${adminBase}/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  setStatus: (id: string, status: string) =>
    call<{ ok: true }>(`${adminBase}/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  createNewVersion: (id: string) =>
    call<FieldQuote>(`${adminBase}/${id}/new-version`, { method: "POST" }),
  decline: (id: string, reason?: string) =>
    call<{ ok: true }>(`${adminBase}/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  sign: (id: string, signatureDataUrl: string, pdfBase64: string) =>
    call<{ ok: true; pdfUrl: string }>(`${adminBase}/${id}/signature`, {
      method: "POST",
      body: JSON.stringify({ signatureDataUrl, pdfBase64, acceptedStatement: true }),
    }),
  publicLink: (id: string, days?: number) =>
    call<{ token: string; url: string; expiresAt: number }>(`${adminBase}/${id}/public-link`, {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
  uploadPhoto: async (id: string, file: File, caption?: string) => {
    // Mirror the server's limits so an unsuitable file gets a clear message
    // here instead of a dropped connection halfway through a big upload.
    if (!PHOTO_TYPES.has(file.type))
      throw new FieldQuoteApiError(415, "Csak JPEG, PNG, WebP vagy AVIF kép tölthető fel.");
    if (file.size > MAX_PHOTO_BYTES)
      throw new FieldQuoteApiError(413, "A kép legfeljebb 12 MB lehet.");
    let res: Response;
    try {
      res = await fetch(`${adminBase}/${id}/photos`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          // Raw HTTP header values are Latin-1 only — encode so Hungarian
          // captions (ő/ű and other non-Latin-1 characters) don't make
          // fetch() throw outright.
          ...(caption ? { "X-Photo-Caption": encodeURIComponent(caption) } : {}),
        },
        body: file,
      });
    } catch {
      throw new FieldQuoteApiError(
        0,
        "A feltöltés megszakadt. Ellenőrizd a kapcsolatot, és próbáld újra.",
      );
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new FieldQuoteApiError(
        res.status,
        (payload as { error?: string }).error ?? "A fénykép feltöltése nem sikerült.",
      );
    return payload as { ok: true; photoId: string; key: string; url: string };
  },
  removePhoto: (id: string, photoId: string) =>
    call<{ ok: true }>(`${adminBase}/${id}/photos/${photoId}`, { method: "DELETE" }),

  catalogList: () => call<{ items: CatalogItem[] }>(`${adminBase}/catalog`),
  catalogSearch: (q: string) =>
    call<{ items: CatalogItem[] }>(`${adminBase}/catalog/search?q=${encodeURIComponent(q)}`),
  catalogSave: (input: Partial<CatalogItem>) =>
    call<CatalogItem>(`${adminBase}/catalog`, { method: "POST", body: JSON.stringify(input) }),
  catalogDelete: (id: string) =>
    call<{ ok: true }>(`${adminBase}/catalog/${id}`, { method: "DELETE" }),

  packagesList: () => call<{ items: QuotePackage[] }>(`${adminBase}/packages`),
  packageSave: (input: Partial<QuotePackage>) =>
    call<{ ok: true }>(`${adminBase}/packages`, { method: "POST", body: JSON.stringify(input) }),
  packageDelete: (id: string) =>
    call<{ ok: true }>(`${adminBase}/packages/${id}`, { method: "DELETE" }),

  templatesList: () => call<{ items: PaymentTemplate[] }>(`${adminBase}/payment-templates`),
  templateSave: (input: Partial<PaymentTemplate>) =>
    call<{ ok: true }>(`${adminBase}/payment-templates`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  templateDelete: (id: string) =>
    call<{ ok: true }>(`${adminBase}/payment-templates/${id}`, { method: "DELETE" }),

  settingsGet: () => call<FieldQuoteSettings>(`${adminBase}/settings`),
  settingsSave: (input: FieldQuoteSettings) =>
    call<{ ok: true }>(`${adminBase}/settings`, { method: "PUT", body: JSON.stringify(input) }),
};

const publicBase = "/api/field-quotes/public";

export const fieldQuotePublicApi = {
  get: (token: string) =>
    call<{
      quote: Omit<
        FieldQuote,
        | "surveyNote"
        | "customerNote"
        | "discountOverCapApprovedBy"
        | "leadId"
        | "publicToken"
        | "publicTokenExpiresAt"
        | "signatureKey"
      >;
      totals: FieldQuoteTotals;
    }>(`${publicBase}/${token}`),
  sign: (token: string, signatureDataUrl: string, pdfBase64: string) =>
    call<{ ok: true; pdfUrl: string }>(`${publicBase}/${token}/signature`, {
      method: "POST",
      body: JSON.stringify({ signatureDataUrl, pdfBase64, acceptedStatement: true }),
    }),
  decline: (token: string, reason?: string) =>
    call<{ ok: true }>(`${publicBase}/${token}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
