PRAGMA foreign_keys = ON;

-- Explicit, queryable quote number/version on the signature record itself
-- (previously only embedded inside the document_snapshot JSON blob), plus a
-- SHA-256 hash of the exact snapshot string. The hash lets a dispute be
-- resolved by recomputing the hash from the stored snapshot and comparing —
-- if they don't match, the snapshot was altered after the fact (it never
-- should be, since this table is only ever written once per field_quote_id,
-- but the hash makes that tamper-evident rather than merely assumed).
ALTER TABLE field_quote_signatures ADD COLUMN quote_number TEXT NOT NULL DEFAULT '';
ALTER TABLE field_quote_signatures ADD COLUMN quote_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE field_quote_signatures ADD COLUMN document_hash TEXT NOT NULL DEFAULT '';

-- Atomic per-year counter for human-facing quote numbers (HJA-YYYY-NNNNNN).
-- The previous "SELECT MAX(number)... then +1" approach has a classic
-- read-then-write race: two quotes created at the same moment could compute
-- the same next number. A single UPDATE ... RETURNING is atomic at the
-- SQLite statement level, so concurrent callers never see the same value.
CREATE TABLE IF NOT EXISTS field_quote_counters (
  year INTEGER PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

-- Defense in depth even with the atomic counter above: two DIFFERENT root
-- quotes (not versions of the same quote, which intentionally share a
-- number) must never end up with the same number. Partial unique index on
-- only the root row of each quote (id = root_id) expresses exactly that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fq_number_root_unique
  ON field_quotes(number) WHERE id = root_id;
