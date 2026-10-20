import type { FieldQuote, FieldQuoteTotals } from "@/demo/field-quote-types";

// Kept free of any runtime dependency (type imports only) so the exact same
// code can be exercised by plain `node --test` unit tests.

/** Who the quote is from, as recorded in the site settings at signing time. */
export interface SellerIdentity {
  name: string;
  address: string;
  taxNumber: string;
  phone: string;
  email: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// A deterministic, explicit projection of "what was agreed" — built field by
// field (not a spread of the live FieldQuote) so it never silently picks up
// unrelated columns (pdfKey, publicToken, timestamps that change later) and
// so its JSON key order — and therefore its hash — is stable across calls.
// This, not the PDF rendering, is the authoritative legal record: the PDF
// is generated client-side for human readability, but this snapshot and its
// hash are computed on the server, from the server's own data. The seller's
// identity is part of it: who the customer contracted with is as much "what
// was agreed" as the price.
export function buildDocumentSnapshot(
  quote: FieldQuote,
  totals: FieldQuoteTotals,
  signedAtIso: string,
  seller: SellerIdentity,
): string {
  return JSON.stringify({
    quoteId: quote.id,
    quoteNumber: quote.number,
    quoteVersion: quote.version,
    rootId: quote.rootId,
    seller: {
      name: seller.name,
      address: seller.address,
      taxNumber: seller.taxNumber,
      phone: seller.phone,
      email: seller.email,
    },
    customer: {
      name: quote.customerName,
      phone: quote.customerPhone,
      email: quote.customerEmail ?? null,
      zip: quote.customerZip ?? null,
      city: quote.customerCity ?? null,
      address: quote.customerAddress ?? null,
    },
    billing: {
      name: quote.billingName ?? null,
      address: quote.billingAddress ?? null,
    },
    survey: {
      propertyType: quote.propertyType ?? null,
      roofType: quote.roofType ?? null,
      roofCovering: quote.roofCovering ?? null,
      estimatedSize: quote.estimatedSize ?? null,
      sizeUnit: quote.sizeUnit ?? null,
      roofCondition: quote.roofCondition ?? null,
    },
    items: [...quote.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        name: item.name,
        description: item.description ?? null,
        category: item.category ?? null,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vat: item.vat,
      })),
    discount: {
      type: quote.discountType ?? null,
      value: quote.discountValue,
      overCapApprovedBy: quote.discountOverCapApprovedBy ?? null,
    },
    totals,
    validityDate: quote.validityDate ?? null,
    expectedStart: quote.expectedStart ?? null,
    expectedDuration: quote.expectedDuration ?? null,
    paymentTerms: quote.paymentTerms ?? null,
    customerNotes: quote.customerNotes ?? null,
    acceptanceText: quote.acceptanceText,
    surveyorAdminId: quote.surveyorAdminId,
    signedAt: signedAtIso,
  });
}
