import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminPage, AdminField, NativeSelect, Panel, StatusPill } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Printer, Send, ArrowUp, ArrowDown, CheckCircle2, XCircle } from "lucide-react";
import { useDemo, formatHuf, newId, nowStamp } from "@/demo/store";
import { priceBook, quoteStatusLabels } from "@/demo/data";
import { quoteTotals, nextQuoteNumber, addDays } from "@/demo/calc";
import type { Quote, QuoteStatus } from "@/demo/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/arajanlatok")({
  validateSearch: (search: Record<string, unknown>): { leadId?: string } =>
    typeof search["leadId"] === "string" ? { leadId: search["leadId"] } : {},
  component: QuotesPage,
});

function QuotesPage() {
  const { quotes, leads, settings, branding, upsertQuote, updateLead } = useDemo();
  const { leadId } = Route.useSearch();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Quote | null>(null);
  const [fStatus, setFStatus] = useState("");
  const [fClient, setFClient] = useState("");
  const [fFrom, setFFrom] = useState("");

  const startFromLead = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const quote: Quote = {
      id: newId("q"),
      number: nextQuoteNumber(quotes),
      leadId: lead.id,
      client: lead.name,
      clientAddress: [lead.zip, lead.city, lead.street].filter(Boolean).join(" "),
      title: lead.service,
      createdAt: new Date().toISOString().slice(0, 10),
      validUntil: addDays(30),
      leadTime: "Egyeztetés szerint, 2-3 hét",
      status: "piszkozat",
      items: [
        {
          id: newId("i"),
          name: priceBook[0]!.name,
          qty: 1,
          unit: priceBook[0]!.unit,
          unitPrice: priceBook[0]!.unitPrice,
          vat: 27,
        },
      ],
      discountPercent: 0,
      note: "",
      internalNote: "",
      payment: "30% előleg, 70% átadáskor",
      warranty: "Kivitelezésre 5 év, anyagra gyártói garancia.",
    };
    setEditing(quote);
    if (lead.status !== "ajanlat-keszul") {
      updateLead(lead.id, {
        status: "ajanlat-keszul",
        timeline: [
          ...lead.timeline,
          { id: newId("tl"), date: nowStamp(), title: "Ajánlat készítése elkezdve", detail: quote.number },
        ],
      });
    }
  };

  // Deep-linked from a lead's detail page ("Árajánlat készítése").
  useEffect(() => {
    if (!leadId || editing) return;
    startFromLead(leadId);
    void navigate({ to: "/admin/arajanlatok", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const setQuoteStatus = (next: QuoteStatus) => {
    if (!editing) return;
    const updated = { ...editing, status: next };
    upsertQuote(updated);
    setEditing(updated);
    const lead = leads.find((l) => l.id === updated.leadId);
    if (lead && (next === "elfogadva" || next === "elutasitva")) {
      updateLead(lead.id, {
        status: next,
        timeline: [
          ...lead.timeline,
          {
            id: newId("tl"),
            date: nowStamp(),
            title: next === "elfogadva" ? "Ajánlat elfogadva" : "Ajánlat elutasítva",
            detail: updated.number,
          },
        ],
      });
    }
    toast.success("A státusz mentve.");
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    if (!editing) return;
    const idx = editing.items.findIndex((x) => x.id === itemId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= editing.items.length) return;
    const items = [...editing.items];
    [items[idx], items[target]] = [items[target]!, items[idx]!];
    setEditing({ ...editing, items });
  };

  const filteredQuotes = useMemo(
    () =>
      quotes.filter(
        (q) =>
          (!fStatus || q.status === fStatus) &&
          (!fClient || q.client.toLowerCase().includes(fClient.toLowerCase())) &&
          (!fFrom || q.createdAt >= fFrom),
      ),
    [quotes, fStatus, fClient, fFrom],
  );

  if (editing) {
    const totals = quoteTotals(editing);
    const upd = (patch: Partial<Quote>) => setEditing({ ...editing, ...patch });

    return (
      <AdminPage
        title={`Árajánlat-szerkesztő — ${editing.number}`}
        intro="A nettó, áfa és bruttó összegek valós időben újraszámolódnak."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                upsertQuote(editing);
                toast.success("Piszkozat mentve.");
              }}
            >
              Mentés piszkozatként
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer /> Nyomtatás / PDF
            </Button>
            <Button
              size="sm"
              variant="copper"
              onClick={() => {
                const sent = { ...editing, status: "elkuldve" as const };
                upsertQuote(sent);
                const lead = leads.find((l) => l.id === sent.leadId);
                if (lead)
                  updateLead(lead.id, {
                    status: "ajanlat-elkuldve",
                    timeline: [
                      ...lead.timeline,
                      {
                        id: newId("tl"),
                        date: nowStamp(),
                        title: "Ajánlat elküldve",
                        detail: sent.number,
                      },
                    ],
                  });
                setEditing(sent);
                toast.success("Az ajánlat elküldött állapotba került.");
              }}
            >
              <Send /> Ajánlat elküldése
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQuoteStatus("elfogadva")}
              disabled={editing.status === "elfogadva"}
            >
              <CheckCircle2 /> Elfogadva
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQuoteStatus("elutasitva")}
              disabled={editing.status === "elutasitva"}
            >
              <XCircle /> Elutasítva
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Lista
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Panel title="Alapadatok">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="Ügyfél">
                  <Input value={editing.client} onChange={(e) => upd({ client: e.target.value })} />
                </AdminField>
                <AdminField label="Cím">
                  <Input
                    value={editing.clientAddress}
                    onChange={(e) => upd({ clientAddress: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Projekt megnevezése" className="sm:col-span-2">
                  <Input value={editing.title} onChange={(e) => upd({ title: e.target.value })} />
                </AdminField>
                <AdminField label="Vállalási idő">
                  <Input
                    value={editing.leadTime}
                    onChange={(e) => upd({ leadTime: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Érvényesség">
                  <Input
                    type="date"
                    value={editing.validUntil}
                    onChange={(e) => upd({ validUntil: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Kedvezmény (%)">
                  <Input
                    type="number"
                    value={editing.discountPercent}
                    onChange={(e) => upd({ discountPercent: Number(e.target.value) || 0 })}
                  />
                </AdminField>
                <AdminField label="Fizetési ütemezés">
                  <Input
                    value={editing.payment}
                    onChange={(e) => upd({ payment: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Garanciális és egyéb feltételek" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={editing.warranty}
                    onChange={(e) => upd({ warranty: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Ügyfélnek szánt megjegyzés" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={editing.note}
                    onChange={(e) => upd({ note: e.target.value })}
                  />
                </AdminField>
                <AdminField
                  label="Belső megjegyzés"
                  hint="Csak az adminban látszik, a nyomtatott ajánlatra nem kerül rá."
                  className="sm:col-span-2"
                >
                  <Textarea
                    rows={2}
                    value={editing.internalNote ?? ""}
                    onChange={(e) => upd({ internalNote: e.target.value })}
                  />
                </AdminField>
                <AdminField label="Egyéb státusz" hint="Megtekintve / módosítást kértek / lejárt eseteire.">
                  <NativeSelect value={editing.status} onChange={(v) => setQuoteStatus(v as QuoteStatus)}>
                    {(
                      [
                        "piszkozat",
                        "ellenorzes",
                        "elkuldve",
                        "megtekintve",
                        "modositast-kertek",
                        "elfogadva",
                        "elutasitva",
                        "lejart",
                      ] as const
                    ).map((s) => (
                      <option key={s} value={s}>
                        {quoteStatusLabels[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </AdminField>
              </div>
            </Panel>

            <Panel
              title="Tételek"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    upd({
                      items: [
                        ...editing.items,
                        {
                          id: newId("i"),
                          name: priceBook[0]!.name,
                          qty: 1,
                          unit: priceBook[0]!.unit,
                          unitPrice: priceBook[0]!.unitPrice,
                          vat: 27,
                        },
                      ],
                    })
                  }
                >
                  <Plus /> Tétel
                </Button>
              }
            >
              <datalist id="price-book-items">
                {priceBook.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
              <div className="space-y-3">
                {editing.items.map((it, index) => {
                  const net = it.qty * it.unitPrice;
                  const gross = net * (1 + (it.vat || 0) / 100);
                  return (
                    <div key={it.id} className="rounded-[var(--radius-button)] border border-border p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_70px_80px_110px_70px_auto]">
                        <Input
                          list="price-book-items"
                          value={it.name}
                          aria-label="Megnevezés"
                          placeholder="Megnevezés (választható vagy egyedi)"
                          onChange={(e) => {
                            const v = e.target.value;
                            const p = priceBook.find((x) => x.name === v);
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id
                                  ? {
                                      ...x,
                                      name: v,
                                      unit: p?.unit ?? x.unit,
                                      unitPrice: p?.unitPrice ?? x.unitPrice,
                                    }
                                  : x,
                              ),
                            });
                          }}
                        />
                        <Input
                          type="number"
                          value={it.qty}
                          aria-label="Mennyiség"
                          onChange={(e) =>
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id ? { ...x, qty: Number(e.target.value) || 0 } : x,
                              ),
                            })
                          }
                        />
                        <Input
                          value={it.unit}
                          aria-label="Mértékegység"
                          onChange={(e) =>
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id ? { ...x, unit: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <Input
                          type="number"
                          value={it.unitPrice}
                          aria-label="Egységár"
                          onChange={(e) =>
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id ? { ...x, unitPrice: Number(e.target.value) || 0 } : x,
                              ),
                            })
                          }
                        />
                        <Input
                          type="number"
                          value={it.vat}
                          aria-label="Áfa"
                          onChange={(e) =>
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id ? { ...x, vat: Number(e.target.value) || 0 } : x,
                              ),
                            })
                          }
                        />
                        <div className="flex items-center justify-self-end">
                          <button
                            aria-label="Tétel mozgatása felfelé"
                            disabled={index === 0}
                            onClick={() => moveItem(it.id, -1)}
                            className="rounded-md p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="Tétel mozgatása lefelé"
                            disabled={index === editing.items.length - 1}
                            onClick={() => moveItem(it.id, 1)}
                            className="rounded-md p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="Tétel törlése"
                            onClick={() => upd({ items: editing.items.filter((x) => x.id !== it.id) })}
                            className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <Input
                          value={it.description ?? ""}
                          aria-label="Leírás"
                          placeholder="Leírás (opcionális)"
                          onChange={(e) =>
                            upd({
                              items: editing.items.map((x) =>
                                x.id === it.id ? { ...x, description: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <p className="whitespace-nowrap text-xs text-muted-foreground">
                          Nettó: {formatHuf(net)} · Bruttó: {formatHuf(gross)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel title="Előnézet" description="Így látja az ügyfél a nyomtatott ajánlatot.">
            <div className="print-area rounded-[var(--radius-card)] border border-border bg-surface p-6 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={branding.faviconUrl || "/favicon.svg"}
                    alt=""
                    className="h-10 w-10 object-contain"
                  />
                  <div>
                    <p className="font-display text-base font-semibold">{settings.company}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[settings.address, settings.taxNumber && `Adószám: ${settings.taxNumber}`]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {[settings.phone, settings.email].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold">Árajánlat</p>
                  <p className="text-xs text-muted-foreground">{editing.number}</p>
                  <span className="print-hide inline-block">
                    <StatusPill status={editing.status} />
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-1 text-xs">
                <p>
                  <strong>{editing.client}</strong>
                </p>
                <p>{editing.clientAddress}</p>
                <p className="mt-2">{editing.title}</p>
                <p className="text-muted-foreground">
                  Vállalási idő: {editing.leadTime} • Érvényes: {editing.validUntil}
                </p>
              </div>
              <table className="mt-4 w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1">Tétel</th>
                    <th className="py-1">Menny.</th>
                    <th className="py-1 text-right">Egységár</th>
                    <th className="py-1 text-right">Nettó</th>
                  </tr>
                </thead>
                <tbody>
                  {editing.items.map((it) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="py-1.5">
                        {it.name}
                        {it.description ? (
                          <span className="block text-[10px] text-muted-foreground">
                            {it.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5">
                        {it.qty} {it.unit}
                      </td>
                      <td className="py-1.5 text-right">{formatHuf(it.unitPrice)}</td>
                      <td className="py-1.5 text-right">{formatHuf(it.qty * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="mt-4 space-y-1 text-xs">
                <Total label="Nettó összesen" value={formatHuf(totals.net)} />
                {editing.discountPercent ? (
                  <Total
                    label={`Kedvezmény (${editing.discountPercent}%)`}
                    value={`- ${formatHuf(totals.discount)}`}
                  />
                ) : null}
                <Total label="Nettó kedvezmény után" value={formatHuf(totals.netAfterDiscount)} />
                <Total label="Áfa" value={formatHuf(totals.vat)} />
                <Total label="Bruttó összesen" value={formatHuf(totals.gross)} strong />
              </dl>
              <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
                <p>Fizetés: {editing.payment}</p>
                <p>Garancia: {editing.warranty}</p>
                {editing.note ? <p>Megjegyzés: {editing.note}</p> : null}
              </div>
            </div>
          </Panel>
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Árajánlatok"
      intro="Meglévő ajánlatok szerkesztése, vagy új ajánlat készítése egy érdeklődőből."
    >
      <Panel title="Új ajánlat leadből">
        <div className="grid gap-3 sm:max-w-md">
          <NativeSelect value="" onChange={(v) => v && startFromLead(v)}>
            <option value="">Válassz érdeklődőt…</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.service}
              </option>
            ))}
          </NativeSelect>
        </div>
      </Panel>

      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminField label="Ügyfél">
            <Input value={fClient} onChange={(e) => setFClient(e.target.value)} placeholder="Keresés név szerint" />
          </AdminField>
          <AdminField label="Státusz">
            <NativeSelect value={fStatus} onChange={setFStatus}>
              <option value="">Mind</option>
              {Object.entries(quoteStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Kiállítva ettől" hint="Ennél későbbi ajánlatok.">
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </AdminField>
        </div>
      </Panel>

      <Panel title={`${filteredQuotes.length} ajánlat`}>
        <ul className="space-y-2 md:hidden">
          {filteredQuotes.map((q) => (
            <li key={q.id} className="rounded-[var(--radius-button)] border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 font-semibold break-words">{q.number}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {quoteStatusLabels[q.status]}
                </span>
              </div>
              <p className="mt-1 text-sm break-words">
                {q.client} — {q.clientAddress}
              </p>
              <p className="text-xs text-muted-foreground">
                Kiállítva: {q.createdAt} · Érvényes: {q.validUntil}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{formatHuf(quoteTotals(q).gross)}</span>
                <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                  Szerkesztés
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-2">Szám</th>
                <th className="p-2">Ügyfél</th>
                <th className="p-2">Helyszín</th>
                <th className="p-2">Kiállítva</th>
                <th className="p-2">Érvényes</th>
                <th className="p-2">Bruttó</th>
                <th className="p-2">Státusz</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0">
                  <td className="p-2 font-semibold">{q.number}</td>
                  <td className="p-2">{q.client}</td>
                  <td className="p-2">{q.clientAddress}</td>
                  <td className="p-2">{q.createdAt}</td>
                  <td className="p-2">{q.validUntil}</td>
                  <td className="p-2">{formatHuf(quoteTotals(q).gross)}</td>
                  <td className="p-2">{quoteStatusLabels[q.status]}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                      Szerkesztés / előnézet
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminPage>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? "border-t border-border pt-1.5 text-sm font-semibold" : ""}`}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
