import projectFinished from "@/assets/project-finished.jpg";
import detailMembrane from "@/assets/detail-membrane.jpg";
import { articles } from "./data";
import type { CmsFieldDefinition, CmsSection, CmsSectionDefinition } from "./types";

const text = (key: string, label: string, defaultValue: string): CmsFieldDefinition => ({
  key,
  label,
  type: "text",
  defaultValue,
});
const longtext = (key: string, label: string, defaultValue: string): CmsFieldDefinition => ({
  key,
  label,
  type: "longtext",
  defaultValue,
});
const image = (key: string, label: string, defaultValue: string): CmsFieldDefinition => ({
  key,
  label,
  type: "image",
  defaultValue,
});
const section = (
  id: string,
  page: string,
  name: string,
  order: number,
  fields: CmsFieldDefinition[],
): CmsSectionDefinition => ({
  id,
  page,
  name,
  defaultVisible: true,
  defaultOrder: order,
  fields,
});

const problems = [
  [
    "Beázás",
    "A víz jellemzően bádogos csomóponton vagy sérült fólián keresztül jut be.",
    "A szerkezet nedvesedik, a szigetelés összetömörödik, penész indulhat.",
    "Beázás és sürgős tetőjavítás",
  ],
  [
    "Elmozdult vagy törött cserép",
    "Vihar, hó vagy korábbi szerelés mozdíthatta el a fedést.",
    "A befújt csapadék a fóliát terheli, ami idővel átszakad.",
    "Beázás és sürgős tetőjavítás",
  ],
  [
    "Nedves padlástér",
    "Gyakran nem beázás, hanem párakicsapódás okozza a nedvességet.",
    "A faszerkezet nedvességtartalma tartósan megemelkedik.",
    "Tető- és födémszigetelés",
  ],
  [
    "Rozsdás bádogozás",
    "A régi horganyzott lemez a hajlatoknál és a rögzítéseknél megy át először.",
    "A vápa és a kéményszegély már nem vezeti el a vizet.",
    "Bádogos munkák",
  ],
  [
    "Elöregedett ereszcsatorna",
    "A toldások kilazulnak, a tartók megsüllyednek, a lejtés megszűnik.",
    "A víz a homlokzatra és a lábazatra folyik.",
    "Ereszcsatorna-rendszerek",
  ],
  [
    "Magas fűtési költség",
    "Hiányos vagy összetömörödött szigetelés, megszakadt párazáró réteg.",
    "A tetőn keresztül jelentős hőveszteség távozik.",
    "Tető- és födémszigetelés",
  ],
  [
    "Viharkár",
    "Felszakadt fedés, elmozdult gerinc, sérült szegélyek.",
    "Egy következő esőnél már a szerkezet ázik.",
    "Beázás és sürgős tetőjavítás",
  ],
  [
    "Teljes tetőcsere előtt állok",
    "Élettartama végén járó héjazat és fólia esetén a részjavítás csak halasztás.",
    "A javítások költsége néhány év alatt eléri a csere árát.",
    "Tetőfelújítás és tetőcsere",
  ],
] as const;

const processSteps = [
  ["Kapcsolatfelvétel", "Telefon, ajánlatkérő vagy visszahívás kérése."],
  ["Igények előzetes felmérése", "Röviden átbeszéljük a problémát és a fényképeket."],
  ["Helyszíni állapotfelmérés", "Kívül és belül is megnézzük a szerkezetet, fotókkal."],
  ["Tételes ajánlat", "Munkanemenkénti bontásban, mennyiségekkel."],
  ["Ütemezés és előkészítés", "Állványozás, anyagbeszerzés, hulladékkezelés."],
  ["Kivitelezés", "Szakaszos munkavégzés, időjáráshoz igazodó ideiglenes védelemmel."],
  ["Dokumentált átadás", "Átadási jegyzőkönyv és fényképes dokumentáció."],
] as const;

const quoteStepTitles = [
  "Milyen munkára van szükség?",
  "Milyen épületről van szó?",
  "Hol található az ingatlan?",
  "A tető főbb adatai",
  "Mennyire sürgős?",
  "Képek és dokumentumok",
  "Kapcsolattartási adatok",
  "Ellenőrzés és beküldés",
] as const;

const quoteStepShort = [
  "Szolgáltatás",
  "Épület",
  "Helyszín",
  "Tetőadatok",
  "Sürgősség",
  "Képek",
  "Kapcsolat",
  "Ellenőrzés",
] as const;

const whyItems = [
  ["Tételes, átlátható ajánlat", "Minden munkanem külön soron, mennyiséggel és egységárral."],
  ["Fényképes dokumentáció", "A rejtett szerkezeti részekről is készül felvétel a takarás előtt."],
  ["Egyértelmű munkafázisok", "Előre tudod, melyik napon mi történik a tetőn."],
  ["Közvetlen kapcsolattartó", "Egy ember, aki a felméréstől az átadásig végigkíséri a munkát."],
  [
    "Az ingatlanhoz illő műszaki megoldás",
    "A rétegrendet a beépítés módjához és a terhelhetőséghez igazítjuk.",
  ],
  [
    "Előre egyeztetett kivitelezési folyamat",
    "Ütemterv, hulladékkezelés és állványozás előre tisztázva.",
  ],
] as const;

const faqItems = [
  [
    "Mikor szükséges teljes tetőcsere?",
    "Akkor, ha a héjazat és a fólia is élettartama végén jár, illetve ha a javítások több ponton, egyre gyakrabban ismétlődnek.",
  ],
  [
    "Vállalnak sürgős beázásjavítást?",
    "Igen. Először a víz útját tárjuk fel és ideiglenesen lezárjuk a felületet, majd a tartós javítást külön egyeztetjük.",
  ],
  [
    "Hogyan történik a helyszíni felmérés?",
    "Megnézzük a tetőt kívülről és a padlásteret belülről, fényképeket készítünk és felmérjük a csomópontokat.",
  ],
  [
    "Mit tartalmaz egy tételes árajánlat?",
    "Külön soron szerepelnek a munkanemek, a mennyiségek, a mértékegységek és az anyagok.",
  ],
  [
    "Lehet fényképek alapján előzetes véleményt kérni?",
    "Igen, de a végleges ajánlat jellemzően helyszíni felmérés után készül.",
  ],
  [
    "Milyen dokumentumokat érdemes elküldeni?",
    "Hasznos lehet a tetőterv, egy korábbi ajánlat, biztosítói jegyzőkönyv és a hibáról készült fénykép.",
  ],
  [
    "Vállalnak bádogozást és ereszcsatorna-cserét is?",
    "Igen, ezek önálló szolgáltatásként is kérhetők.",
  ],
  [
    "Hogyan egyeztethető a kivitelezés időpontja?",
    "Az ajánlat elfogadása után írásos ütemtervet küldünk a kezdésről és a fő munkafázisokról.",
  ],
] as const;

function pairedFields(
  prefix: string,
  items: readonly (readonly [string, string])[],
  titleLabel: string,
  descriptionLabel: string,
) {
  return items.flatMap(([titleValue, descriptionValue], index) => [
    text(`${prefix}.${index + 1}.title`, `${index + 1}. ${titleLabel}`, titleValue),
    longtext(
      `${prefix}.${index + 1}.description`,
      `${index + 1}. ${descriptionLabel}`,
      descriptionValue,
    ),
  ]);
}

export const cmsDefinitions: CmsSectionDefinition[] = [
  section("global.header", "Globális elemek", "Fejléc és navigáció", 1, [
    text("nav.home", "Kezdőlap menüpont", "Kezdőlap"),
    text("nav.services", "Szolgáltatások menüpont", "Szolgáltatások"),
    text("nav.references", "Referenciák menüpont", "Referenciák"),
    text("nav.process", "Folyamat menüpont", "Folyamat"),
    text("nav.knowledge", "Tudástár menüpont", "Tudástár"),
    text("nav.contact", "Kapcsolat menüpont", "Kapcsolat"),
    text("cta", "Fejléc CTA", "Ajánlatot kérek"),
  ]),
  section("global.footer", "Globális elemek", "Lábléc", 2, [
    longtext(
      "description",
      "Rövid bemutatkozás",
      "Tetőfedés, bádogozás és kivitelezés Szolnok és környéke területén.",
    ),
    longtext("note", "Alsó megjegyzés", "Az oldalon szereplő információk tájékoztató jellegűek."),
    text("servicesTitle", "Szolgáltatások oszlop címe", "Szolgáltatások"),
    text("pagesTitle", "Oldalak oszlop címe", "Oldalak"),
    text("contactTitle", "Elérhetőség oszlop címe", "Elérhetőség"),
    text("copyrightSuffix", "Copyright utótag", "Minden jog fenntartva."),
  ]),
  section("global.mobileCta", "Globális elemek", "Mobil alsó műveletsáv", 3, [
    text("call", "Hívás gomb", "Hívás"),
    text("callback", "Visszahívás gomb", "Visszahívás"),
    text("quote", "Ajánlatkérés gomb", "Ajánlatkérés"),
  ]),
  section("global.callback", "Globális elemek", "Visszahívás ablak", 4, [
    text("eyebrow", "Címke", "Visszahívás"),
    text("title", "Cím", "Mikor hívhatjuk?"),
    text("nameLabel", "Név mező", "Név"),
    text("namePlaceholder", "Név helykitöltő", "Például Varga Ildikó"),
    text("phoneLabel", "Telefonszám mező", "Telefonszám"),
    text("phonePlaceholder", "Telefonszám helykitöltő", "+36 30 000 0000"),
    text("cityLabel", "Település mező", "Település"),
    text("cityPlaceholder", "Település helykitöltő", "Például Szolnok"),
    text("serviceLabel", "Szolgáltatás mező", "Szolgáltatás"),
    text("otherService", "Egyéb szolgáltatás", "Egyéb kivitelezés"),
    text("whenLabel", "Időpont mező", "Visszahívás időpontja"),
    text("when.1", "1. időpont", "Ma délelőtt"),
    text("when.2", "2. időpont", "Ma délután"),
    text("when.3", "3. időpont", "Holnap"),
    text("when.4", "4. időpont", "Munkaidő után"),
    longtext(
      "consent",
      "Hozzájárulás szövege",
      "Elfogadom, hogy a megadott adatokat kapcsolatfelvétel céljából kezeljék.",
    ),
    text("submit", "Beküldés gomb", "Visszahívást kérek"),
    text("submitting", "Mentés folyamatban", "Mentés…"),
    text("successTitle", "Sikeres beküldés címe", "Rögzítettük a kérést"),
    longtext(
      "successText",
      "Sikeres beküldés leírása",
      "A megadott időpontban keresünk telefonon. A kérés biztonságosan bekerült az adminfelület érdeklődői közé.",
    ),
    text("done", "Bezáró gomb", "Rendben"),
  ]),
  section("home.hero", "Főoldal", "Hero", 1, [
    text("eyebrow", "Felső címke", "Tetőfedés • Javítás • Bádogosmunka • Szigetelés"),
    text("title", "Főcím első sora", "Nem egyszerűen tetőt építünk."),
    text("accent", "Kiemelt főcímrész", "Otthonokat védünk meg"),
    text("suffix", "Főcím befejezése", "évtizedekre."),
    longtext(
      "description",
      "Alcím",
      "Tetőfedés, javítás, bádogozás és teljes körű kivitelezés átlátható folyamattal, dokumentált munkával és személyre szabott ajánlattal.",
    ),
    text("primaryCta", "Elsődleges gomb", "Kérek helyszíni felmérést"),
    text("secondaryCta", "Másodlagos gomb", "Gyors ajánlatkérés"),
    text("callbackCta", "Visszahívás gomb", "Csak visszahívást kérek"),
    text("focus.1.label", "1. szolgáltatásválasztó", "Tetőfedés"),
    longtext(
      "focus.1.note",
      "1. szolgáltatás leírása",
      "Teljes rétegrend a párazárótól a gerincelemekig, az épülethez illő héjazattal.",
    ),
    text("focus.1.service", "1. kapcsolt szolgáltatás", "Komplett tetőfedés"),
    text("focus.2.label", "2. szolgáltatásválasztó", "Tetőjavítás"),
    longtext(
      "focus.2.note",
      "2. szolgáltatás leírása",
      "Elmozdult cserép, hibás csomópont: célzott javítás fényképes állapotrögzítéssel.",
    ),
    text("focus.2.service", "2. kapcsolt szolgáltatás", "Beázás és sürgős tetőjavítás"),
    text("focus.3.label", "3. szolgáltatásválasztó", "Bádogozás"),
    longtext(
      "focus.3.note",
      "3. szolgáltatás leírása",
      "Kéményszegély, vápa és oromszegély méretre hajlítva, a hőtágulást figyelembe véve.",
    ),
    text("focus.3.service", "3. kapcsolt szolgáltatás", "Bádogos munkák"),
    text("focus.4.label", "4. szolgáltatásválasztó", "Ereszcsatorna"),
    longtext(
      "focus.4.note",
      "4. szolgáltatás leírása",
      "A tetőfelülethez méretezett csatorna és lefolyó, új tartókkal és helyes lejtéssel.",
    ),
    text("focus.4.service", "4. kapcsolt szolgáltatás", "Ereszcsatorna-rendszerek"),
    text("focus.5.label", "5. szolgáltatásválasztó", "Tetőszigetelés"),
    longtext(
      "focus.5.note",
      "5. szolgáltatás leírása",
      "Folytonos párazáró réteg és szellőző légrés, hogy a szerkezet szárazon maradjon.",
    ),
    text("focus.5.service", "5. kapcsolt szolgáltatás", "Tető- és födémszigetelés"),
    text("focus.6.label", "6. szolgáltatásválasztó", "Egyéb kivitelezés"),
    longtext(
      "focus.6.note",
      "6. szolgáltatás leírása",
      "Ácsmunka, kéményfelújítás, tetőtéri ablak és kapcsolódó homlokzati javítások.",
    ),
    text("focus.6.service", "6. kapcsolt szolgáltatás", "Kapcsolódó kivitelezési munkák"),
    text("trust.1", "1. bizalmi állítás", "Dokumentált munkafolyamat"),
    text("trust.2", "2. bizalmi állítás", "Tételes árajánlat"),
    text("trust.3", "3. bizalmi állítás", "Fényképes állapotfelmérés"),
    text("trust.4", "4. bizalmi állítás", "Közvetlen kapcsolattartás"),
  ]),
  section("home.services", "Főoldal", "Szolgáltatások", 2, [
    text("eyebrow", "Címke", "Szolgáltatások"),
    text("title", "Cím", "Szolgáltatási területek"),
    longtext("description", "Leírás", "A tetőszerkezettől a csatornáig egy kivitelezői körben."),
    text("detailsCta", "Részletek link", "Részletek"),
  ]),
  section("home.diagnostics", "Főoldal", "Tetődiagnosztika", 3, [
    text("eyebrow", "Címke", "Diagnosztika"),
    text("title", "Cím", "Mit jelez a tető?"),
    longtext(
      "description",
      "Leírás",
      "Válaszd ki, amit tapasztalsz, és megmutatjuk, mi állhat mögötte, illetve melyik szolgáltatás ad rá megoldást.",
    ),
    text("causeLabel", "Ok címkéje", "Mi állhat mögötte"),
    text("consequenceLabel", "Következmény címkéje", "Lehetséges következmény"),
    text("serviceLabel", "Szolgáltatás címkéje", "Javasolt szolgáltatás"),
    text("button", "Gomb", "Megnézetem szakemberrel"),
    ...problems.flatMap(([titleValue, cause, consequence, service], index) => [
      text(`problem.${index + 1}.title`, `${index + 1}. probléma`, titleValue),
      longtext(`problem.${index + 1}.cause`, `${index + 1}. lehetséges ok`, cause),
      longtext(`problem.${index + 1}.consequence`, `${index + 1}. következmény`, consequence),
      text(`problem.${index + 1}.service`, `${index + 1}. javasolt szolgáltatás`, service),
    ]),
  ]),
  section("home.beforeAfter", "Főoldal", "Előtte–utána referencia", 4, [
    text("eyebrow", "Címke", "Referencia"),
    text("title", "Cím", "Előtte és utána"),
    longtext(
      "description",
      "Leírás",
      "Húzd el a csúszkát, hogy lásd a kiindulási állapotot és az elkészült tetőt.",
    ),
    text("beforeLabel", "Előtte címke", "Előtte"),
    text("afterLabel", "Utána címke", "Utána"),
    longtext(
      "solutions",
      "Felhasznált megoldások",
      "Páraáteresztő tetőfólia, ellenléc és lécezés, betoncserép héjazat, hajlított bádogos szegélyek.",
    ),
    text("button", "Gomb", "Projekt megtekintése"),
  ]),
  section("home.process", "Főoldal", "Munkafolyamat", 5, [
    text("eyebrow", "Címke", "Folyamat"),
    text("title", "Cím", "Átlátható folyamat az első hívástól az elkészült tetőig"),
    longtext("description", "Leírás", "Hét lépés, amelyben minden szakasz előre egyeztetett."),
    ...pairedFields("step", processSteps, "lépés címe", "lépés leírása"),
  ]),
  section("home.caseStudy", "Főoldal", "Kiemelt esettanulmány", 6, [
    text("eyebrow", "Címke", "Kiemelt esettanulmány"),
    text("button", "Gomb", "Hasonló munkára kérek ajánlatot"),
  ]),
  section("home.why", "Főoldal", "Miért minket?", 7, [
    text("eyebrow", "Címke", "Miért minket"),
    text("title", "Cím", "Miért ezt a vállalkozást?"),
    longtext("description", "Leírás", "Konkrét vállalások általános ígéretek helyett."),
    ...pairedFields("item", whyItems, "előny címe", "előny leírása"),
  ]),
  section("home.testimonials", "Főoldal", "Vélemények", 8, [
    text("eyebrow", "Címke", "Vélemények"),
    text("title", "Cím", "Ügyfélhelyzetek, ahogy az ügyfelek látták"),
    longtext(
      "description",
      "Leírás",
      "Az alábbi vélemények a bemutatóhoz készült mintatartalmak, nem hitelesített értékelések.",
    ),
    text("review.1.name", "1. név", "Sz. Tamás"),
    text("review.1.place", "1. helyszín", "Szolnok"),
    text("review.1.topic", "1. munka", "Teljes tetőcsere"),
    longtext(
      "review.1.text",
      "1. vélemény",
      "A felmérés után részletes, tételes ajánlatot kaptunk, és a munka az ütemterv szerint haladt.",
    ),
    text("review.2.name", "2. név", "K. Anikó"),
    text("review.2.place", "2. helyszín", "Törökszentmiklós"),
    text("review.2.topic", "2. munka", "Sürgős beázásjavítás"),
    longtext(
      "review.2.text",
      "2. vélemény",
      "A vihar utáni beázásnál gyorsan kijöttek, és fényképen megmutatták, hol jutott be a víz.",
    ),
    text("review.3.name", "3. név", "B. Gergő"),
    text("review.3.place", "3. helyszín", "Karcag"),
    text("review.3.topic", "3. munka", "Ereszcsatorna és bádogozás"),
    longtext(
      "review.3.text",
      "3. vélemény",
      "Az új csatornát a tetőfelülethez méretezték, a kéményszegélyt is újracsinálták.",
    ),
  ]),
  section("home.serviceArea", "Főoldal", "Szolgáltatási terület", 9, [
    text("eyebrow", "Címke", "Szolgáltatási terület"),
    text("title", "Cím", "Szolnok és a környező települések"),
    longtext(
      "description",
      "Leírás",
      "Elsősorban az alábbi térségben dolgozunk. Ha a településed nem szerepel a listán, attól még egyeztethetünk.",
    ),
    text("placeholder", "Kereső helyőrző", "Írd be a települést"),
    text("button", "Keresés gomb", "Ellenőrzés"),
    longtext(
      "success",
      "Találat üzenet",
      "A megadott település a kiemelt szolgáltatási területünkön található.",
    ),
    longtext(
      "fallback",
      "Nincs találat üzenet",
      "A pontos kiszállási lehetőségről egyeztessünk telefonon.",
    ),
  ]),
  section("home.faq", "Főoldal", "Gyakori kérdések", 10, [
    text("eyebrow", "Címke", "Gyakori kérdések"),
    text("title", "Cím", "Amit a leggyakrabban kérdeznek"),
    ...pairedFields("faq", faqItems, "kérdés", "válasz"),
  ]),
  section("home.cta", "Főoldal", "Záró CTA", 11, [
    text("title", "Cím", "A tető hibái ritkán oldódnak meg maguktól."),
    longtext(
      "description",
      "Leírás",
      "Küldj néhány információt és fényképet, hogy felkészülten tudjunk visszahívni.",
    ),
    text("primaryCta", "Elsődleges gomb", "Részletes ajánlatkérés"),
    text("secondaryCta", "Másodlagos gomb", "Visszahívást kérek"),
    image("image", "Háttérkép", projectFinished),
  ]),
  section("services.index", "Szolgáltatások", "Szolgáltatások oldal", 1, [
    text("eyebrow", "Címke", "Szolgáltatások"),
    text("title", "Cím", "Amit a tetőn és a tető körül vállalunk"),
    longtext(
      "description",
      "Leírás",
      "A szerkezettől a csatornáig minden munkanem egy kivitelezői körben, egyetlen kapcsolattartóval.",
    ),
    text("details", "Részletek link", "Részletek"),
    longtext(
      "ctaText",
      "Alsó CTA szöveg",
      "Nem tudod, melyik szolgáltatás kell? Írd le a problémát, és javaslatot adunk.",
    ),
    text("ctaButton", "Alsó CTA gomb", "Ajánlatkérés indítása"),
  ]),
  section("services.detail", "Szolgáltatások", "Szolgáltatás részletező", 2, [
    text("back", "Vissza link", "Összes szolgáltatás"),
    image("image", "Alapértelmezett szolgáltatáskép", detailMembrane),
    longtext(
      "extra",
      "Kiegészítő bemutatkozás",
      "A munkát mindig állapotfelméréssel kezdjük, és a rétegrendet az épület adottságaihoz igazítjuk. A rejtett részekről fényképes dokumentációt készítünk.",
    ),
    text("processTitle", "Folyamat címe", "A munka menete"),
    ...pairedFields("step", processSteps.slice(0, 6), "lépés", "leírás"),
    text("offerTitle", "Ajánlatkérő kártya címe", "Kérj ajánlatot erre"),
    longtext(
      "offerText",
      "Ajánlatkérő kártya leírása",
      "Az ajánlatkérő már ezzel a szolgáltatással előtöltve nyílik meg.",
    ),
    text("benefitsTitle", "Vállalások címe", "Amit vállalunk"),
    text("benefit.1", "1. vállalás", "Tételes, összehasonlítható ajánlat"),
    text("benefit.2", "2. vállalás", "Előre egyeztetett munkafázisok"),
    text("benefit.3", "3. vállalás", "Fényképes dokumentáció"),
    text("benefit.4", "4. vállalás", "Hulladékkezelés és helyreállítás"),
    text("referenceTitle", "Kapcsolódó referencia címe", "Kapcsolódó referencia"),
  ]),
  section("references.index", "Referenciák", "Referencia listaoldal", 1, [
    text("eyebrow", "Címke", "Referenciák"),
    text("title", "Cím", "Elvégzett munkák, konkrét helyzetekkel"),
    longtext(
      "description",
      "Leírás",
      "Minden projektnél rögzítjük a kiindulási problémát, az elvégzett munkanemeket és a kivitelezési időt.",
    ),
    text("button", "Kártya link", "Projekt megtekintése"),
  ]),
  section("references.detail", "Referenciák", "Referencia részletező", 2, [
    text("back", "Vissza link", "Összes referencia"),
    text("situationTitle", "Kiindulási helyzet címe", "Kiindulási helyzet"),
    text("worksTitle", "Elvégzett munkák címe", "Elvégzett munkák"),
    text("servicesLabel", "Munkanemek címke", "Munkanemek"),
    text("durationLabel", "Kivitelezési idő címke", "Kivitelezési idő"),
    text("locationLabel", "Helyszín címke", "Helyszín"),
    text("button", "Ajánlatkérő gomb", "Hasonló munkára kérek ajánlatot"),
  ]),
  section("process.page", "Folyamat", "Folyamat oldal", 1, [
    text("eyebrow", "Címke", "Folyamat"),
    text("title", "Cím", "Átlátható folyamat az első hívástól az elkészült tetőig"),
    longtext("description", "Leírás", "Minden szakasz előre egyeztetett, és írásban is rögzítjük."),
    ...pairedFields("step", processSteps, "lépés címe", "lépés leírása"),
    longtext(
      "ctaText",
      "Alsó CTA",
      "Kezdjük az első lépéssel: néhány adat és fénykép elég az induláshoz.",
    ),
    text("ctaButton", "CTA gomb", "Ajánlatkérés indítása"),
  ]),
  section("knowledge.index", "Tudástár", "Tudástár listaoldal", 1, [
    text("eyebrow", "Címke", "Tudástár"),
    text("title", "Cím", "Amit érdemes tudni, mielőtt döntesz"),
    longtext(
      "description",
      "Leírás",
      "Rövid, gyakorlati írások arról, hogyan lehet felkészülten kivitelezőt választani.",
    ),
    text("readingSuffix", "Olvasási idő utótag", "olvasás"),
  ]),
  ...articles.map((article, articleIndex) =>
    section(`article.${article.slug}`, "Tudástár", `Cikk: ${article.title}`, articleIndex + 2, [
      text("slug", "URL azonosító", article.slug),
      text("category", "Kategória", article.category),
      text("readingTime", "Olvasási idő", article.readingTime),
      text("title", "Cím", article.title),
      longtext("lead", "Bevezető", article.lead),
      ...article.body.map((paragraph, index) =>
        longtext(`paragraph.${index + 1}`, `${index + 1}. bekezdés`, paragraph),
      ),
      longtext("ctaText", "Alsó CTA", "Nézzük meg konkrétan a te tetődet is."),
      text("ctaButton", "CTA gomb", "Ajánlatkérés indítása"),
    ]),
  ),
  section("contact.page", "Kapcsolat", "Kapcsolat oldal", 1, [
    text("eyebrow", "Címke", "Kapcsolat"),
    text("title", "Cím", "Beszéljük át, mi történik a tetőn"),
    longtext(
      "description",
      "Leírás",
      "Válaszd azt a formát, ami neked kényelmes: hívás, visszahívás vagy részletes ajánlatkérő fényképekkel.",
    ),
    text("phoneTitle", "Telefon kártya címe", "Telefonos egyeztetés"),
    longtext("phoneText", "Telefon kártya leírása", "Sürgős beázás esetén ez a leggyorsabb út."),
    text("callbackTitle", "Visszahívás kártya címe", "Visszahívás kérése"),
    longtext(
      "callbackText",
      "Visszahívás kártya leírása",
      "Add meg, mikor hívhatunk, és a megadott sávban keresünk.",
    ),
    text("callbackButton", "Visszahívás gomb", "Visszahívást kérek"),
    text("quoteTitle", "Ajánlatkérés kártya címe", "Részletes ajánlatkérés"),
    longtext(
      "quoteText",
      "Ajánlatkérés kártya leírása",
      "Nyolc rövid lépés, fényképfeltöltéssel. Így felkészülten hívunk vissza.",
    ),
    text("quoteButton", "Ajánlatkérés gomb", "Ajánlatkérő megnyitása"),
    text("detailsTitle", "Elérhetőségek cím", "Elérhetőségek"),
    text("areasTitle", "Területek cím", "Szolgáltatási terület"),
    longtext(
      "areasText",
      "Területek megjegyzése",
      "Ha a településed nem szerepel a listán, attól még egyeztethetünk a kiszállásról.",
    ),
  ]),
  section("quote.wizard", "Ajánlatkérő", "Ajánlatkérő felület", 1, [
    text("header", "Fejléc", "Ajánlatkérés"),
    text("autosave", "Mentési állapot", "automatikusan mentve"),
    ...quoteStepTitles.map((title, index) =>
      text(`step.${index + 1}.title`, `${index + 1}. lépés címe`, title),
    ),
    ...quoteStepShort.map((title, index) =>
      text(`step.${index + 1}.short`, `${index + 1}. lépés rövid neve`, title),
    ),
    text("submit", "Beküldés gomb", "Ajánlatkérés beküldése"),
    text("submitting", "Beküldés folyamatban", "Mentés…"),
  ]),
];

export const defaultCmsSections: CmsSection[] = cmsDefinitions.map((definition) => ({
  id: definition.id,
  page: definition.page,
  name: definition.name,
  visible: definition.defaultVisible,
  order: definition.defaultOrder,
  values: Object.fromEntries(definition.fields.map((field) => [field.key, field.defaultValue])),
}));

export function mergeCmsSections(stored: CmsSection[] | undefined): CmsSection[] {
  const storedMap = new Map((stored ?? []).map((entry) => [entry.id, entry]));
  return defaultCmsSections.map((fallback) => {
    const existing = storedMap.get(fallback.id);
    return existing
      ? { ...fallback, ...existing, values: { ...fallback.values, ...existing.values } }
      : structuredClone(fallback);
  });
}
