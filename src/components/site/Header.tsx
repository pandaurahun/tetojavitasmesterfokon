import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCmsSection, useDemo } from "@/demo/store";

export function Header() {
  const { branding, settings } = useDemo();
  const { section, value } = useCmsSection("global.header");
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const nav = [
    { to: "/" as const, label: value("nav.home", "Kezdőlap") },
    { to: "/szolgaltatasok" as const, label: value("nav.services", "Szolgáltatások") },
    { to: "/referenciak" as const, label: value("nav.references", "Referenciák") },
    { to: "/folyamat" as const, label: value("nav.process", "Folyamat") },
    { to: "/tudastar" as const, label: value("nav.knowledge", "Tudástár") },
    { to: "/kapcsolat" as const, label: value("nav.contact", "Kapcsolat") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  if (section && !section.visible) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-80 print:hidden">
      <div
        className={`mx-auto transition-all duration-300 ${
          scrolled
            ? "mt-0 max-w-full border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-xl"
            : "mt-3 max-w-[min(1200px,calc(100%-1.5rem))] rounded-full border border-[color-mix(in_oklab,var(--primary)_10%,transparent)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] backdrop-blur-md"
        }`}
      >
        <div
          className={`mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 ${
            scrolled ? "h-14 max-w-[1200px]" : "h-16"
          }`}
        >
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Mark />
            <span className="truncate font-display text-lg font-semibold tracking-tight">
              {branding.logoText}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                activeProps={{ className: "text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="rounded-full px-3 py-2 text-sm font-medium transition-colors hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`tel:${settings.phone.replace(/\s/g, "")}`}
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <Phone className="h-4 w-4 text-accent" />
              <span className="hidden xl:inline">{settings.phone}</span>
            </a>
            <Button asChild variant="copper" size="sm" className="hidden sm:inline-flex">
              <Link to="/ajanlatkeres">{value("cta", "Ajánlatot kérek")}</Link>
            </Button>
            <button
              onClick={() => setMenu(true)}
              aria-label="Menü megnyitása"
              className="rounded-full p-2 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 bg-ink text-ink-foreground lg:hidden"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <span className="font-display text-lg font-semibold">{branding.logoText}</span>
              <button onClick={() => setMenu(false)} aria-label="Menü bezárása" className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-5 pt-6">
              {nav.map((n, i) => (
                <motion.div
                  key={n.to}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                >
                  <Link
                    to={n.to}
                    onClick={() => setMenu(false)}
                    className="block border-b border-[color-mix(in_oklab,white_10%,transparent)] py-4 font-display text-2xl"
                  >
                    {n.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 space-y-3"
              >
                <Button asChild variant="copper" size="lg" className="w-full">
                  <Link to="/ajanlatkeres" onClick={() => setMenu(false)}>
                    {value("cta", "Ajánlatot kérek")}
                  </Link>
                </Button>
                <Button asChild variant="hairline" size="lg" className="w-full">
                  <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>
                </Button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Mark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[calc(var(--radius-button)+2px)] bg-ink">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M2 13 12 5l10 8"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M5 18h14"
          fill="none"
          stroke="var(--ink-foreground)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
