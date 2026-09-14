# Roof Guardian Suite

> A projekt már nem csak localStorage-demó: Cloudflare Workers, D1 adatbázis, R2
> médiatárolás és védett admin-belépés került bele. Az éles környezet beállítását a
> [telepítési útmutató](docs/DEPLOYMENT.md) írja le. Az alábbi hosszú leírás az eredeti
> projektbrief, ezért több helyen még a korábbi demóállapotot említi.

Készíts egy teljes, prémium minőségű, magyar nyelvű, reszponzív webalkalmazás-demót egy tetőfedéssel és kapcsolódó építőipari szolgáltatásokkal foglalkozó vállalkozás számára.

A projekt munkaneve:

TetőVonal

Ez egy később teljesen átnevezhető és átszínezhető demómárka. A weboldal ne egyszerű tetőfedő vállalkozói sablon legyen, hanem egy látványos, modern, prémium leadgeneráló és ajánlatkezelő rendszer bemutatója.

A végeredmény legyen alkalmas arra, hogy egy ügyfélnek élőben megmutassuk:

milyen lehet a prémium publikus weboldala;

hogyan gyűjt leadeket;

hogyan működik a részletes ajánlatkérés;

hogyan kezelhetők az érdeklődők;

hogyan készíthetők árajánlatok;

hogyan vihetők fel új szolgáltatások és tulajdonságok;

hogyan módosítható az oldal arculata;

hogyan kezelhetők a referenciák és tartalmak;

milyen lehet a vállalkozás saját adminrendszere.

Alapvető elvárás

Ne készíts wireframe-et vagy félkész prototípust.

Készíts vizuálisan kidolgozott, prezentálható, működő demót:

minden fontos gomb működjön;

a navigáció működjön;

az ajánlatkérő végig kitölthető legyen;

az adminfelület menüpontjai legyenek megnyithatók;

legyenek valósághű demóadatok;

ne használj lorem ipsum szöveget;

ne maradjanak üres oldalak;

ne legyenek „coming soon” képernyők;

ne legyenek működésképtelen CTA-k;

minden tartalom magyar nyelvű legyen;

ügyelj a helyes magyar ékezetekre.

Első körben ne építs valódi backendet vagy hitelesítést. Használj valósághű demóadatokat, React state-et és localStorage-ot, hogy a rendszer interaktívnak és működőnek hasson.

Technológiai irány

Használj:

React;

TypeScript;

Tailwind CSS;

Framer Motion;

Lucide ikonokat;

újrafelhasználható komponenseket;

jól strukturált adatmodelleket;

reszponzív layoutot;

hozzáférhető formmezőket;

finom mikroanimációkat.

Ne használj túl sok külső csomagot. A teljesítmény maradjon jó.

1. Vizuális koncepció

A megjelenés legyen:

prémium;

modern;

építészeti;

magabiztos;

technológiai;

letisztult;

elegáns;

vizuálisan emlékezetes.

Kerüld a tipikus, olcsó hatású építőipari sablonokat:

ne domináljon a rikító piros;

ne legyen fekete-sárga munkavédelmi hangulat;

ne legyen túl sok stock fotó;

ne legyen klasszikus „három kártya és egy kapcsolatfelvételi űrlap” sablon;

ne legyen általános SaaS dashboard kinézete;

ne használj túl sok indokolatlan gradientet;

ne zsúfold tele az oldalt ikonokkal.

Alapértelmezett színvilág

Használj prémium, építészeti palettát:

mély grafit: #111820;

meleg elefántcsont háttér: #F5F1E8;

réz vagy bronz kiemelés: #C47743;

hideg palaszürke: #66717D;

sötét erdőzöld kiegészítő: #25473D;

világos felületekhez törtfehér: #FCFAF6.

A színvilág később az adminfelületen legyen módosítható.

Tipográfia

Alapértelmezett betűtípusok:

címekhez: Sora vagy Space Grotesk;

törzsszöveghez: Manrope vagy Inter.

A címek legyenek karakteresek, építészeti hatásúak, de jól olvashatók.

A betűtípusok később az admin arculati menüjében legyenek választhatók.

2. Rendhagyó, animált hero szakasz

A hero a projekt legfontosabb része.

A hero ne egy háttérképre helyezett cím legyen.

Készíts teljes képernyős, körülbelül 100svh magas, vizuálisan lenyűgöző hero élményt.

Hero vizuális történet

A hero jobb oldalán vagy központi részén jelenjen meg egy modern családi ház tetőszerkezetének látványos, izometrikus vagy térhatású ábrázolása.

A tető betöltéskor rétegenként épüljön fel:

megjelenik az épület alapformája;

felépül a fa tetőszerkezet;

megjelenik a hőszigetelés;

rákerül a tetőfólia;

megjelennek a lécek;

felkerülnek a tetőcserepek;

megjelennek a bádogos elemek;

felkerül az ereszcsatorna;

a kész tetőn végigfut egy finom fényhatás.

Ezt SVG, CSS, Framer Motion és rétegzett elemek kombinációjával oldd meg. Ne használj nehéz vagy instabil 3D motort, ha az rontaná a teljesítményt.

Interaktivitás

A hero reagáljon finoman:

az egér mozgására;

a kurzor pozíciójára;

a görgetésre;

a kiválasztott szolgáltatásra.

Legyen enyhe parallax hatás, mélységérzet és rétegmozgás.

Ne legyen túl gyors vagy zavaró.

A prefers-reduced-motion beállítást kezeld. Csökkentett animáció esetén is maradjon esztétikus a hero.

Mobilon egyszerűsített, optimalizált animáció jelenjen meg, amely nem akad és nem takarja ki a szöveget.

Időjárási történet

A tető elkészülése után fusson le egy rövid, elegáns időjárási animáció:

megjelennek esőcseppek;

a víz lefolyik a tetőn;

az ereszcsatorna elvezeti;

megjelenik egy finom védelmi aura vagy kontúrvonal;

az időjárás kitisztul.

Ez vizuálisan kommunikálja, hogy a vállalkozás nem egyszerűen tetőt épít, hanem megvédi az otthont.

Hero szövegezés

Kis felső címke:

TETŐFEDÉS • JAVÍTÁS • BÁDOGOSMUNKA • SZIGETELÉS

Főcím:

Nem egyszerűen tetőt építünk.
Otthonokat védünk meg évtizedekre.

Az „Otthonokat védünk meg” szövegrész kapjon finom, elegáns kiemelést.

Alcím:

Tetőfedés, javítás, bádogozás és teljes körű kivitelezés átlátható folyamattal, dokumentált munkával és személyre szabott ajánlattal.

Elsődleges CTA:

Kérek helyszíni felmérést

Másodlagos CTA:

Gyors ajánlatkérés

Kisebb szöveges link:

Csak visszahívást kérek

A CTA-kra kattintva valódi interakció történjen:

a helyszíni felmérés a részletes ajánlatkérőre vigyen;

a gyors ajánlatkérés nyissa meg az ajánlatkérő első lépését;

a visszahívás nyisson egy kompakt modal ablakot.

Hero szolgáltatásválasztó

A hero alsó részén jelenjen meg egy elegáns, interaktív szolgáltatásválasztó:

Tetőfedés

Tetőjavítás

Bádogozás

Ereszcsatorna

Tetőszigetelés

Egyéb kivitelezés

Az aktív szolgáltatás kiválasztásakor:

változzon meg a tető animációjának egy részlete;

változzon a kisebb leírás;

a CTA vigye tovább a kiválasztott szolgáltatást az ajánlatkérőbe;

az aktív elem vizuálisan emelkedjen ki.

Bizalmi információk a hero alatt

Ne használj kitalált számokat vagy hamis minősítéseket.

Használj ilyen rövid bizalmi állításokat:

Dokumentált munkafolyamat

Tételes árajánlat

Fényképes állapotfelmérés

Közvetlen kapcsolattartás

3. Globális fejléc

Készíts prémium, lebegő vagy félig áttetsző fejlécet.

Menüpontok:

Kezdőlap

Szolgáltatások

Referenciák

Folyamat

Tudástár

Kapcsolat

Jobb oldalon:

telefonszám ikon;

„Ajánlatot kérek” kiemelt gomb.

Görgetés után a fejléc váljon kompaktabbá, kapjon enyhe hátteret és blur hatást.

Mobilon legyen igényesen animált menü, ne egyszerű alapértelmezett dropdown.

4. Főoldal további szekciói

4.1. Szolgáltatási területek

Készíts prémium szolgáltatásbemutatót.

Ne egyszerű egyforma kártyákból álljon.

Használj aszimmetrikus, építészeti gridet, nagy vizuális felületekkel.

Szolgáltatások:

Komplett tetőfedés

Tetőfelújítás és tetőcsere

Beázás és sürgős tetőjavítás

Bádogos munkák

Ereszcsatorna-rendszerek

Tető- és födémszigetelés

Ácsmunkák

Kapcsolódó kivitelezési munkák

Minden szolgáltatásnál jelenjen meg:

rövid, szakmai leírás;

vizuális ikon vagy rajz;

„Részletek” link;

„Ehhez kérek ajánlatot” lehetőség.

4.2. Problémafelismerő interaktív blokk

Cím:

Mit jelez a tető?

Készíts interaktív diagnosztikai szekciót.

A felhasználó választhasson problémák közül:

beázás;

elmozdult vagy törött cserepek;

nedves padlástér;

rozsdás bádogozás;

elöregedett ereszcsatorna;

magas fűtési költség;

viharkár;

teljes tetőcsere előtt állok.

A választás után jelenjen meg:

rövid magyarázat;

lehetséges következmény;

javasolt szolgáltatás;

CTA: „Megnézetem szakemberrel”.

Ez legyen látványos, informatív és leadgeneráló.

4.3. Előtte–utána referencia

Készíts nagy méretű, interaktív előtte–utána képösszehasonlítót.

Legyen húzható slider.

A blokk mellett jelenjen meg:

projekt típusa;

helyszín;

kiindulási probléma;

elvégzett munkák;

hozzávetőleges kivitelezési idő;

felhasznált megoldások;

„Projekt megtekintése” gomb.

Használj valósághű, minőségi tető- és építőipari képeket. Ne használj nyilvánvaló placeholder képeket.

4.4. Munkafolyamat

Cím:

Átlátható folyamat az első hívástól az elkészült tetőig

Lépések:

Kapcsolatfelvétel

Igények előzetes felmérése

Helyszíni állapotfelmérés

Tételes ajánlat

Ütemezés és előkészítés

Kivitelezés

Dokumentált átadás

A szekció görgetésre animált idővonalként működjön.

A lépések egymás után aktiválódjanak.

4.5. Kiemelt esettanulmány

Mutass be egy teljes demóprojektet.

Projekt:

Családi ház teljes tetőfelújítása

Helyszín:

Szolnok térsége

Kiindulási helyzet:

elöregedett héjazat;

több ponton jelentkező beázás;

sérült bádogozás;

hiányos tetőszigetelés.

Elvégzett munka:

régi tetőfedés bontása;

szerkezeti elemek ellenőrzése;

fóliázás és lécezés;

új tetőfedés;

teljes bádogozás;

új ereszcsatorna;

szigetelési csomópontok javítása.

Legyen képgaléria, projektadatok és „Hasonló munkára kérek ajánlatot” CTA.

4.6. Miért ezt a vállalkozást?

Ne használj általános állításokat, mint „minőségi munka” vagy „kedvező ár”.

Használj konkrétabb értékajánlatokat:

Tételes, átlátható ajánlat

Fényképes dokumentáció

Egyértelmű munkafázisok

Közvetlen kapcsolattartó

Az ingatlanhoz illő műszaki megoldás

Előre egyeztetett kivitelezési folyamat

4.7. Vélemények

Készíts elegáns ügyfélvélemény-szekciót.

A demóvélemények legyenek egyértelműen prezentációs célú mintatartalmak, ne valódi hitelesített értékelésként jelenjenek meg.

Használj három különböző helyzetet:

teljes tetőcsere;

sürgős beázásjavítás;

ereszcsatorna és bádogozás.

4.8. Szolgáltatási terület

Készíts stilizált, modern térképszerű megjelenést.

Ne használj bonyolult valódi térképintegrációt.

Mutasd be példaként:

Szolnok;

Törökszentmiklós;

Kisújszállás;

Karcag;

Mezőtúr;

Abony;

környező települések.

Legyen településkereső mező:

Írd be a települést

A demó visszajelzése:

„A megadott település a kiemelt szolgáltatási területünkön található.”

vagy „A pontos kiszállási lehetőségről egyeztessünk telefonon.”

4.9. Gyakori kérdések

Készíts igényes accordion komponenst.

Kérdések:

Mikor szükséges teljes tetőcsere?

Vállalnak sürgős beázásjavítást?

Hogyan történik a helyszíni felmérés?

Mit tartalmaz egy tételes árajánlat?

Lehet fényképek alapján előzetes véleményt kérni?

Milyen dokumentumokat érdemes elküldeni?

Vállalnak bádogozást és ereszcsatorna-cserét is?

Hogyan egyeztethető a kivitelezés időpontja?

4.10. Záró CTA

Készíts vizuálisan erős, sötét hátterű, animált záró szakaszt.

Főcím:

A tető hibái ritkán oldódnak meg maguktól.

Alcím:

Küldj néhány információt és fényképet, hogy felkészülten tudjunk visszahívni.

Gombok:

Részletes ajánlatkérés

Visszahívást kérek

5. Részletes ajánlatkérő

Hozz létre külön, teljes képernyős ajánlatkérő felületet.

Útvonal:

/ajanlatkeres

Az ajánlatkérő legyen:

vizuálisan prémium;

több lépéses;

egyszerűen érthető;

mobilon is kényelmes;

folyamatjelzővel ellátott;

automatikusan mentett;

visszalépés esetén adatvesztés nélküli.

A folyamatjelző mutassa:

aktuális lépés;

hátralévő lépések;

hozzávetőleges kitöltési idő.

Ajánlatkérő lépések

1. Milyen munkára van szükség?

Választható vizuális kártyák:

Új tető

Teljes tetőcsere

Tetőjavítás

Beázás

Viharkár

Bádogozás

Ereszcsatorna

Szigetelés

Egyéb munka

2. Milyen épületről van szó?

Családi ház

Társasház

Nyaraló

Melléképület

Ipari vagy gazdasági épület

Egyéb

3. Hol található az ingatlan?

Mezők:

irányítószám;

település;

utca és házszám opcionálisan.

4. Mit tudunk a tetőről?

hozzávetőleges alapterület;

tető formája;

jelenlegi fedés;

épület szintjeinek száma;

tető hozzávetőleges kora;

megközelíthetőség;

rövid leírás.

5. Mennyire sürgős?

Azonnali segítség szükséges

Néhány napon belül

Egy hónapon belül

Tervezett felújítás

Egyelőre csak tájékozódom

6. Képek és dokumentumok

Készíts drag-and-drop fájlfeltöltő demót.

Lehessen:

több képet kiválasztani;

előnézetet látni;

képet törölni;

dokumentumot hozzáadni.

A fájlok demóként kezelhetők, valódi szerverfeltöltés nem szükséges.

7. Kapcsolattartás

Mezők:

név;

telefonszám;

e-mail;

preferált kapcsolatfelvétel;

mikor kereshetik;

további megjegyzés;

adatkezelési checkbox.

8. Összegzés

Mutasd meg az összes megadott adatot szerkeszthető összegzésben.

Beküldés után jelenjen meg prémium visszaigazoló képernyő:

Köszönjük az ajánlatkérést!

Magyarázd el:

az adatok áttekintése;

kapcsolatfelvétel;

szükség esetén helyszíni felmérés;

személyre szabott ajánlat.

A lead kerüljön be a demó adminfelület érdeklődői közé.

6. Gyors visszahívási modal

Készíts kompakt modalt:

Cím:

Mikor hívhatjuk?

Mezők:

név;

telefonszám;

település;

szolgáltatás;

visszahívás időpontja;

adatkezelési elfogadás.

Beküldés után ez is jelenjen meg az admin leadlistájában.

7. Adminfelület

Hozz létre külön adminbemutatót.

Útvonal:

/admin

Ne kérjen valódi bejelentkezést.

A fejlécben egyértelműen szerepeljen:

DEMO ADMINFELÜLET

Legyen egy „Vissza a weboldalra” gomb.

Az admin ne általános SaaS sablon legyen. Vizuálisan kapcsolódjon a publikus oldal építészeti stílusához, de legyen professzionális és jól áttekinthető.

Admin menüpontok

Vezérlőpult

Érdeklődők

Ajánlatkérések

Árajánlatok

Szolgáltatások

Tulajdonságkezelő

Referenciák

Tartalmak

Arculat

Jogi oldalak

Beállítások

Mobilon legyen megfelelő admin navigáció.

8. Admin vezérlőpult

Mutass valósághű demóadatokat.

Kártyák:

Új érdeklődők

Visszahívásra vár

Felmérés egyeztetve

Ajánlat készül

Ajánlat elküldve

Elfogadott munkák

Készíts:

egyszerű leadforrás-diagramot;

szolgáltatásonkénti érdeklődés diagramot;

heti aktivitási grafikont;

sürgős érdeklődők listáját;

következő teendők listáját;

legutóbbi ajánlatok táblázatát.

Az adatok legyenek egyértelműen demóadatok.

9. Érdeklődők kezelése

Hozz létre listanézetet és Kanban nézetet.

Státuszok:

Új

Kapcsolatfelvételre vár

Megkeresve

Felmérés egyeztetve

Felmérve

Ajánlat készül

Ajánlat elküldve

Utánkövetés

Elfogadva

Elutasítva

Lehessen:

keresni;

szolgáltatásra szűrni;

településre szűrni;

státuszra szűrni;

sürgősségre szűrni;

leadet megnyitni;

státuszt módosítani;

jegyzetet hozzáadni;

következő teendőt megadni;

felelőst kiválasztani.

Lead részletes adatlap

Mutassa:

kapcsolattartási adatok;

ingatlan címe;

kiválasztott szolgáltatás;

sürgősség;

tetőadatok;

feltöltött képek;

üzenet;

lead forrása;

idővonal;

belső jegyzetek;

kapcsolódó ajánlatok;

„Árajánlat készítése” gomb.

10. Árajánlat-generáló admin

Hozz létre vizuálisan kidolgozott árajánlat-szerkesztőt.

Lehessen:

ügyfelet kiválasztani;

leadből ajánlatot létrehozni;

projektcímet megadni;

ajánlatszámot generálni;

tételeket felvinni;

mennyiséget megadni;

mértékegységet választani;

egységárat megadni;

áfát választani;

kedvezményt hozzáadni;

megjegyzést írni;

vállalási időt megadni;

ajánlat érvényességét megadni;

fizetési ütemezést hozzáadni;

garanciális feltételeket megadni.

Használj belső demóárakat, hogy az ajánlatgeneráló működése jól prezentálható legyen.

A publikus weboldalon ne jelenjen meg nyilvános árlista.

Ajánlati tételek demója

Például:

meglévő fedés bontása;

hulladék elszállítása;

tetőfólia elhelyezése;

ellenléc és tetőléc;

tetőfedés kivitelezése;

szegélyek és bádogos elemek;

ereszcsatorna-rendszer;

állványozás;

munkadíj;

egyedi tétel.

Ajánlat előnézet

A szerkesztő mellett jelenjen meg valós idejű, PDF-szerű dokumentum-előnézet.

Tartalmazza:

logó;

cégadatok;

ügyféladatok;

ajánlatszám;

projekt címe;

tételes táblázat;

nettó összeg;

áfa;

bruttó összeg;

feltételek;

érvényesség;

aláírási hely.

Gombok:

Mentés piszkozatként

Előnézet

PDF letöltése

Ajánlat elküldése

A PDF letöltése lehet frontend demó vagy nyomtatható nézet.

Ajánlati státuszok:

Piszkozat

Ellenőrzés alatt

Elküldve

Megtekintve

Módosítást kértek

Elfogadva

Elutasítva

Lejárt

11. Szolgáltatáskezelő

Az adminban lehessen:

új szolgáltatást létrehozni;

szolgáltatást szerkeszteni;

képet választani;

ikont választani;

rövid és hosszú leírást megadni;

CTA-szöveget megadni;

aktív vagy inaktív állapotot választani;

szolgáltatási kategóriát megadni;

sorrendet módosítani.

A szolgáltatás módosítása jelenjen meg a publikus demóban is.

Használj localStorage-alapú működést.

12. Dinamikus tulajdonságkezelő

Ez az admin egyik legfontosabb prezentációs funkciója.

Készíts olyan felületet, ahol egy szolgáltatáshoz új egyedi mezők adhatók.

Mezőtípusok:

rövid szöveg;

hosszú szöveg;

szám;

igen/nem;

választógomb;

több választás;

legördülő lista;

dátum;

fájlfeltöltés;

fényképfeltöltés;

terület;

mennyiség;

mértékegység.

Lehessen megadni:

mező neve;

belső azonosító;

leírás;

kötelező vagy opcionális;

publikus vagy csak adminban látható;

választható opciók;

sorrend;

melyik szolgáltatáshoz tartozik.

Készíts élő előnézetet arról, hogyan jelenik meg az új mező az ajánlatkérőben.

Demó példa:

Szolgáltatás:

Napelem előkészítés tetőfelújítással

Új mezők:

Van már felszerelt napelem?

Panelek száma

Tető tájolása

Szükséges bontás?

Tervdokumentáció feltöltése

13. Referenciakezelő

Az adminban lehessen:

új projektet létrehozni;

projektcímet megadni;

helyszínt megadni;

szolgáltatásokat hozzárendelni;

kiindulási problémát leírni;

elvégzett munkákat felsorolni;

előtte és utána képeket feltölteni;

projektgalériát kezelni;

kivitelezési időt megadni;

kiemelt projektet választani;

publikálási állapotot megadni.

A referenciaoldal publikus előnézete legyen látványos esettanulmány.

14. Arculatkezelő

Hozz létre működő arculati szerkesztőt.

Lehessen változtatni:

elsődleges szín;

másodlagos szín;

kiemelőszín;

háttérszín;

címbetűtípus;

törzsszöveg-betűtípus;

gombok lekerekítése;

kártyák lekerekítése;

árnyékok erőssége;

szekciók térköze;

animáció intenzitása;

logó;

hero főcím;

hero alcím;

CTA feliratok.

Készíts három választható előre beállított arculatot:

Réz és grafit

Sötétkék és homok

Erdőzöld és elefántcsont

A módosítások valós időben jelenjenek meg egy publikus oldal előnézetében.

Legyen:

Mentés

Alaphelyzet

Előnézet megnyitása

15. Tartalomkezelés

Készíts egyszerű CMS-demót.

Szerkeszthető blokkok:

hero;

bizalmi sáv;

szolgáltatások szekció címe;

munkafolyamat;

Miért minket?;

záró CTA;

elérhetőségek;

lábléc.

Lehessen:

címet szerkeszteni;

leírást módosítani;

gombfeliratot módosítani;

szekciót elrejteni;

sorrendet változtatni.

16. Jogi oldalak

Készíts publikus demóoldalakat:

Impresszum

Adatkezelési tájékoztató

ÁSZF

Cookie-tájékoztató

Az adminban legyen jogi tartalomszerkesztő:

dokumentum címe;

verzió;

hatálybalépés dátuma;

rich text tartalom;

publikált vagy piszkozat állapot.

A szövegek legyenek egyértelműen minta jellegűek, ne állítsd, hogy jogász által ellenőrzött dokumentumok.

17. Tudástár és szolgáltatási oldalak

Készíts legalább három minta tudástár-cikket:

Mikor szükséges teljes tetőcsere?

Mitől ázhat be a tető?

Mit tartalmaz egy korrekt tetőfelújítási ajánlat?

Készíts részletes mintaoldalt a következő szolgáltatáshoz:

/szolgaltatasok/tetofedes

Az oldal tartalmazzon:

egyedi hero;

szolgáltatás bemutatása;

tipikus problémák;

munkafolyamat;

kapcsolódó referencia;

gyakori kérdések;

ajánlatkérő CTA.

Most nem szükséges extrém SEO-rendszert készíteni, de az oldalak szerkezete legyen kulturált és később SEO-ra alkalmas.

18. Demó navigációs sáv

Készíts egy diszkrét, de jól látható demóvezérlőt, amely segíti a prezentációt.

Jelenjen meg például a képernyő bal alsó részén.

Funkciók:

Publikus oldal

Ajánlatkérő

Admin

Arculat szerkesztése

Demó visszaállítása

A vezérlő ne rontsa a prémium megjelenést.

Legyen összecsukható.

19. Mikroanimációk

Használj finom animációkat:

szekciók belépése;

kártyák lebegése;

gombok hover állapota;

számok animált megjelenése;

navigációs állapotok;

progress bar;

accordion;

modalok;

admin panelek;

Kanban kártyák;

ajánlati tételek hozzáadása;

színpaletta-váltás.

Kerüld:

az indokolatlan forgást;

a túlzott bounce animációt;

a túl lassú megjelenést;

a minden elemre alkalmazott fade-in effektet;

a teljesítményt rontó nagy blur rétegeket.

20. Reszponzivitás

A projekt minden fontos nézeten legyen gondosan kidolgozva:

nagy desktop;

laptop;

tablet;

mobil.

Különösen figyelj:

hero szöveg olvashatósága;

animáció mobilos egyszerűsítése;

sticky CTA mobilon;

ajánlatkérő használhatósága;

admin táblázatok mobilnézete;

modalok mérete;

fájlfeltöltés;

ajánlat előnézete;

hosszú magyar szavak tördelése.

Mobilon jelenjen meg egy kompakt, alsó sticky CTA-sáv:

Hívás

Visszahívás

Ajánlatkérés

21. Tartalmi és hitelességi szabályok

Ne használj:

hamis tanúsítványokat;

hamis partnerlogókat;

nem létező szakmai díjakat;

kitalált több száz értékelést;

valótlan garanciavállalást;

irreális ígéreteket;

„Magyarország első számú tetőfedője” típusú állításokat;

hamis sürgetést;

visszaszámlálót;

nyilvános, fix árlistát.

Használj szakmai, emberi, bizalomépítő megfogalmazást.

Az oldal ne legyen agresszív értékesítési oldal, de minden szekció természetesen vezessen a kapcsolatfelvétel felé.

22. Végső minőségellenőrzés

A projekt befejezése előtt ellenőrizd:

minden navigációs link működik;

nincs vízszintes overflow;

nincs üres oldal;

nincs lorem ipsum;

minden CTA működik;

az ajánlatkérő végigvihető;

a beküldött lead megjelenik az adminban;

a gyors visszahívás megjelenik az adminban;

az ajánlatszerkesztő használható;

az ajánlati összesítések frissülnek;

az arculati beállítások látható változást okoznak;

az új szolgáltatás menthető;

az új tulajdonság megjelenik az előnézetben;

az admin mobilon is használható;

az animáció nem akad;

a hero mobilon sem takarja el a tartalmat;

minden magyar szöveg helyes és természetes;

az egész projekt vizuálisan egységes.

A végeredmény egy olyan prémium, látványos és interaktív demó legyen, amelyet egy tetőfedő vállalkozás tulajdonosának megmutatva azonnal érthető, hogy ez nem csak egy weboldal, hanem egy teljes leadgyűjtő, ajánlatkészítő és ügyfélkezelő rendszer alapja.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
