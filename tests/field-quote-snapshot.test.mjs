// The signed document snapshot and its SHA-256 are the legal record of a
// signed field quote. These tests pin the properties that make the hash
// trustworthy: it is deterministic, it covers everything that was agreed, and
// it does not drift when unrelated things change.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { buildDocumentSnapshot, sha256Hex } from "../src/server/field-quote-snapshot.ts";
import { computeFieldQuoteTotals } from "../src/lib/field-quote-calc.ts";

const SELLER = {
  name: "Tetőjavítás Mesterfokon Kft.",
  address: "5000 Szolnok, Fő utca 1.",
  taxNumber: "12345678-2-16",
  phone: "+36 30 123 4567",
  email: "info@tetojavitasmesterfokon.hu",
};

function makeQuote(over = {}) {
  return {
    id: "q-1",
    number: "HJA-2026-000001",
    version: 1,
    rootId: "q-1",
    status: "READY",
    customerName: "Teszt Elek",
    customerPhone: "+36 30 123 4567",
    customerEmail: "teszt@example.com",
    customerZip: "5000",
    customerCity: "Szolnok",
    customerAddress: "Teszt utca 1.",
    billingName: "Teszt Elek Számla Kft.",
    billingAddress: "5000 Szolnok, Számla köz 2.",
    customerNote: "BELSO-LEAD-NOTE",
    propertyType: "Családi ház",
    roofType: "Nyeregtető",
    roofCovering: "Cserép",
    estimatedSize: "120",
    sizeUnit: "m²",
    roofCondition: "Közepes",
    surveyNote: "BELSO-SURVEY-NOTE",
    discountType: "percent",
    discountValue: 5,
    discountOverCapApprovedBy: undefined,
    validityDate: "2026-12-31",
    expectedStart: "2 héten belül",
    expectedDuration: "3 nap",
    paymentTerms: "50% előleg, 50% átadáskor.",
    customerNotes: "tető, függő, műszaki, felmérő, tetőfedés, árvíztűrő, tükörfúrógép",
    acceptanceText: "Az ajánlat tartalmát megismertem.",
    surveyorAdminId: "admin-1",
    publicToken: "SECRET-TOKEN",
    pdfKey: "should-not-appear",
    leadId: "lead-1",
    createdAt: "2026-10-04T08:00:00.000Z",
    updatedAt: "2026-10-04T08:05:00.000Z",
    photos: [],
    items: [
      { id: "i2", name: "B tétel", qty: 3, unit: "db", unitPrice: 33_333, vat: 27, sortOrder: 1 },
      { id: "i1", name: "A tétel", qty: 120, unit: "m²", unitPrice: 8_500, vat: 27, sortOrder: 0 },
    ],
    ...over,
  };
}

const SIGNED_AT = "2026-10-04T09:07:43.000Z";
const snapshotOf = (quote, seller = SELLER) =>
  buildDocumentSnapshot(
    quote,
    computeFieldQuoteTotals(quote.items, quote.discountType, quote.discountValue),
    SIGNED_AT,
    seller,
  );

test("deterministic: the same quote always yields the same snapshot and hash", async () => {
  const a = snapshotOf(makeQuote());
  const b = snapshotOf(makeQuote());
  assert.equal(a, b);
  assert.equal(await sha256Hex(a), await sha256Hex(b));
});

test("sha256Hex matches an independent implementation (node:crypto)", async () => {
  const text = snapshotOf(makeQuote());
  assert.equal(await sha256Hex(text), createHash("sha256").update(text, "utf8").digest("hex"));
  assert.match(await sha256Hex(text), /^[0-9a-f]{64}$/);
});

test("Hungarian text survives byte-exact (UTF-8, no escapes that could differ)", () => {
  const snapshot = snapshotOf(makeQuote());
  for (const word of [
    "tető",
    "függő",
    "műszaki",
    "felmérő",
    "tetőfedés",
    "árvíztűrő",
    "tükörfúrógép",
  ]) {
    assert.ok(snapshot.includes(word), word);
  }
});

test("items are ordered by sortOrder, not by array position", () => {
  const snapshot = JSON.parse(snapshotOf(makeQuote()));
  assert.deepEqual(
    snapshot.items.map((i) => i.name),
    ["A tétel", "B tétel"],
  );
});

test("everything that was agreed changes the hash", async () => {
  const base = await sha256Hex(snapshotOf(makeQuote()));
  const variants = {
    "price of a line": makeQuote({
      items: makeQuote().items.map((i) => (i.id === "i1" ? { ...i, unitPrice: 8_501 } : i)),
    }),
    "quantity of a line": makeQuote({
      items: makeQuote().items.map((i) => (i.id === "i1" ? { ...i, qty: 121 } : i)),
    }),
    discount: makeQuote({ discountValue: 6 }),
    "customer name": makeQuote({ customerName: "Teszt Elemér" }),
    "billing data": makeQuote({ billingName: "Más Kft." }),
    "payment terms": makeQuote({ paymentTerms: "100% előleg." }),
    validity: makeQuote({ validityDate: "2027-01-01" }),
    "acceptance text": makeQuote({ acceptanceText: "Más szöveg." }),
    version: makeQuote({ version: 2 }),
  };
  for (const [what, quote] of Object.entries(variants)) {
    assert.notEqual(
      await sha256Hex(snapshotOf(quote)),
      base,
      `changing the ${what} must change the hash`,
    );
  }
});

test("the seller's identity is part of what was agreed", async () => {
  const base = await sha256Hex(snapshotOf(makeQuote()));
  assert.notEqual(
    await sha256Hex(snapshotOf(makeQuote(), { ...SELLER, taxNumber: "00000000-0-00" })),
    base,
  );
  assert.notEqual(await sha256Hex(snapshotOf(makeQuote(), { ...SELLER, address: "Máshol" })), base);
});

test("internal and volatile fields never enter the snapshot", async () => {
  const quote = makeQuote();
  const base = await sha256Hex(snapshotOf(quote));
  const text = snapshotOf(quote);
  for (const secret of [
    "BELSO-LEAD-NOTE",
    "BELSO-SURVEY-NOTE",
    "SECRET-TOKEN",
    "should-not-appear",
    "lead-1",
  ]) {
    assert.ok(!text.includes(secret), `${secret} must not be in the snapshot`);
  }
  // ...and changing them later must not change the recorded hash input.
  const later = makeQuote({
    customerNote: "megváltozott belső jegyzet",
    surveyNote: "másik",
    publicToken: "NEW-TOKEN",
    pdfKey: "other.pdf",
    updatedAt: "2027-01-01T00:00:00.000Z",
    leadId: "lead-9",
  });
  assert.equal(await sha256Hex(snapshotOf(later)), base);
});

test("the recorded totals are the shared calculation's output", () => {
  const quote = makeQuote();
  const snapshot = JSON.parse(snapshotOf(quote));
  assert.deepEqual(snapshot.totals, computeFieldQuoteTotals(quote.items, "percent", 5));
  assert.equal(snapshot.signedAt, SIGNED_AT);
  assert.equal(snapshot.quoteNumber, "HJA-2026-000001");
});
