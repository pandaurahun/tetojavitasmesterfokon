import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useCmsSection, useDemo } from "@/demo/store";
import { images } from "@/demo/data";

export const Route = createFileRoute("/szolgaltatasok/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Szolgáltatás: ${params.slug} — TetőVonal` },
      {
        name: "description",
        content:
          "Részletes műszaki leírás a kiválasztott tetőfedő szolgáltatásról, a folyamat lépéseiről és az ajánlatkérés módjáról.",
      },
      { property: "og:title", content: "Szolgáltatás részletei — TetőVonal" },
      {
        property: "og:description",
        content: "Mit tartalmaz a munka, hogyan zajlik, és mire figyelünk a kivitelezés során.",
      },
    ],
  }),
  component: ServiceDetail,
  notFoundComponent: () => (
    <div className="pt-32 pb-24 text-center">
      <p className="text-sm text-muted-foreground">Ez a szolgáltatás nem található.</p>
      <Button asChild variant="ink" className="mt-4">
        <Link to="/szolgaltatasok">Összes szolgáltatás</Link>
      </Button>
    </div>
  ),
});

function ServiceDetail() {
  const { slug } = Route.useParams();
  const { services, projects } = useDemo();
  const { section, value } = useCmsSection("services.detail");
  const service = services.find((s) => s.slug === slug);
  if (!service) throw notFound();

  const related = projects.filter((p) => p.published && p.services.includes(service.title));

  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main className="pt-28 sm:pt-32">
        <Container className={section?.visible === false ? "hidden" : ""}>
          <Link
            to="/szolgaltatasok"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {value("back", "Összes szolgáltatás")}
          </Link>

          <Reveal>
            <p className="label-eyebrow mt-8 text-accent">{service.category}</p>
            <h1 className="mt-4 max-w-3xl font-display text-3xl leading-tight font-semibold text-balance-tight sm:text-5xl">
              {service.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {service.short}
            </p>
          </Reveal>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <Reveal>
              <img
                src={service.image || value("image", images.detailMembrane)}
                alt={`${service.title} — munkafázis`}
                loading="lazy"
                className="w-full rounded-[var(--radius-card)] border border-border object-cover"
              />
              <div className="mt-8 space-y-4 text-base leading-relaxed">
                <p>{service.long}</p>
                <p>{value("extra")}</p>
              </div>

              <h2 className="mt-10 font-display text-2xl font-semibold">
                {value("processTitle", "A munka menete")}
              </h2>
              <ol className="mt-5 space-y-3">
                {Array.from({ length: 6 }, (_, index) => ({
                  title: value(`step.${index + 1}.title`),
                  description: value(`step.${index + 1}.description`),
                })).map((step, i) => (
                  <li key={step.title} className="flex gap-3 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-ink-foreground">
                      {i + 1}
                    </span>
                    <span>
                      <strong className="font-semibold">{step.title}</strong>
                      <span className="mt-0.5 block text-muted-foreground">{step.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="sticky top-28 space-y-4">
                <div className="surface-card p-6">
                  <h2 className="font-display text-lg font-semibold">{value("offerTitle")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{value("offerText")}</p>
                  <Button asChild variant="copper" className="mt-5 w-full">
                    <Link to="/ajanlatkeres" search={{ szolgaltatas: service.title, lepes: 2 }}>
                      {service.cta} <ArrowRight />
                    </Link>
                  </Button>
                </div>

                <div className="surface-card p-6">
                  <h3 className="label-eyebrow text-accent">{value("benefitsTitle")}</h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    {Array.from({ length: 4 }, (_, index) => value(`benefit.${index + 1}`)).map(
                      (x) => (
                        <li key={x} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          {x}
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                {related.length > 0 ? (
                  <div className="surface-card p-6">
                    <h3 className="label-eyebrow text-accent">{value("referenceTitle")}</h3>
                    <div className="mt-4 space-y-3">
                      {related.map((p) => (
                        <Link
                          key={p.id}
                          to="/referenciak/$id"
                          params={{ id: p.id }}
                          className="block text-sm font-semibold hover:text-accent"
                        >
                          {p.title}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {p.location} — {p.duration}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Reveal>
          </div>
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
