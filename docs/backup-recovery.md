# Mentés és helyreállítás

Ez a dokumentum azt írja le, **mi hol tárolódik**, **hogyan készíts mentést**, és
**mit tegyél, ha valami elromlik** (hibás deploy, hibás migráció, elveszett vagy
elrontott adat). Semmi itt nem automatikus: a parancsokat Te futtatod, a
visszaállító (felülíró) lépések külön figyelmeztetéssel vannak jelölve.

> A Cloudflare-hez tartozó parancsok `wrangler`-t használnak, a
> `--config wrangler.jsonc` kapcsolóval, a projekt gyökeréből. Bejelentkezés:
> `npx wrangler login`. Az éles (`--remote`) adatbázist érintő parancsokat
> csak szándékosan futtasd.

## 1. Mi hol van

### D1 adatbázis (`tetojavitasmesterfokon`)

| Tábla | Tartalom | Mennyire kritikus |
| --- | --- | --- |
| `admins`, `sessions`, `auth_attempts` | belépési adatok, munkamenetek, próbálkozás-számlálók | az `admins` igen; a másik kettő újraépül |
| `site_state` | a weboldal szerkeszthető tartalma (egyetlen JSON-sor, `id = 'main'`) | igen |
| `leads` | érdeklődők (JSON, a látogatók személyes adataival) | igen |
| `quotes` | régi (JSON-alapú) árajánlatok | igen |
| `field_quotes`, `field_quote_items`, `field_quote_photos`, `field_quote_events`, `field_quote_counters` | helyszíni ajánlatok | igen |
| **`field_quote_signatures`** | **aláírt ajánlatok jogi rekordja**: dokumentum-pillanatkép (`document_snapshot`), SHA-256 hash (`document_hash`), aláírás- és PDF-kulcs, időpont | **legkritikusabb — soha ne vesszen el** |
| `quote_catalog_items`, `quote_packages`, `quote_package_items`, `quote_payment_templates`, `field_quote_settings` | tételkatalógus, csomagok, fizetési sablonok, kedvezménylimit | igen (újraépíthető, de munkás) |
| `jobs`, `job_events` | Munkák és előzményeik | igen |

### R2 tároló (`tetojavitasmesterfokon-media`)

| Előtag | Tartalom |
| --- | --- |
| `media/<dátum>/…` | az adminban feltöltött képek (arculat, referenciák, tartalom) |
| `media/lead-uploads/<dátum>/…` | az ajánlatkérőben a látogatók által feltöltött fotók |
| `field-quotes/<ajánlat-id>/photos/…` | felmérési fotók |
| `field-quotes/<ajánlat-id>/signatures/…` | aláírás-képek (PNG) |
| `field-quotes/<ajánlat-id>/pdf/…` | **aláírt PDF-ek** |

Az aláírt dokumentum bizonyítéka három dolog együtt: a `field_quote_signatures`
sor (pillanatkép + hash), az aláírás-kép és a PDF az R2-ben. **Mindhármat
mentsd.**

## 2. Mentés

### 2.1 D1 — SQL-export

```powershell
# teljes adatbázis (séma + adatok) egy fájlba — csak olvas
npx wrangler d1 export tetojavitasmesterfokon --remote --output backup-2026-10-04.sql --config wrangler.jsonc
```

* Készíts exportot **minden éles migráció és minden nagyobb deploy előtt**, és
  legalább hetente.
* A fájl személyes adatokat és az admin jelszó-hasheket tartalmaz. Tárold
  titkosított helyen, **ne** tedd a repóba. A repó **nyilvános** a GitHubon,
  ezért a `.gitignore` kizárja a `backup-*.sql` és a `local-admin.sql` nevű
  fájlokat — de más néven mentett exportot nem véd, ezért nevezd így a
  mentéseket.
* Tarts legalább két helyen másolatot (pl. a gépeden és egy külső tárhelyen).
* Csak egy tábla: `--table field_quote_signatures`.

### 2.2 D1 — Time Travel (beépített)

A Cloudflare D1 az elmúlt **30 napra** visszamenőleg bármely időpontra vissza
tudja állítani az adatbázist (a wrangler súgója szerint is: *within the last 30
days*). Ez a legjobb védelem egy rossz parancs vagy hibás migráció ellen.

```powershell
npx wrangler d1 time-travel info tetojavitasmesterfokon --config wrangler.jsonc
```

A kiírt *bookmark* azonosítja az adatbázis pillanatnyi állapotát; ha
visszaállítást tervezel, **előbb jegyezd fel**, hogy a visszaállítás is
visszacsinálható legyen.

### 2.3 R2 — fotók, aláírások, PDF-ek

Az R2-ben **nincs beépített verziózás vagy kuka**: egy törölt vagy felülírt
objektum nem állítható vissza. Ezért az aláírt dokumentumokat külön is másold:

* **Egy-egy fájl** (pl. egy aláírt PDF):

  ```powershell
  npx wrangler r2 object get tetojavitasmesterfokon-media/field-quotes/<id>/pdf/<fájl>.pdf --remote --file masolat.pdf --config wrangler.jsonc
  ```

* **Egész előtag rendszeres másolása**: a Cloudflare R2 S3-kompatibilis, ezért
  `rclone`-nal (vagy hasonló eszközzel) szinkronizálható egy külső helyre.
  Ehhez a Cloudflare-fiókban csak olvasási jogú R2 API-tokent hozz létre, és a
  tokent soha ne tárold a repóban. Havonta legalább a `field-quotes/` előtagot
  másold.

### 2.4 A mentés épségének ellenőrzése

Az aláírt ajánlatok sértetlenségét a SHA-256 hash igazolja. Az alábbi script
**csak olvas**, és minden aláírt dokumentumnál újraszámolja a hash-t:

```powershell
node scripts/verify-document-hashes.mjs            # helyi adatbázis
node scripts/verify-document-hashes.mjs --remote   # éles adatbázis
```

Eltérés (`MISMATCH`) azt jelenti, hogy a pillanatkép az aláírás után módosult —
ennek sosem szabad előfordulnia; ilyenkor azonnal készíts exportot, és vedd elő a
Time Travel-t (2.2).

## 3. Helyreállítás

### 3.1 Egy-két sor rossz

Az exportfájlból (`backup-….sql`) keresd ki a sorokat, és javítsd célzott
`UPDATE`-tel. Előtte mindig készíts friss exportot.

### 3.2 Az egész adatbázis visszaállítása egy korábbi időpontra (Time Travel)

> **FIGYELEM: ez felülírja az adatbázist.** Minden, ami a megadott időpont óta
> történt (új érdeklődők, aláírások), elvész, hacsak később nem a visszaállítás
> előtti *bookmarkra* állítod vissza.

```powershell
# 1. a jelenlegi állapot bookmarkja (hogy a visszaállítás is visszavonható legyen)
npx wrangler d1 time-travel info tetojavitasmesterfokon --config wrangler.jsonc

# 2. visszaállítás időpontra (RFC3339 vagy unix másodperc, max. 30 nap)
npx wrangler d1 time-travel restore tetojavitasmesterfokon --timestamp 2026-10-04T08:00:00Z --config wrangler.jsonc

# ha mégsem jó: vissza a 1. lépés bookmarkjára
npx wrangler d1 time-travel restore tetojavitasmesterfokon --bookmark <bookmark> --config wrangler.jsonc
```

### 3.3 Teljes katasztrófa: új adatbázis exportból

1. `npx wrangler d1 create <új-név>` — jegyezd fel az új `database_id`-t.
2. Töltsd be a mentést: `npx wrangler d1 execute <új-név> --remote --file backup-….sql --config wrangler.jsonc`.
3. Írd át a `wrangler.jsonc` `d1_databases` blokkjában a `database_name` és
   `database_id` értékét, majd `npm run build` és `npx wrangler deploy --config wrangler.jsonc`.
4. Futtasd a `node scripts/verify-document-hashes.mjs --remote` ellenőrzést.

### 3.4 Elveszett R2 objektumok

Töltsd vissza a külső másolatból:
`npx wrangler r2 object put tetojavitasmesterfokon-media/<kulcs> --file <fájl> --content-type <típus> --remote --config wrangler.jsonc`.
A kulcsokat a `field_quote_signatures` (`signature_storage_key`,
`pdf_storage_key`) és a `field_quote_photos` (`storage_key`) táblák sorai adják.

## 4. Migrációk

A fájlok a `migrations/` mappában vannak, sorrendben:

| Fájl | Tartalom | Újrafuttatható? |
| --- | --- | --- |
| `0001_backend.sql` | alap táblák (admin, munkamenet, érdeklődők, …) | igen |
| `0002_field_quotes.sql` | helyszíni ajánlat táblái | igen |
| `0003_field_quote_seed.sql` | induló katalógus, csomagok, sablonok (`ON CONFLICT DO NOTHING`) | igen |
| `0004_field_quote_integrity.sql` | hash- és számoszlopok az aláírásokhoz, ajánlatszám-számláló, egyediségi index | **nem** (`ALTER TABLE … ADD COLUMN`) |
| `0005_field_quote_perf.sql` | teljesítményindex, felesleges index törlése | igen |
| `0006_jobs.sql` | `jobs`, `job_events` (Munkák) | igen |

Szabályok:

1. **Előbb export** (2.1), utána `npx wrangler d1 migrations list tetojavitasmesterfokon --remote --config wrangler.jsonc`
   (a még nem alkalmazott fájlokat mutatja), végül
   `npx wrangler d1 migrations apply tetojavitasmesterfokon --remote --config wrangler.jsonc`.
2. A `0002`–`0006` fájlokat **egyben** alkalmazd, mielőtt a helyszíni ajánlat
   modult használni kezded: a `0004` nullától indítja az ajánlatszám-számlálót,
   ezért a `0003` és `0004` között létrehozott ajánlatok számai ütköznének.
3. A wrangler nyilvántartja az alkalmazott migrációkat, így a `0004` sosem fut
   le kétszer. Ha egy migráció **félúton hibázik**, ne futtasd vakon újra: nézd
   meg a `pragma_table_info`-val, mi készült el, vagy állítsd vissza a
   Time Travel-lel (3.2).
4. A migrációk **csak bővítenek** (új tábla, új oszlop, új index) — így egy
   hibás deploy visszavonása (5. fejezet) után a régi kód is működik az új
   sémával. Oszlopot vagy táblát törlő migrációt ne ugyanabban a kiadásban
   vezess be, mint az azt használó kód módosítását.
5. Helyi próba tiszta adatbázison, meglévő adatokkal:
   `node scripts/migration-upgrade-test.mjs` — egy eldobható helyi adatbázison
   végigfuttatja a `0001`–`0006` láncot egy régi módon aláírt rekorddal, és
   ellenőrzi, hogy az adat átvészeli, valamint hogy melyik fájl újrafuttatható.

## 5. Hibás deploy visszavonása

```powershell
npx wrangler deployments list --config wrangler.jsonc          # az utolsó 10 deploy
npx wrangler rollback <version-id> --config wrangler.jsonc      # vissza egy korábbi verzióra
```

* A visszavonás a **kódot** és a statikus fájlokat cseréli, az **adatbázist
  nem** (a D1 és az R2 tartalma marad).
* Ha a hibás kiadással migráció is ment, a régi kódnak működnie kell az új
  sémával — ezért kell a migrációknak csak bővíteniük (4.4).
* Rollback után ellenőrizd: `https://tetojavitasmesterfokon.hu/`, `/admin/login`,
  és egy próba-ajánlatkérés.

## 6. Adatvesztési incidens — az első teendők

1. **Ne javíts találomra.** Írd fel az időpontot, és hogy mi tűnt el.
2. Készíts **azonnal exportot** (2.1) és jegyezd fel a Time Travel bookmarkot
   (2.2) — ez rögzíti a jelenlegi állapotot.
3. Állapítsd meg, mely táblákat/objektumokat érinti (1. fejezet).
4. Válaszd a legszűkebb helyreállítást: sorjavítás (3.1) → Time Travel (3.2) →
   új adatbázis exportból (3.3).
5. Ellenőrizd a hash-eket (`verify-document-hashes.mjs`), és nézz át néhány
   friss érdeklődőt és aláírt ajánlatot az adminban.
6. Ha **személyes adatot** érintett az incidens (kiszivárgás, jogosulatlan
   hozzáférés), az adatkezelési szabályok szerinti bejelentési kötelezettséget
   egyeztesd az adatvédelmi felelőssel / jogásszal — ennek határideje rövid.

## 7. Helyi tesztkörnyezet (nem éles!)

A teljes helyszíni ajánlat folyamat helyben, valódi Cloudflare-futtatókörnyezeti
szimulációval (`wrangler dev`) próbálható:

```powershell
npm run db:migrate:local
npm run build
npx wrangler dev --config wrangler.jsonc --port 8787

# teszt-admin (CSAK helyi adatbázisba): a script SQL-t ír ki, magát nem futtatja
$env:E2E_PASSWORD = 'valami-hosszu-jelszo'
node scripts/make-local-test-admin.mjs > local-admin.sql
npx wrangler d1 execute tetojavitasmesterfokon --local --config wrangler.jsonc --file local-admin.sql
Remove-Item local-admin.sql

# végpontok közötti ellenőrzés (csak localhoston fut, csak a saját sorait törli)
$env:E2E_EMAIL = 'test-field-quote@example.invalid'
npm run test:e2e
npm test                                   # egységtesztek
```

Az `npm run build` a `.output/public` mappát írja; amíg egy `wrangler dev` fut,
Windowson zárolhatja azt — a build előtt állítsd le.
