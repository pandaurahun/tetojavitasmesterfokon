import { z } from "zod";

const shortText = z.string().max(300);
const mediumText = z.string().max(5_000);
const id = z.string().min(1).max(120);

export const fieldQuoteItemInputSchema = z.object({
  id: id.optional(),
  catalogItemId: id.optional(),
  name: shortText.min(1),
  description: mediumText.optional(),
  category: shortText.optional(),
  // Bounded so qty × unit price (computed in fillér) stays far below 2^53 —
  // the money math is exact integer arithmetic only inside that range.
  qty: z.number().finite().min(0).max(100_000),
  unit: shortText.min(1),
  unitPrice: z.number().finite().min(0).max(100_000_000),
  vat: z.number().min(0).max(100),
});

export const fieldQuoteSaveSchema = z.object({
  id: id.optional(),
  leadId: id.optional(),

  customerName: shortText.min(1),
  customerPhone: shortText.min(1),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  customerZip: shortText.optional(),
  customerCity: shortText.optional(),
  customerAddress: shortText.optional(),
  billingName: shortText.optional(),
  billingAddress: shortText.optional(),
  customerNote: mediumText.optional(),

  propertyType: shortText.optional(),
  roofType: shortText.optional(),
  roofCovering: shortText.optional(),
  estimatedSize: shortText.optional(),
  sizeUnit: shortText.optional(),
  roofCondition: shortText.optional(),
  surveyNote: mediumText.optional(),

  discountType: z.enum(["percent", "fixed"]).optional(),
  discountValue: z.number().finite().min(0).max(100_000_000).default(0),
  discountOverCapApprovedBy: shortText.optional(),
  validityDate: shortText.optional(),
  expectedStart: shortText.optional(),
  expectedDuration: shortText.optional(),
  paymentTerms: mediumText.optional(),
  customerNotes: mediumText.optional(),

  items: z.array(fieldQuoteItemInputSchema).max(200),
});

export const fieldQuoteStatusSchema = z.object({
  status: z.enum(["DRAFT", "READY", "WAITING_FOR_SIGNATURE", "CANCELLED"]),
});

export const fieldQuotePhotoSchema = z.object({
  url: shortText.min(1),
  caption: shortText.optional(),
});

export const fieldQuoteSignatureSchema = z.object({
  signatureDataUrl: z.string().min(100).max(2_000_000),
  pdfBase64: z.string().min(100).max(8_000_000),
  acceptedStatement: z.literal(true),
});

export const fieldQuoteDeclineSchema = z.object({
  reason: shortText.optional(),
});

export const catalogItemSaveSchema = z.object({
  id: id.optional(),
  name: shortText.min(1),
  category: shortText.min(1),
  description: mediumText.optional(),
  unit: shortText.min(1),
  basePrice: z.number().finite().min(0).max(100_000_000),
  vat: z.number().min(0).max(100),
  active: z.boolean(),
  sortOrder: z.number().int(),
});

export const packageSaveSchema = z.object({
  id: id.optional(),
  name: shortText.min(1),
  description: mediumText.optional(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  items: z
    .array(
      z.object({
        catalogItemId: id,
        defaultQty: z.number().finite().min(0).max(100_000),
        sortOrder: z.number().int(),
      }),
    )
    .max(100),
});

export const paymentTemplateSaveSchema = z.object({
  id: id.optional(),
  name: shortText.min(1),
  body: mediumText.min(1),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
});

export const fieldQuoteSettingsSchema = z.object({
  maxDiscountPercent: z.number().min(0).max(100),
  defaultValidityDays: z.number().int().min(1).max(365),
  acceptanceStatement: mediumText.min(1),
});
