import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField, AdminPage, EmptyState, NativeSelect, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fieldQuoteApi, FieldQuoteApiError } from "@/lib/field-quote-client";
import {
  CATALOG_UNITS,
  type CatalogItem,
  type FieldQuoteSettings,
  type PaymentTemplate,
  type QuotePackage,
} from "@/demo/field-quote-types";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/helyszini-ajanlat/beallitasok")({
  head: () => ({
    meta: [{ title: "Helyszíni ajánlat — Beállítások" }, { name: "robots", content: "noindex" }],
  }),
  component: FieldQuoteSettingsPage,
});

const huf = (v: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(v) + " Ft";

function FieldQuoteSettingsPage() {
  const [tab, setTab] = useState<"beallitasok" | "katalogus" | "csomagok" | "sablonok">(
    "beallitasok",
  );
  return (
    <AdminPage
      title="Helyszíni ajánlat — beállítások"
      intro="Katalógus, csomagok, fizetési sablonok és a kedvezménylimit kezelése."
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/helyszini-ajanlat">← Lista</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            ["beallitasok", "Beállítások"],
            ["katalogus", "Katalógus"],
            ["csomagok", "Csomagok"],
            ["sablonok", "Fizetési sablonok"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              tab === key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "beallitasok" ? <GeneralSettings /> : null}
      {tab === "katalogus" ? <CatalogSettings /> : null}
      {tab === "csomagok" ? <PackageSettings /> : null}
      {tab === "sablonok" ? <TemplateSettings /> : null}
    </AdminPage>
  );
}

function GeneralSettings() {
  const [settings, setSettings] = useState<FieldQuoteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fieldQuoteApi.settingsGet().then(setSettings);
  }, []);

  if (!settings)
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      </Panel>
    );

  const save = async () => {
    setSaving(true);
    try {
      await fieldQuoteApi.settingsSave(settings);
      toast.success("Beállítások mentve.");
    } catch (e) {
      toast.error(e instanceof FieldQuoteApiError ? e.message : "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Általános beállítások">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField
          label="Maximális kedvezmény (%)"
          hint="Efelett jóváhagyó indoklás szükséges a mentéshez."
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={settings.maxDiscountPercent}
            onChange={(e) =>
              setSettings({ ...settings, maxDiscountPercent: Number(e.target.value) || 0 })
            }
          />
        </AdminField>
        <AdminField label="Alapértelmezett érvényesség (nap)">
          <Input
            type="number"
            min={1}
            max={365}
            value={settings.defaultValidityDays}
            onChange={(e) =>
              setSettings({ ...settings, defaultValidityDays: Number(e.target.value) || 1 })
            }
          />
        </AdminField>
      </div>
      <AdminField
        label="Elfogadó nyilatkozat szövege"
        className="mt-3"
        hint="Ezt a checkboxot kell bejelölnie az ügyfélnek aláíráskor."
      >
        <Textarea
          rows={2}
          value={settings.acceptanceStatement}
          onChange={(e) => setSettings({ ...settings, acceptanceStatement: e.target.value })}
        />
      </AdminField>
      <Button className="mt-4" variant="copper" disabled={saving} onClick={() => void save()}>
        Mentés
      </Button>
    </Panel>
  );
}

interface CatalogDraft {
  name: string;
  category: string;
  unit: string;
  basePrice: string;
  vat: string;
}

const EMPTY_CATALOG_DRAFT: CatalogDraft = {
  name: "",
  category: "",
  unit: "db",
  basePrice: "0",
  vat: "27",
};

const parseDecimal = (value: string) => Number(value.trim().replace(/\s/g, "").replace(",", "."));

function checkCatalogDraft(
  draft: CatalogDraft,
): { ok: true; basePrice: number; vat: number } | { ok: false; error: string } {
  if (!draft.name.trim() || !draft.category.trim()) {
    return { ok: false, error: "Adjon meg nevet és kategóriát." };
  }
  const basePrice = parseDecimal(draft.basePrice);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return { ok: false, error: "Az ár nem lehet negatív, és számnak kell lennie." };
  }
  const vat = parseDecimal(draft.vat);
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    return { ok: false, error: "Az ÁFA 0 és 100 közötti szám legyen." };
  }
  return { ok: true, basePrice, vat };
}

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof FieldQuoteApiError ? e.message : fallback;

// Loads a list and keeps "still loading" and "failed to load" apart from
// "genuinely empty" — otherwise a dropped session or a server error would show
// the same empty-state text as a catalog that really has no items.
function useRemoteList<T>(fetcher: () => Promise<{ items: T[] }>) {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const reload = useCallback(async () => {
    try {
      const result = await fetcher();
      setItems(result.items);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [fetcher]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { items, state, reload };
}

function ListStatus({
  state,
  empty,
  onRetry,
}: {
  state: "loading" | "ready" | "error";
  empty: string | null;
  onRetry: () => void;
}) {
  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Betöltés...</p>;
  }
  if (state === "error") {
    return (
      <p className="text-sm text-destructive">
        A lista betöltése nem sikerült.{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Újrapróbálás
        </button>
      </p>
    );
  }
  return empty ? <EmptyState text={empty} /> : null;
}

function CatalogSettings() {
  const { items, state, reload } = useRemoteList(fieldQuoteApi.catalogList);
  const [draft, setDraft] = useState<CatalogDraft>(EMPTY_CATALOG_DRAFT);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CatalogDraft>(EMPTY_CATALOG_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const add = async () => {
    const checked = checkCatalogDraft(draft);
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    setAdding(true);
    try {
      await fieldQuoteApi.catalogSave({
        name: draft.name.trim(),
        category: draft.category.trim(),
        unit: draft.unit,
        basePrice: checked.basePrice,
        vat: checked.vat,
        active: true,
        sortOrder: items.length,
      });
      setDraft(EMPTY_CATALOG_DRAFT);
      await reload();
      toast.success("Tétel hozzáadva a katalógushoz.");
    } catch (e) {
      toast.error(errorMessage(e, "A mentés nem sikerült."));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditDraft({
      name: item.name,
      category: item.category,
      unit: item.unit,
      basePrice: String(item.basePrice),
      vat: String(item.vat),
    });
  };

  const saveEdit = async (item: CatalogItem) => {
    const checked = checkCatalogDraft(editDraft);
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    setSavingEdit(true);
    try {
      // The whole item goes back with its id: the server updates that row, and
      // quotes written from now on pick up the new price (quotes already saved
      // keep the price they were written with).
      await fieldQuoteApi.catalogSave({
        ...item,
        name: editDraft.name.trim(),
        category: editDraft.category.trim(),
        unit: editDraft.unit,
        basePrice: checked.basePrice,
        vat: checked.vat,
      });
      setEditingId(null);
      await reload();
      toast.success("Tétel módosítva.");
    } catch (e) {
      toast.error(errorMessage(e, "A módosítás nem sikerült."));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (item: CatalogItem) => {
    try {
      await fieldQuoteApi.catalogSave({ ...item, active: !item.active });
      await reload();
    } catch (e) {
      toast.error(errorMessage(e, "A módosítás nem sikerült."));
    }
  };

  const remove = async (item: CatalogItem) => {
    if (
      !window.confirm(
        `Biztosan törli a(z) „${item.name}” tételt? A csomagokból is kikerül; a már elkészült ajánlatok nem változnak. Ha csak nem akarja használni, inkább tiltsa le.`,
      )
    ) {
      return;
    }
    try {
      await fieldQuoteApi.catalogDelete(item.id);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e, "A törlés nem sikerült."));
    }
  };

  const unitOptions = (current: string) =>
    CATALOG_UNITS.includes(current as (typeof CATALOG_UNITS)[number])
      ? CATALOG_UNITS
      : [current, ...CATALOG_UNITS];

  return (
    <Panel
      title="Tételkatalógus"
      description="Ezekből lehet gyorsan tételt felvenni egy helyszíni ajánlatba."
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-7">
        <Input
          placeholder="Megnevezés"
          aria-label="Új tétel megnevezése"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="sm:col-span-2"
        />
        <Input
          placeholder="Kategória"
          aria-label="Új tétel kategóriája"
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
        />
        <NativeSelect value={draft.unit} onChange={(v) => setDraft((d) => ({ ...d, unit: v }))}>
          {CATALOG_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </NativeSelect>
        <Input
          placeholder="Ár (Ft)"
          aria-label="Új tétel nettó egységára"
          inputMode="decimal"
          value={draft.basePrice}
          onChange={(e) => setDraft((d) => ({ ...d, basePrice: e.target.value }))}
        />
        <Input
          placeholder="ÁFA %"
          aria-label="Új tétel ÁFA-kulcsa"
          inputMode="decimal"
          value={draft.vat}
          onChange={(e) => setDraft((d) => ({ ...d, vat: e.target.value }))}
        />
        <Button type="button" disabled={adding} onClick={() => void add()}>
          <Plus className="h-4 w-4" /> Hozzáadás
        </Button>
      </div>

      <ListStatus
        state={state}
        empty={items.length === 0 ? "Még nincs katalógustétel." : null}
        onRetry={() => void reload()}
      />
      {state === "ready" && items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item) =>
            editingId === item.id ? (
              <div
                key={item.id}
                className="grid gap-2 rounded-[var(--radius-button)] border border-accent/50 bg-accent/5 p-3 sm:grid-cols-7"
              >
                <Input
                  aria-label="Megnevezés"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  className="sm:col-span-2"
                />
                <Input
                  aria-label="Kategória"
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                />
                <NativeSelect
                  value={editDraft.unit}
                  onChange={(v) => setEditDraft((d) => ({ ...d, unit: v }))}
                >
                  {unitOptions(editDraft.unit).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  aria-label="Nettó egységár (Ft)"
                  inputMode="decimal"
                  value={editDraft.basePrice}
                  onChange={(e) => setEditDraft((d) => ({ ...d, basePrice: e.target.value }))}
                />
                <Input
                  aria-label="ÁFA %"
                  inputMode="decimal"
                  value={editDraft.vat}
                  onChange={(e) => setEditDraft((d) => ({ ...d, vat: e.target.value }))}
                />
                <div className="flex gap-2 sm:col-span-7 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingEdit}
                    onClick={() => void saveEdit(item)}
                  >
                    <Check className="h-4 w-4" /> Mentés
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={savingEdit}
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" /> Mégse
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p
                    className={`font-medium ${!item.active ? "text-muted-foreground line-through" : ""}`}
                  >
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.category} · {huf(item.basePrice)} / {item.unit} · ÁFA {item.vat}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(item)}
                    aria-label={`${item.name} szerkesztése`}
                  >
                    <Pencil className="h-4 w-4" /> Szerkesztés
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleActive(item)}
                  >
                    {item.active ? "Letiltás" : "Aktiválás"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    aria-label={`${item.name} törlése`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}
    </Panel>
  );
}

function PackageSettings() {
  const {
    items: packages,
    state,
    reload,
  } = useRemoteList<QuotePackage>(fieldQuoteApi.packagesList);
  const { items: catalog } = useRemoteList<CatalogItem>(fieldQuoteApi.catalogList);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const toggleItem = (id: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 1;
      return next;
    });

  const create = async () => {
    const items = Object.entries(selected).map(([catalogItemId, defaultQty], sortOrder) => ({
      catalogItemId,
      defaultQty,
      sortOrder,
    }));
    if (!name.trim() || items.length === 0) {
      toast.error("Adjon nevet a csomagnak és válasszon legalább egy tételt.");
      return;
    }
    setSaving(true);
    try {
      await fieldQuoteApi.packageSave({
        name: name.trim(),
        active: true,
        sortOrder: packages.length,
        items,
      });
      setName("");
      setSelected({});
      await reload();
      toast.success("Csomag létrehozva.");
    } catch (e) {
      toast.error(errorMessage(e, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Csomagok"
      description="Gyakori tételcsoportok egy kattintással hozzáadhatók egy ajánlathoz."
    >
      <div className="mb-4 space-y-2 rounded-[var(--radius-button)] border border-border p-3">
        <Input
          placeholder="Csomag neve, pl. Teljes tetőcsere – cserépfedés"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {catalog.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                item.id in selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" disabled={saving} onClick={() => void create()}>
          <Plus className="h-4 w-4" /> Csomag mentése
        </Button>
      </div>

      <ListStatus
        state={state}
        empty={packages.length === 0 ? "Még nincs csomag." : null}
        onRetry={() => void reload()}
      />
      {state === "ready" && packages.length > 0 ? (
        <div className="space-y-1.5">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{pkg.name}</p>
                <p className="text-xs text-muted-foreground">{pkg.items.length} tétel</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Biztosan törli a(z) „${pkg.name}” csomagot?`)) return;
                  try {
                    await fieldQuoteApi.packageDelete(pkg.id);
                    await reload();
                  } catch (e) {
                    toast.error(errorMessage(e, "A törlés nem sikerült."));
                  }
                }}
                aria-label={`${pkg.name} törlése`}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function TemplateSettings() {
  const {
    items: templates,
    state,
    reload,
  } = useRemoteList<PaymentTemplate>(fieldQuoteApi.templatesList);
  const [draft, setDraft] = useState({ name: "", body: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast.error("Adjon nevet és szöveget a sablonnak.");
      return;
    }
    setSaving(true);
    try {
      await fieldQuoteApi.templateSave({
        name: draft.name.trim(),
        body: draft.body.trim(),
        isDefault: templates.length === 0,
        sortOrder: templates.length,
      });
      setDraft({ name: "", body: "" });
      await reload();
      toast.success("Fizetési sablon mentve.");
    } catch (e) {
      toast.error(errorMessage(e, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Fizetési sablonok"
      description="Gyakori fizetési feltételek, amik egy kattintással beilleszthetők."
    >
      <div className="mb-4 space-y-2 rounded-[var(--radius-button)] border border-border p-3">
        <Input
          placeholder="Sablon neve, pl. Előleg + végösszeg"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <Textarea
          rows={2}
          placeholder="Pl. 50% előleg a munkakezdéskor, 50% a műszaki átadáskor."
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        />
        <Button type="button" size="sm" disabled={saving} onClick={() => void add()}>
          <Plus className="h-4 w-4" /> Sablon mentése
        </Button>
      </div>

      <ListStatus
        state={state}
        empty={templates.length === 0 ? "Még nincs fizetési sablon." : null}
        onRetry={() => void reload()}
      />
      {state === "ready" && templates.length > 0 ? (
        <div className="space-y-1.5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-[var(--radius-button)] border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t.name}
                  {t.isDefault ? (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-normal text-accent">
                      alapértelmezett
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{t.body}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Biztosan törli a(z) „${t.name}” sablont?`)) return;
                  try {
                    await fieldQuoteApi.templateDelete(t.id);
                    await reload();
                  } catch (e) {
                    toast.error(errorMessage(e, "A törlés nem sikerült."));
                  }
                }}
                aria-label={`${t.name} törlése`}
              >
                <Trash2 className="h-4 w-4 shrink-0 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
