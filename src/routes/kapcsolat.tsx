import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mail, MapPin, Phone, Clock } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MobileCta } from "@/components/site/MobileCta";
import { Container, Reveal, SectionHeading } from "@/components/site/Primitives";
import { Button } from "@/components/ui/button";
import { useCmsSection, useDemo } from "@/demo/store";
import { useCallbackModal } from "@/demo/ui";

export const Route = createFileRoute("/kapcsolat")({
  head: () => ({
    meta: [
      { title: "Kapcsolat — hívás, visszahívás, ajánlatkérés | TetőVonal" },
      {
        name: "description",
        content:
          "Hívj minket munkanapokon, kérj visszahívást, vagy töltsd ki a részletes ajánlatkérőt. Szolnok és a környező települések területén dolgozunk.",
      },
      { property: "og:title", content: "Kapcsolat — TetőVonal" },
      {
        property: "og:description",
        content: "Közvetlen kapcsolattartó, visszahívás kérése és ajánlatkérés egy helyen.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { settings } = useDemo();
  const { section, value } = useCmsSection("contact.page");
  const { open } = useCallbackModal();
  const tel = `tel:${settings.phone.replace(/\s/g, "")}`;

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
            <Reveal>
              <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <div>
                  <Phone className="h-5 w-5 text-accent" />
                  <h2 className="mt-4 font-display text-lg font-semibold">{value("phoneTitle")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{value("phoneText")}</p>
                </div>
                <Button asChild variant="ink" className="mt-6">
                  <a href={tel}>{settings.phone}</a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <div>
                  <Clock className="h-5 w-5 text-accent" />
                  <h2 className="mt-4 font-display text-lg font-semibold">
                    {value("callbackTitle")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{value("callbackText")}</p>
                </div>
                <Button variant="outline" className="mt-6" onClick={() => open()}>
                  {value("callbackButton")}
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] bg-ink p-6 text-ink-foreground">
                <div>
                  <Mail className="h-5 w-5 text-accent" />
                  <h2 className="mt-4 font-display text-lg font-semibold">{value("quoteTitle")}</h2>
                  <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--ink-foreground)_72%,transparent)]">
                    {value("quoteText")}
                  </p>
                </div>
                <Button asChild variant="copper" className="mt-6">
                  <Link to="/ajanlatkeres" search={{ lepes: 1 }}>
                    {value("quoteButton")} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <div className="surface-card h-full p-6">
                <h2 className="label-eyebrow text-accent">{value("detailsTitle")}</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <Item icon={<Phone className="h-4 w-4 text-accent" />} label="Telefon">
                    <a href={tel} className="font-semibold hover:text-accent">
                      {settings.phone}
                    </a>
                  </Item>
                  <Item icon={<Mail className="h-4 w-4 text-accent" />} label="E-mail">
                    <a
                      href={`mailto:${settings.email}`}
                      className="font-semibold hover:text-accent"
                    >
                      {settings.email}
                    </a>
                  </Item>
                  <Item icon={<MapPin className="h-4 w-4 text-accent" />} label="Székhely">
                    {settings.address}
                  </Item>
                  <Item icon={<Clock className="h-4 w-4 text-accent" />} label="Nyitvatartás">
                    {settings.workingHours}
                  </Item>
                </dl>
                <p className="mt-6 text-xs text-muted-foreground">
                  {settings.company} — adószám: {settings.taxNumber}. A megjelenő adatok a
                  bemutatóhoz készült minta adatok.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="surface-card h-full p-6">
                <h2 className="label-eyebrow text-accent">{value("areasTitle")}</h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {settings.areas.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm text-muted-foreground">{value("areasText")}</p>
              </div>
            </Reveal>
          </div>
          <div className="h-20" />
        </Container>
      </main>
      <Footer />
      <MobileCta />
    </div>
  );
}

function Item({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
      <span className="mt-0.5">{icon}</span>
      <div>
        <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
