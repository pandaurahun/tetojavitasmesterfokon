import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminPage, AdminField, NativeSelect, Panel, StatusPill, UrgencyPill, EmptyState } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useDemo, newId, nowStamp } from "@/demo/store";
import { statusLabels, statusOrder, sourceLabels, urgencyLabels, owners } from "@/demo/data";
import type { Lead, LeadStatus } from "@/demo/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/erdeklodok")({
  component: LeadsPage,
});

function LeadsPage() {
  const { leads, updateLead, quotes } = useDemo();
  const [view, setView] = useState<"tabla" | "kanban">("tabla");
  const [q, setQ] = useState("");
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        const text = `${l.name} ${l.phone} ${l.email} ${l.city} ${l.service}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (!service || l.service === service) &&
          (!city || l.city === city) &&
          (!status || l.status === status) &&
          (!urgency || l.urgency === urgency)
        );
      }),
    [leads, q, service, city, status, urgency],
  );

  const cities = [...new Set(leads.map((l) => l.city))];
  const serviceNames = [...new Set(leads.map((l) => l.service))];
  const open = leads.find((l) => l.id === openId) ?? null;

  const setStatusOf = (lead: Lead, next: LeadStatus) => {
    updateLead(lead.id, {
      status: next,
      timeline: [
        ...lead.timeline,
        { id: newId("tl"), date: nowStamp(), title: `Státusz: ${statusLabels[next]}` },
      ],
    });
    toast.success("A státusz mentve.");
  };

  return (
    <AdminPage
      title="Érdeklődők"
      intro="Táblázatos és Kanban nézet, szűrőkkel. A módosítások automatikusan mentődnek a szerverre."
      actions={
        <div className="flex gap-2">
          <Button variant={view === "tabla" ? "ink" : "outline"} size="sm" onClick={() => setView("tabla")}>
            Táblázat
          </Button>
          <Button variant={view === "kanban" ? "ink" : "outline"} size="sm" onClick={() => setView("kanban")}>
            Kanban
          </Button>
        </div>
      }
    >
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AdminField label="Keresés">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Név, telefon, város" />
          </AdminField>
          <AdminField label="Szolgáltatás">
            <NativeSelect value={service} onChange={setService}>
              <option value="">Mind</option>
              {serviceNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Település">
            <NativeSelect value={city} onChange={setCity}>
              <option value="">Mind</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Státusz">
            <NativeSelect value={status} onChange={setStatus}>
              <option value="">Mind</option>
              {statusOrder.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Sürgősség">
            <NativeSelect value={urgency} onChange={setUrgency}>
              <option value="">Mind</option>
              {Object.entries(urgencyLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
        </div>
      </Panel>

      {view === "tabla" ? (
        <Panel title={`${filtered.length} érdeklődő`}>
          {filtered.length === 0 ? (
            <EmptyState text="Nincs a szűrőnek megfelelő érdeklődő." />
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {filtered.map((l) => (
                  <li key={l.id} className="rounded-[var(--radius-button)] border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 font-semibold break-words">{l.name}</span>
                      <StatusPill status={l.status} />
                    </div>
                    <p className="mt-1 text-sm break-words text-muted-foreground">
                      {l.service} — {l.city}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <UrgencyPill urgency={l.urgency} />
                      <Button size="sm" variant="outline" onClick={() => setOpenId(l.id)}>
                        Megnyitás
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="-mx-2 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="p-2">Név</th>
                      <th className="p-2">Szolgáltatás</th>
                      <th className="p-2">Település</th>
                      <th className="p-2">Sürgősség</th>
                      <th className="p-2">Státusz</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="p-2 font-semibold">{l.name}</td>
                        <td className="p-2">{l.service}</td>
                        <td className="p-2">{l.city}</td>
                        <td className="p-2">
                          <UrgencyPill urgency={l.urgency} />
                        </td>
                        <td className="p-2">
                          <StatusPill status={l.status} />
                        </td>
                        <td className="p-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setOpenId(l.id)}>
                            Megnyitás
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>

          )}
        </Panel>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3">
            {statusOrder.map((s) => (
              <div key={s} className="w-64 shrink-0 rounded-[var(--radius-card)] bg-muted/60 p-3">
                <h3 className="text-xs font-semibold">
                  {statusLabels[s]} ({filtered.filter((l) => l.status === s).length})
                </h3>
                <div className="mt-3 space-y-2">
                  {filtered
                    .filter((l) => l.status === s)
                    .map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setOpenId(l.id)}
                        className="w-full rounded-[var(--radius-button)] border border-border bg-surface p-3 text-left text-sm hover:shadow-soft"
                      >
                        <span className="block font-semibold">{l.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {l.service} — {l.city}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open ? (
        <Panel
          title={`${open.name} — ${open.id.toUpperCase()}`}
          description={`Beérkezett: ${new Date(open.createdAt).toLocaleString("hu-HU")} • Forrás: ${sourceLabels[open.source] ?? open.source}`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
              Bezárás
            </Button>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <Row label="Telefon" value={<a className="hover:text-accent" href={`tel:${open.phone.replace(/\s/g, "")}`}>{open.phone}</a>} />
              <Row label="E-mail" value={open.email ? <a className="hover:text-accent" href={`mailto:${open.email}`}>{open.email}</a> : "—"} />
              <Row label="Helyszín" value={[open.zip, open.city, open.street].filter(Boolean).join(" ")} />
              <Row label="Szolgáltatás" value={open.service} />
              <Row label="Épület" value={open.buildingType ?? "—"} />
              <Row label="Sürgősség" value={urgencyLabels[open.urgency] ?? open.urgency} />
              <Row label="Tetőadatok" value={Object.values(open.roof ?? {}).filter(Boolean).join(" • ") || "—"} />
              <Row label="Üzenet" value={open.message ?? "—"} />
              {open.extra
                ? Object.entries(open.extra).map(([k, v]) => <Row key={k} label={k} value={v} />)
                : null}
              {open.files.length ? (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {open.files.map((f) =>
                    f.dataUrl ? (
                      <img key={f.id} src={f.dataUrl} alt={f.name} className="h-24 w-full rounded-md object-cover" />
                    ) : (
                      <span key={f.id} className="rounded-md bg-muted p-2 text-[11px]">{f.name}</span>
                    ),
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <AdminField label="Státusz">
                <NativeSelect value={open.status} onChange={(v) => setStatusOf(open, v as LeadStatus)}>
                  {statusOrder.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </NativeSelect>
              </AdminField>
              <AdminField label="Felelős">
                <NativeSelect value={open.owner} onChange={(v) => updateLead(open.id, { owner: v })}>
                  {owners.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </NativeSelect>
              </AdminField>
              <AdminField label="Következő teendő">
                <Input
                  value={open.nextTask ?? ""}
                  onChange={(e) => updateLead(open.id, { nextTask: e.target.value })}
                />
              </AdminField>

              <AdminField label="Belső jegyzet">
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </AdminField>
              <Button
                size="sm"
                variant="ink"
                disabled={!note.trim()}
                onClick={() => {
                  updateLead(open.id, {
                    notes: [
                      { id: newId("n"), date: nowStamp(), author: open.owner, text: note.trim() },
                      ...open.notes,
                    ],
                  });
                  setNote("");
                  toast.success("Jegyzet mentve.");
                }}
              >
                Jegyzet mentése
              </Button>

              <div>
                <h4 className="label-eyebrow text-muted-foreground">Jegyzetek</h4>
                <ul className="mt-2 space-y-2 text-xs">
                  {open.notes.length ? (
                    open.notes.map((n) => (
                      <li key={n.id} className="rounded-md bg-muted p-2">
                        <span className="font-semibold">{n.author}</span> — {n.date}
                        <p className="mt-1">{n.text}</p>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">Még nincs jegyzet.</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="label-eyebrow text-muted-foreground">Idővonal</h4>
                <ol className="mt-2 space-y-2 text-xs">
                  {open.timeline.map((t) => (
                    <li key={t.id} className="border-l-2 border-accent pl-3">
                      <span className="font-semibold">{t.title}</span>
                      <span className="block text-muted-foreground">
                        {t.date}
                        {t.detail ? ` — ${t.detail}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="text-xs text-muted-foreground">
                Kapcsolódó ajánlat:{" "}
                {quotes.find((qq) => qq.leadId === open.id)?.number ?? "még nincs"}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border pb-2 last:border-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
