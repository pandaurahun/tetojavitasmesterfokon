import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useCmsSection, useDemo } from "@/demo/store";

export const Route = createFileRoute("/szolgaltatasok/")({
  head: () => ({
    meta: [
      { title: "Szolgáltatások — tetőfedés, bádogozás, szigetelés | TetőVonal" },
      {
        name: "description",
        content:
          "Komplett tetőfedés, tetőfelújítás, beázásjavítás, bádogos munkák, ereszcsatorna, szigetelés és ácsmunkák egy kivitelezői körben.",
      },
      { property: "og:title", content: "Szolgáltatási területek — TetőVonal" },
      {
        property: "og:description",
        content: "Nézd meg, milyen tetőfedő és bádogos munkákat vállalunk, és kérj rá ajánlatot.",
      },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { services } = useDemo();
  const { section, value } = useCmsSection("services.index");
  const list = services.filter((s) => s.active).sort((a, b) => a.order - b.order);
  const categories = Array.from(new Set(list.map((s) => s.category)));

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

          {categories.map((cat) => (
            <section key={cat} className="mt-14">
              <h2 className="label-eyebrow text-accent">{cat}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {list
                  .filter((s) => s.category === cat)
                  .map((s, i) => (
                    <Reveal key={s.id} delay={i * 0.04}>
                      <article className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-lift">
                        <div>
                          <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {s.short}
                          </p>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                          <Link
                            to="/szolgaltatasok/$slug"
                            params={{ slug: s.slug }}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
                          >
                            {value("details", "Részletek")}{" "}
                            <ArrowUpRight className="h-4 w-4 text-accent" />
                          </Link>
                          <Link
                            to="/ajanlatkeres"
                            search={{ szolgaltatas: s.title, lepes: 1 }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {s.cta}
                          </Link>
                        </div>
                      </article>
                    </Reveal>
                  ))}
              </div>
            </section>
          ))}

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
