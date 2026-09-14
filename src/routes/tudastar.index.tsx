import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { useCmsSection, useDemo } from "@/demo/store";

export const Route = createFileRoute("/tudastar/")({
  head: () => ({
    meta: [
      { title: "Tudástár — tetőfelújítási útmutatók | TetőVonal" },
      {
        name: "description",
        content:
          "Mikor szükséges teljes tetőcsere, mitől ázhat be a tető, és mit tartalmaz egy korrekt tetőfelújítási ajánlat? Döntéstámogató cikkek kivitelezői szemmel.",
      },
      { property: "og:title", content: "Tudástár — TetőVonal" },
      {
        property: "og:description",
        content: "Gyakorlati útmutatók tetőcseréhez, beázáshoz és ajánlatolvasáshoz.",
      },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { cms } = useDemo();
  const { section, value } = useCmsSection("knowledge.index");
  const articles = cms
    .filter((section) => section.id.startsWith("article.") && section.visible)
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      slug: section.values["slug"] ?? section.id.slice("article.".length),
      title: section.values["title"] ?? section.name,
      lead: section.values["lead"] ?? "",
      readingTime: section.values["readingTime"] ?? "",
      category: section.values["category"] ?? "",
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

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {articles.map((a, i) => (
              <Reveal key={a.slug} delay={i * 0.05}>
                <Link
                  to="/tudastar/$slug"
                  params={{ slug: a.slug }}
                  className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <div>
                    <span className="label-eyebrow text-accent">{a.category}</span>
                    <h2 className="mt-3 font-display text-xl font-semibold">{a.title}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">{a.lead}</p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
                    {a.readingTime} {value("readingSuffix", "olvasás")}{" "}
                    <ArrowUpRight className="h-4 w-4 text-accent" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="h-20" />
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
