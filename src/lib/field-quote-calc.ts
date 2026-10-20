import type { FieldQuoteTotals } from "@/demo/field-quote-types";

interface PricedLine {
  qty: number;
  unitPrice: number;
  vat: number;
}

const nonNegative = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

// Net amount of one line in whole forints. The unit price is taken in fillér
// (1/100 Ft) first: multiplying raw floats like 33.33 × 3 gives
// 99.99000000000001, and a legal quote must never show or sign drift like that.
export function lineNet(qty: number, unitPrice: number): number {
  const priceInFiller = Math.round(nonNegative(unitPrice) * 100);
  return Math.round(Math.round(nonNegative(qty) * priceInFiller) / 100);
}

// Hungarian decimal comma, no float noise: 12.5 → "12,5", 0.1 + 0.2 → "0,3".
export function formatQty(qty: number): string {
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 3 }).format(nonNegative(qty));
}

/** The VAT rate every line shares, or null for a mix (or no lines). */
export function commonVatRate(items: PricedLine[]): number | null {
  const first = items[0];
  if (!first) return null;
  return items.every((item) => item.vat === first.vat) ? first.vat : null;
}

/** "5%", "7,5%" — Hungarian decimal comma, no float noise. */
export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(nonNegative(value))}%`;
}

// One function, used by the browser (live total), the server (dashboard,
// signed snapshot) and the PDF — so they can never disagree.
//
// Everything it returns is a whole number of forints, and the document always
// adds up exactly as printed:
//   net            = Σ of the printed line amounts
//   netAfterDiscount = net − discount
//   gross          = netAfterDiscount + vat
// Rounding happens at explicit, deterministic points only: each line, the
// discount, and the VAT of each VAT-rate group.
export function computeFieldQuoteTotals(
  items: PricedLine[],
  discountType: "percent" | "fixed" | undefined,
  discountValue: number,
): FieldQuoteTotals {
  const groups = new Map<number, number>(); // VAT rate -> net of its lines
  let net = 0;
  for (const item of items) {
    const line = lineNet(item.qty, item.unitPrice);
    const rate = nonNegative(item.vat);
    groups.set(rate, (groups.get(rate) ?? 0) + line);
    net += line;
  }

  const value = nonNegative(discountValue);
  let discount = 0;
  if (discountType === "percent") discount = Math.round((net * Math.min(value, 100)) / 100);
  else if (discountType === "fixed") discount = Math.min(Math.round(value), net);

  // The discount reduces the VAT base proportionally in every VAT-rate group
  // (a 27 % line and a 5 % line each lose their share). The last group takes
  // the remainder so the shares always add up to the whole discount.
  const rates = [...groups.keys()].sort((a, b) => a - b);
  let allocated = 0;
  let vat = 0;
  rates.forEach((rate, index) => {
    const groupNet = groups.get(rate) ?? 0;
    const groupDiscount =
      index === rates.length - 1
        ? discount - allocated
        : net > 0
          ? Math.round((discount * groupNet) / net)
          : 0;
    allocated += groupDiscount;
    vat += Math.round(((groupNet - groupDiscount) * rate) / 100);
  });

  const netAfterDiscount = net - discount;
  return { net, discount, netAfterDiscount, vat, gross: netAfterDiscount + vat };
}

// A fixed-amount discount is compared against the cap as the percentage of
// the net it represents, so both discount styles share one limit — and the
// editor warning and the server check use this one function.
export function effectiveDiscountPercent(
  items: PricedLine[],
  discountType: "percent" | "fixed" | undefined,
  discountValue: number,
): number {
  if (!discountType || !(discountValue > 0)) return 0;
  if (discountType === "percent") return discountValue;
  const { net } = computeFieldQuoteTotals(items, undefined, 0);
  return net > 0 ? (discountValue / net) * 100 : 0;
}
