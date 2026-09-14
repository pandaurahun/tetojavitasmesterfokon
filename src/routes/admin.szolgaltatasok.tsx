import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage, AdminField, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useDemo, newId } from "@/demo/store";
import type { ServiceItem } from "@/demo/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/szolgaltatasok")({
  component: ServicesAdmin,
});

const emptyService = (order: number): ServiceItem => ({
  id: newId("svc"),
  slug: `uj-szolgaltatas-${order}`,
  title: "Új szolgáltatás",
  category: "Kivitelezés",
  icon: "Wrench",
  short: "",
  long: "",
  cta: "Ehhez kérek ajánlatot",
  active: true,
  order,
});

function ServicesAdmin() {
  const { services, upsertService } = useDemo();
  const sorted = [...services].sort((a, b) => a.order - b.order);
  const [editing, setEditing] = useState<ServiceItem | null>(null);

  const move = (s: ServiceItem, dir: -1 | 1) => {
    const idx = sorted.findIndex((x) => x.id === s.id);
    const other = sorted[idx + dir];
    if (!other) return;
    upsertService({ ...s, order: other.order });
    upsertService({ ...other, order: s.order });
  };

  return (
    <AdminPage
      title="Szolgáltatások"
      intro="A módosítások azonnal megjelennek a publikus főoldal szolgáltatáslistájában és az ajánlatkérőben."
      actions={
        <Button size="sm" variant="ink" onClick={() => setEditing(emptyService(sorted.length + 1))}>
          <Plus /> Új szolgáltatás
        </Button>
      }
    >
      {editing ? (
        <Panel
          title="Szolgáltatás szerkesztése"
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="copper"
                onClick={() => {
                  upsertService(editing);
                  setEditing(null);
                  toast.success("Szolgáltatás mentve.");
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
            <AdminField label="Cím">
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </AdminField>
            <AdminField label="Kategória">
              <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            </AdminField>
            <AdminField label="URL-részlet (slug)">
              <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </AdminField>
            <AdminField label="Ikon neve">
              <Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
            </AdminField>
            <AdminField label="Rövid leírás" className="sm:col-span-2">
              <Textarea rows={2} value={editing.short} onChange={(e) => setEditing({ ...editing, short: e.target.value })} />
            </AdminField>
            <AdminField label="Hosszú leírás" className="sm:col-span-2">
              <Textarea rows={4} value={editing.long} onChange={(e) => setEditing({ ...editing, long: e.target.value })} />
            </AdminField>
            <AdminField label="CTA felirat">
              <Input value={editing.cta} onChange={(e) => setEditing({ ...editing, cta: e.target.value })} />
            </AdminField>
            <AdminField label="Megjelenítés">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <span className="text-sm">{editing.active ? "Aktív" : "Elrejtve"}</span>
              </div>
            </AdminField>
          </div>
        </Panel>
      ) : null}

      <Panel title={`${services.length} szolgáltatás`}>
        <ul className="space-y-2">
          {sorted.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-button)] border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.category} • {s.active ? "aktív" : "elrejtve"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.active}
                  aria-label={`${s.title} aktiválása`}
                  onCheckedChange={(v) => upsertService({ ...s, active: v })}
                />
                <button
                  aria-label="Feljebb"
                  disabled={i === 0}
                  onClick={() => move(s, -1)}
                  className="rounded-md p-2 hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  aria-label="Lejjebb"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(s, 1)}
                  className="rounded-md p-2 hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                  Szerkesztés
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </AdminPage>
  );
}
