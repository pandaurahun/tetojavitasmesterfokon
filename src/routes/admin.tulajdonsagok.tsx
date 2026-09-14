import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminPage, AdminField, EmptyState, NativeSelect, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useDemo, newId } from "@/demo/store";
import type { CustomField, CustomFieldType } from "@/demo/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tulajdonsagok")({
  component: FieldsAdmin,
});

const fieldTypes: { value: CustomFieldType; label: string }[] = [
  { value: "rovid-szoveg", label: "Rövid szöveg" },
  { value: "hosszu-szoveg", label: "Hosszú szöveg" },
  { value: "szam", label: "Szám" },
  { value: "igen-nem", label: "Igen / nem" },
  { value: "valasztogomb", label: "Választógomb" },
  { value: "tobb-valasztas", label: "Több választás" },
  { value: "legordulo", label: "Legördülő lista" },
  { value: "datum", label: "Dátum" },
  { value: "fajl", label: "Fájl" },
  { value: "fotó", label: "Fotó" },
  { value: "terulet", label: "Terület (m²)" },
  { value: "mennyiseg", label: "Mennyiség" },
  { value: "mertekegyseg", label: "Mértékegység" },
];

const typeLabel = (t: string) => fieldTypes.find((f) => f.value === t)?.label ?? t;

const needsOptions = (t: CustomFieldType) =>
  t === "valasztogomb" || t === "tobb-valasztas" || t === "legordulo";

function FieldsAdmin() {
  const { services, fields, upsertField, removeField } = useDemo();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [editing, setEditing] = useState<CustomField | null>(null);

  const list = useMemo(
    () => fields.filter((f) => f.serviceId === serviceId).sort((a, b) => a.order - b.order),
    [fields, serviceId],
  );

  const move = (f: CustomField, dir: -1 | 1) => {
    const idx = list.findIndex((x) => x.id === f.id);
    const other = list[idx + dir];
    if (!other) return;
    upsertField({ ...f, order: other.order });
    upsertField({ ...other, order: f.order });
  };

  const startNew = () =>
    setEditing({
      id: newId("fld"),
      label: "Új kérdés",
      key: `uj_kerdes_${list.length + 1}`,
      type: "rovid-szoveg",
      description: "",
      required: false,
      publicVisible: true,
      options: [],
      order: list.length + 1,
      serviceId,
    });

  return (
    <AdminPage
      title="Tulajdonságkezelő"
      intro="Szolgáltatásonként állítható egyedi kérdések. A publikusan látható kérdések azonnal megjelennek az ajánlatkérő megfelelő lépésében."
      actions={
        <Button size="sm" variant="ink" onClick={startNew} disabled={!serviceId}>
          <Plus /> Új tulajdonság
        </Button>
      }
    >
      <Panel title="Szolgáltatás kiválasztása">
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Szolgáltatás">
            <NativeSelect
              value={serviceId}
              onChange={(v) => {
                setServiceId(v);
                setEditing(null);
              }}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Kérdések száma">
            <div className="flex h-10 items-center text-sm text-muted-foreground">
              {list.length} tulajdonság — ebből {list.filter((f) => f.publicVisible).length} publikus
            </div>
          </AdminField>
        </div>
      </Panel>

      {editing ? (
        <Panel
          title="Tulajdonság szerkesztése"
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="copper"
                onClick={() => {
                  upsertField(editing);
                  setEditing(null);
                  toast.success("Tulajdonság mentve.");
                }}
              >
                Mentés
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Mégsem
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Megjelenő címke">
              <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            </AdminField>
            <AdminField label="Azonosító kulcs" hint="Ezzel a kulccsal tároljuk a beérkező választ.">
              <Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} />
            </AdminField>
            <AdminField label="Típus">
              <NativeSelect
                value={editing.type}
                onChange={(v) => setEditing({ ...editing, type: v as CustomFieldType })}
              >
                {fieldTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField label="Sorrend">
              <Input
                type="number"
                value={editing.order}
                onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) || 1 })}
              />
            </AdminField>
            <AdminField label="Súgó szöveg" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </AdminField>
            {needsOptions(editing.type) ? (
              <AdminField
                label="Válaszlehetőségek"
                hint="Soronként egy lehetőség."
                className="sm:col-span-2"
              >
                <Textarea
                  rows={4}
                  value={editing.options.join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </AdminField>
            ) : null}
            <AdminField label="Kötelező kitöltés">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={editing.required}
                  onCheckedChange={(v) => setEditing({ ...editing, required: v })}
                />
                <span className="text-sm">{editing.required ? "Kötelező" : "Opcionális"}</span>
              </div>
            </AdminField>
            <AdminField label="Publikus ajánlatkérőben">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={editing.publicVisible}
                  onCheckedChange={(v) => setEditing({ ...editing, publicVisible: v })}
                />
                <span className="text-sm">{editing.publicVisible ? "Látható" : "Csak belső"}</span>
              </div>
            </AdminField>
          </div>
        </Panel>
      ) : null}

      <Panel title="Tulajdonságok">
        {list.length === 0 ? (
          <EmptyState text="Ehhez a szolgáltatáshoz még nincs egyedi kérdés." />
        ) : (
          <ul className="space-y-2">
            {list.map((f, i) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {f.label}
                    {f.required ? <span className="text-destructive"> *</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel(f.type)} · kulcs: {f.key} · {f.publicVisible ? "publikus" : "belső"}
                    {f.options.length ? ` · ${f.options.length} lehetőség` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="Feljebb" disabled={i === 0} onClick={() => move(f, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Lejjebb"
                    disabled={i === list.length - 1}
                    onClick={() => move(f, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(f)}>
                    <Pencil /> Szerkesztés
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Törlés"
                    onClick={() => {
                      removeField(f.id);
                      if (editing?.id === f.id) setEditing(null);
                      toast.success("Tulajdonság törölve.");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminPage>
  );
}
