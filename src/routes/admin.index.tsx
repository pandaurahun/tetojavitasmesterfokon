import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AdminPage, Panel, StatCard, StatusPill, UrgencyPill } from "@/components/admin/ui";
import { useDemo, formatHuf } from "@/demo/store";
import { sourceLabels } from "@/demo/data";
import { quoteTotals } from "@/demo/calc";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { leads, quotes, services } = useDemo();

  const stats = useMemo(() => {
    const by = (s: string) => leads.filter((l) => l.status === s).length;
    return {
      uj: by("uj"),
      visszahivas: by("kapcsolatra-var"),
      felmeres: by("felmeres-egyeztetve"),
      keszul: by("ajanlat-keszul"),
      elkuldve: quotes.filter((q) => q.status === "elkuldve" || q.status === "megtekintve").length,
      elfogadva: by("elfogadva"),
      surgos: leads.filter((l) => l.urgency === "azonnali" || l.urgency === "napokon-belul").length,
    };
  }, [leads, quotes]);

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => map.set(l.source, (map.get(l.source) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const byService = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => map.set(l.service, (map.get(l.service) ?? 0) + 1));
    return services
      .map((s) => ({ title: s.title, count: map.get(s.title) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [leads, services]);

  const maxService = Math.max(1, ...byService.map((s) => s.count));

  return (
    <AdminPage
      title="Vezérlőpult"
      intro="A számok élő demóadatokból számolódnak. Ha a publikus ajánlatkérőből új igény érkezik, azonnal itt is megjelenik."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Új érdeklődő" value={stats.uj} tone="accent" hint="Még nem kezelt igény" />
        <StatCard label="Visszahívásra vár" value={stats.visszahivas} />
        <StatCard label="Felmérésre vár" value={stats.felmeres} />
        <StatCard label="Készülő ajánlat" value={stats.keszul} />
        <StatCard label="Elküldött ajánlat" value={stats.elkuldve} />
        <StatCard label="Elfogadott munka" value={stats.elfogadva} tone="forest" />
        <StatCard label="Sürgős lead" value={stats.surgos} tone="danger" />
        <StatCard label="Összes érdeklődő" value={leads.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Következő teendők" description="Felelősökhöz rendelt nyitott feladatok">
          <ul className="space-y-3">
            {leads
              .filter((l) => l.nextTask)
              .slice(0, 6)
              .map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/admin/erdeklodok"
                      className="text-sm font-semibold hover:text-accent"
                    >
                      {l.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {l.nextTask} — {l.owner}
                    </p>
                  </div>
                  <UrgencyPill urgency={l.urgency} />
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="Legutóbbi ajánlatok">
          <ul className="space-y-3">
            {quotes.slice(0, 5).map((q) => {
              const t = quoteTotals(q);
              return (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/admin/arajanlatok"
                      className="text-sm font-semibold hover:text-accent"
                    >
                      {q.number} — {q.client}
                    </Link>
                    <p className="text-xs text-muted-foreground">{q.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatHuf(t.gross)}</span>
                    <StatusPill status={q.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Leadforrások">
          <ul className="space-y-2 text-sm">
            {sources.map(([s, n]) => (
              <li key={s} className="flex items-center justify-between gap-3">
                <span>{sourceLabels[s] ?? s}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Szolgáltatásonkénti érdeklődés">
          <ul className="space-y-2.5">
            {byService.map((s) => (
              <li key={s.title}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate">{s.title}</span>
                  <span className="font-semibold">{s.count}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(s.count / maxService) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminPage>
  );
}
