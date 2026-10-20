import type {
  CatalogItem,
  FieldQuoteSettings,
  PaymentTemplate,
  QuotePackage,
} from "@/demo/field-quote-types";

type Row = Record<string, unknown>;
const s = (row: Row, key: string): string => (row[key] as string) ?? "";
const sOpt = (row: Row, key: string): string | undefined => {
  const v = row[key];
  return v === null || v === undefined || v === "" ? undefined : (v as string);
};
const n = (row: Row, key: string): number => Number(row[key] ?? 0);

function mapCatalogItem(row: Row): CatalogItem {
  return {
    id: s(row, "id"),
    name: s(row, "name"),
    category: s(row, "category"),
    description: sOpt(row, "description"),
    unit: s(row, "unit"),
    basePrice: n(row, "base_price"),
    vat: n(row, "vat"),
    active: n(row, "active") === 1,
    sortOrder: n(row, "sort_order"),
  };
}

export async function listCatalogItems(db: D1Database, onlyActive = false): Promise<CatalogItem[]> {
  const result = await db
    .prepare(
      `SELECT * FROM quote_catalog_items ${onlyActive ? "WHERE active = 1" : ""} ORDER BY category ASC, sort_order ASC`,
    )
    .all<Row>();
  return (result.results ?? []).map(mapCatalogItem);
}

// Authoritative current prices for a set of catalog item ids — used to
// override whatever price a client happens to send for a catalog-linked
// line item, so the server (not the browser) is always the source of truth
// for what a catalog item actually costs.
export async function getCatalogItemsByIds(
  db: D1Database,
  ids: string[],
): Promise<Map<string, CatalogItem>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const placeholders = unique.map((_, i) => `?${i + 1}`).join(",");
  const result = await db
    .prepare(`SELECT * FROM quote_catalog_items WHERE id IN (${placeholders})`)
    .bind(...unique)
    .all<Row>();
  const map = new Map<string, CatalogItem>();
  for (const row of result.results ?? []) {
    const item = mapCatalogItem(row);
    map.set(item.id, item);
  }
  return map;
}

export async function searchCatalogItems(db: D1Database, query: string): Promise<CatalogItem[]> {
  const result = await db
    .prepare(
      `SELECT * FROM quote_catalog_items WHERE active = 1 AND name LIKE ?1 ORDER BY sort_order ASC LIMIT 20`,
    )
    .bind(`%${query}%`)
    .all<Row>();
  return (result.results ?? []).map(mapCatalogItem);
}

export async function saveCatalogItem(
  db: D1Database,
  input: {
    id?: string | undefined;
    name: string;
    category: string;
    description?: string | undefined;
    unit: string;
    basePrice: number;
    vat: number;
    active: boolean;
    sortOrder: number;
  },
): Promise<CatalogItem> {
  const now = Date.now();
  const id = input.id || crypto.randomUUID();
  if (input.id) {
    const updated = await db
      .prepare(
        `UPDATE quote_catalog_items SET name=?2, category=?3, description=?4, unit=?5, base_price=?6, vat=?7, active=?8, sort_order=?9, updated_at=?10 WHERE id=?1`,
      )
      .bind(
        id,
        input.name,
        input.category,
        input.description || null,
        input.unit,
        input.basePrice,
        input.vat,
        input.active ? 1 : 0,
        input.sortOrder,
        now,
      )
      .run();
    // Editing an id that doesn't exist must not silently "succeed" (or crash
    // on the read-back below) — the caller maps this to a 404.
    if (updated.meta?.changes === 0) throw new Error("CATALOG_ITEM_NOT_FOUND");
  } else {
    await db
      .prepare(
        `INSERT INTO quote_catalog_items (id, name, category, description, unit, base_price, vat, active, sort_order, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)`,
      )
      .bind(
        id,
        input.name,
        input.category,
        input.description || null,
        input.unit,
        input.basePrice,
        input.vat,
        input.active ? 1 : 0,
        input.sortOrder,
        now,
      )
      .run();
  }
  const row = await db
    .prepare(`SELECT * FROM quote_catalog_items WHERE id = ?1`)
    .bind(id)
    .first<Row>();
  return mapCatalogItem(row!);
}

// quote_package_items.catalog_item_id references the catalog without a
// cascade, so deleting a catalog item that a package still lists would fail
// with a foreign-key error. The item leaves its packages first (in the same
// batch). Quotes already written are untouched: field_quote_items keep their
// own copy of name/unit/price and only an unconstrained catalog_item_id.
export async function deleteCatalogItem(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM quote_package_items WHERE catalog_item_id = ?1`).bind(id),
    db.prepare(`DELETE FROM quote_catalog_items WHERE id = ?1`).bind(id),
  ]);
}

export async function listPackages(db: D1Database): Promise<QuotePackage[]> {
  const [pkgRows, itemRows] = await db.batch<Row>([
    db.prepare(`SELECT * FROM quote_packages ORDER BY sort_order ASC`),
    db.prepare(`SELECT * FROM quote_package_items ORDER BY sort_order ASC`),
  ]);
  const items = itemRows?.results ?? [];
  return (pkgRows?.results ?? []).map((row) => ({
    id: s(row, "id"),
    name: s(row, "name"),
    description: sOpt(row, "description"),
    active: n(row, "active") === 1,
    sortOrder: n(row, "sort_order"),
    items: items
      .filter((it) => s(it, "package_id") === s(row, "id"))
      .map((it) => ({
        catalogItemId: s(it, "catalog_item_id"),
        defaultQty: n(it, "default_qty"),
        sortOrder: n(it, "sort_order"),
      })),
  }));
}

export async function savePackage(
  db: D1Database,
  input: {
    id?: string | undefined;
    name: string;
    description?: string | undefined;
    active: boolean;
    sortOrder: number;
    items: { catalogItemId: string; defaultQty: number; sortOrder: number }[];
  },
): Promise<void> {
  const id = input.id || crypto.randomUUID();
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    input.id
      ? db
          .prepare(
            `UPDATE quote_packages SET name=?2, description=?3, active=?4, sort_order=?5 WHERE id=?1`,
          )
          .bind(id, input.name, input.description || null, input.active ? 1 : 0, input.sortOrder)
      : db
          .prepare(
            `INSERT INTO quote_packages (id, name, description, active, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6)`,
          )
          .bind(
            id,
            input.name,
            input.description || null,
            input.active ? 1 : 0,
            input.sortOrder,
            now,
          ),
    db.prepare(`DELETE FROM quote_package_items WHERE package_id = ?1`).bind(id),
    ...input.items.map((item) =>
      db
        .prepare(
          `INSERT INTO quote_package_items (id, package_id, catalog_item_id, default_qty, sort_order) VALUES (?1,?2,?3,?4,?5)`,
        )
        .bind(crypto.randomUUID(), id, item.catalogItemId, item.defaultQty, item.sortOrder),
    ),
  ];
  await db.batch(statements);
}

export async function deletePackage(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM quote_packages WHERE id = ?1`).bind(id).run();
}

export async function listPaymentTemplates(db: D1Database): Promise<PaymentTemplate[]> {
  const result = await db
    .prepare(`SELECT * FROM quote_payment_templates ORDER BY sort_order ASC`)
    .all<Row>();
  return (result.results ?? []).map((row) => ({
    id: s(row, "id"),
    name: s(row, "name"),
    body: s(row, "body"),
    isDefault: n(row, "is_default") === 1,
    sortOrder: n(row, "sort_order"),
  }));
}

export async function savePaymentTemplate(
  db: D1Database,
  input: {
    id?: string | undefined;
    name: string;
    body: string;
    isDefault: boolean;
    sortOrder: number;
  },
): Promise<void> {
  const id = input.id || crypto.randomUUID();
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  if (input.isDefault) {
    statements.push(db.prepare(`UPDATE quote_payment_templates SET is_default = 0`));
  }
  statements.push(
    input.id
      ? db
          .prepare(
            `UPDATE quote_payment_templates SET name=?2, body=?3, is_default=?4, sort_order=?5 WHERE id=?1`,
          )
          .bind(id, input.name, input.body, input.isDefault ? 1 : 0, input.sortOrder)
      : db
          .prepare(
            `INSERT INTO quote_payment_templates (id, name, body, is_default, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6)`,
          )
          .bind(id, input.name, input.body, input.isDefault ? 1 : 0, input.sortOrder, now),
  );
  await db.batch(statements);
}

export async function deletePaymentTemplate(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM quote_payment_templates WHERE id = ?1`).bind(id).run();
}

const DEFAULT_SETTINGS: FieldQuoteSettings = {
  maxDiscountPercent: 10,
  defaultValidityDays: 14,
  acceptanceStatement:
    "Az ajánlat tartalmát megismertem, a feltételeket elfogadom és az ajánlatot megrendelem.",
};

export async function getFieldQuoteSettings(db: D1Database): Promise<FieldQuoteSettings> {
  const row = await db.prepare(`SELECT * FROM field_quote_settings WHERE id = 'main'`).first<Row>();
  if (!row) return DEFAULT_SETTINGS;
  return {
    maxDiscountPercent: n(row, "max_discount_percent"),
    defaultValidityDays: n(row, "default_validity_days"),
    acceptanceStatement: s(row, "acceptance_statement"),
  };
}

export async function saveFieldQuoteSettings(
  db: D1Database,
  input: FieldQuoteSettings,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO field_quote_settings (id, max_discount_percent, default_validity_days, acceptance_statement, updated_at)
       VALUES ('main', ?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET max_discount_percent=excluded.max_discount_percent,
         default_validity_days=excluded.default_validity_days, acceptance_statement=excluded.acceptance_statement,
         updated_at=excluded.updated_at`,
    )
    .bind(
      input.maxDiscountPercent,
      input.defaultValidityDays,
      input.acceptanceStatement,
      Date.now(),
    )
    .run();
}
