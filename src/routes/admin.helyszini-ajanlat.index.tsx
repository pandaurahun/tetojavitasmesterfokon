import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminPage, EmptyState, NativeSelect, Panel, StatCard } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fieldQuoteApi } from "@/lib/field-quote-client";
import {
  FIELD_QUOTE_STATUS_LABELS,
  type FieldQuote,
  type FieldQuoteStatus,
} from "@/demo/field-quote-types";
import { FileSignature, Plus, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/admin/helyszini-ajanlat/")({
  head: () => ({
    meta: [{ title: "Helyszíni ajánlat — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: FieldQuoteListPage,
});

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-foreground",
  READY: "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-accent",
  WAITING_FOR_SIGNATURE: "bg-[color-mix(in_oklab,var(--accent)_24%,transparent)] text-accent",
  SIGNED: "bg-forest text-forest-foreground",
  DECLINED: "bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

function FieldQuoteListPage() {
  const [items, setItems] = useState<FieldQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState<{
    todayCount: number;
    signedCount: number;
    pendingCount: number;
    declinedCount: number;
    todayValue: number;
    acceptedValue: number;
  } | null>(null);

  useEffect(() => {
    void fieldQuoteApi.dashboard().then(setStats);
  }, []);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      void fieldQuoteApi
        .list({ status: status || undefined, q: q || undefined })
        .then((r) => setItems(r.items))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [q, status]);

  const huf = useMemo(() => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }), []);

  return (
    <AdminPage
      title="Helyszíni ajánlat"
      intro="Gyors, helyszíni árajánlat-készítés és aláíratás ügyfeleknél — mobilon, tableten vagy laptopon."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/admin/helyszini-ajanlat/beallitasok">
              <SettingsIcon className="h-4 w-4" /> Beállítások
            </Link>
          </Button>
          <Button asChild variant="copper">
            <Link to="/admin/helyszini-ajanlat/uj">
              <Plus className="h-4 w-4" /> Új helyszíni ajánlat
            </Link>
          </Button>
        </>
      }
    >
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Mai ajánlatok"
            value={stats.todayCount}
            hint={`${huf.format(stats.todayValue)} Ft`}
          />
          <StatCard
            label="Aláírva (ma)"
            value={stats.signedCount}
            tone="forest"
            hint={`${huf.format(stats.acceptedValue)} Ft`}
          />
          <StatCard label="Folyamatban" value={stats.pendingCount} tone="accent" />
          <StatCard label="Elutasítva (ma)" value={stats.declinedCount} tone="danger" />
        </div>
      ) : null}

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keresés név, telefon, város vagy ajánlatszám szerint..."
            className="min-w-[240px] flex-1"
          />
          <NativeSelect value={status} onChange={setStatus} className="w-auto">
            <option value="">Minden állapot</option>
            {Object.entries(FIELD_QUOTE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Betöltés...</p>
        ) : items.length === 0 ? (
          <EmptyState text="Nincs a szűrésnek megfelelő helyszíni ajánlat." />
        ) : (
          <div className="space-y-2">
            {items.map((quote) => (
              <Link
                key={quote.id}
                to="/admin/helyszini-ajanlat/$id"
                params={{ id: quote.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border px-4 py-3 text-sm hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <FileSignature className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {quote.customerName}
                    <span className="font-normal text-muted-foreground">
                      {quote.number} / v{quote.version}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[quote.customerCity, quote.customerPhone].filter(Boolean).join(" · ")}
                    {" · "}
                    {new Date(quote.createdAt).toLocaleDateString("hu-HU")}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[quote.status] ?? "bg-muted"}`}
                >
                  {FIELD_QUOTE_STATUS_LABELS[quote.status as FieldQuoteStatus]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </AdminPage>
  );
}
