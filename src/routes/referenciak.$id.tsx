import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useCmsSection, useDemo } from "@/demo/store";

export const Route = createFileRoute("/referenciak/$id")({
  head: () => ({
    meta: [
      { title: "Referencia projekt — TetőVonal" },
      {
        name: "description",
        content:
          "Egy elvégzett tetőmunka részletei: kiindulási állapot, elvégzett munkanemek, kivitelezési idő és fényképes dokumentáció.",
      },
      { property: "og:title", content: "Referencia projekt — TetőVonal" },
      {
        property: "og:description",
        content: "Előtte-utána fényképek és a teljes munkanem-lista.",
      },
    ],
  }),
  component: ProjectDetail,
  notFoundComponent: () => (
    <div className="pt-32 pb-24 text-center">
      <p className="text-sm text-muted-foreground">Ez a projekt nem található.</p>
      <Button asChild variant="ink" className="mt-4">
        <Link to="/referenciak">Összes referencia</Link>
      </Button>
    </div>
  ),
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { projects } = useDemo();
  const { section, value } = useCmsSection("references.detail");
  const project = projects.find((p) => p.id === id);
  const [pos, setPos] = useState(50);
  if (!project) throw notFound();

  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main className="pt-28 sm:pt-32">
        <Container className={section?.visible === false ? "hidden" : ""}>
          <Link
            to="/referenciak"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {value("back", "Összes referencia")}
          </Link>

          <Reveal>
            <p className="label-eyebrow mt-8 text-accent">{project.location}</p>
            <h1 className="mt-4 max-w-3xl font-display text-3xl leading-tight font-semibold sm:text-5xl">
              {project.title}
            </h1>
          </Reveal>

          <Reveal>
            <div className="relative mt-10 overflow-hidden rounded-[var(--radius-card)] border border-border shadow-soft">
              <img
                src={project.afterImage}
                alt="A tető az elvégzett munka után"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              >
                <img
                  src={project.beforeImage}
                  alt="A tető a munka előtt"
                  className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent"
                style={{ left: `${pos}%` }}
              />
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

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="font-display text-2xl font-semibold">
                {value("situationTitle", "Kiindulási helyzet")}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {project.problem}
              </p>
              <h2 className="mt-10 font-display text-2xl font-semibold">
                {value("worksTitle", "Elvégzett munkák")}
              </h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {project.works.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {w}
                  </li>
                ))}
              </ul>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {project.gallery.map((g, i) => (
                  <img
                    key={g + i}
                    src={g}
                    loading="lazy"
                    alt={`${project.title} — fázis ${i + 1}`}
                    className="w-full rounded-[var(--radius-card)] border border-border object-cover"
                  />
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="surface-card p-6">
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="label-eyebrow text-muted-foreground">
                      {value("servicesLabel", "Munkanemek")}
                    </dt>
                    <dd className="mt-1.5">{project.services.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow text-muted-foreground">
                      {value("durationLabel", "Kivitelezési idő")}
                    </dt>
                    <dd className="mt-1.5">{project.duration}</dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow text-muted-foreground">
                      {value("locationLabel", "Helyszín")}
                    </dt>
                    <dd className="mt-1.5">{project.location}</dd>
                  </div>
                </dl>
                <Button asChild variant="copper" className="mt-6 w-full">
                  <Link to="/ajanlatkeres" search={{ szolgaltatas: project.services[0], lepes: 1 }}>
                    {value("button", "Hasonló munkára kérek ajánlatot")} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="h-20" />
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}
