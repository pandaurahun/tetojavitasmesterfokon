import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/store";

export const Route = createFileRoute("/jogi/$slug")({
  head: () => ({
    meta: [
      { title: "Jogi tájékoztatók | TetőVonal" },
      {
        name: "description",
        content:
          "Impresszum, adatkezelési tájékoztató, általános szerződési feltételek és cookie-tájékoztató.",
      },
      { property: "og:title", content: "Jogi tájékoztatók — TetőVonal" },
      { property: "og:description", content: "A TetőVonal jogi dokumentumai és tájékoztatói." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LegalPage,
  notFoundComponent: () => (
    <div className="pt-32 pb-24 text-center">
      <p className="text-sm text-muted-foreground">Ez a dokumentum nem található.</p>
      <Button asChild variant="ink" className="mt-4">
        <Link to="/">Kezdőlap</Link>
      </Button>
    </div>
  ),
});

const slugAliases: Record<string, string> = {
  adatkezeles: "adatkezelesi-tajekoztato",
  cookie: "cookie-tajekoztato",
  "cookie-kezeles": "cookie-tajekoztato",
  gdpr: "adatkezelesi-tajekoztato",
};

function LegalPage() {
  const { slug } = Route.useParams();
  const { legal } = useDemo();
  const resolved = slugAliases[slug] ?? slug;
  const doc = legal.find((d) => (d.slug === slug || d.slug === resolved) && d.published);
  if (!doc) throw notFound();

  return (
    <div className="pb-16 sm:pb-0">
      <Header />
      <main className="pt-28 sm:pt-32">
        <Container className="max-w-[760px]">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Kezdőlap
          </Link>
          <h1 className="mt-8 font-display text-3xl font-semibold sm:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Verzió {doc.version} — hatályos: {doc.effectiveFrom}
          </p>
          <p className="mt-4 rounded-[var(--radius-button)] border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            A dokumentum bemutató célú mintatartalom, nem minősül jogi tanácsadásnak.
          </p>
          <div className="mt-8 space-y-4 text-sm leading-relaxed whitespace-pre-line">
            {doc.body}
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            {legal
              .filter((d) => d.published && d.slug !== doc.slug)
              .map((d) => (
                <Link
                  key={d.id}
                  to="/jogi/$slug"
                  params={{ slug: d.slug }}
                  className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted"
                >
                  {d.title}
                </Link>
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
