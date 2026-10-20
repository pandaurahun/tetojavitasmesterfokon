PRAGMA foreign_keys = ON;

-- listFieldQuotes()'s "latest version per root" lookup
-- (field-quote.server.ts) filters/sorts by (root_id, version) together;
-- the existing single-column idx_fq_root can't satisfy that without a
-- per-group sort. This composite index lets it.
CREATE INDEX IF NOT EXISTS idx_fq_root_version ON field_quotes(root_id, version DESC);

-- field_quotes.public_token is already UNIQUE, which SQLite backs with its
-- own implicit index — idx_fq_public_token (migration 0002) duplicated
-- that, paying extra write cost on every token generation for no query
-- benefit.
DROP INDEX IF EXISTS idx_fq_public_token;
