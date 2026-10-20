import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getConsentState,
  isSensitivePath,
  acceptAllConsent,
  acceptNecessaryOnlyConsent,
  grantAnalyticsConsent,
  revokeAnalyticsConsent,
  grantMarketingConsent,
  revokeMarketingConsent,
} from "@/lib/analytics";

interface ConsentSettingsContextValue {
  open: () => void;
}

const ConsentSettingsContext = createContext<ConsentSettingsContextValue>({ open: () => {} });

export const useConsentSettings = () => useContext(ConsentSettingsContext);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // No banner where no cookie-based tracking runs at all: the admin area, and
  // the secure customer quote link (a transactional page whose fixed footer
  // banner would also cover the signature buttons on a phone).
  const isAdmin =
    pathname === "/admin" || pathname.startsWith("/admin/") || isSensitivePath(pathname);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!isAdmin && !getConsentState()) setVisible(true);
  }, [isAdmin]);

  const openSettings = () => {
    const stored = getConsentState();
    setAnalytics(stored?.analytics ?? false);
    setMarketing(stored?.marketing ?? false);
    setExpanded(true);
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
    setExpanded(false);
  };

  const acceptAll = () => {
    acceptAllConsent();
    close();
  };

  const necessaryOnly = () => {
    acceptNecessaryOnlyConsent();
    close();
  };

  const saveSettings = () => {
    if (analytics) grantAnalyticsConsent();
    else revokeAnalyticsConsent();
    if (marketing) grantMarketingConsent();
    else revokeMarketingConsent();
    close();
  };

  return (
    <ConsentSettingsContext.Provider value={{ open: openSettings }}>
      {children}
      {visible && !isAdmin ? (
        <div className="fixed inset-x-0 bottom-0 z-95 border-t border-border bg-surface p-4 shadow-lift sm:p-5 print:hidden">
          <div className="mx-auto max-w-3xl">
            {!expanded ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Sütiket használunk az oldal működéséhez, és — hozzájárulásod esetén —
                    statisztikai és marketingcélokra. Bővebben az{" "}
                    <a href="/jogi/cookie-tajekoztato" className="underline hover:text-accent">
                      Adatkezelési tájékoztatóban
                    </a>
                    .
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
                    Beállítások
                  </Button>
                  <Button size="sm" variant="ghost" onClick={necessaryOnly}>
                    Csak szükségesek
                  </Button>
                  <Button size="sm" variant="copper" onClick={acceptAll}>
                    Összes elfogadása
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold">Süti beállítások</p>
                <div className="space-y-3">
                  <ConsentRow
                    title="Szükséges sütik"
                    description="A weboldal alapműködéséhez kellenek, ezek nem kapcsolhatók ki."
                  >
                    <Switch checked disabled aria-label="Szükséges sütik" />
                  </ConsentRow>
                  <ConsentRow
                    title="Statisztikai sütik"
                    description="Segítenek megérteni, hogyan használják a látogatók az oldalt (GA4)."
                  >
                    <Switch
                      checked={analytics}
                      onCheckedChange={(v) => setAnalytics(Boolean(v))}
                      aria-label="Statisztikai sütik"
                    />
                  </ConsentRow>
                  <ConsentRow
                    title="Marketing sütik"
                    description="Hirdetési mérés és személyre szabás (Google Ads, Meta)."
                  >
                    <Switch
                      checked={marketing}
                      onCheckedChange={(v) => setMarketing(Boolean(v))}
                      aria-label="Marketing sütik"
                    />
                  </ConsentRow>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={necessaryOnly}>
                    Csak szükségesek
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveSettings}>
                    Kiválasztottak mentése
                  </Button>
                  <Button size="sm" variant="copper" onClick={acceptAll}>
                    Összes elfogadása
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </ConsentSettingsContext.Provider>
  );
}

function ConsentRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[var(--radius-button)] border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
