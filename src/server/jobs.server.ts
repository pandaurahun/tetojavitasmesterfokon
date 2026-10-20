import type { Job, JobEvent, JobStatus } from "@/demo/job-types";
import { JOB_STATUSES, JOB_STATUS_LABELS } from "@/demo/job-types";

type Row = Record<string, unknown>;

const s = (row: Row, key: string): string => (row[key] as string) ?? "";
const sOpt = (row: Row, key: string): string | undefined => {
  const v = row[key];
  return v === null || v === undefined || v === "" ? undefined : (v as string);
};

// Timestamps are epoch milliseconds; `new Date(NaN).toISOString()` throws, so
// one damaged row must not be able to fail the whole list.
function iso(value: unknown): string {
  const ms = Number(value);
  const date = new Date(Number.isFinite(ms) ? ms : 0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function mapJob(row: Row): Job {
  const status = s(row, "status");
  return {
    id: s(row, "id"),
    fieldQuoteId: s(row, "field_quote_id"),
    quoteNumber: s(row, "quote_number"),
    quoteVersion: Number(row["quote_version"] ?? 1),
    customerName: s(row, "customer_name"),
    customerPhone: s(row, "customer_phone"),
    customerEmail: sOpt(row, "customer_email"),
    address: sOpt(row, "address"),
    surveyorAdminId: s(row, "surveyor_admin_id"),
    surveyorName: sOpt(row, "surveyor_email"),
    workType: sOpt(row, "work_type"),
    contractAmount: Number(row["contract_amount"] ?? 0),
    plannedStart: sOpt(row, "planned_start"),
    status: (JOB_STATUSES as readonly string[]).includes(status)
      ? (status as JobStatus)
      : "PREPARATION",
    internalNote: sOpt(row, "internal_note"),
    pdfKey: sOpt(row, "pdf_storage_key"),
    createdAt: iso(row["created_at"]),
    updatedAt: iso(row["updated_at"]),
  };
}

const SELECT_JOB = `SELECT j.*, a.email AS surveyor_email, fs.pdf_storage_key AS pdf_storage_key
                      FROM jobs j
                      LEFT JOIN admins a ON a.id = j.surveyor_admin_id
                      LEFT JOIN field_quote_signatures fs ON fs.field_quote_id = j.field_quote_id`;

export async function listJobs(db: D1Database, filters: { status?: string | undefined }) {
  const status = filters.status && JOB_STATUSES.includes(filters.status as JobStatus);
  const stmt = status
    ? db
        .prepare(`${SELECT_JOB} WHERE j.status = ?1 ORDER BY j.updated_at DESC LIMIT 500`)
        .bind(filters.status)
    : db.prepare(`${SELECT_JOB} ORDER BY j.updated_at DESC LIMIT 500`);
  const result = await stmt.all<Row>();
  const jobs: Job[] = [];
  for (const row of result.results ?? []) {
    try {
      jobs.push(mapJob(row));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "job_list_row_skipped",
          id: typeof row["id"] === "string" ? row["id"] : null,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return jobs;
}

export async function loadJob(db: D1Database, id: string): Promise<Job | null> {
  const row = await db.prepare(`${SELECT_JOB} WHERE j.id = ?1`).bind(id).first<Row>();
  return row ? mapJob(row) : null;
}

export async function loadJobByQuote(db: D1Database, fieldQuoteId: string): Promise<Job | null> {
  const row = await db
    .prepare(`${SELECT_JOB} WHERE j.field_quote_id = ?1`)
    .bind(fieldQuoteId)
    .first<Row>();
  return row ? mapJob(row) : null;
}

export async function listJobEvents(db: D1Database, jobId: string): Promise<JobEvent[]> {
  const result = await db
    .prepare(
      `SELECT * FROM job_events WHERE job_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT 200`,
    )
    .bind(jobId)
    .all<Row>();
  return (result.results ?? []).map((row) => ({
    id: s(row, "id"),
    eventType: s(row, "event_type"),
    detail: sOpt(row, "detail"),
    actor: s(row, "actor"),
    createdAt: iso(row["created_at"]),
  }));
}

async function logJobEvent(
  db: D1Database,
  jobId: string,
  eventType: string,
  actor: string,
  detail?: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO job_events (id, job_id, event_type, detail, actor, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(crypto.randomUUID(), jobId, eventType, detail ?? null, actor, Date.now())
    .run();
}

export type CreateJobResult =
  { ok: true; job: Job; created: boolean } | { ok: false; reason: "NOT_FOUND" | "NOT_SIGNED" };

// A job starts from a SIGNED quote and from nothing else. Everything on it —
// customer, address, amount — is read from the server's own records of that
// quote (the amount from the signed snapshot), never from the request.
export async function createJobFromSignedQuote(
  db: D1Database,
  fieldQuoteId: string,
  actor: string,
): Promise<CreateJobResult> {
  const quote = await db
    .prepare(
      `SELECT fq.id, fq.number, fq.version, fq.status, fq.customer_name, fq.customer_phone,
              fq.customer_email, fq.customer_zip, fq.customer_city, fq.customer_address,
              fq.surveyor_admin_id, fs.document_snapshot
         FROM field_quotes fq
         LEFT JOIN field_quote_signatures fs ON fs.field_quote_id = fq.id
        WHERE fq.id = ?1`,
    )
    .bind(fieldQuoteId)
    .first<Row>();
  if (!quote) return { ok: false, reason: "NOT_FOUND" };
  if (s(quote, "status") !== "SIGNED" || !quote["document_snapshot"]) {
    return { ok: false, reason: "NOT_SIGNED" };
  }

  const existing = await loadJobByQuote(db, fieldQuoteId);
  if (existing) return { ok: true, job: existing, created: false };

  let contractAmount = 0;
  try {
    const gross = (JSON.parse(s(quote, "document_snapshot")) as { totals?: { gross?: unknown } })
      .totals?.gross;
    if (typeof gross === "number" && Number.isFinite(gross)) contractAmount = Math.round(gross);
  } catch {
    /* an unreadable snapshot leaves the amount at 0 rather than blocking the job */
  }

  const categories = await db
    .prepare(
      `SELECT DISTINCT category FROM field_quote_items
        WHERE field_quote_id = ?1 AND category IS NOT NULL AND category <> '' LIMIT 4`,
    )
    .bind(fieldQuoteId)
    .all<{ category: string }>();
  const workType = (categories.results ?? []).map((r) => r.category).join(", ") || null;

  const address =
    [s(quote, "customer_zip"), s(quote, "customer_city"), s(quote, "customer_address")]
      .filter(Boolean)
      .join(" ") || null;

  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO jobs (id, field_quote_id, quote_number, quote_version, customer_name,
                           customer_phone, customer_email, address, surveyor_admin_id, work_type,
                           contract_amount, status, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'PREPARATION',?12,?12)`,
      )
      .bind(
        id,
        fieldQuoteId,
        s(quote, "number"),
        Number(quote["version"] ?? 1),
        s(quote, "customer_name"),
        s(quote, "customer_phone"),
        sOpt(quote, "customer_email") ?? null,
        address,
        s(quote, "surveyor_admin_id"),
        workType,
        contractAmount,
        now,
      )
      .run();
  } catch (error) {
    // Two clicks racing: the other request inserted first. UNIQUE(field_quote_id)
    // guarantees one job per contract — hand back the winner's.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE constraint failed")) {
      const winner = await loadJobByQuote(db, fieldQuoteId);
      if (winner) return { ok: true, job: winner, created: false };
    }
    throw error;
  }
  await logJobEvent(db, id, "created", actor, `Létrehozva a(z) ${s(quote, "number")} ajánlatból`);
  const job = await loadJob(db, id);
  if (!job) throw new Error("A munka létrehozása után nem olvasható vissza.");
  return { ok: true, job, created: true };
}

export interface JobUpdateInput {
  status?: JobStatus | undefined;
  plannedStart?: string | null | undefined;
  workType?: string | undefined;
  internalNote?: string | undefined;
}

export async function updateJob(
  db: D1Database,
  id: string,
  input: JobUpdateInput,
  actor: string,
): Promise<Job | null> {
  const current = await loadJob(db, id);
  if (!current) return null;

  const sets: string[] = [];
  const binds: unknown[] = [];
  const add = (column: string, value: unknown) => {
    binds.push(value);
    sets.push(`${column} = ?${binds.length + 1}`);
  };
  const notes: string[] = [];

  if (input.status !== undefined && input.status !== current.status) {
    add("status", input.status);
    notes.push(
      `állapot: ${JOB_STATUS_LABELS[current.status]} → ${JOB_STATUS_LABELS[input.status]}`,
    );
  }
  if (input.plannedStart !== undefined) {
    const next = input.plannedStart || null;
    if (next !== (current.plannedStart ?? null)) {
      add("planned_start", next);
      notes.push(`tervezett kezdés: ${current.plannedStart ?? "—"} → ${next ?? "—"}`);
    }
  }
  if (input.workType !== undefined) {
    const next = input.workType.trim() || null;
    if (next !== (current.workType ?? null)) {
      add("work_type", next);
      notes.push("munka típusa módosítva");
    }
  }
  if (input.internalNote !== undefined) {
    const next = input.internalNote.trim() || null;
    if (next !== (current.internalNote ?? null)) {
      add("internal_note", next);
      notes.push("belső megjegyzés módosítva");
    }
  }
  if (sets.length === 0) return current;

  const now = Date.now();
  add("updated_at", now);
  await db
    .prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?1`)
    .bind(id, ...binds)
    .run();
  const statusChanged = input.status !== undefined && input.status !== current.status;
  await logJobEvent(db, id, statusChanged ? "status_changed" : "updated", actor, notes.join("; "));
  return await loadJob(db, id);
}
