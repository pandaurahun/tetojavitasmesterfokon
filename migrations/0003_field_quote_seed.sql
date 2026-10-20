-- Starter content so the field-quote module is usable immediately after
-- deploy. All of this is editable/removable from Admin → Helyszíni ajánlat →
-- Beállítások — prices here are illustrative placeholders, not a real
-- published price list.

INSERT INTO field_quote_settings (id, max_discount_percent, default_validity_days, acceptance_statement, updated_at)
VALUES ('main', 10, 14, 'Az ajánlat tartalmát megismertem, a feltételeket elfogadom és az ajánlatot megrendelem.', unixepoch() * 1000)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quote_catalog_items (id, name, category, unit, base_price, vat, active, sort_order, created_at, updated_at) VALUES
  ('seed-cat-01', 'Cserépfedés bontása és elszállítása', 'Tetőfedés', 'm²', 1800, 27, 1, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-02', 'Új cserépfedés kialakítása', 'Tetőfedés', 'm²', 8500, 27, 1, 2, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-03', 'Lécezés cseréje', 'Tetőfedés', 'm²', 2200, 27, 1, 3, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-04', 'Párazáró / párafékező fóliázás', 'Tetőfedés', 'm²', 1200, 27, 1, 4, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-05', 'Ereszcsatorna csere', 'Bádogozás', 'fm', 4500, 27, 1, 5, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-06', 'Hócsatorna / hóvédő rács', 'Bádogozás', 'fm', 3200, 27, 1, 6, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-07', 'Kémény bádogozás', 'Bádogozás', 'db', 35000, 27, 1, 7, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-08', 'Szarufa csere / erősítés', 'Ácsmunka', 'fm', 6500, 27, 1, 8, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-09', 'Tetőszerkezet ácsmunka', 'Ácsmunka', 'óra', 9500, 27, 1, 9, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-10', 'Hőszigetelés (ásványgyapot, 20 cm)', 'Szigetelés', 'm²', 3800, 27, 1, 10, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-11', 'Állványozás', 'Egyéb', 'm²', 900, 27, 1, 11, unixepoch() * 1000, unixepoch() * 1000),
  ('seed-cat-12', 'Törmelékszállítás, konténer', 'Egyéb', 'db', 45000, 27, 1, 12, unixepoch() * 1000, unixepoch() * 1000)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quote_packages (id, name, description, active, sort_order, created_at) VALUES
  ('seed-pkg-01', 'Teljes tetőcsere – cserépfedés', 'Bontás, lécezés, fóliázás, új cserépfedés és állványozás egyben.', 1, 1, unixepoch() * 1000),
  ('seed-pkg-02', 'Ereszcsatorna felújítás', 'Ereszcsatorna és hócsatorna csere egyben.', 1, 2, unixepoch() * 1000)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quote_package_items (id, package_id, catalog_item_id, default_qty, sort_order) VALUES
  ('seed-pkgi-01', 'seed-pkg-01', 'seed-cat-01', 1, 1),
  ('seed-pkgi-02', 'seed-pkg-01', 'seed-cat-03', 1, 2),
  ('seed-pkgi-03', 'seed-pkg-01', 'seed-cat-04', 1, 3),
  ('seed-pkgi-04', 'seed-pkg-01', 'seed-cat-02', 1, 4),
  ('seed-pkgi-05', 'seed-pkg-01', 'seed-cat-11', 1, 5),
  ('seed-pkgi-06', 'seed-pkg-02', 'seed-cat-05', 1, 1),
  ('seed-pkgi-07', 'seed-pkg-02', 'seed-cat-06', 1, 2)
ON CONFLICT(id) DO NOTHING;

INSERT INTO quote_payment_templates (id, name, body, is_default, sort_order, created_at) VALUES
  ('seed-pay-01', '50% előleg / 50% átadáskor', 'Az összeg 50%-a előleg a munka megkezdésekor, a fennmaradó 50% a műszaki átadás-átvételkor esedékes.', 1, 1, unixepoch() * 1000),
  ('seed-pay-02', 'Egyösszegű, átadás után', 'A teljes összeg a munka elkészülte és átadás-átvétel után, számla ellenében esedékes.', 0, 2, unixepoch() * 1000)
ON CONFLICT(id) DO NOTHING;
