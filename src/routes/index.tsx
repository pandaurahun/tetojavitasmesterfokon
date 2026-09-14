import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Search } from "lucide-react";
import { Hero } from "@/components/hero/Hero";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCmsSection, useDemo } from "@/demo/store";
import { useCallbackModal } from "@/demo/ui";
import { images } from "@/demo/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TetőVonal | Tetőfedés és kivitelezés" },
      {
        name: "description",
        content:
          "Tetőfedés, tetőfelújítás, beázásjavítás, bádogozás és ereszcsatorna kivitelezés átlátható folyamattal, tételes ajánlattal és fényképes dokumentációval.",
      },
      { property: "og:title", content: "TetőVonal — otthonokat védünk meg évtizedekre" },
      {
        property: "og:description",
        content:
          "Prémium tetőfedő és bádogos kivitelezés Szolnok és környéke területén. Kérj helyszíni felmérést vagy tételes ajánlatot.",
      },
    ],
  }),
  component: Home,
});

const problems = [
  {
    key: "beazas",
    title: "Beázás",
    explain: "A víz jellemzően bádogos csomóponton vagy sérült fólián keresztül jut be.",
    consequence: "A szerkezet nedvesedik, a szigetelés összetömörödik, penész indulhat.",
    service: "Beázás és sürgős tetőjavítás",
  },
  {
    key: "cserep",
    title: "Elmozdult vagy törött cserép",
    explain: "Vihar, hó vagy korábbi szerelés mozdíthatta el a fedést.",
    consequence: "A befújt csapadék a fóliát terheli, ami idővel átszakad.",
    service: "Beázás és sürgős tetőjavítás",
  },
  {
    key: "padlas",
    title: "Nedves padlástér",
    explain: "Gyakran nem beázás, hanem párakicsapódás okozza a nedvességet.",
    consequence: "A faszerkezet nedvességtartalma tartósan megemelkedik.",
    service: "Tető- és födémszigetelés",
  },
  {
    key: "badog",
    title: "Rozsdás bádogozás",
    explain: "A régi horganyzott lemez a hajlatoknál és a rögzítéseknél megy át először.",
    consequence: "A vápa és a kéményszegély már nem vezeti el a vizet.",
    service: "Bádogos munkák",
  },
  {
    key: "csatorna",
    title: "Elöregedett ereszcsatorna",
    explain: "A toldások kilazulnak, a tartók megsüllyednek, a lejtés megszűnik.",
    consequence: "A víz a homlokzatra és a lábazatra folyik.",
    service: "Ereszcsatorna-rendszerek",
  },
  {
    key: "futes",
    title: "Magas fűtési költség",
    explain: "Hiányos vagy összetömörödött szigetelés, megszakadt párazáró réteg.",
    consequence: "A tetőn keresztül jelentős hőveszteség távozik.",
    service: "Tető- és födémszigetelés",
  },
  {
    key: "vihar",
    title: "Viharkár",
    explain: "Felszakadt fedés, elmozdult gerinc, sérült szegélyek.",
    consequence: "Egy következő esőnél már a szerkezet ázik.",
    service: "Beázás és sürgős tetőjavítás",
  },
  {
    key: "csere",
    title: "Teljes tetőcsere előtt állok",
    explain: "Élettartama végén járó héjazat és fólia esetén a részjavítás csak halasztás.",
    consequence: "A javítások költsége néhány év alatt eléri a csere árát.",
    service: "Tetőfelújítás és tetőcsere",
  },
];

const faq = [
  {
    q: "Mikor szükséges teljes tetőcsere?",
    a: "Akkor, ha a héjazat és a fólia is élettartama végén jár, illetve ha a javítások több ponton, egyre gyakrabban ismétlődnek. Egyetlen hibás csomópont miatt nem indokolt csere.",
  },
  {
    q: "Vállalnak sürgős beázásjavítást?",
    a: "Igen. Ilyenkor először a víz útját tárjuk fel és ideiglenesen lezárjuk a felületet, majd a tartós javítást külön egyeztetjük.",
  },
  {
    q: "Hogyan történik a helyszíni felmérés?",
    a: "Megnézzük a tetőt kívülről és a padlásteret belülről is, fényképeket készítünk, felmérjük a méreteket, és rögzítjük a csomópontok állapotát.",
  },
  {
    q: "Mit tartalmaz egy tételes árajánlat?",
    a: "Külön soron a bontást, a hulladékkezelést, a fóliát, a lécezést, a fedést, a bádogos elemeket, a csatornát és az állványozást, mennyiséggel és mértékegységgel együtt.",
  },
  {
    q: "Lehet fényképek alapján előzetes véleményt kérni?",
    a: "Igen, az ajánlatkérőben feltölthetők fényképek. Ez alapján előzetes véleményt adunk, de a végleges ajánlat helyszíni felmérés után készül.",
  },
  {
    q: "Milyen dokumentumokat érdemes elküldeni?",
    a: "Ha van, hasznos a tetőterv, a korábbi ajánlat vagy a biztosítói kárfelvételi jegyzőkönyv, valamint fényképek a beázás helyéről.",
  },
  {
    q: "Vállalnak bádogozást és ereszcsatorna-cserét is?",
    a: "Igen, a bádogos munkák és a csatornarendszerek kivitelezése önálló szolgáltatásként is kérhető.",
  },
  {
    q: "Hogyan egyeztethető a kivitelezés időpontja?",
    a: "Az ajánlat elfogadása után ütemtervet küldünk, amelyben rögzítjük a kezdés időpontját és a főbb munkafázisokat.",
  },
];

const why = [
  {
    t: "Tételes, átlátható ajánlat",
    d: "Minden munkanem külön soron, mennyiséggel és egységárral.",
  },
  {
    t: "Fényképes dokumentáció",
    d: "A rejtett szerkezeti részekről is készül felvétel a takarás előtt.",
  },
  { t: "Egyértelmű munkafázisok", d: "Előre tudod, melyik napon mi történik a tetőn." },
  {
    t: "Közvetlen kapcsolattartó",
    d: "Egy ember, aki a felméréstől az átadásig végigkíséri a munkát.",
  },
  {
    t: "Az ingatlanhoz illő műszaki megoldás",
    d: "A rétegrendet a beépítés módjához és a terhelhetőséghez igazítjuk.",
  },
  {
    t: "Előre egyeztetett kivitelezési folyamat",
    d: "Ütemterv, hulladékkezelés és állványozás előre tisztázva.",
  },
];

const testimonials = [
  {
    name: "Sz. Tamás",
    place: "Szolnok",
    topic: "Teljes tetőcsere",
    text: "A felmérés után részletes, tételes ajánlatot kaptunk, és a munka az ütemterv szerint haladt. A bontás napján is le volt fedve a tető estére.",
  },
  {
    name: "K. Anikó",
    place: "Törökszentmiklós",
    topic: "Sürgős beázásjavítás",
    text: "A vihar utáni beázásnál gyorsan kijöttek, ideiglenesen lezárták a hibát, és fényképen megmutatták, hol jött be a víz.",
  },
  {
    name: "B. Gergő",
    place: "Karcag",
    topic: "Ereszcsatorna és bádogozás",
    text: "Az új csatornát a tetőfelülethez méretezték, a kéményszegélyt is újracsinálták. Azóta nem folyik a víz a falra.",
  },
];

const processSteps = [
  { t: "Kapcsolatfelvétel", d: "Telefon, ajánlatkérő vagy visszahívás kérése." },
  { t: "Igények előzetes felmérése", d: "Röviden átbeszéljük a problémát és a fényképeket." },
  { t: "Helyszíni állapotfelmérés", d: "Kívül és belül is megnézzük a szerkezetet, fotókkal." },
  { t: "Tételes ajánlat", d: "Munkanemenkénti bontásban, mennyiségekkel." },
  { t: "Ütemezés és előkészítés", d: "Állványozás, anyagbeszerzés, hulladékkezelés." },
  {
    t: "Kivitelezés",
    d: "Szakaszos munkavégzés. A munkanap végén a megnyitott tetőfelületet az időjárási körülményekhez igazodó ideiglenes védelemmel látjuk el.",
  },
  { t: "Dokumentált átadás", d: "Átadási jegyzőkönyv és fényképes dokumentáció." },
];

function Home() {
  const { cms } = useDemo();
  const components = {
    "home.hero": Hero,
    "home.services": Services,
    "home.diagnostics": Diagnostics,
    "home.beforeAfter": BeforeAfter,
    "home.process": Process,
    "home.caseStudy": CaseStudy,
    "home.why": Why,
    "home.testimonials": Testimonials,
    "home.serviceArea": ServiceArea,
    "home.faq": Faq,
    "home.cta": FinalCta,
  } as const;
  const sections = cms
    .filter((section) => section.page === "Főoldal" && section.visible && section.id in components)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main>
        {sections.map((section) => {
          const Component = components[section.id as keyof typeof components];
          return Component ? <Component key={section.id} /> : null;
        })}
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}

function Services() {
  const { services } = useDemo();
  const { section, value } = useCmsSection("home.services");
  const list = services.filter((s) => s.active).sort((a, b) => a.order - b.order);
  if (section && !section.visible) return null;

  return (
    <section className="section-pad" id="szolgaltatasok">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
          />
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {list.map((s, i) => {
            const wide = i === 0 || i === 3;
            return (
              <Reveal
                key={s.id}
                delay={i * 0.04}
                className={wide ? "lg:col-span-7" : "lg:col-span-5"}
              >
                <article className="group flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <h3 className="min-w-0 font-display text-xl font-semibold text-balance-tight sm:text-2xl">
                        {s.title}
                      </h3>
                      <span className="label-eyebrow shrink-0 rounded-full bg-[color-mix(in_oklab,var(--primary)_7%,transparent)] px-2.5 py-1 text-muted-foreground">
                        {s.category}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed break-words text-muted-foreground">
                      {s.short}
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      to="/szolgaltatasok/$slug"
                      params={{ slug: s.slug }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {value("detailsCta", "Részletek")}{" "}
                      <ArrowUpRight className="h-4 w-4 text-accent" />
                    </Link>
                    <Link
                      to="/ajanlatkeres"
                      search={{ szolgaltatas: s.title, lepes: 1 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {s.cta}
                    </Link>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function Diagnostics() {
  const { section, value } = useCmsSection("home.diagnostics");
  const editableProblems = problems.map((problem, index) => ({
    ...problem,
    title: value(`problem.${index + 1}.title`, problem.title),
    explain: value(`problem.${index + 1}.cause`, problem.explain),
    consequence: value(`problem.${index + 1}.consequence`, problem.consequence),
    service: value(`problem.${index + 1}.service`, problem.service),
  }));
  const [activeKey, setActiveKey] = useState(problems[0]!.key);
  const active =
    editableProblems.find((problem) => problem.key === activeKey) ?? editableProblems[0]!;
  if (section && !section.visible) return null;
  return (
    <section className="section-pad bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
          />
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-wrap gap-2 self-start">
            {editableProblems.map((p) => (
              <button
                key={p.key}
                onClick={() => setActiveKey(p.key)}
                className={`rounded-[var(--radius-button)] border px-4 py-3 text-left text-sm font-medium transition-all ${
                  activeKey === p.key
                    ? "border-accent bg-accent text-accent-foreground shadow-soft"
                    : "border-border bg-surface hover:-translate-y-0.5 hover:shadow-soft"
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="surface-card p-6 sm:p-8"
            >
              <h3 className="font-display text-2xl font-semibold">{active.title}</h3>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="label-eyebrow text-accent">{value("causeLabel")}</dt>
                  <dd className="mt-1.5 text-muted-foreground">{active.explain}</dd>
                </div>
                <div>
                  <dt className="label-eyebrow text-accent">{value("consequenceLabel")}</dt>
                  <dd className="mt-1.5 text-muted-foreground">{active.consequence}</dd>
                </div>
                <div>
                  <dt className="label-eyebrow text-accent">{value("serviceLabel")}</dt>
                  <dd className="mt-1.5 font-medium">{active.service}</dd>
                </div>
              </dl>
              <Button asChild variant="ink" className="mt-6">
                <Link to="/ajanlatkeres" search={{ szolgaltatas: active.service, lepes: 1 }}>
                  {value("button", "Megnézetem szakemberrel")} <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

function BeforeAfter() {
  const { projects } = useDemo();
  const { section, value } = useCmsSection("home.beforeAfter");
  const project = projects.find((p) => p.featured) ?? projects[0];
  const [pos, setPos] = useState(52);
  if (!project || (section && !section.visible)) return null;

  return (
    <section className="section-pad">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
          />
        </Reveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border shadow-soft">
              <img
                src={project.afterImage}
                alt="A tető az elvégzett felújítás után"
                loading="lazy"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              >
                <img
                  src={project.beforeImage}
                  alt="A tető állapota a felújítás előtt"
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent"
                style={{ left: `${pos}%` }}
              />
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-ink-foreground">
                {value("beforeLabel", "Előtte")}
              </span>
              <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                {value("afterLabel", "Utána")}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                aria-label="Előtte-utána csúszka"
                onChange={(e) => setPos(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="surface-card h-full p-6 sm:p-7">
              <h3 className="font-display text-xl font-semibold">{project.title}</h3>
              <dl className="mt-5 space-y-4 text-sm">
                <Row label="Projekt típusa" value={project.services.join(", ")} />
                <Row label="Helyszín" value={project.location} />
                <Row label="Kiindulási probléma" value={project.problem} />
                <Row label="Elvégzett munkák" value={project.works.join(" • ")} />
                <Row label="Kivitelezési idő" value={project.duration} />
                <Row label="Felhasznált megoldások" value={value("solutions")} />
              </dl>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/referenciak/$id" params={{ id: project.id }}>
                  {value("button", "Projekt megtekintése")} <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 last:border-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Process() {
  const { section, value } = useCmsSection("home.process");
  const steps = processSteps.map((step, index) => ({
    t: value(`step.${index + 1}.title`, step.t),
    d: value(`step.${index + 1}.description`, step.d),
  }));
  if (section && !section.visible) return null;
  return (
    <section className="section-pad bg-ink text-ink-foreground" id="folyamat">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
            tone="light"
          />
        </Reveal>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-[color-mix(in_oklab,white_10%,transparent)] md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.05} className="h-full">
              <li className="flex h-full flex-col gap-2 bg-ink p-6">
                <span className="font-display text-3xl text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-lg font-semibold">{s.t}</h3>
                <p className="text-sm text-[color-mix(in_oklab,var(--ink-foreground)_70%,transparent)]">
                  {s.d}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function CaseStudy() {
  const { projects } = useDemo();
  const { section, value } = useCmsSection("home.caseStudy");
  const project = projects.find((p) => p.featured) ?? projects[0];
  if (!project || (section && !section.visible)) return null;
  return (
    <section className="section-pad">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={project.title}
            intro={`${project.location} — ${project.problem}`}
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {project.gallery.map((g, i) => (
            <Reveal
              key={g + i}
              delay={i * 0.05}
              className={i === 0 ? "md:col-span-2 md:row-span-2" : ""}
            >
              <img
                src={g}
                loading="lazy"
                alt={`${project.title} — munkafázis ${i + 1}`}
                className="h-full w-full rounded-[var(--radius-card)] border border-border object-cover"
              />
            </Reveal>
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <ul className="grid gap-2 sm:grid-cols-2">
            {project.works.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {w}
              </li>
            ))}
          </ul>
          <Button asChild variant="copper" size="lg">
            <Link
              to="/ajanlatkeres"
              search={{ szolgaltatas: "Tetőfelújítás és tetőcsere", lepes: 1 }}
            >
              {value("button", "Hasonló munkára kérek ajánlatot")}
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}

function Why() {
  const { section, value } = useCmsSection("home.why");
  const items = why.map((item, index) => ({
    t: value(`item.${index + 1}.title`, item.t),
    d: value(`item.${index + 1}.description`, item.d),
  }));
  if (section && !section.visible) return null;
  return (
    <section className="section-pad bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((w, i) => (
            <Reveal key={w.t} delay={i * 0.04}>
              <div className="h-full rounded-[var(--radius-card)] border-l-2 border-accent bg-surface p-6 shadow-soft">
                <h3 className="font-display text-lg font-semibold">{w.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{w.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Testimonials() {
  const { section, value } = useCmsSection("home.testimonials");
  const items = testimonials.map((item, index) => ({
    name: value(`review.${index + 1}.name`, item.name),
    place: value(`review.${index + 1}.place`, item.place),
    topic: value(`review.${index + 1}.topic`, item.topic),
    text: value(`review.${index + 1}.text`, item.text),
  }));
  if (section && !section.visible) return null;
  return (
    <section className="section-pad">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <figure className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <blockquote className="text-sm leading-relaxed">„{t.text}”</blockquote>
                <figcaption className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t.name}</span> — {t.place}
                  <span className="mt-1 block text-accent">{t.topic}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ServiceArea() {
  const { settings } = useDemo();
  const { section, value } = useCmsSection("home.serviceArea");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const found = settings.areas.some(
      (a) =>
        a.toLowerCase() === q.trim().toLowerCase() ||
        a.toLowerCase().includes(q.trim().toLowerCase()),
    );
    setResult(
      q.trim().length === 0
        ? "Írd be a település nevét a kereséshez."
        : found
          ? value("success")
          : value("fallback"),
    );
  };

  if (section && !section.visible) return null;

  return (
    <section className="section-pad bg-forest text-forest-foreground">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <Reveal>
          <SectionHeading
            eyebrow={value("eyebrow")}
            title={value("title")}
            intro={value("description")}
            tone="light"
          />
          <form onSubmit={check} className="mt-6 flex max-w-md gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={value("placeholder", "Írd be a települést")}
              aria-label="Település keresése"
              className="bg-[color-mix(in_oklab,white_10%,transparent)] text-forest-foreground placeholder:text-[color-mix(in_oklab,var(--forest-foreground)_55%,transparent)]"
            />
            <Button type="submit" variant="copper">
              <Search className="h-4 w-4" /> {value("button", "Ellenőrzés")}
            </Button>
          </form>
          {result ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-sm text-[color-mix(in_oklab,var(--forest-foreground)_82%,transparent)]"
            >
              {result}
            </motion.p>
          ) : null}
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative rounded-[var(--radius-card)] border border-[color-mix(in_oklab,white_16%,transparent)] p-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {settings.areas.map((a, i) => (
                <span
                  key={a}
                  className={`rounded-full px-3 py-2 text-center text-xs font-semibold ${
                    i < 6
                      ? "bg-accent text-accent-foreground"
                      : "border border-[color-mix(in_oklab,white_20%,transparent)]"
                  }`}
                >
                  {a}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs text-[color-mix(in_oklab,var(--forest-foreground)_65%,transparent)]">
              A kiemelt települések rézszínnel jelölve.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function Faq() {
  const { section, value } = useCmsSection("home.faq");
  const items = faq.map((item, index) => ({
    q: value(`faq.${index + 1}.title`, item.q),
    a: value(`faq.${index + 1}.description`, item.a),
  }));
  if (section && !section.visible) return null;
  return (
    <section className="section-pad">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <SectionHeading eyebrow={value("eyebrow")} title={value("title")} />
        </Reveal>
        <Reveal delay={0.06}>
          <Accordion type="single" collapsible className="w-full">
            {items.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left font-display text-base font-semibold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </section>
  );
}

function FinalCta() {
  const { open } = useCallbackModal();
  const { section, value } = useCmsSection("home.cta");
  if (section && !section.visible) return null;
  return (
    <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
      <img
        src={value("image", images.projectFinished)}
        alt=""
        loading="lazy"
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-15"
      />
      <Container className="section-pad relative">
        <Reveal>
          <h2 className="max-w-2xl font-display text-3xl leading-tight font-semibold text-balance-tight sm:text-4xl lg:text-5xl">
            {value("title")}
          </h2>
          <p className="mt-5 max-w-xl text-base text-[color-mix(in_oklab,var(--ink-foreground)_75%,transparent)]">
            {value("description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="copper" size="lg">
              <Link to="/ajanlatkeres" search={{ szolgaltatas: "Komplett tetőfedés", lepes: 1 }}>
                {value("primaryCta", "Részletes ajánlatkérés")} <ArrowRight />
              </Link>
            </Button>
            <Button variant="hairline" size="lg" onClick={() => open()}>
              {value("secondaryCta", "Visszahívást kérek")}
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
