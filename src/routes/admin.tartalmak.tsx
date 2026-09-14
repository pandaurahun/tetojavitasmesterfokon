import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, LoaderCircle, RotateCcw } from "lucide-react";
import { AdminPage, AdminField, NativeSelect, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cmsDefinitions, defaultCmsSections } from "@/demo/cms";
import { useDemo } from "@/demo/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tartalmak")({ component: ContentAdmin });

function ContentAdmin() {
  const { cms, update, updateCmsSection, updateCmsValue, uploadMedia, syncError } = useDemo();
  const pages = useMemo(() => Array.from(new Set(cmsDefinitions.map((entry) => entry.page))), []);
  const [page, setPage] = useState("Főoldal");
  const [uploading, setUploading] = useState<string | null>(null);
  const definitions = cmsDefinitions.filter((entry) => entry.page === page);
  const sections = definitions
    .map((definition) => ({ definition, state: cms.find((entry) => entry.id === definition.id) }))
    .filter((entry) => entry.state)
    .sort((a, b) => a.state!.order - b.state!.order);

  const moveSection = (id: string, direction: -1 | 1) => {
    const currentIndex = sections.findIndex((entry) => entry.state!.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sections.length) return;
    const current = sections[currentIndex]!.state!;
    const target = sections[targetIndex]!.state!;
    update({
      cms: cms.map((entry) =>
        entry.id === current.id
          ? { ...entry, order: target.order }
          : entry.id === target.id
            ? { ...entry, order: current.order }
            : entry,
      ),
    });
  };

  const uploadImage = async (sectionId: string, fieldKey: string, file?: File) => {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]).has(file.type)) {
      toast.error("Csak JPEG, PNG, WebP vagy AVIF kép tölthető fel.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A kép legfeljebb 10 MB lehet.");
      return;
    }
    const uploadKey = `${sectionId}:${fieldKey}`;
    setUploading(uploadKey);
    try {
      updateCmsValue(sectionId, fieldKey, await uploadMedia(file));
      toast.success("A kép feltöltve és beállítva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A képfeltöltés nem sikerült.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <AdminPage
      title="Tartalomkezelő"
      intro="A publikus oldalak szövegei, gombfeliratai, képei, szekciósorrendje és láthatósága. A módosítások automatikusan mentődnek."
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            update({ cms: structuredClone(defaultCmsSections) });
            toast.success("A teljes publikus tartalom visszaállítva.");
          }}
        >
          <RotateCcw /> Alapértékek
        </Button>
      }
    >
      {syncError ? (
        <p className="rounded-[var(--radius-button)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {syncError}
        </p>
      ) : null}

      <Panel title="Szerkesztendő oldal">
        <NativeSelect value={page} onChange={setPage} className="max-w-md">
          {pages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </Panel>

      <div className="grid gap-4">
        {sections.map(({ definition, state }, index) => {
          if (!state) return null;
          return (
            <Panel
              key={state.id}
              title={state.name}
              description={state.visible ? "Megjelenik a weboldalon" : "Jelenleg elrejtve"}
              actions={
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Szekció előrébb mozgatása"
                    disabled={index === 0}
                    onClick={() => moveSection(state.id, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Szekció hátrébb mozgatása"
                    disabled={index === sections.length - 1}
                    onClick={() => moveSection(state.id, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="sm"
                    variant={state.visible ? "ghost" : "outline"}
                    onClick={() => updateCmsSection(state.id, { visible: !state.visible })}
                  >
                    {state.visible ? <EyeOff /> : <Eye />}
                    {state.visible ? "Elrejtés" : "Megjelenítés"}
                  </Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                {definition.fields.map((field) => {
                  const value = state.values[field.key] ?? field.defaultValue;
                  const uploadKey = `${state.id}:${field.key}`;
                  if (field.type === "image") {
                    return (
                      <AdminField key={field.key} label={field.label} className="md:col-span-2">
                        <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-start">
                          {value ? (
                            <img
                              src={value}
                              alt="CMS kép előnézete"
                              className="aspect-[16/10] w-full rounded-[var(--radius-button)] border border-border object-cover"
                            />
                          ) : (
                            <div className="grid aspect-[16/10] place-items-center rounded-[var(--radius-button)] border border-dashed border-border bg-muted">
                              <ImagePlus className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Input
                              value={value}
                              onChange={(event) =>
                                updateCmsValue(state.id, field.key, event.target.value)
                              }
                              placeholder="Kép URL-címe"
                            />
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
                              {uploading === uploadKey ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImagePlus className="h-4 w-4" />
                              )}
                              {uploading === uploadKey ? "Feltöltés…" : "Új kép feltöltése"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                className="sr-only"
                                disabled={uploading !== null}
                                onChange={(event) => {
                                  void uploadImage(state.id, field.key, event.target.files?.[0]);
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </AdminField>
                    );
                  }
                  return (
                    <AdminField
                      key={field.key}
                      label={field.label}
                      className={field.type === "longtext" ? "md:col-span-2" : ""}
                    >
                      {field.type === "longtext" ? (
                        <Textarea
                          rows={3}
                          value={value}
                          onChange={(event) =>
                            updateCmsValue(state.id, field.key, event.target.value)
                          }
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(event) =>
                            updateCmsValue(state.id, field.key, event.target.value)
                          }
                        />
                      )}
                    </AdminField>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
                <span className="text-xs font-semibold text-muted-foreground">Szekció látható</span>
                <Switch
                  checked={state.visible}
                  onCheckedChange={(visible) => updateCmsSection(state.id, { visible })}
                />
              </div>
            </Panel>
          );
        })}
      </div>
    </AdminPage>
  );
}
