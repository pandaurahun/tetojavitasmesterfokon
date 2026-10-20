import { useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminField, NativeSelect, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/store";
import { fieldQuoteApi, FieldQuoteApiError } from "@/lib/field-quote-client";
import { computeFieldQuoteTotals, effectiveDiscountPercent, lineNet } from "@/lib/field-quote-calc";
import {
  areaNumberFromLead,
  propertyTypeFromLead,
  PROPERTY_TYPES,
  ROOF_CONDITIONS,
  ROOF_COVERINGS,
  roofCoveringFromLead,
  roofTypeFromLead,
  ROOF_TYPES,
  SIZE_UNITS,
  type CatalogItem,
  type FieldQuote,
  type FieldQuoteSettings,
  type PaymentTemplate,
  type QuotePackage,
} from "@/demo/field-quote-types";
import { Camera, Loader2, Package, Plus, Search, Trash2, X } from "lucide-react";

const huf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";
const uid = (): string => crypto.randomUUID();

interface ItemDraft {
  tempId: string;
  id?: string | undefined;
  catalogItemId?: string | undefined;
  name: string;
  description?: string | undefined;
  category?: string | undefined;
  qty: number;
  unit: string;
  unitPrice: number;
  vat: number;
}

interface FormState {
  leadId?: string | undefined;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerZip: string;
  customerCity: string;
  customerAddress: string;
  billingName: string;
  billingAddress: string;
  customerNote: string;
  propertyType: string;
  roofType: string;
  roofCovering: string;
  estimatedSize: string;
  sizeUnit: string;
  roofCondition: string;
  surveyNote: string;
  discountType: "" | "percent" | "fixed";
  discountValue: number;
  discountOverCapApprovedBy: string;
  validityDate: string;
  expectedStart: string;
  expectedDuration: string;
  paymentTerms: string;
  customerNotes: string;
}

function formFromQuote(q: FieldQuote | null | undefined, defaultValidityDays: number): FormState {
  const validity =
    q?.validityDate ??
    new Date(Date.now() + defaultValidityDays * 86_400_000).toISOString().slice(0, 10);
  return {
    leadId: q?.leadId,
    customerName: q?.customerName ?? "",
    customerPhone: q?.customerPhone ?? "",
    customerEmail: q?.customerEmail ?? "",
    customerZip: q?.customerZip ?? "",
    customerCity: q?.customerCity ?? "",
    customerAddress: q?.customerAddress ?? "",
    billingName: q?.billingName ?? "",
    billingAddress: q?.billingAddress ?? "",
    customerNote: q?.customerNote ?? "",
    propertyType: q?.propertyType ?? "",
    roofType: q?.roofType ?? "",
    roofCovering: q?.roofCovering ?? "",
    estimatedSize: q?.estimatedSize ?? "",
    sizeUnit: q?.sizeUnit ?? "m²",
    roofCondition: q?.roofCondition ?? "",
    surveyNote: q?.surveyNote ?? "",
    discountType: (q?.discountType as "percent" | "fixed" | undefined) ?? "",
    discountValue: q?.discountValue ?? 0,
    discountOverCapApprovedBy: q?.discountOverCapApprovedBy ?? "",
    validityDate: validity,
    expectedStart: q?.expectedStart ?? "",
    expectedDuration: q?.expectedDuration ?? "",
    paymentTerms: q?.paymentTerms ?? "",
    customerNotes: q?.customerNotes ?? "",
  };
}

export function FieldQuoteEditor({
  initial,
  onSaved,
  onDirtyChange,
}: {
  initial?: FieldQuote | null;
  onSaved: (quote: FieldQuote) => void;
  /** Called whenever "has unsaved changes" flips. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { leads } = useDemo();
  const [settings, setSettings] = useState<FieldQuoteSettings | null>(null);
  const [form, setForm] = useState<FormState>(() => formFromQuote(initial, 14));
  const [items, setItems] = useState<ItemDraft[]>(
    () => initial?.items.map((i) => ({ ...i, tempId: uid() })) ?? [],
  );
  const [leadQuery, setLeadQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [packages, setPackages] = useState<QuotePackage[]>([]);
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogItem[]>([]);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: "",
    qty: "1",
    unit: "db",
    unitPrice: "0",
    vat: "27",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Unsaved changes" = the payload that would be saved differs from the one
  // loaded. The baseline is captured on the first render pass (and re-captured
  // once the settings arrive for a NEW quote, since they supply its default
  // validity date — that isn't a change the user made).
  const baseline = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const leaveApproved = useRef(false);

  useEffect(() => {
    const current = JSON.stringify(buildPayload());
    if (baseline.current === null) {
      baseline.current = current;
      return;
    }
    setDirty(current !== baseline.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Leaving the page (menu click, back button, tab close) with unsaved changes
  // would silently throw them away — ask first.
  useBlocker({
    shouldBlockFn: () =>
      leaveApproved.current
        ? false
        : !window.confirm("Mentetlen módosítások vannak. Biztosan elhagyja az oldalt?"),
    disabled: !dirty,
    enableBeforeUnload: () => dirty && !leaveApproved.current,
  });

  useEffect(() => {
    const loadFailed = () => toast.error("A katalógus vagy a beállítások betöltése nem sikerült.");
    void fieldQuoteApi
      .settingsGet()
      .then((s) => {
        setSettings(s);
        if (!initial) {
          setForm((f) => ({
            ...f,
            validityDate: new Date(Date.now() + s.defaultValidityDays * 86_400_000)
              .toISOString()
              .slice(0, 10),
          }));
          baseline.current = null;
        }
      })
      .catch(loadFailed);
    void fieldQuoteApi
      .catalogList()
      .then((r) => setCatalog(r.items))
      .catch(loadFailed);
    void fieldQuoteApi
      .packagesList()
      .then((r) => setPackages(r.items))
      .catch(loadFailed);
    void fieldQuoteApi
      .templatesList()
      .then((r) => setTemplates(r.items))
      .catch(loadFailed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!catalogQuery.trim()) {
      setCatalogResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void fieldQuoteApi.catalogSearch(catalogQuery).then((r) => setCatalogResults(r.items));
    }, 250);
    return () => clearTimeout(handle);
  }, [catalogQuery]);

  const totals = useMemo(
    () => computeFieldQuoteTotals(items, form.discountType || undefined, form.discountValue),
    [items, form.discountType, form.discountValue],
  );

  const discountPercent = effectiveDiscountPercent(
    items,
    form.discountType || undefined,
    form.discountValue,
  );
  const overCap = Boolean(
    settings && form.discountType && discountPercent > settings.maxDiscountPercent,
  );

  const matchingLeads = useMemo(() => {
    if (!leadQuery.trim()) return [];
    const q = leadQuery.toLowerCase();
    return leads
      .filter((l) => `${l.name} ${l.phone} ${l.city}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [leads, leadQuery]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addCatalogItem = (ci: CatalogItem) => {
    setItems((prev) => [
      ...prev,
      {
        tempId: uid(),
        catalogItemId: ci.id,
        name: ci.name,
        description: ci.description,
        category: ci.category,
        qty: 1,
        unit: ci.unit,
        unitPrice: ci.basePrice,
        vat: ci.vat,
      },
    ]);
    setCatalogQuery("");
    setCatalogResults([]);
  };

  const addPackage = (pkg: QuotePackage) => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const newItems: ItemDraft[] = pkg.items
      .map((pi): ItemDraft | null => {
        const ci = byId.get(pi.catalogItemId);
        if (!ci) return null;
        return {
          tempId: uid(),
          catalogItemId: ci.id,
          name: ci.name,
          description: ci.description,
          category: ci.category,
          qty: pi.defaultQty,
          unit: ci.unit,
          unitPrice: ci.basePrice,
          vat: ci.vat,
        };
      })
      .filter((x): x is ItemDraft => x !== null);
    if (newItems.length === 0) {
      toast.error("A csomag tételei nem találhatók a katalógusban.");
      return;
    }
    setItems((prev) => [...prev, ...newItems]);
    toast.success(`„${pkg.name}” csomag hozzáadva (${newItems.length} tétel).`);
  };

  const addCustomItem = () => {
    const qty = Number(customItem.qty.replace(",", "."));
    const unitPrice = Number(customItem.unitPrice.replace(",", "."));
    const vat = Number(customItem.vat.replace(",", "."));
    if (
      !customItem.name.trim() ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      toast.error("Adjon meg nevet, érvényes mennyiséget és árat.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        tempId: uid(),
        name: customItem.name.trim(),
        qty,
        unit: customItem.unit,
        unitPrice,
        vat: Number.isFinite(vat) ? vat : 27,
      },
    ]);
    setCustomItem({ name: "", qty: "1", unit: "db", unitPrice: "0", vat: "27" });
    setCustomItemOpen(false);
  };

  const updateItem = (tempId: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)));
  const removeItem = (tempId: string) =>
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));

  const buildPayload = () => ({
    leadId: form.leadId || undefined,
    customerName: form.customerName.trim(),
    customerPhone: form.customerPhone.trim(),
    customerEmail: form.customerEmail.trim() || undefined,
    customerZip: form.customerZip.trim() || undefined,
    customerCity: form.customerCity.trim() || undefined,
    customerAddress: form.customerAddress.trim() || undefined,
    billingName: form.billingName.trim() || undefined,
    billingAddress: form.billingAddress.trim() || undefined,
    customerNote: form.customerNote.trim() || undefined,
    propertyType: form.propertyType || undefined,
    roofType: form.roofType || undefined,
    roofCovering: form.roofCovering || undefined,
    estimatedSize: form.estimatedSize.trim() || undefined,
    sizeUnit: form.sizeUnit || undefined,
    roofCondition: form.roofCondition || undefined,
    surveyNote: form.surveyNote.trim() || undefined,
    discountType: form.discountType || undefined,
    discountValue: form.discountType ? form.discountValue : 0,
    discountOverCapApprovedBy: form.discountOverCapApprovedBy.trim() || undefined,
    validityDate: form.validityDate || undefined,
    expectedStart: form.expectedStart.trim() || undefined,
    expectedDuration: form.expectedDuration.trim() || undefined,
    paymentTerms: form.paymentTerms.trim() || undefined,
    customerNotes: form.customerNotes.trim() || undefined,
    items: items.map((i) => ({
      id: i.id,
      catalogItemId: i.catalogItemId,
      name: i.name,
      description: i.description,
      category: i.category,
      qty: i.qty,
      unit: i.unit,
      unitPrice: i.unitPrice,
      vat: i.vat,
    })),
  });

  const save = async () => {
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError("Az ügyfél neve és telefonszáma kötelező.");
      return;
    }
    if (items.length === 0) {
      setError("Legalább egy tétel szükséges a mentéshez.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = initial?.id
        ? await fieldQuoteApi.update(initial.id, payload)
        : await fieldQuoteApi.create(payload);
      toast.success("Az ajánlat mentve.");
      // Saved: navigating on (new quote → its page) must not trigger the
      // "unsaved changes" prompt.
      leaveApproved.current = true;
      onSaved(saved);
    } catch (e) {
      const message = e instanceof FieldQuoteApiError ? e.message : "A mentés nem sikerült.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-28">
      <Panel
        title="Ügyfél"
        description="Válasszon korábbi érdeklődőt, vagy adja meg az adatokat kézzel."
      >
        <div className="relative mb-4">
          <AdminField label="Érdeklődő keresése (opcionális)">
            <Input
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
              placeholder="Név, telefon vagy város..."
            />
          </AdminField>
          {matchingLeads.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-[var(--radius-button)] border border-border bg-surface shadow-lift">
              {matchingLeads.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="block w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      leadId: l.id,
                      customerName: l.name,
                      customerPhone: l.phone,
                      customerEmail: l.email || f.customerEmail,
                      customerCity: l.city || f.customerCity,
                      customerZip: l.zip || f.customerZip,
                      customerAddress: l.street || f.customerAddress,
                      propertyType: propertyTypeFromLead(l.buildingType) || f.propertyType,
                      roofType: roofTypeFromLead(l.roof?.shape) || f.roofType,
                      roofCovering: roofCoveringFromLead(l.roof?.covering) || f.roofCovering,
                      estimatedSize: areaNumberFromLead(l.roof?.area) || f.estimatedSize,
                    }));
                    setLeadQuery("");
                  }}
                >
                  <span className="font-medium">{l.name}</span>{" "}
                  <span className="text-muted-foreground">
                    — {l.phone} · {l.city}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {form.leadId ? (
          <p className="mb-3 flex items-center gap-2 text-xs text-accent">
            Érdeklődőhöz kapcsolva
            <button type="button" className="underline" onClick={() => set("leadId", undefined)}>
              kapcsolat törlése
            </button>
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Név *">
            <Input
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
            />
          </AdminField>
          <AdminField label="Telefon *">
            <Input
              value={form.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
            />
          </AdminField>
          <AdminField label="E-mail">
            <Input
              type="email"
              value={form.customerEmail}
              onChange={(e) => set("customerEmail", e.target.value)}
            />
          </AdminField>
          <AdminField label="Irányítószám">
            <Input value={form.customerZip} onChange={(e) => set("customerZip", e.target.value)} />
          </AdminField>
          <AdminField label="Város">
            <Input
              value={form.customerCity}
              onChange={(e) => set("customerCity", e.target.value)}
            />
          </AdminField>
          <AdminField label="Cím">
            <Input
              value={form.customerAddress}
              onChange={(e) => set("customerAddress", e.target.value)}
            />
          </AdminField>
          <AdminField label="Számlázási név (ha eltér)">
            <Input
              value={form.billingName}
              onChange={(e) => set("billingName", e.target.value)}
              placeholder="Pl. cégnév vagy más személy"
            />
          </AdminField>
          <AdminField label="Számlázási cím (ha eltér)">
            <Input
              value={form.billingAddress}
              onChange={(e) => set("billingAddress", e.target.value)}
              placeholder="Irányítószám, település, utca, házszám"
            />
          </AdminField>
        </div>
        <AdminField label="Belső megjegyzés (nem látja az ügyfél)" className="mt-3">
          <Textarea
            rows={2}
            value={form.customerNote}
            onChange={(e) => set("customerNote", e.target.value)}
          />
        </AdminField>
      </Panel>

      <Panel title="Helyszíni felmérés">
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Ingatlan típusa">
            <NativeSelect value={form.propertyType} onChange={(v) => set("propertyType", v)}>
              <option value="">— válasszon —</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Tetőforma">
            <NativeSelect value={form.roofType} onChange={(v) => set("roofType", v)}>
              <option value="">— válasszon —</option>
              {ROOF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Héjazat">
            <NativeSelect value={form.roofCovering} onChange={(v) => set("roofCovering", v)}>
              <option value="">— válasszon —</option>
              {ROOF_COVERINGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Állapot">
            <NativeSelect value={form.roofCondition} onChange={(v) => set("roofCondition", v)}>
              <option value="">— válasszon —</option>
              {ROOF_CONDITIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Becsült méret" htmlFor="fq-estimated-size">
            <div className="flex gap-2">
              <Input
                id="fq-estimated-size"
                value={form.estimatedSize}
                onChange={(e) => set("estimatedSize", e.target.value)}
                className="flex-1"
              />
              <NativeSelect
                aria-label="Méretegység"
                value={form.sizeUnit}
                onChange={(v) => set("sizeUnit", v)}
                className="w-24"
              >
                {SIZE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </AdminField>
        </div>
        <AdminField label="Felmérési jegyzet (nem látja az ügyfél)" className="mt-3">
          <Textarea
            rows={3}
            value={form.surveyNote}
            onChange={(e) => set("surveyNote", e.target.value)}
          />
        </AdminField>
      </Panel>

      {initial?.id ? (
        <FieldQuotePhotos
          fieldQuoteId={initial.id}
          initialPhotos={initial.photos}
          locked={initial.status === "SIGNED"}
        />
      ) : (
        <Panel title="Fényképek">
          <p className="text-sm text-muted-foreground">
            Mentse el az ajánlatot piszkozatként, utána tölthet fel fényképeket.
          </p>
        </Panel>
      )}

      <Panel
        title="Tételek"
        description="Keressen a katalógusban, adjon hozzá csomagot, vagy vegyen fel egyedi tételt."
      >
        <div className="relative mb-3">
          <AdminField label="Katalógus keresése" htmlFor="fq-catalog-search">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="fq-catalog-search"
                className="pl-9"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Pl. cserépcsere, ácsszerkezet..."
              />
            </div>
          </AdminField>
          {catalogResults.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded-[var(--radius-button)] border border-border bg-surface shadow-lift">
              {catalogResults.map((ci) => (
                <button
                  key={ci.id}
                  type="button"
                  className="flex w-full items-center justify-between border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  onClick={() => addCatalogItem(ci)}
                >
                  <span>{ci.name}</span>
                  <span className="text-muted-foreground">
                    {huf(ci.basePrice)} / {ci.unit}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {packages.filter((p) => p.active).length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {packages
              .filter((p) => p.active)
              .map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => addPackage(pkg)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-accent hover:text-accent"
                >
                  <Package className="h-3.5 w-3.5" /> {pkg.name}
                </button>
              ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            {/* Phones: one card per line — a 560px-wide table would hide the
                price and delete columns off-screen, and this is the screen
                the surveyor holds on the roof. */}
            <div className="space-y-3 sm:hidden">
              {items.map((item) => (
                <div
                  key={item.tempId}
                  className="rounded-[var(--radius-button)] border border-border p-3"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      aria-label="Tétel megnevezése"
                      value={item.name}
                      onChange={(e) => updateItem(item.tempId, { name: e.target.value })}
                      className="h-9 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.tempId)}
                      aria-label={`${item.name} törlése`}
                      className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="space-y-1 text-[11px] font-semibold text-muted-foreground">
                      Menny.
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(item.tempId, { qty: Number(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-muted-foreground">
                      Egység
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(item.tempId, { unit: e.target.value })}
                        className="h-9"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-muted-foreground">
                      Egységár
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.tempId, { unitPrice: Number(e.target.value) || 0 })
                        }
                        className="h-9"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-right text-sm font-medium">
                    {huf(lineNet(item.qty, item.unitPrice))}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      nettó · ÁFA {item.vat}%
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-semibold">Tétel</th>
                    <th className="w-20 pb-2 font-semibold">Menny.</th>
                    <th className="w-20 pb-2 font-semibold">Egység</th>
                    <th className="w-28 pb-2 font-semibold">Egységár</th>
                    <th className="w-16 pb-2 font-semibold">ÁFA</th>
                    <th className="w-24 pb-2 text-right font-semibold">Nettó</th>
                    <th className="w-8 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.tempId} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        <Input
                          aria-label="Tétel megnevezése"
                          value={item.name}
                          onChange={(e) => updateItem(item.tempId, { name: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          aria-label="Mennyiség"
                          type="number"
                          min={0}
                          step="any"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(item.tempId, { qty: Number(e.target.value) || 0 })
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          aria-label="Mértékegység"
                          value={item.unit}
                          onChange={(e) => updateItem(item.tempId, { unit: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          aria-label="Nettó egységár"
                          type="number"
                          min={0}
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.tempId, { unitPrice: Number(e.target.value) || 0 })
                          }
                          className="h-8"
                        />
                      </td>
                      <td className="py-2 pr-2 text-xs whitespace-nowrap text-muted-foreground">
                        {item.vat}%
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {huf(lineNet(item.qty, item.unitPrice))}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(item.tempId)}
                          aria-label={`${item.name} törlése`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="rounded-[var(--radius-button)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Még nincs tétel felvéve.
          </p>
        )}

        {customItemOpen ? (
          <div className="mt-3 grid gap-2 rounded-[var(--radius-button)] border border-border p-3 sm:grid-cols-6">
            <Input
              placeholder="Megnevezés"
              aria-label="Egyedi tétel megnevezése"
              value={customItem.name}
              onChange={(e) => setCustomItem((c) => ({ ...c, name: e.target.value }))}
              className="sm:col-span-2"
            />
            <Input
              placeholder="Menny."
              aria-label="Egyedi tétel mennyisége"
              inputMode="decimal"
              value={customItem.qty}
              onChange={(e) => setCustomItem((c) => ({ ...c, qty: e.target.value }))}
            />
            <Input
              placeholder="Egység"
              aria-label="Egyedi tétel mértékegysége"
              value={customItem.unit}
              onChange={(e) => setCustomItem((c) => ({ ...c, unit: e.target.value }))}
            />
            <Input
              placeholder="Egységár"
              aria-label="Egyedi tétel nettó egységára"
              inputMode="decimal"
              value={customItem.unitPrice}
              onChange={(e) => setCustomItem((c) => ({ ...c, unitPrice: e.target.value }))}
            />
            <NativeSelect
              aria-label="Egyedi tétel ÁFA-kulcsa"
              value={customItem.vat}
              onChange={(v) => setCustomItem((c) => ({ ...c, vat: v }))}
            >
              {["27", "18", "5", "0"].map((rate) => (
                <option key={rate} value={rate}>
                  ÁFA {rate}%
                </option>
              ))}
            </NativeSelect>
            <div className="flex gap-2 sm:col-span-6">
              <Button type="button" size="sm" onClick={addCustomItem}>
                Hozzáadás
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCustomItemOpen(false)}
              >
                Mégse
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setCustomItemOpen(true)}
          >
            <Plus className="h-4 w-4" /> Egyedi tétel
          </Button>
        )}
      </Panel>

      <Panel title="Árazás és feltételek">
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Kedvezmény típusa">
            <NativeSelect
              value={form.discountType}
              onChange={(v) => set("discountType", v as FormState["discountType"])}
            >
              <option value="">Nincs kedvezmény</option>
              <option value="percent">Százalékos</option>
              <option value="fixed">Fix összegű</option>
            </NativeSelect>
          </AdminField>
          {form.discountType ? (
            <AdminField
              label={form.discountType === "percent" ? "Kedvezmény (%)" : "Kedvezmény (Ft)"}
            >
              <Input
                type="number"
                min={0}
                value={form.discountValue}
                onChange={(e) => set("discountValue", Number(e.target.value) || 0)}
              />
            </AdminField>
          ) : null}
        </div>
        {overCap ? (
          <div className="mt-3 rounded-[var(--radius-button)] border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              A kedvezmény ({discountPercent.toFixed(1)}%) meghaladja az engedélyezett{" "}
              {settings?.maxDiscountPercent}%-os limitet. Jóváhagyás szükséges a mentéshez.
            </p>
            <AdminField label="Jóváhagyó neve / indoklás" className="mt-2">
              <Input
                value={form.discountOverCapApprovedBy}
                onChange={(e) => set("discountOverCapApprovedBy", e.target.value)}
                placeholder="Pl. Kovács Ádám, egyedi egyeztetés alapján"
              />
            </AdminField>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <AdminField label="Érvényesség">
            <Input
              type="date"
              value={form.validityDate}
              onChange={(e) => set("validityDate", e.target.value)}
            />
          </AdminField>
          <AdminField label="Várható kezdés">
            <Input
              value={form.expectedStart}
              onChange={(e) => set("expectedStart", e.target.value)}
              placeholder="Pl. 2 héten belül"
            />
          </AdminField>
          <AdminField label="Várható időtartam">
            <Input
              value={form.expectedDuration}
              onChange={(e) => set("expectedDuration", e.target.value)}
              placeholder="Pl. 2-3 nap"
            />
          </AdminField>
        </div>

        <AdminField label="Fizetési feltételek" htmlFor="fq-payment-terms" className="mt-3">
          {templates.length > 0 ? (
            <NativeSelect
              aria-label="Fizetési sablon beillesztése"
              value=""
              onChange={(id) => {
                const t = templates.find((x) => x.id === id);
                if (t) set("paymentTerms", t.body);
              }}
              className="mb-2"
            >
              <option value="">— sablon beillesztése —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Textarea
            id="fq-payment-terms"
            rows={2}
            value={form.paymentTerms}
            onChange={(e) => set("paymentTerms", e.target.value)}
          />
        </AdminField>

        <AdminField label="Megjegyzés az ügyfélnek" className="mt-3">
          <Textarea
            rows={2}
            value={form.customerNotes}
            onChange={(e) => set("customerNotes", e.target.value)}
          />
        </AdminField>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur sm:p-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Bruttó végösszeg: </span>
            <span className="font-display text-lg font-semibold">{huf(totals.gross)}</span>
          </div>
          <div className="flex items-center gap-3">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="button"
              variant="copper"
              disabled={saving || (overCap && !form.discountOverCapApprovedBy.trim())}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mentés
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldQuotePhotos({
  fieldQuoteId,
  initialPhotos,
  locked,
}: {
  fieldQuoteId: string;
  initialPhotos: FieldQuote["photos"];
  locked: boolean;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    const failures: string[] = [];
    try {
      // One file per request, each handled on its own: a bad file in the
      // middle of a multi-select must not throw away the ones after it.
      for (const file of files) {
        try {
          const result = await fieldQuoteApi.uploadPhoto(fieldQuoteId, file);
          setPhotos((prev) => [
            ...prev,
            { id: result.photoId, url: result.key, sortOrder: prev.length },
          ]);
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof FieldQuoteApiError ? e.message : "a fénykép feltöltése nem sikerült."}`,
          );
        }
      }
    } finally {
      setUploading(false);
    }
    if (failures.length > 0) toast.error(failures.join("\n"));
  };

  return (
    <Panel title="Fényképek">
      {!locked ? (
        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:border-accent hover:text-accent">
          <Camera className="h-4 w-4" />
          {uploading ? "Feltöltés..." : "Fénykép hozzáadása"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => {
              // The FileList is live — copy it before clearing the input
              // (clearing lets the same file be picked again after a failure).
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              void onFiles(picked);
            }}
          />
        </label>
      ) : null}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius-button)] border border-border"
            >
              <img
                src={`/api/admin/field-quotes/media/${p.url}`}
                alt={p.caption ?? ""}
                className="h-full w-full object-cover"
              />
              {!locked ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fieldQuoteApi.removePhoto(fieldQuoteId, p.id);
                      setPhotos((prev) => prev.filter((x) => x.id !== p.id));
                    } catch (e) {
                      toast.error(
                        e instanceof FieldQuoteApiError
                          ? e.message
                          : "A fénykép törlése nem sikerült.",
                      );
                    }
                  }}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Törlés"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Még nincs fénykép feltöltve.</p>
      )}
    </Panel>
  );
}
