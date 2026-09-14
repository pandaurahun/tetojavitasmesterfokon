import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useCmsSection } from "@/demo/store";

export const Route = createFileRoute("/folyamat")({
  head: () => ({
    meta: [
      { title: "Munkafolyamat — az első hívástól az átadásig | TetőVonal" },
      {
        name: "description",
        content:
          "Hét lépés, amelyben minden szakasz előre egyeztetett: kapcsolatfelvétel, felmérés, tételes ajánlat, ütemezés, kivitelezés és dokumentált átadás.",
      },
      { property: "og:title", content: "Átlátható munkafolyamat — TetőVonal" },
      {
        property: "og:description",
        content: "Előre tudod, melyik napon mi történik a tetőn.",
      },
    ],
  }),
  component: ProcessPage,
});

const steps = [
  {
    t: "Kapcsolatfelvétel",
    d: "Telefon, ajánlatkérő vagy visszahívás kérése. Már ekkor rögzítjük a probléma jellegét és a helyszínt.",
  },
  {
    t: "Igények előzetes felmérése",
    d: "Röviden átbeszéljük a tapasztalt hibát, és megnézzük a feltöltött fényképeket. Ez alapján előzetes véleményt adunk.",
  },
  {
    t: "Helyszíni állapotfelmérés",
    d: "A tetőt kívülről és a padlásteret belülről is megvizsgáljuk, méreteket veszünk fel, és fényképen rögzítjük a csomópontok állapotát.",
  },
  {
    t: "Tételes ajánlat",
    d: "Munkanemenkénti bontásban, mennyiségekkel, mértékegységekkel, vállalási idővel és érvényességgel.",
  },
  {
    t: "Ütemezés és előkészítés",
    d: "Állványozás, anyagbeszerzés, hulladékkezelés és a munkaterület átvétele előre egyeztetve.",
  },
  {
    t: "Kivitelezés",
    d: "Szakaszos munkavégzés. A munkanap végén a megnyitott tetőfelületet az időjárási körülményekhez igazodó ideiglenes védelemmel látjuk el.",
  },
  {
    t: "Dokumentált átadás",
    d: "Átadás-átvételi jegyzőkönyv, fényképes dokumentáció a rejtett szerkezeti részekről és a garanciális feltételek írásban.",
  },
];

function ProcessPage() {
  const { section, value } = useCmsSection("process.page");
  const editableSteps = steps.map((step, index) => ({
    t: value(`step.${index + 1}.title`, step.t),
    d: value(`step.${index + 1}.description`, step.d),
  }));
  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main className="pt-28 sm:pt-32">
        <Container className={section?.visible === false ? "hidden" : ""}>
          <Reveal>
            <SectionHeading
              eyebrow={value("eyebrow")}
              title={value("title")}
              intro={value("description")}
            />
          </Reveal>

          <ol className="mt-14 space-y-4">
            {editableSteps.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.04}>
                <li className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-6">
                  <span className="font-display text-4xl text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold">{s.t}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          <div className="section-pad">
            <div className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-ink p-8 text-ink-foreground sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-lg font-display text-xl font-semibold">{value("ctaText")}</p>
              <Button asChild variant="copper" size="lg">
                <Link to="/ajanlatkeres" search={{ lepes: 1 }}>
                  {value("ctaButton", "Ajánlatkérés indítása")} <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
