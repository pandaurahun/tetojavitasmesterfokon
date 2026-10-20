# Adatkezelési életciklus és törlési szabályzat (tervezet)

Ez a dokumentum azt rögzíti, **milyen adatot tárol a rendszer, meddig érdemes
megőrizni, és hogyan lehet (és hogyan nem lehet) törölni**. Két részből áll:

* **Ami ma működik** — pontosan azt írja le, amit a kód tesz.
* **Javaslat** — amit még Neked kell eldöntened (érdemes a könyvelővel és az
  adatvédelmi jogásszal egyeztetni). Ezek **nincsenek megvalósítva**, és ebben a
  körben szándékosan semmilyen automatikus törlés nem készült.

> Ez nem jogi tanács. A megőrzési idők és a jogalapok végleges meghatározása a
> te (és a jogász/könyvelő) felelősséged.

## 1. Alapelvek

1. **Aláírt üzleti/jogi dokumentumot nem lehet egyszerűen törölni.** Az adminban
   **nincs** törlés gomb az aláírt ajánlatokhoz, és nincs rá API-végpont sem. Az
   aláírt ajánlat tartalma zárolt; módosítás csak új verzióval lehetséges, a régi
   változat érintetlen marad.
2. **Nincs automatikus, adatvesztést okozó törlés.** Semmi nem töröl magától
   (nincs időzített törlés, nincs „X hónap után eltávolít" feladat).
3. **A törlés mindig szándékos, emberi lépés**, és csak azt érinti, amit
   megnevezel.
4. A mentések (lásd `docs/backup-recovery.md`) a törölt adatot is tartalmazhatják,
   amíg le nem járnak (Time Travel: 30 nap; saját exportok: ameddig megtartod).

## 2. Mit tárol a rendszer?

| Adat | Hol | Kiknek az adata | Személyes adat? |
| --- | --- | --- | --- |
| Érdeklődő (név, telefon, e-mail, cím, üzenet, tetőadatok) | `leads` | ajánlatot kérő látogatók | igen |
| Látogatók fotói az ajánlatkérőből | R2 `media/lead-uploads/…` | ajánlatot kérők (ingatlanfotó) | igen (ingatlan, esetleg személyek) |
| Régi árajánlatok | `quotes` | érdeklődők | igen |
| Helyszíni ajánlat (ügyfél, számlázási adat, felmérés, tételek, árak) | `field_quotes*` | ügyfelek | igen |
| Felmérési fotók | R2 `field-quotes/<id>/photos/…` | ügyfelek ingatlana | igen |
| **Aláírt ajánlat**: pillanatkép, SHA-256 hash, aláírás-kép, PDF | `field_quote_signatures`, R2 `…/signatures/…`, `…/pdf/…` | ügyfelek | igen — **jogi irat** |
| Munkák (ügyfél, cím, összeg, állapot, megjegyzés) | `jobs`, `job_events` | ügyfelek | igen |
| Admin fiókok, munkamenetek | `admins`, `sessions` | a cég munkatársai | igen (e-mail) |
| Belépési kísérletek | `auth_attempts` | bárki, aki belépni próbál | csak az IP **hash-e** és az idő |

Az audit-napló (`field_quote_events`, `job_events`) az admin azonosítóját és az
időpontot rögzíti; ügyféladatot nem tartalmaz.

## 3. Ami ma működik

| Művelet | Állapot |
| --- | --- |
| **Érdeklődő törlése** (admin → Érdeklődők) | működik: törli az érdeklődő sorát **és a látogató által feltöltött saját fotóit** az R2-ből. Végleges. |
| **Egy felmérési fotó törlése** (ajánlat szerkesztése közben) | működik, csak **nem aláírt** ajánlatnál; az R2-objektumot is törli |
| **Ajánlat visszavonása** | az állapot „Visszavont"-ra állítható (nem törlés) |
| **Ajánlat elutasítása** (ügyfél) | az állapot „Elutasított" (nem törlés) |
| **Aláírt ajánlat törlése** | **nincs** — szándékosan |
| **Munka törlése** | **nincs** — a lezárt munka „Lezárva" állapotú marad |
| **Automatikus törlés / archiválás** | **nincs** |
| Katalógustétel / csomag / fizetési sablon törlése | működik (megerősítéssel); a már elkészült ajánlatokat nem érinti, mert azok saját másolatot őriznek |

## 4. Javaslat: megőrzési idők és életciklus (döntés kell)

A javaslat kiindulópontja: az **aláírt szerződéses dokumentumokat** a vonatkozó
számviteli/polgári jogi előírások szerint kell megőrizni (általában hosszú ideig,
a számviteli bizonylatokra jellemzően 8 év — ezt a könyvelőddel erősítsd meg), a
**sosem szerződéssé vált megkereséseket** viszont nem érdemes korlátlan ideig
tartani.

| Adatkör | Javasolt megőrzés | Mi történjen utána |
| --- | --- | --- |
| Érdeklődő, amiből **nem lett** aláírt ajánlat | az utolsó kapcsolatfelvételtől 12–24 hónap | admin által indított törlés (a fotókkal együtt) |
| Nem aláírt (piszkozat / elutasított / visszavont) helyszíni ajánlat | ugyanez | tervezett: „archiválás", majd az ügyféladatok anonimizálása |
| **Aláírt ajánlat + munka + aláírás-kép + PDF** | a szerződéses / számviteli megőrzési idő végéig (a könyvelő/jogász szerint) | tervezett: a megőrzési idő lejárta után **kézzel**, kétlépéses megerősítéssel, előzetes exporttal és naplózással |
| Admin fiókok | amíg a munkatárs dolgozik | a fiók letiltása/törlése kilépéskor |
| `auth_attempts`, lejárt `sessions` | rövid (nap) | tervezett: lejárt sorok takarítása (nem érint ügyféladatot) |

**Miért nem egyszerű a lejárt aláírt ajánlat törlése?** A SHA-256 hash a teljes
pillanatképet védi; az ügyféladatok utólagos „kitörlése" a pillanatképből
megtörné a hash-t. Ezért a lejárat utáni lépés vagy a **teljes rekord** (pillanatkép
+ aláírás + PDF) dokumentált, szándékos megsemmisítése, vagy a rekord megtartása
és az érintett kérésének korlátozása — ezt jogásszal kell eldönteni. A rendszer
ma egyiket sem teszi meg magától.

## 5. Érintetti kérések kezelése (kézi folyamat)

1. **Azonosítsd** a személyt a telefonszáma/e-mail címe alapján: az adminban az
   Érdeklődők, a Helyszíni ajánlat és a Munkák keresőjében.
2. **Hozzáférés / másolat**: a talált rekordokat (érdeklődő, ajánlat, PDF)
   exportáld vagy másold ki a kérőnek.
3. **Helyesbítés**: érdeklődő és nem aláírt ajánlat szerkeszthető; aláírt ajánlatnál
   új verzió készül (a régi megmarad).
4. **Törlés**:
   * *érdeklődő* — törölhető az adminban (a fotókkal együtt);
   * *nem aláírt ajánlat* — jelenleg visszavonható; végleges törlés/anonimizálás
     a tervezett archiváló lépés (4. fejezet) után lesz lehetséges;
   * *aláírt ajánlat / munka* — a megőrzési kötelezettség miatt nem törölhető;
     a kérőt tájékoztatni kell a megőrzés jogalapjáról és idejéről.
5. **Naplózd** a kérést és a megtett lépéseket (dátum, ki, mi).
6. Tájékoztasd a kérőt, hogy a **mentésekben** az adat még legfeljebb a mentés
   lejártáig (Time Travel: 30 nap) megmaradhat.

## 6. Nyitott döntések

1. Megőrzési idő az aláírt ajánlatokra és munkákra (könyvelő/jogász).
2. Megőrzési idő a szerződéssé nem vált megkeresésekre.
3. Kell-e „Archivált" állapot az érdeklődőknek és a nem aláírt ajánlatoknak?
4. Az aláírt dokumentumok lejárat utáni sorsa: megsemmisítés vagy korlátozott
   megőrzés.
5. A látogatói fotók (R2 `media/lead-uploads/…`) jelenleg a nehezen kitalálható
   (véletlen azonosítós) URL-jükön **bárki számára elérhetők, aki ismeri a
   linket**, nem csak belépett adminnak. Kell-e ezeket adminhoz kötött útvonalra
   áttenni? (A fotók az érdeklődő törlésekor törlődnek.)
6. Az adatkezelési tájékoztató szövege (jelenleg mintaszöveg) — véglegesítés.
