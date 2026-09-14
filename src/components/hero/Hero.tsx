import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoofScene, type HeroFocus } from "./RoofScene";
import { useCmsSection } from "@/demo/store";
import { useCallbackModal } from "@/demo/ui";
import { Container } from "@/components/site/Primitives";

const focusOptions: { key: HeroFocus; label: string; note: string; service: string }[] = [
  {
    key: "tetofedes",
    label: "Tetőfedés",
    note: "Teljes rétegrend a párazárótól a gerincelemekig, az épülethez illő héjazattal.",
    service: "Komplett tetőfedés",
  },
  {
    key: "tetojavitas",
    label: "Tetőjavítás",
    note: "Elmozdult cserép, hibás csomópont: célzott javítás fényképes állapotrögzítéssel.",
    service: "Beázás és sürgős tetőjavítás",
  },
  {
    key: "badogozas",
    label: "Bádogozás",
    note: "Kéményszegély, vápa és oromszegély méretre hajlítva, a hőtágulást figyelembe véve.",
    service: "Bádogos munkák",
  },
  {
    key: "ereszcsatorna",
    label: "Ereszcsatorna",
    note: "A tetőfelülethez méretezett csatorna és lefolyó, új tartókkal és helyes lejtéssel.",
    service: "Ereszcsatorna-rendszerek",
  },
  {
    key: "tetoszigeteles",
    label: "Tetőszigetelés",
    note: "Folytonos párazáró réteg és szellőző légrés, hogy a szerkezet szárazon maradjon.",
    service: "Tető- és födémszigetelés",
  },
  {
    key: "egyeb",
    label: "Egyéb kivitelezés",
    note: "Ácsmunka, kéményfelújítás, tetőtéri ablak és kapcsolódó homlokzati javítások.",
    service: "Kapcsolódó kivitelezési munkák",
  },
];

const trust = [
  "Dokumentált munkafolyamat",
  "Tételes árajánlat",
  "Fényképes állapotfelmérés",
  "Közvetlen kapcsolattartás",
];

export function Hero() {
  const [focus, setFocus] = useState<HeroFocus>("tetofedes");
  const { section, value } = useCmsSection("home.hero");
  const { open } = useCallbackModal();
  const editableFocusOptions = focusOptions.map((option, index) => ({
    ...option,
    label: value(`focus.${index + 1}.label`, option.label),
    note: value(`focus.${index + 1}.note`, option.note),
    service: value(`focus.${index + 1}.service`, option.service),
  }));
  const active = editableFocusOptions.find((option) => option.key === focus)!;
  const editableTrust = trust.map((item, index) => value(`trust.${index + 1}`, item));

  if (section && !section.visible) return null;

  return (
    <section className="relative isolate overflow-hidden pt-24 pb-14 sm:min-h-[100svh] sm:pt-28 lg:pb-0">
      <div className="pointer-events-none absolute inset-0 -z-10 hairline-grid opacity-60" />
      <div className="pointer-events-none absolute -top-40 -right-32 -z-10 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_65%)]" />

      <Container className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="label-eyebrow text-accent"
          >
            {value("eyebrow", "Tetőfedés • Javítás • Bádogosmunka • Szigetelés")}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-5 text-[2.1rem] leading-[1.05] font-semibold text-balance-tight sm:text-5xl lg:text-[3.4rem]"
          >
            {value("title", "Nem egyszerűen tetőt építünk.")}{" "}
            <span className="mt-2 block">
              <span className="copper-underline">{value("accent", "Otthonokat védünk meg")}</span>{" "}
              {value("suffix", "évtizedekre.")}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {value("description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button asChild size="lg" variant="ink">
              <Link to="/ajanlatkeres" search={{ szolgaltatas: active.service, lepes: 1 }}>
                {value("primaryCta", "Kérek helyszíni felmérést")}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/ajanlatkeres" search={{ szolgaltatas: active.service, lepes: 1 }}>
                {value("secondaryCta", "Gyors ajánlatkérés")}
              </Link>
            </Button>
            <button
              onClick={() => open(active.service)}
              className="inline-flex items-center gap-2 self-start px-1 text-sm font-medium text-muted-foreground underline decoration-[color-mix(in_oklab,var(--accent)_60%,transparent)] decoration-2 underline-offset-4 transition-colors hover:text-foreground sm:self-auto"
            >
              <PhoneCall className="h-4 w-4 text-accent" />
              {value("callbackCta", "Csak visszahívást kérek")}
            </button>
          </motion.div>

          <div className="mt-10">
            <div className="flex flex-wrap gap-2">
              {editableFocusOptions.map((o) => {
                const isActive = o.key === focus;
                return (
                  <button
                    key={o.key}
                    onClick={() => setFocus(o.key)}
                    aria-pressed={isActive}
                    className={`relative rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm ${
                      isActive
                        ? "-translate-y-0.5 border-accent bg-accent text-accent-foreground shadow-soft"
                        : "border-border bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] text-muted-foreground hover:-translate-y-0.5 hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <motion.p
              key={active.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-4 max-w-lg text-sm text-muted-foreground"
            >
              {active.note}
            </motion.p>
          </div>
        </div>

        <div className="relative order-first lg:order-last">
          <RoofScene focus={focus} />
        </div>
      </Container>

      <Container className="mt-12 lg:mt-16">
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {editableTrust.map((t) => (
            <div
              key={t}
              className="bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-5 py-4 text-sm font-medium"
            >
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
              {t}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
