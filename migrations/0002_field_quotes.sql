PRAGMA foreign_keys = ON;

-- Each row is one VERSION of a field quote. root_id groups all versions of
-- "the same" quote together; supersedes_id points at the immediately
-- previous version. Once a row's status is SIGNED it is never mutated again
-- — an edit after signing creates a new row (version + 1, same root_id).
CREATE TABLE IF NOT EXISTS field_quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  root_id TEXT NOT NULL,
  supersedes_id TEXT,
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','READY','WAITING_FOR_SIGNATURE','SIGNED','DECLINED','EXPIRED','CANCELLED')),

  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_zip TEXT,
  customer_city TEXT,
  customer_address TEXT,
  billing_name TEXT,
  billing_address TEXT,
  customer_note TEXT,

  property_type TEXT,
  roof_type TEXT,
  roof_covering TEXT,
  estimated_size TEXT,
  size_unit TEXT,
  roof_condition TEXT,
  survey_note TEXT,

  discount_type TEXT CHECK (discount_type IN ('percent','fixed') OR discount_type IS NULL),
  discount_value REAL NOT NULL DEFAULT 0,
  discount_over_cap_approved_by TEXT,
  validity_date TEXT,
  expected_start TEXT,
  expected_duration TEXT,
  payment_terms TEXT,
  customer_notes TEXT,
  acceptance_text TEXT NOT NULL DEFAULT '',

  surveyor_admin_id TEXT NOT NULL,
  public_token TEXT UNIQUE,
  public_token_expires_at INTEGER,
  signed_at INTEGER,
  declined_at INTEGER,
  decline_reason TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (surveyor_admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_fq_status ON field_quotes(status);
CREATE INDEX IF NOT EXISTS idx_fq_root ON field_quotes(root_id);
CREATE INDEX IF NOT EXISTS idx_fq_public_token ON field_quotes(public_token);
CREATE INDEX IF NOT EXISTS idx_fq_lead ON field_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_fq_created_at ON field_quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS field_quote_items (
  id TEXT PRIMARY KEY,
  field_quote_id TEXT NOT NULL,
  catalog_item_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  qty REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_price REAL NOT NULL,
  vat REAL NOT NULL DEFAULT 27,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (field_quote_id) REFERENCES field_quotes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fq_items_quote ON field_quote_items(field_quote_id);

CREATE TABLE IF NOT EXISTS field_quote_photos (
  id TEXT PRIMARY KEY,
  field_quote_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (field_quote_id) REFERENCES field_quotes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fq_photos_quote ON field_quote_photos(field_quote_id);

-- One signature per (locked) version. document_snapshot freezes the full
-- quote+items+totals JSON exactly as agreed, independent of any later
-- catalog/pricing changes.
CREATE TABLE IF NOT EXISTS field_quote_signatures (
  id TEXT PRIMARY KEY,
  field_quote_id TEXT NOT NULL UNIQUE,
  signature_storage_key TEXT NOT NULL,
  accepted_statement_text TEXT NOT NULL,
  document_snapshot TEXT NOT NULL,
  pdf_storage_key TEXT,
  surveyor_admin_id TEXT NOT NULL,
  audit_session_id TEXT,
  signed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (field_quote_id) REFERENCES field_quotes(id),
  FOREIGN KEY (surveyor_admin_id) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS field_quote_events (
  id TEXT PRIMARY KEY,
  field_quote_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  actor TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fq_events_quote ON field_quote_events(field_quote_id);

CREATE TABLE IF NOT EXISTS quote_catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  base_price REAL NOT NULL,
  vat REAL NOT NULL DEFAULT 27,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_active ON quote_catalog_items(active);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON quote_catalog_items(category);

CREATE TABLE IF NOT EXISTS quote_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_package_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  catalog_item_id TEXT NOT NULL,
  default_qty REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (package_id) REFERENCES quote_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_item_id) REFERENCES quote_catalog_items(id)
);
CREATE INDEX IF NOT EXISTS idx_pkg_items_package ON quote_package_items(package_id);

CREATE TABLE IF NOT EXISTS quote_payment_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Singleton settings row, same pattern as site_state('main').
CREATE TABLE IF NOT EXISTS field_quote_settings (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  max_discount_percent REAL NOT NULL DEFAULT 10,
  default_validity_days INTEGER NOT NULL DEFAULT 14,
  acceptance_statement TEXT NOT NULL DEFAULT 'Az ajánlat tartalmát megismertem, a feltételeket elfogadom és az ajánlatot megrendelem.',
  updated_at INTEGER NOT NULL
);
