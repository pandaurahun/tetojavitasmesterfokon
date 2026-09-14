import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Layers,
  ChevronRight,
  Globe,
  FileText,
  LayoutDashboard,
  Palette,
  RotateCcw,
  X,
} from "lucide-react";
import { useDemo } from "@/demo/store";
import { toast } from "sonner";

export function DemoBar() {
  const [open, setOpen] = useState(false);
  const { resetDemo } = useDemo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: "Publikus oldal", icon: Globe },
    { to: "/ajanlatkeres", label: "Ajánlatkérő", icon: FileText },
    { to: "/admin", label: "Admin", icon: LayoutDashboard },
    { to: "/admin/arculat", label: "Arculat szerkesztése", icon: Palette },
  ] as const;

  return (
    <div className="fixed bottom-20 left-3 z-90 sm:bottom-4 print:hidden">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-60 rounded-[var(--radius-card)] border border-[color-mix(in_oklab,white_12%,transparent)] bg-ink/95 p-2 text-ink-foreground shadow-lift backdrop-blur"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="label-eyebrow text-accent">Demóvezérlő</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Demóvezérlő összecsukása"
                className="rounded-full p-1 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <nav className="mt-1 space-y-0.5">
              {items.map((it) => {
                const active = pathname === it.to;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`flex items-center gap-2 rounded-[var(--radius-button)] px-2 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-[color-mix(in_oklab,white_10%,transparent)]"
                    }`}
                  >
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  resetDemo();
                  toast.success("A demóadatok visszaállítva.");
                }}
                className="flex w-full items-center gap-2 rounded-[var(--radius-button)] px-2 py-2 text-sm transition-colors hover:bg-[color-mix(in_oklab,white_10%,transparent)]"
              >
                <RotateCcw className="h-4 w-4" />
                Demó visszaállítása
              </button>
            </nav>
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,white_14%,transparent)] bg-ink/90 px-3.5 py-2.5 text-xs font-semibold text-ink-foreground shadow-lift backdrop-blur transition-transform hover:-translate-y-0.5"
          >
            <Layers className="h-4 w-4 text-accent" />
            Demóvezérlő
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
