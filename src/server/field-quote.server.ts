import type { FieldQuote, FieldQuoteItem, FieldQuotePhoto } from "@/demo/field-quote-types";
import { computeFieldQuoteTotals } from "@/lib/field-quote-calc";

type Row = Record<string, unknown>;

function s(row: Row, key: string): string {
  return (row[key] as string) ?? "";
}
function sOpt(row: Row, key: string): string | undefined {
  const v = row[key];
  return v === null || v === undefined || v === "" ? undefined : (v as string);
}
function n(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

// Timestamps are stored as epoch milliseconds. `new Date(NaN).toISOString()`
// throws a RangeError, so one row with a corrupt/NULL/non-numeric timestamp
// would otherwise fail the whole list (and every page that renders it).
// Missing or unusable values become `undefined` and the caller picks a fallback.
function safeIso(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const ms = Number(value);
  if (!Number.isFinite(ms)) return undefined;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapItem(row: Row): FieldQuoteItem {
  return {
    id: s(row, "id"),
    catalogItemId: sOpt(row, "catalog_item_id"),
    name: s(row, "name"),
    description: sOpt(row, "description"),
    category: sOpt(row, "category"),
    qty: n(row, "qty"),
    unit: s(row, "unit"),
    unitPrice: n(row, "unit_price"),
    vat: n(row, "vat"),
    sortOrder: n(row, "sort_order"),
  };
}

function mapPhoto(row: Row): FieldQuotePhoto {
  return {
    id: s(row, "id"),
    url: s(row, "storage_key"),
    caption: sOpt(row, "caption"),
    sortOrder: n(row, "sort_order"),
  };
}

function mapQuote(row: Row, items: FieldQuoteItem[], photos: FieldQuotePhoto[]): FieldQuote {
  return {
    id: s(row, "id"),
    number: s(row, "number"),
    version: n(row, "version"),
    rootId: s(row, "root_id"),
    supersedesId: sOpt(row, "supersedes_id"),
    leadId: sOpt(row, "lead_id"),
    status: s(row, "status") as FieldQuote["status"],

    customerName: s(row, "customer_name"),
    customerPhone: s(row, "customer_phone"),
    customerEmail: sOpt(row, "customer_email"),
    customerZip: sOpt(row, "customer_zip"),
    customerCity: sOpt(row, "customer_city"),
    customerAddress: sOpt(row, "customer_address"),
    billingName: sOpt(row, "billing_name"),
    billingAddress: sOpt(row, "billing_address"),
    customerNote: sOpt(row, "customer_note"),

    propertyType: sOpt(row, "property_type"),
    roofType: sOpt(row, "roof_type"),
    roofCovering: sOpt(row, "roof_covering"),
    estimatedSize: sOpt(row, "estimated_size"),
    sizeUnit: sOpt(row, "size_unit"),
    roofCondition: sOpt(row, "roof_condition"),
    surveyNote: sOpt(row, "survey_note"),

    discountType: sOpt(row, "discount_type") as FieldQuote["discountType"],
    discountValue: n(row, "discount_value"),
    discountOverCapApprovedBy: sOpt(row, "discount_over_cap_approved_by"),
    validityDate: sOpt(row, "validity_date"),
    expectedStart: sOpt(row, "expected_start"),
    expectedDuration: sOpt(row, "expected_duration"),
    paymentTerms: sOpt(row, "payment_terms"),
    customerNotes: sOpt(row, "customer_notes"),
    acceptanceText: s(row, "acceptance_text"),

    surveyorAdminId: s(row, "surveyor_admin_id"),
    surveyorName: sOpt(row, "surveyor_email"),
    publicToken: sOpt(row, "public_token"),
    publicTokenExpiresAt: safeIso(row["public_token_expires_at"]),
    signedAt: safeIso(row["signed_at"]),
    declinedAt: safeIso(row["declined_at"]),
    declineReason: sOpt(row, "decline_reason"),

    createdAt: safeIso(row["created_at"]) ?? new Date(0).toISOString(),
    updatedAt:
      safeIso(row["updated_at"]) ?? safeIso(row["created_at"]) ?? new Date(0).toISOString(),

    items,
    photos,
    pdfKey: sOpt(row, "pdf_storage_key"),
    signatureKey: sOpt(row, "signature_storage_key"),
    documentHash: sOpt(row, "document_hash"),
  };
}

const SIGNATURE_JOIN = `LEFT JOIN field_quote_signatures fs ON fs.field_quote_id = fq.id`;
const SIGNATURE_COLUMNS = `fs.pdf_storage_key AS pdf_storage_key, fs.signature_storage_key AS signature_storage_key, fs.document_hash AS document_hash`;

export const computeTotals = computeFieldQuoteTotals;

// A single UPDATE ... RETURNING is atomic at the SQLite statement level —
// unlike a "SELECT MAX(number) then +1" read-then-write, two concurrent
// callers (e.g. two admins saving a new quote at the same moment) can never
// observe or claim the same value.
async function nextFieldQuoteNumber(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  await db
    .prepare(
      `INSERT INTO field_quote_counters (year, value) VALUES (?1, 0) ON CONFLICT(year) DO NOTHING`,
    )
    .bind(year)
    .run();
  const row = await db
    .prepare(`UPDATE field_quote_counters SET value = value + 1 WHERE year = ?1 RETURNING value`)
    .bind(year)
    .first<{ value: number }>();
  const next = row?.value ?? 1;
  return `HJA-${year}-${String(next).padStart(6, "0")}`;
}

export async function logFieldQuoteEvent(
  db: D1Database,
  fieldQuoteId: string,
  eventType: string,
  actor: string,
  detail?: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO field_quote_events (id, field_quote_id, event_type, detail, actor, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(crypto.randomUUID(), fieldQuoteId, eventType, detail ?? null, actor, Date.now())
    .run();
}

async function loadItemsAndPhotos(
  db: D1Database,
  fieldQuoteId: string,
): Promise<{ items: FieldQuoteItem[]; photos: FieldQuotePhoto[] }> {
  const [itemRows, photoRows] = await db.batch([
    db
      .prepare(`SELECT * FROM field_quote_items WHERE field_quote_id = ?1 ORDER BY sort_order ASC`)
      .bind(fieldQuoteId),
    db
      .prepare(`SELECT * FROM field_quote_photos WHERE field_quote_id = ?1 ORDER BY sort_order ASC`)
      .bind(fieldQuoteId),
  ]);
  return {
    items: (itemRows?.results ?? []).map((r) => mapItem(r as Row)),
    photos: (photoRows?.results ?? []).map((r) => mapPhoto(r as Row)),
  };
}

export async function loadFieldQuote(db: D1Database, id: string): Promise<FieldQuote | null> {
  const row = await db
    .prepare(
      `SELECT fq.*, a.email AS surveyor_email, ${SIGNATURE_COLUMNS} FROM field_quotes fq
         LEFT JOIN admins a ON a.id = fq.surveyor_admin_id
         ${SIGNATURE_JOIN}
        WHERE fq.id = ?1`,
    )
    .bind(id)
    .first<Row>();
  if (!row) return null;
  const { items, photos } = await loadItemsAndPhotos(db, id);
  return mapQuote(row, items, photos);
}

export async function loadFieldQuoteByToken(
  db: D1Database,
  token: string,
): Promise<FieldQuote | null> {
  const row = await db
    .prepare(
      `SELECT fq.*, a.email AS surveyor_email, ${SIGNATURE_COLUMNS} FROM field_quotes fq
         LEFT JOIN admins a ON a.id = fq.surveyor_admin_id
         ${SIGNATURE_JOIN}
        WHERE fq.public_token = ?1`,
    )
    .bind(token)
    .first<Row>();
  if (!row) return null;
  if (row["public_token_expires_at"] && n(row, "public_token_expires_at") < Date.now()) return null;
  const { items, photos } = await loadItemsAndPhotos(db, s(row, "id"));
  return mapQuote(row, items, photos);
}

export interface FieldQuoteListFilters {
  status?: string | undefined;
  q?: string | undefined;
}

export async function listFieldQuotes(
  db: D1Database,
  filters: FieldQuoteListFilters,
): Promise<FieldQuote[]> {
  // One row per root_id — the latest version only (highest `version` per root).
  const clauses = [
    "fq.id = (SELECT id FROM field_quotes f2 WHERE f2.root_id = fq.root_id ORDER BY f2.version DESC LIMIT 1)",
  ];
  const binds: unknown[] = [];
  if (filters.status) {
    clauses.push(`fq.status = ?${binds.length + 1}`);
    binds.push(filters.status);
  }
  if (filters.q) {
    clauses.push(
      `(fq.customer_name LIKE ?${binds.length + 1} OR fq.customer_phone LIKE ?${binds.length + 1} OR fq.customer_city LIKE ?${binds.length + 1} OR fq.number LIKE ?${binds.length + 1})`,
    );
    binds.push(`%${filters.q}%`);
  }
  const stmt = db
    .prepare(
      `SELECT fq.*, a.email AS surveyor_email, ${SIGNATURE_COLUMNS} FROM field_quotes fq
         LEFT JOIN admins a ON a.id = fq.surveyor_admin_id
         ${SIGNATURE_JOIN}
        WHERE ${clauses.join(" AND ")}
        ORDER BY fq.created_at DESC LIMIT 500`,
    )
    .bind(...binds);
  const result = await stmt.all<Row>();
  const rows = result.results ?? [];
  // Items/photos aren't needed for the list view — skip the N+1 fetch.
  // One unreadable row must never take the whole list (and the dashboard
  // page that renders it) down, so each row is mapped on its own.
  const quotes: FieldQuote[] = [];
  for (const row of rows) {
    try {
      quotes.push(mapQuote(row, [], []));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "field_quote_list_row_skipped",
          id: typeof row["id"] === "string" ? row["id"] : null,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return quotes;
}

export interface SaveFieldQuoteInput {
  id?: string | undefined;
  leadId?: string | undefined;
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
  discountType?: "percent" | "fixed" | undefined;
  discountValue: number;
  discountOverCapApprovedBy?: string | undefined;
  validityDate?: string | undefined;
  expectedStart?: string | undefined;
  expectedDuration?: string | undefined;
  paymentTerms?: string | undefined;
  customerNotes?: string | undefined;
  items: {
    id?: string | undefined;
    catalogItemId?: string | undefined;
    name: string;
    description?: string | undefined;
    category?: string | undefined;
    qty: number;
    unit: string;
    unitPrice: number;
    vat: number;
  }[];
}

// Creates a DRAFT on first save, otherwise updates the SAME row in place —
// UNLESS that row is already SIGNED, in which case the caller must use
// createNewVersion() instead (checked by the route handler).
export async function saveFieldQuote(
  db: D1Database,
  input: SaveFieldQuoteInput,
  adminId: string,
  acceptanceStatement: string,
): Promise<FieldQuote> {
  const now = Date.now();
  let id = input.id;
  let rootId = id;
  let number: string;
  let isNew = false;

  if (id) {
    const existing = await db
      .prepare(`SELECT root_id, number, status FROM field_quotes WHERE id = ?1`)
      .bind(id)
      .first<{ root_id: string; number: string; status: string }>();
    if (!existing) throw new Error("A helyszíni ajánlat nem található.");
    if (existing.status === "SIGNED") {
      throw new Error("SIGNED_IMMUTABLE");
    }
    rootId = existing.root_id;
    number = existing.number;
  } else {
    id = crypto.randomUUID();
    rootId = id;
    number = await nextFieldQuoteNumber(db);
    isNew = true;
  }

  const statements: D1PreparedStatement[] = [
    isNew
      ? db
          .prepare(
            `INSERT INTO field_quotes (
              id, number, version, root_id, lead_id, status,
              customer_name, customer_phone, customer_email, customer_zip, customer_city, customer_address,
              billing_name, billing_address, customer_note,
              property_type, roof_type, roof_covering, estimated_size, size_unit, roof_condition, survey_note,
              discount_type, discount_value, discount_over_cap_approved_by, validity_date, expected_start, expected_duration,
              payment_terms, customer_notes, acceptance_text,
              surveyor_admin_id, created_at, updated_at
            ) VALUES (?1,?2,1,?3,?4,'DRAFT',?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?31)`,
          )
          .bind(
            id,
            number,
            rootId,
            input.leadId ?? null,
            input.customerName,
            input.customerPhone,
            input.customerEmail || null,
            input.customerZip || null,
            input.customerCity || null,
            input.customerAddress || null,
            input.billingName || null,
            input.billingAddress || null,
            input.customerNote || null,
            input.propertyType || null,
            input.roofType || null,
            input.roofCovering || null,
            input.estimatedSize || null,
            input.sizeUnit || null,
            input.roofCondition || null,
            input.surveyNote || null,
            input.discountType || null,
            input.discountValue,
            input.discountOverCapApprovedBy || null,
            input.validityDate || null,
            input.expectedStart || null,
            input.expectedDuration || null,
            input.paymentTerms || null,
            input.customerNotes || null,
            acceptanceStatement,
            adminId,
            now,
          )
      : db
          .prepare(
            `UPDATE field_quotes SET
              lead_id=?2, customer_name=?3, customer_phone=?4, customer_email=?5, customer_zip=?6, customer_city=?7,
              customer_address=?8, billing_name=?9, billing_address=?10, customer_note=?11,
              property_type=?12, roof_type=?13, roof_covering=?14, estimated_size=?15, size_unit=?16,
              roof_condition=?17, survey_note=?18, discount_type=?19, discount_value=?20, discount_over_cap_approved_by=?21,
              validity_date=?22, expected_start=?23, expected_duration=?24, payment_terms=?25, customer_notes=?26, updated_at=?27
             WHERE id=?1`,
          )
          .bind(
            id,
            input.leadId ?? null,
            input.customerName,
            input.customerPhone,
            input.customerEmail || null,
            input.customerZip || null,
            input.customerCity || null,
            input.customerAddress || null,
            input.billingName || null,
            input.billingAddress || null,
            input.customerNote || null,
            input.propertyType || null,
            input.roofType || null,
            input.roofCovering || null,
            input.estimatedSize || null,
            input.sizeUnit || null,
            input.roofCondition || null,
            input.surveyNote || null,
            input.discountType || null,
            input.discountValue,
            input.discountOverCapApprovedBy || null,
            input.validityDate || null,
            input.expectedStart || null,
            input.expectedDuration || null,
            input.paymentTerms || null,
            input.customerNotes || null,
            now,
          ),
    db.prepare(`DELETE FROM field_quote_items WHERE field_quote_id = ?1`).bind(id),
    ...input.items.map((item, index) =>
      db
        .prepare(
          `INSERT INTO field_quote_items
            (id, field_quote_id, catalog_item_id, name, description, category, qty, unit, unit_price, vat, sort_order, created_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
        )
        .bind(
          item.id || crypto.randomUUID(),
          id,
          item.catalogItemId || null,
          item.name,
          item.description || null,
          item.category || null,
          item.qty,
          item.unit,
          item.unitPrice,
          item.vat,
          index,
          now,
        ),
    ),
  ];
  await db.batch(statements);
  await logFieldQuoteEvent(db, id, isNew ? "created" : "updated", adminId);

  const saved = await loadFieldQuote(db, id);
  if (!saved) throw new Error("A mentés nem sikerült.");
  return saved;
}

export async function setFieldQuoteStatus(
  db: D1Database,
  id: string,
  status: "DRAFT" | "READY" | "WAITING_FOR_SIGNATURE" | "CANCELLED",
  actor: string,
): Promise<void> {
  await db
    .prepare(`UPDATE field_quotes SET status = ?2, updated_at = ?3 WHERE id = ?1`)
    .bind(id, status, Date.now())
    .run();
  await logFieldQuoteEvent(db, id, `status_${status.toLowerCase()}`, actor);
}

export async function addFieldQuotePhoto(
  db: D1Database,
  fieldQuoteId: string,
  storageKey: string,
  caption: string | undefined,
  actor: string,
): Promise<string> {
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM field_quote_photos WHERE field_quote_id = ?1`)
    .bind(fieldQuoteId)
    .first<{ n: number }>();
  const photoId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO field_quote_photos (id, field_quote_id, storage_key, caption, sort_order, created_at)
       VALUES (?1,?2,?3,?4,?5,?6)`,
    )
    .bind(photoId, fieldQuoteId, storageKey, caption || null, countRow?.n ?? 0, Date.now())
    .run();
  await logFieldQuoteEvent(db, fieldQuoteId, "photo_added", actor, caption);
  return photoId;
}

export async function removeFieldQuotePhoto(
  db: D1Database,
  photoId: string,
  fieldQuoteId: string,
  actor: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM field_quote_photos WHERE id = ?1 AND field_quote_id = ?2`)
    .bind(photoId, fieldQuoteId)
    .run();
  await logFieldQuoteEvent(db, fieldQuoteId, "photo_removed", actor);
}

// Creates version+1 of a SIGNED quote so the original, signed row is never
// touched. The new row starts as DRAFT with the same content as the
// previous version (caller then edits/saves normally).
export async function createNewFieldQuoteVersion(
  db: D1Database,
  previousId: string,
  actor: string,
): Promise<string> {
  const prev = await loadFieldQuote(db, previousId);
  if (!prev) throw new Error("A helyszíni ajánlat nem található.");
  const newId = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO field_quotes (
          id, number, version, root_id, supersedes_id, lead_id, status,
          customer_name, customer_phone, customer_email, customer_zip, customer_city, customer_address,
          billing_name, billing_address, customer_note,
          property_type, roof_type, roof_covering, estimated_size, size_unit, roof_condition, survey_note,
          discount_type, discount_value, validity_date, expected_start, expected_duration,
          payment_terms, customer_notes, acceptance_text,
          surveyor_admin_id, created_at, updated_at
        ) VALUES (?1,?2,?3,?4,?5,?6,'DRAFT',?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?32)`,
      )
      .bind(
        newId,
        prev.number,
        prev.version + 1,
        prev.rootId,
        previousId,
        prev.leadId ?? null,
        prev.customerName,
        prev.customerPhone,
        prev.customerEmail ?? null,
        prev.customerZip ?? null,
        prev.customerCity ?? null,
        prev.customerAddress ?? null,
        prev.billingName ?? null,
        prev.billingAddress ?? null,
        prev.customerNote ?? null,
        prev.propertyType ?? null,
        prev.roofType ?? null,
        prev.roofCovering ?? null,
        prev.estimatedSize ?? null,
        prev.sizeUnit ?? null,
        prev.roofCondition ?? null,
        prev.surveyNote ?? null,
        prev.discountType ?? null,
        prev.discountValue,
        prev.validityDate ?? null,
        prev.expectedStart ?? null,
        prev.expectedDuration ?? null,
        prev.paymentTerms ?? null,
        prev.customerNotes ?? null,
        prev.acceptanceText,
        actor,
        now,
      ),
    ...prev.items.map((item, index) =>
      db
        .prepare(
          `INSERT INTO field_quote_items
            (id, field_quote_id, catalog_item_id, name, description, category, qty, unit, unit_price, vat, sort_order, created_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
        )
        .bind(
          crypto.randomUUID(),
          newId,
          item.catalogItemId ?? null,
          item.name,
          item.description ?? null,
          item.category ?? null,
          item.qty,
          item.unit,
          item.unitPrice,
          item.vat,
          index,
          now,
        ),
    ),
  ]);
  await logFieldQuoteEvent(db, newId, "new_version_created", actor, `from ${previousId}`);
  return newId;
}

export async function generatePublicToken(
  db: D1Database,
  fieldQuoteId: string,
  days: number,
): Promise<string> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  await db
    .prepare(
      `UPDATE field_quotes SET public_token = ?2, public_token_expires_at = ?3, updated_at = ?4 WHERE id = ?1`,
    )
    .bind(fieldQuoteId, token, expiresAt, Date.now())
    .run();
  await logFieldQuoteEvent(db, fieldQuoteId, "public_link_created", "customer");
  return token;
}

// pdfStorageKey is written in the SAME insert as the signature row, not via
// a follow-up UPDATE — a two-step write would leave a real window where a
// Worker interruption between the steps permanently strands a SIGNED quote
// (immutable from here on) with no retrievable PDF, since nothing could
// ever regenerate or reattach one afterward. The PDF is already uploaded to
// R2 by the time this is called, so there's no reason to split the write.
export async function recordFieldQuoteSignature(
  db: D1Database,
  fieldQuoteId: string,
  signatureStorageKey: string,
  pdfStorageKey: string,
  acceptedStatementText: string,
  documentSnapshot: string,
  surveyorAdminId: string,
  actor: string,
  quoteNumber: string,
  quoteVersion: number,
  documentHash: string,
): Promise<void> {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO field_quote_signatures
          (id, field_quote_id, signature_storage_key, pdf_storage_key, accepted_statement_text, document_snapshot, surveyor_admin_id, signed_at, created_at, quote_number, quote_version, document_hash)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,?10,?11)`,
      )
      .bind(
        crypto.randomUUID(),
        fieldQuoteId,
        signatureStorageKey,
        pdfStorageKey,
        acceptedStatementText,
        documentSnapshot,
        surveyorAdminId,
        now,
        quoteNumber,
        quoteVersion,
        documentHash,
      ),
    db
      .prepare(`UPDATE field_quotes SET status='SIGNED', signed_at=?2, updated_at=?2 WHERE id=?1`)
      .bind(fieldQuoteId, now),
  ]);
  await logFieldQuoteEvent(db, fieldQuoteId, "signature_recorded", actor);
}

export async function declineFieldQuote(
  db: D1Database,
  fieldQuoteId: string,
  reason: string | undefined,
  actor: string,
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE field_quotes SET status='DECLINED', declined_at=?2, decline_reason=?3, updated_at=?2 WHERE id=?1`,
    )
    .bind(fieldQuoteId, now, reason || null)
    .run();
  await logFieldQuoteEvent(db, fieldQuoteId, "declined", actor, reason);
}

export interface FieldQuoteDashboardStats {
  todayCount: number;
  signedCount: number;
  pendingCount: number;
  declinedCount: number;
  todayValue: number;
  acceptedValue: number;
}

// "Today" is the business's day (Hungary), not the Worker's UTC day — a quote
// written at 00:30 CEST must count for today, not yesterday. Computed from the
// wall-clock parts Intl reports for Europe/Budapest, re-checked at the
// candidate instant so a DST-change day doesn't shift it by an hour.
function startOfBudapestDayMs(now: Date = new Date()): number {
  const wallClockAsUtc = (at: Date): { dayStart: number; offset: number } => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Budapest",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const year = get("year");
    const month = get("month") - 1;
    const day = get("day");
    const local = Date.UTC(year, month, day, get("hour"), get("minute"), get("second"));
    return {
      dayStart: Date.UTC(year, month, day),
      offset: local - Math.floor(at.getTime() / 1000) * 1000,
    };
  };
  const first = wallClockAsUtc(now);
  const candidate = first.dayStart - first.offset;
  const second = wallClockAsUtc(new Date(candidate));
  return first.dayStart - second.offset;
}

// Each row is one (quote × item) pair from the LEFT JOIN below; a quote with no
// items still appears once with NULL item columns. Totals use the same shared
// calculation as the editor/PDF/snapshot, so the dashboard can't disagree.
function summarizeQuoteRows(rows: Row[]): { count: number; gross: number } {
  const byQuote = new Map<
    string,
    {
      discountType: "percent" | "fixed" | undefined;
      discountValue: number;
      items: { qty: number; unitPrice: number; vat: number }[];
    }
  >();
  for (const row of rows) {
    const id = s(row, "id");
    let entry = byQuote.get(id);
    if (!entry) {
      entry = {
        discountType: sOpt(row, "discount_type") as "percent" | "fixed" | undefined,
        discountValue: n(row, "discount_value"),
        items: [],
      };
      byQuote.set(id, entry);
    }
    if (row["qty"] !== null && row["qty"] !== undefined) {
      entry.items.push({ qty: n(row, "qty"), unitPrice: n(row, "unit_price"), vat: n(row, "vat") });
    }
  }
  let gross = 0;
  for (const entry of byQuote.values()) {
    gross += computeTotals(entry.items, entry.discountType, entry.discountValue).gross;
  }
  return { count: byQuote.size, gross };
}

export async function getFieldQuoteDashboardStats(
  db: D1Database,
): Promise<FieldQuoteDashboardStats> {
  const todayMs = startOfBudapestDayMs();
  const withItems = (where: string) =>
    `SELECT fq.id AS id, fq.discount_type AS discount_type, fq.discount_value AS discount_value,
            i.qty AS qty, i.unit_price AS unit_price, i.vat AS vat
       FROM field_quotes fq LEFT JOIN field_quote_items i ON i.field_quote_id = fq.id
      WHERE ${where}`;

  // A fixed four statements however many quotes exist — every D1 call is a
  // Worker subrequest, so a per-quote lookup would cap how busy a day can be.
  const [todayRows, signedRows, pendingRows, declinedRows] = await db.batch<Row>([
    db.prepare(withItems(`fq.created_at >= ?1`)).bind(todayMs),
    db.prepare(withItems(`fq.status = 'SIGNED' AND fq.signed_at >= ?1`)).bind(todayMs),
    db.prepare(
      `SELECT COUNT(*) AS c FROM field_quotes WHERE status IN ('DRAFT','READY','WAITING_FOR_SIGNATURE')`,
    ),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM field_quotes WHERE status = 'DECLINED' AND declined_at >= ?1`,
      )
      .bind(todayMs),
  ]);

  const today = summarizeQuoteRows(todayRows?.results ?? []);
  const signed = summarizeQuoteRows(signedRows?.results ?? []);
  return {
    todayCount: today.count,
    signedCount: signed.count,
    pendingCount: n((pendingRows?.results ?? [])[0] ?? {}, "c"),
    declinedCount: n((declinedRows?.results ?? [])[0] ?? {}, "c"),
    todayValue: today.gross,
    acceptedValue: signed.gross,
  };
}
