import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminPage, AdminField, NativeSelect, Panel, StatusPill, UrgencyPill, EmptyState } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Trash2, LoaderCircle, CheckCircle2, X } from "lucide-react";
import { useDemo, newId, nowStamp } from "@/demo/store";
import { statusLabels, statusOrder, sourceLabels, urgencyLabels, owners } from "@/demo/data";
import type { Lead, LeadStatus, Quote, QuoteItem } from "@/demo/types";
import { toast } from "sonner";

interface AiDraftItem {
  name: string;
  description?: string | undefined;
  qty: number | null;
  unit: string;
  confidence: "high" | "low";
  priceSource: "catalog" | "manual_needed";
  unitPrice?: number | undefined;
}

interface AiDraft {
  summary: string;
  suggestedItems: AiDraftItem[];
  uncertainties: string[];
  siteSurveyCheckpoints: string[];
  customerText: string;
  internalWarnings: string[];
}

export const AI_QUOTE_DRAFT_STORAGE_KEY = "ai-quote-draft-handoff";

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
  const [source, setSource] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        const text = `${l.name} ${l.phone} ${l.email} ${l.city} ${l.service}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (!service || l.service === service) &&
          (!city || l.city === city) &&
          (!status || l.status === status) &&
          (!urgency || l.urgency === urgency) &&
          (!source || l.source === source)
        );
      }),
    [leads, q, service, city, status, urgency, source],
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

  const runAiQuoteDraft = async (lead: Lead) => {
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    try {
      const res = await fetch("/api/admin/ai/quote-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const payload = (await res.json().catch(() => ({}))) as AiDraft & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Az AI ajánlatjavaslat nem sikerült.");
      setAiDraft(payload);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Az AI ajánlatjavaslat nem sikerült.");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAiDraft = (lead: Lead) => {
    if (!aiDraft) return;
    const items: QuoteItem[] = aiDraft.suggestedItems.map((item) => ({
      id: newId("i"),
      name: item.name,
      description: item.description,
      qty: item.qty ?? 1,
      unit: item.unit,
      unitPrice: item.unitPrice ?? 0,
      vat: 27,
    }));
    const internalNoteParts: string[] = [];
    if (aiDraft.uncertainties.length) {
      internalNoteParts.push("Bizonytalanságok:\n" + aiDraft.uncertainties.map((u) => `- ${u}`).join("\n"));
    }
    if (aiDraft.siteSurveyCheckpoints.length) {
      internalNoteParts.push(
        "Helyszíni felméréskor ellenőrizendő:\n" +
          aiDraft.siteSurveyCheckpoints.map((c) => `- ${c}`).join("\n"),
      );
    }
    if (aiDraft.internalWarnings.length) {
      internalNoteParts.push(
        "Admin figyelmeztetések:\n" + aiDraft.internalWarnings.map((w) => `- ${w}`).join("\n"),
      );
    }
    const draft: Partial<Quote> = {
      items,
      note: aiDraft.customerText,
      internalNote: internalNoteParts.join("\n\n"),
    };
    try {
      sessionStorage.setItem(AI_QUOTE_DRAFT_STORAGE_KEY, JSON.stringify({ leadId: lead.id, draft }));
    } catch {
      /* private mode — the quote editor will just fall back to the default single item */
    }
    setAiDraft(null);
    void navigate({ to: "/admin/arajanlatok", search: { leadId: lead.id } });
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
          <AdminField label="Forrás">
            <NativeSelect value={source} onChange={setSource}>
              <option value="">Mind</option>
              {Object.entries(sourceLabels).map(([k, v]) => (
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
          description={`Beérkezett: ${new Date(open.createdAt).toLocaleString("hu-HU")} • Frissítve: ${open.updatedAt ? new Date(open.updatedAt).toLocaleString("hu-HU") : "—"} • Forrás: ${sourceLabels[open.source] ?? open.source}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={aiLoading}
                onClick={() => void runAiQuoteDraft(open)}
              >
                {aiLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                AI ajánlatjavaslat
              </Button>
              <Button asChild size="sm" variant="copper">
                <Link to="/admin/arajanlatok" search={{ leadId: open.id }}>
                  <FileText /> Árajánlat készítése
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
                Bezárás
              </Button>
            </div>
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
              {open.attribution ? (
                <>
                  <Row label="Kampány" value={open.attribution.campaign ?? "—"} />
                  <Row label="Csatorna (medium)" value={open.attribution.medium ?? "—"} />
                  <Row
                    label="Google/Meta kattintás ID"
                    value={
                      [
                        open.attribution.gclid ? `gclid: ${open.attribution.gclid}` : null,
                        open.attribution.fbclid ? `fbclid: ${open.attribution.fbclid}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"
                    }
                  />
                  <Row label="Belépési oldal" value={open.attribution.landingPage ?? "—"} />
                  <Row
                    label="Első látogatás"
                    value={
                      open.attribution.firstTouchAt
                        ? new Date(open.attribution.firstTouchAt).toLocaleString("hu-HU")
                        : "—"
                    }
                  />
                </>
              ) : null}
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
                  placeholder="Pl. helyszíni felmérés egyeztetése"
                />
              </AdminField>
              <AdminField label="Határidő" hint="Opcionális.">
                <Input
                  type="date"
                  value={open.nextTaskDue ?? ""}
                  onChange={(e) => updateLead(open.id, { nextTaskDue: e.target.value })}
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

      {open && (aiLoading || aiError || aiDraft) ? (
        <Panel
          title="AI ajánlatjavaslat"
          description="A javaslat piszkozat — minden sor szerkeszthető, elfogadás előtt semmi nem kerül mentésre."
          actions={
            <Button size="sm" variant="ghost" onClick={() => setAiDraft(null)}>
              <X /> Bezárás
            </Button>
          }
        >
          {aiLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Javaslat generálása…
            </p>
          ) : aiError ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {aiError}
            </p>
          ) : aiDraft ? (
            <div className="space-y-4 text-sm">
              <p>{aiDraft.summary}</p>

              <div>
                <h4 className="label-eyebrow text-muted-foreground">Javasolt tételek</h4>
                <div className="mt-2 space-y-2">
                  {aiDraft.suggestedItems.map((item, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-[var(--radius-button)] border border-border p-3 sm:grid-cols-[1fr_70px_80px_auto]"
                    >
                      <Input
                        value={item.name}
                        aria-label="Megnevezés"
                        onChange={(e) =>
                          setAiDraft({
                            ...aiDraft,
                            suggestedItems: aiDraft.suggestedItems.map((x, i) =>
                              i === index ? { ...x, name: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <Input
                        type="number"
                        value={item.qty ?? ""}
                        placeholder="?"
                        aria-label="Mennyiség"
                        onChange={(e) =>
                          setAiDraft({
                            ...aiDraft,
                            suggestedItems: aiDraft.suggestedItems.map((x, i) =>
                              i === index
                                ? { ...x, qty: e.target.value === "" ? null : Number(e.target.value) }
                                : x,
                            ),
                          })
                        }
                      />
                      <Input
                        value={item.unit}
                        aria-label="Mértékegység"
                        onChange={(e) =>
                          setAiDraft({
                            ...aiDraft,
                            suggestedItems: aiDraft.suggestedItems.map((x, i) =>
                              i === index ? { ...x, unit: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <button
                        aria-label="Tétel elvetése"
                        onClick={() =>
                          setAiDraft({
                            ...aiDraft,
                            suggestedItems: aiDraft.suggestedItems.filter((_, i) => i !== index),
                          })
                        }
                        className="justify-self-end rounded-md p-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-muted-foreground sm:col-span-4">
                        {item.priceSource === "catalog"
                          ? `Ár a katalógusból: ${item.unitPrice ?? "—"} Ft`
                          : "Nincs katalógus-egyezés — az árat az ajánlat-szerkesztőben add meg."}
                        {item.confidence === "low" ? " · Ellenőrizendő (bizonytalan adat)." : ""}
                      </p>
                    </div>
                  ))}
                  {aiDraft.suggestedItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nincs javasolt tétel.</p>
                  ) : null}
                </div>
              </div>

              {aiDraft.uncertainties.length ? (
                <ListBlock title="Bizonytalanságok" items={aiDraft.uncertainties} />
              ) : null}
              {aiDraft.siteSurveyCheckpoints.length ? (
                <ListBlock
                  title="Helyszíni felméréskor ellenőrizendő"
                  items={aiDraft.siteSurveyCheckpoints}
                />
              ) : null}
              {aiDraft.internalWarnings.length ? (
                <ListBlock title="Admin figyelmeztetések" items={aiDraft.internalWarnings} tone="warn" />
              ) : null}

              <AdminField label="Ügyfélnek szánt szöveg" hint="Az ajánlat 'Ügyfélnek szánt megjegyzés' mezőjébe kerül.">
                <Textarea
                  rows={3}
                  value={aiDraft.customerText}
                  onChange={(e) => setAiDraft({ ...aiDraft, customerText: e.target.value })}
                />
              </AdminField>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="copper" onClick={() => acceptAiDraft(open)}>
                  <CheckCircle2 /> Elfogadás → új ajánlat
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiDraft(null)}>
                  Elvetés
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </AdminPage>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  return (
    <div>
      <h4 className={`label-eyebrow ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}>
        {title}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
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
