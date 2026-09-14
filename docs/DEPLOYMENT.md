# Cloudflare Workers telepítés

Az alkalmazás full-stack TanStack Start rendszer, ezért a production cél Cloudflare
Workers + Workers Static Assets. A szerkeszthető adatok D1-ben, a feltöltött képek
R2-ben vannak; a Pages és az Apache `.htaccess` ehhez az architektúrához nem szükséges.

## 1. Szükséges Cloudflare-erőforrások

A `wrangler.jsonc` már a `tetojavitasmesterfokon` D1 adatbázist és a
`tetojavitasmesterfokon-media` R2 bucketet köti a Workerhez. Első telepítés előtt az
R2 szolgáltatást engedélyezni, majd a bucketet létrehozni kell, ha még nem létezik:

```powershell
npx wrangler login
npx wrangler r2 bucket create tetojavitasmesterfokon-media
npx wrangler d1 migrations apply tetojavitasmesterfokon --remote --config wrangler.jsonc
```

## 2. Környezeti változók és titkok

Az egyetlen kötelező Worker-secret a legalább 32 karakteres `BOOTSTRAP_SECRET`:

```powershell
npx wrangler secret put BOOTSTRAP_SECRET --config wrangler.jsonc
```

A `VITE_ENABLE_DEMO_UI` build idejű kliensváltozó. Productionben a repóban lévő
`.env.production` miatt alapértelmezetten `false`; csak tesztkörnyezetben állítsd
`true` értékre. API-kulcs vagy jelszó nem kerülhet `VITE_*` változóba.

## 3. Build, ellenőrzés és első deploy

```powershell
npm run build
npx wrangler deploy --dry-run --config wrangler.jsonc
npm run deploy:cf
```

A build szerverbelépési pontja `.output/server/index.mjs`, a statikus assetek
könyvtára `.output/public`. A Wrangler egy műveletben telepíti mindkettőt.

## 4. Domainkapcsolat

A `wrangler.jsonc` két Custom Domaint deklarál:

- `tetojavitasmesterfokon.hu`
- `www.tetojavitasmesterfokon.hu`

Az első sikeres `wrangler deploy` létrehozza a hozzájuk tartozó Cloudflare
DNS-rekordokat és TLS-tanúsítványokat. Ha valamelyik hostnéven már van A, AAAA vagy
CNAME rekord, a deploy előtt azt el kell távolítani, különben a Custom Domain
létrehozása ütközhet. A `www` kéréseket a Worker 308-as átirányítással a fő domainre
viszi, az útvonal és a query string megőrzésével.

## 5. Első admin létrehozása

Az első és egyetlen bootstrap kérés:

```http
POST https://tetojavitasmesterfokon.hu/api/admin/bootstrap
Authorization: Bearer A_BOOTSTRAP_TITOK
Content-Type: application/json

{"email":"sajat@email.hu","password":"legalabb-12-karakteres-jelszo"}
```

Siker után az admin a `https://tetojavitasmesterfokon.hu/admin` címen érhető el. Ha
már van admin, a bootstrap végpont újabb fiókot nem hoz létre.

## Helyi ellenőrzés

Másold a `.dev.vars.example` fájlt `.dev.vars` néven, töltsd ki a helyi titkot, majd:

```powershell
npm run db:migrate:local
npm run build
npx wrangler dev --config wrangler.jsonc
node scripts/backend-smoke.mjs http://127.0.0.1:8787 A_HELYI_BOOTSTRAP_TITOK
```
