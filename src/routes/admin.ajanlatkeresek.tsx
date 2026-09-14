import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminPage, AdminField, EmptyState, NativeSelect, Panel, StatusPill, UrgencyPill } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { useDemo, nowStamp, newId } from "@/demo/store";
import { statusLabels, statusOrder, sourceLabels } from "@/demo/data";
import type { Lead } from "@/demo/types";

export const Route = createFileRoute("/admin/ajanlatkeresek")({
  component: RequestsAdmin,
});

function RequestsAdmin() {
  const { leads, fields, services, updateLead } = useDemo();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("mind");
  const [openId, setOpenId] = useState<string | null>(null);

  const requests = useMemo(() => {
    return leads
      .filter((l) => l.source === "reszletes-ajanlatkero")
      .filter((l) => (status === "mind" ? true : l.status === status))
      .filter((l) => {
        if (!q.trim()) return true;
        const t = `${l.name} ${l.city} ${l.service} ${l.email} ${l.phone}`.toLowerCase();
        return t.includes(q.trim().toLowerCase());
      });
  }, [leads, status, q]);

  const open = requests.find((l) => l.id === openId) ?? null;

  return (
    <AdminPage
      title="Ajánlatkérések"
      intro="A publikus, részletes ajánlatkérőből beérkezett igények teljes tartalommal: tetőadatok, egyedi kérdések válaszai és feltöltött fájlok."
    >
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminField label="Keresés">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Név, város, szolgáltatás…" />
          </AdminField>
          <AdminField label="Státusz">
            <NativeSelect value={status} onChange={setStatus}>
              <option value="mind">Minden státusz</option>
              {statusOrder.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s] ?? s}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Találat">
            <div className="flex h-10 items-center text-sm text-muted-foreground">
              {requests.length} ajánlatkérés
            </div>
          </AdminField>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel title="Beérkezett igények">
          {requests.length === 0 ? (
            <EmptyState text="Nincs a szűrésnek megfelelő ajánlatkérés. Küldj be egyet a publikus ajánlatkérőből." />
          ) : (
            <ul className="space-y-2">
              {requests.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setOpenId(l.id)}
                    className={`w-full rounded-[var(--radius-button)] border p-3 text-left transition-colors ${
                      openId === l.id ? "border-accent bg-muted/60" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{l.name}</span>
                      <StatusPill status={l.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {l.service} — {l.city} · {l.createdAt}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <UrgencyPill urgency={l.urgency} />
                      {l.files.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          <Paperclip className="h-3 w-3" /> {l.files.length} fájl
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted-foreground">{sourceLabels[l.source] ?? l.source}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {open ? (
          <RequestDetail
            key={open.id}
            lead={open}
            fieldLabel={(key) => fields.find((f) => f.key === key)?.label ?? key}
            serviceTitles={services.map((s) => s.title)}
            onStatus={(s) =>
              updateLead(open.id, {
                status: s as Lead["status"],
                timeline: [
                  ...open.timeline,
                  { id: newId("tl"), date: nowStamp(), title: `Státusz: ${statusLabels[s] ?? s}` },
                ],
              })
            }
          />
        ) : (
          <Panel title="Részletek">
            <EmptyState text="Válassz ki egy ajánlatkérést a bal oldali listából." />
          </Panel>
        )}
      </div>
    </AdminPage>
  );
}

function RequestDetail({
  lead,
  fieldLabel,
  serviceTitles,
  onStatus,
}: {
  lead: Lead;
  fieldLabel: (key: string) => string;
  serviceTitles: string[];
  onStatus: (status: string) => void;
}) {
  const roof = lead.roof ?? {};
  const roofRows: [string, string | undefined][] = [
    ["Tetőfelület", roof.area],
    ["Tetőforma", roof.shape],
    ["Jelenlegi héjazat", roof.covering],
    ["Szintek száma", roof.levels],
    ["Tető életkora", roof.age],
    ["Megközelíthetőség", roof.access],
  ];

  return (
    <Panel
      title={lead.name}
      description={`${lead.service} · beérkezett: ${lead.createdAt}`}
      actions={
        <Button asChild size="sm" variant="copper">
          <Link to="/admin/arajanlatok">
            <FileText /> Ajánlat készítése
          </Link>
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Státusz">
            <NativeSelect value={lead.status} onChange={onStatus}>
              {statusOrder.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s] ?? s}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Szolgáltatás">
            <div className="flex h-10 items-center text-sm">
              {serviceTitles.includes(lead.service) ? lead.service : `${lead.service} (egyedi)`}
            </div>
          </AdminField>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Telefon" value={lead.phone} />
          <Row label="E-mail" value={lead.email} />
          <Row label="Helyszín" value={[lead.zip, lead.city, lead.street].filter(Boolean).join(" ")} />
          <Row label="Épület típusa" value={lead.buildingType} />
          <Row label="Preferált elérés" value={lead.preferredContact} />
          <Row label="Hívási idősáv" value={lead.callWindow} />
        </div>

        <div>
          <p className="label-eyebrow text-muted-foreground">Tetőadatok</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {roofRows.filter(([, v]) => v).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nem adott meg műszaki adatot.</p>
            ) : (
              roofRows.filter(([, v]) => v).map(([k, v]) => <Row key={k} label={k} value={v} />)
            )}
          </div>
          {roof.description ? (
            <p className="mt-3 rounded-[var(--radius-button)] bg-muted/60 p-3 text-sm">{roof.description}</p>
          ) : null}
        </div>

        {lead.extra && Object.keys(lead.extra).length ? (
          <div>
            <p className="label-eyebrow text-muted-foreground">Egyedi kérdések</p>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(lead.extra).map(([k, v]) => (
                <Row key={k} label={fieldLabel(k)} value={v} />
              ))}
            </div>
          </div>
        ) : null}

        {lead.message ? (
          <div>
            <p className="label-eyebrow text-muted-foreground">Üzenet</p>
            <p className="mt-2 rounded-[var(--radius-button)] bg-muted/60 p-3 text-sm">{lead.message}</p>
          </div>
        ) : null}

        <div>
          <p className="label-eyebrow text-muted-foreground">Csatolmányok</p>
          {lead.files.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nincs feltöltött fájl.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {lead.files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-[var(--radius-button)] border border-border p-2"
                >
                  {f.dataUrl ? (
                    <img
                      src={f.dataUrl}
                      alt={f.name}
                      className="h-12 w-12 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      {f.kind === "kep" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.max(1, Math.round(f.size / 1024))} kB
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="label-eyebrow text-muted-foreground">Idővonal</p>
          <ul className="mt-2 space-y-2">
            {[...lead.timeline].reverse().map((t) => (
              <li key={t.id} className="border-l-2 border-accent pl-3">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">{t.date}</p>
                {t.detail ? <p className="text-xs text-muted-foreground">{t.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}
