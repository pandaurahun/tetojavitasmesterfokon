export type FieldQuoteStatus =
  "DRAFT" | "READY" | "WAITING_FOR_SIGNATURE" | "SIGNED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export type DiscountType = "percent" | "fixed";

export interface FieldQuoteItem {
  id: string;
  catalogItemId?: string | undefined;
  name: string;
  description?: string | undefined;
  category?: string | undefined;
  qty: number;
  unit: string;
  unitPrice: number;
  vat: number;
  sortOrder: number;
}

export interface FieldQuotePhoto {
  id: string;
  url: string;
  caption?: string | undefined;
  sortOrder: number;
}

export interface FieldQuote {
  id: string;
  number: string;
  version: number;
  rootId: string;
  supersedesId?: string | undefined;
  leadId?: string | undefined;
  status: FieldQuoteStatus;

  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
  customerZip?: string | undefined;
  customerCity?: string | undefined;
  customerAddress?: string | undefined;
  billingName?: string | undefined;
  billingAddress?: string | undefined;
  customerNote?: string | undefined;

  propertyType?: string | undefined;
  roofType?: string | undefined;
  roofCovering?: string | undefined;
  estimatedSize?: string | undefined;
  sizeUnit?: string | undefined;
  roofCondition?: string | undefined;
  surveyNote?: string | undefined;

  discountType?: DiscountType | undefined;
  discountValue: number;
  discountOverCapApprovedBy?: string | undefined;
  validityDate?: string | undefined;
  expectedStart?: string | undefined;
  expectedDuration?: string | undefined;
  paymentTerms?: string | undefined;
  customerNotes?: string | undefined;
  acceptanceText: string;

  surveyorAdminId: string;
  surveyorName?: string | undefined;
  publicToken?: string | undefined;
  publicTokenExpiresAt?: string | undefined;
  signedAt?: string | undefined;
  declinedAt?: string | undefined;
  declineReason?: string | undefined;

  createdAt: string;
  updatedAt: string;

  items: FieldQuoteItem[];
  photos: FieldQuotePhoto[];
  pdfKey?: string | undefined;
  signatureKey?: string | undefined;
  documentHash?: string | undefined;
}

export interface FieldQuoteTotals {
  net: number;
  discount: number;
  netAfterDiscount: number;
  vat: number;
  gross: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  description?: string | undefined;
  unit: string;
  basePrice: number;
  vat: number;
  active: boolean;
  sortOrder: number;
}

export interface QuotePackageItem {
  catalogItemId: string;
  defaultQty: number;
  sortOrder: number;
}

export interface QuotePackage {
  id: string;
  name: string;
  description?: string | undefined;
  active: boolean;
  sortOrder: number;
  items: QuotePackageItem[];
}

export interface PaymentTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface FieldQuoteSettings {
  maxDiscountPercent: number;
  defaultValidityDays: number;
  acceptanceStatement: string;
}

export const FIELD_QUOTE_STATUS_LABELS: Record<FieldQuoteStatus, string> = {
  DRAFT: "Piszkozat",
  READY: "Kész",
  WAITING_FOR_SIGNATURE: "Aláírásra vár",
  SIGNED: "Aláírt",
  DECLINED: "Elutasított",
  EXPIRED: "Lejárt",
  CANCELLED: "Visszavont",
};

export const PROPERTY_TYPES = [
  "Családi ház",
  "Társasház",
  "Melléképület",
  "Garázs",
  "Gazdasági épület",
  "Egyéb",
] as const;

export const ROOF_TYPES = [
  "Nyeregtető",
  "Sátortető",
  "Félnyeregtető",
  "Lapostető",
  "Kontytető",
  "Egyéb",
] as const;

export const ROOF_COVERINGS = [
  "Cserép",
  "Betoncserép",
  "Lemez",
  "Pala",
  "Zsindely",
  "Bitumenes",
  "Egyéb",
] as const;

// The public quote-request wizard words building type, roof shape and covering
// differently from the field-quote editor's (shorter) lists. A lead's value is
// translated when there is a clear equivalent and otherwise left unset — never
// forced into a wrong choice, and never stored as text the dropdown can't show.
const WIZARD_PROPERTY_TYPES: Record<string, (typeof PROPERTY_TYPES)[number]> = {
  "Családi ház": "Családi ház",
  Társasház: "Társasház",
  Melléképület: "Melléképület",
  "Ipari vagy mezőgazdasági épület": "Gazdasági épület",
  Nyaraló: "Egyéb",
  Középület: "Egyéb",
};
const WIZARD_ROOF_TYPES: Record<string, (typeof ROOF_TYPES)[number]> = {
  Nyeregtető: "Nyeregtető",
  Kontytető: "Kontytető",
  Féltető: "Félnyeregtető",
  Lapostető: "Lapostető",
  Összetett: "Egyéb",
};
const WIZARD_ROOF_COVERINGS: Record<string, (typeof ROOF_COVERINGS)[number]> = {
  Betoncserép: "Betoncserép",
  "Kerámia cserép": "Cserép",
  "Hódfarkú cserép": "Cserép",
  Palafedés: "Pala",
  Trapézlemez: "Lemez",
  Zsindely: "Zsindely",
  "Bitumenes lemez": "Bitumenes",
};

export const propertyTypeFromLead = (value?: string): string =>
  (value && WIZARD_PROPERTY_TYPES[value]) || "";
export const roofTypeFromLead = (value?: string): string =>
  (value && WIZARD_ROOF_TYPES[value]) || "";
export const roofCoveringFromLead = (value?: string): string =>
  (value && WIZARD_ROOF_COVERINGS[value]) || "";
/** "120 m²" → "120"; the unit lives in its own select. */
export const areaNumberFromLead = (value?: string): string =>
  value?.match(/\d+(?:[.,]\d+)?/)?.[0] ?? "";

export const SIZE_UNITS = ["m²", "fm", "db"] as const;

export const ROOF_CONDITIONS = ["Jó", "Közepes", "Rossz", "Sürgős javítás szükséges"] as const;

export const CATALOG_UNITS = ["db", "m", "fm", "m²", "óra", "nap", "alkalom", "átalány"] as const;

export const DECLINE_REASONS = [
  "Túl magas ár",
  "Át kell gondolnom",
  "Más ajánlatokat is kérek",
  "Időpont nem megfelelő",
  "Egyéb",
] as const;
