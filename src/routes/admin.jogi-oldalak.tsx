import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage, AdminField, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-react";
import { useDemo } from "@/demo/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/jogi-oldalak")({
  component: LegalAdmin,
});

function LegalAdmin() {
  const { legal, updateLegal } = useDemo();
  const [activeId, setActiveId] = useState(legal[0]?.id ?? "");
  const doc = legal.find((d) => d.id === activeId) ?? legal[0];

  return (
    <AdminPage
      title="Jogi oldalak"
      intro="Impresszum, adatkezelési tájékoztató és további jogi dokumentumok verziószámmal és hatálybalépési dátummal. A tartalom bemutató célú mintaszöveg."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Panel title="Dokumentumok">
          <ul className="space-y-2">
            {legal.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setActiveId(d.id)}
                  className={`w-full rounded-[var(--radius-button)] border p-3 text-left transition-colors ${
                    doc?.id === d.id ? "border-accent bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <p className="text-sm font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    v{d.version} · {d.effectiveFrom} · {d.published ? "publikált" : "piszkozat"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {doc ? (
          <Panel
            title={doc.title}
            description={`/jogi/${doc.slug}`}
            actions={
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/jogi/$slug" params={{ slug: doc.slug }} target="_blank">
                    <ExternalLink /> Megnyitás
                  </Link>
                </Button>
                <Button size="sm" variant="copper" onClick={() => toast.success("Dokumentum mentve.")}>
                  Mentés
                </Button>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Cím">
                <Input value={doc.title} onChange={(e) => updateLegal(doc.id, { title: e.target.value })} />
              </AdminField>
              <AdminField label="URL-részlet (slug)">
                <Input value={doc.slug} onChange={(e) => updateLegal(doc.id, { slug: e.target.value })} />
              </AdminField>
              <AdminField label="Verzió">
                <Input value={doc.version} onChange={(e) => updateLegal(doc.id, { version: e.target.value })} />
              </AdminField>
              <AdminField label="Hatályos ettől">
                <Input
                  type="date"
                  value={doc.effectiveFrom}
                  onChange={(e) => updateLegal(doc.id, { effectiveFrom: e.target.value })}
                />
              </AdminField>
              <AdminField label="Szöveg" hint="Az üres sorok új bekezdést jelentenek." className="sm:col-span-2">
                <Textarea
                  rows={16}
                  value={doc.body}
                  onChange={(e) => updateLegal(doc.id, { body: e.target.value })}
                />
              </AdminField>
              <AdminField label="Publikálás">
                <div className="flex h-10 items-center gap-3">
                  <Switch
                    checked={doc.published}
                    onCheckedChange={(v) => updateLegal(doc.id, { published: v })}
                  />
                  <span className="text-sm">{doc.published ? "Publikált" : "Piszkozat"}</span>
                </div>
              </AdminField>
            </div>
          </Panel>
        ) : null}
      </div>
    </AdminPage>
  );
}
