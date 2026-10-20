PRAGMA foreign_keys = ON;

-- "Munkák" (jobs): the minimal hand-over from a SIGNED field quote to the work
-- itself. Deliberately small — one row per signed quote, a status, a planned
-- start and a note. No scheduling engine, no materials, no invoicing.
--
-- Additive only: creates new tables and an index, touches nothing that
-- exists, and every statement is re-runnable (IF NOT EXISTS), so it is safe to
-- apply to a database that already holds production data.

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  -- One job per signed quote. UNIQUE is also what makes "create job" safely
  -- idempotent: a double click can never produce two jobs for one contract.
  field_quote_id TEXT NOT NULL UNIQUE,
  quote_number TEXT NOT NULL,
  quote_version INTEGER NOT NULL,
  -- Copied from the signed quote at creation, so the job card reads the same
  -- even if somebody later edits the customer's details elsewhere.
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  address TEXT,
  surveyor_admin_id TEXT NOT NULL,
  work_type TEXT,
  -- Gross contract amount in whole forints, taken from the signed snapshot
  -- (never from the client).
  contract_amount INTEGER NOT NULL,
  planned_start TEXT,
  status TEXT NOT NULL DEFAULT 'PREPARATION'
    CHECK (status IN ('PREPARATION','SCHEDULED','IN_PROGRESS','ON_HOLD','COMPLETED','HANDED_OVER','CLOSED')),
  internal_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (field_quote_id) REFERENCES field_quotes(id),
  FOREIGN KEY (surveyor_admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);

-- Who changed what, when. Jobs are never hard-deleted (a closed job is just
-- status CLOSED), so this log is the history of the work.
CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id);
