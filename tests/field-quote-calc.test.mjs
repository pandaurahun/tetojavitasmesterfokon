// Money math for the field-quote module. Run with `npm test`.
// The same functions run in the browser (live total), on the server (dashboard,
// signed snapshot) and in the PDF, so any rounding drift here is a legal
// document showing a number nobody typed.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commonVatRate,
  computeFieldQuoteTotals,
  effectiveDiscountPercent,
  formatPercent,
  formatQty,
  lineNet,
} from "../src/lib/field-quote-calc.ts";

const CALC_ITEMS = [
  { qty: 100, unitPrice: 5000, vat: 27 },
  { qty: 20, unitPrice: 8000, vat: 27 },
  { qty: 1, unitPrice: 50000, vat: 27 },
];

test("the reference quote: 100x5000 + 20x8000 + 1x50000 at 27% VAT", () => {
  assert.deepEqual(computeFieldQuoteTotals(CALC_ITEMS, undefined, 0), {
    net: 710_000,
    discount: 0,
    netAfterDiscount: 710_000,
    vat: 191_700,
    gross: 901_700,
  });
});

test("a 5% discount reduces the VAT base too", () => {
  const t = computeFieldQuoteTotals(CALC_ITEMS, "percent", 5);
  assert.equal(t.discount, 35_500);
  assert.equal(t.netAfterDiscount, 674_500);
  assert.equal(t.vat, 182_115); // 27% of 674 500
  assert.equal(t.gross, 856_615);
});

test("floating-point products never leak: 3 x 33.33 is 100 Ft, not 99.99000000000001", () => {
  assert.equal(lineNet(3, 33.33), 100);
  assert.equal(lineNet(0.1 + 0.2, 10), 3);
  const t = computeFieldQuoteTotals([{ qty: 3, unitPrice: 33.33, vat: 27 }], undefined, 0);
  for (const value of Object.values(t)) assert.ok(Number.isInteger(value), `${value} is whole`);
});

test("a fixed discount can never exceed the net", () => {
  const t = computeFieldQuoteTotals(CALC_ITEMS, "fixed", 9_999_999);
  assert.equal(t.discount, 710_000);
  assert.equal(t.netAfterDiscount, 0);
  assert.equal(t.vat, 0);
  assert.equal(t.gross, 0);
});

test("a percent discount is clamped to 100%", () => {
  assert.equal(computeFieldQuoteTotals(CALC_ITEMS, "percent", 250).discount, 710_000);
});

test("mixed VAT rates: the discount is shared out so the parts add up exactly", () => {
  const items = [
    { qty: 1, unitPrice: 100_000, vat: 27 },
    { qty: 1, unitPrice: 50_000, vat: 5 },
  ];
  const t = computeFieldQuoteTotals(items, "percent", 10);
  assert.equal(t.net, 150_000);
  assert.equal(t.discount, 15_000);
  // 27%: 90 000 x .27 = 24 300   5%: 45 000 x .05 = 2 250
  assert.equal(t.vat, 26_550);
  assert.equal(t.gross, 135_000 + 26_550);
});

test("bad input is neutralised, never NaN", () => {
  const t = computeFieldQuoteTotals(
    [
      { qty: Number.NaN, unitPrice: 100, vat: 27 },
      { qty: 2, unitPrice: -50, vat: Number.POSITIVE_INFINITY },
    ],
    "percent",
    Number.NaN,
  );
  for (const value of Object.values(t)) assert.ok(Number.isFinite(value));
  assert.equal(t.net, 0);
});

test("empty quote", () => {
  assert.deepEqual(computeFieldQuoteTotals([], "percent", 10), {
    net: 0,
    discount: 0,
    netAfterDiscount: 0,
    vat: 0,
    gross: 0,
  });
});

// Deterministic PRNG so a failure is reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("property: 5000 random quotes always add up exactly and stay whole", () => {
  const rand = mulberry32(20261004);
  const vatRates = [0, 5, 18, 27];
  for (let n = 0; n < 5000; n++) {
    const items = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => ({
      qty: Math.round(rand() * 5000) / 100, // 0.00 .. 50.00
      unitPrice: Math.round(rand() * 2_000_000) / 100, // 0.00 .. 20 000.00
      vat: vatRates[Math.floor(rand() * vatRates.length)],
    }));
    const type = ["percent", "fixed", undefined][Math.floor(rand() * 3)];
    const value =
      type === "percent" ? Math.round(rand() * 3000) / 100 : Math.round(rand() * 50_000);
    const t = computeFieldQuoteTotals(items, type, value);

    for (const [key, v] of Object.entries(t)) {
      assert.ok(
        Number.isInteger(v) && v >= 0,
        `${key}=${v} for ${JSON.stringify({ items, type, value })}`,
      );
    }
    assert.equal(
      t.net,
      items.reduce((s, i) => s + lineNet(i.qty, i.unitPrice), 0),
    );
    assert.equal(t.netAfterDiscount, t.net - t.discount);
    assert.equal(t.gross, t.netAfterDiscount + t.vat);
    assert.ok(t.discount <= t.net);
    // VAT can never exceed the highest rate applied to the discounted net.
    assert.ok(t.vat <= Math.ceil((t.netAfterDiscount * 27) / 100) + items.length);
  }
});

test("effectiveDiscountPercent puts both discount styles on the same scale", () => {
  assert.equal(effectiveDiscountPercent(CALC_ITEMS, "percent", 12), 12);
  assert.equal(effectiveDiscountPercent(CALC_ITEMS, "fixed", 71_000), 10);
  assert.equal(effectiveDiscountPercent(CALC_ITEMS, undefined, 50), 0);
  assert.equal(effectiveDiscountPercent([], "fixed", 100), 0);
  assert.equal(effectiveDiscountPercent(CALC_ITEMS, "percent", 0), 0);
});

test("the server-side cap check and the editor warning agree on a fixed discount", () => {
  // 25% of 710 000 as a fixed amount is exactly 25% — over a 10% cap.
  assert.ok(effectiveDiscountPercent(CALC_ITEMS, "fixed", 177_500) > 10);
  assert.ok(effectiveDiscountPercent(CALC_ITEMS, "fixed", 35_500) <= 10);
});

test("labels", () => {
  assert.equal(commonVatRate(CALC_ITEMS), 27);
  assert.equal(commonVatRate([...CALC_ITEMS, { qty: 1, unitPrice: 1, vat: 5 }]), null);
  assert.equal(commonVatRate([]), null);
  assert.equal(formatPercent(5), "5%");
  assert.equal(formatPercent(7.5), "7,5%");
  assert.equal(formatQty(12.5), "12,5");
  assert.equal(formatQty(120), "120");
});
