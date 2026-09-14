import type { Quote, QuoteItem } from "./types";

export interface QuoteTotals {
  net: number;
  discount: number;
  netAfterDiscount: number;
  vat: number;
  gross: number;
}

export function itemNet(item: QuoteItem) {
  return item.qty * item.unitPrice;
}

export function quoteTotals(quote: Pick<Quote, "items" | "discountPercent">): QuoteTotals {
  const net = quote.items.reduce((sum, i) => sum + itemNet(i), 0);
  const discountRate = (quote.discountPercent || 0) / 100;
  const discount = net * discountRate;
  const netAfterDiscount = net - discount;
  const vat = quote.items.reduce(
    (sum, i) => sum + itemNet(i) * (1 - discountRate) * ((i.vat || 0) / 100),
    0,
  );
  return {
    net,
    discount,
    netAfterDiscount,
    vat,
    gross: netAfterDiscount + vat,
  };
}

export function nextQuoteNumber(existing: { number: string }[]) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((q) => Number(q.number.split("-").pop()))
    .filter((n) => Number.isFinite(n)) as number[];
  const next = (nums.length ? Math.max(...nums) : 180) + 1;
  return `AJ-${year}-${String(next).padStart(4, "0")}`;
}

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
