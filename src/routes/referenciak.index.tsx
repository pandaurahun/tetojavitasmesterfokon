import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { useCmsSection, useDemo } from "@/demo/store";

export const Route = createFileRoute("/referenciak/")({
  head: () => ({
    meta: [
      { title: "Referenciák — elvégzett tetőfelújítások | TetőVonal" },
      {
        name: "description",
        content:
          "Elvégzett tetőfelújítások, bádogos munkák és szigetelési projektek előtte-utána fényképekkel, a kiindulási problémával és az elvégzett munkanemekkel.",
      },
      { property: "og:title", content: "Referenciák — TetőVonal" },
      {
        property: "og:description",
        content: "Konkrét projektek: probléma, elvégzett munkák, kivitelezési idő.",
      },
    ],
  }),
  component: ReferencesPage,
});

function ReferencesPage() {
  const { projects } = useDemo();
  const { section, value } = useCmsSection("references.index");
  const list = projects.filter((p) => p.published);

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

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {list.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.05}>
                <Link
                  to="/referenciak/$id"
                  params={{ id: p.id }}
                  className="group block overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <img
                    src={p.afterImage}
                    alt={p.title}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="p-6">
                    <span className="label-eyebrow text-accent">{p.location}</span>
                    <h2 className="mt-2 font-display text-xl font-semibold">{p.title}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">{p.problem}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                      {value("button", "Projekt megtekintése")}{" "}
                      <ArrowUpRight className="h-4 w-4 text-accent" />
                    </span>
                  </div>
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
