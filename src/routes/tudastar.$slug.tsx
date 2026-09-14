import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/store";

export const Route = createFileRoute("/tudastar/$slug")({
  head: () => ({
    meta: [
      { title: "Tudástár cikk — TetőVonal" },
      {
        name: "description",
        content:
          "Gyakorlati útmutató tetőfelújításhoz, beázás okaihoz és az árajánlatok összehasonlításához.",
      },
      { property: "og:title", content: "Tudástár cikk — TetőVonal" },
      { property: "og:description", content: "Kivitelezői szemmel írt döntéstámogató cikk." },
    ],
  }),
  component: ArticlePage,
  notFoundComponent: () => (
    <div className="pt-32 pb-24 text-center">
      <p className="text-sm text-muted-foreground">Ez a cikk nem található.</p>
      <Button asChild variant="ink" className="mt-4">
        <Link to="/tudastar">Tudástár</Link>
      </Button>
    </div>
  ),
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { cms } = useDemo();
  const section = cms.find(
    (entry) => entry.id.startsWith("article.") && entry.values["slug"] === slug && entry.visible,
  );
  if (!section) throw notFound();
  const article = {
    title: section.values["title"] ?? section.name,
    lead: section.values["lead"] ?? "",
    readingTime: section.values["readingTime"] ?? "",
    category: section.values["category"] ?? "",
    body: Object.entries(section.values)
      .filter(([key]) => key.startsWith("paragraph."))
      .sort(([left], [right]) => Number(left.split(".")[1]) - Number(right.split(".")[1]))
      .map(([, paragraph]) => paragraph)
      .filter(Boolean),
  };

  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main className="pt-28 sm:pt-32">
        <Container className="max-w-[760px]">
          <Link
            to="/tudastar"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Tudástár
          </Link>
          <Reveal>
            <p className="label-eyebrow mt-8 text-accent">
              {article.category} • {article.readingTime}
            </p>
            <h1 className="mt-4 font-display text-3xl leading-tight font-semibold sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{article.lead}</p>
            <div className="mt-8 space-y-5 text-base leading-relaxed">
              {article.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>

          <div className="my-16 rounded-[var(--radius-card)] bg-ink p-8 text-ink-foreground">
            <p className="font-display text-xl font-semibold">{section.values["ctaText"]}</p>
            <Button asChild variant="copper" className="mt-5">
              <Link to="/ajanlatkeres" search={{ lepes: 1 }}>
                {section.values["ctaButton"]} <ArrowRight />
              </Link>
            </Button>
          </div>
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
