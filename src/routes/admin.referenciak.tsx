import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { AdminPage, AdminField, EmptyState, Panel } from "@/components/admin/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { newId, useDemo } from "@/demo/store";
import type { ProjectRef } from "@/demo/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/referenciak")({ component: ProjectsAdmin });

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function ImageDropZone({
  id,
  label,
  multiple = false,
  disabled = false,
  onFiles,
}: {
  id: string;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const acceptFiles = (files: FileList | null) => {
    if (files?.length) onFiles(Array.from(files));
  };

  return (
    <div
      className="rounded-[var(--radius-button)] border border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:border-accent"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) acceptFiles(event.dataTransfer.files);
      }}
    >
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          acceptFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex cursor-pointer items-center gap-2 text-sm font-semibold ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {disabled ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {label}
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Húzd ide vagy válaszd ki · max. 10 MB/kép
      </p>
    </div>
  );
}

function ProjectsAdmin() {
  const { projects, services, upsertProject, removeProject, moveProject, uploadMedia, syncError } =
    useDemo();
  const [editing, setEditing] = useState<ProjectRef | null>(null);
  const [uploading, setUploading] = useState<"before" | "after" | "gallery" | null>(null);

  const startNew = () =>
    setEditing({
      id: newId("prj"),
      title: "",
      location: "",
      services: [],
      problem: "",
      works: [],
      duration: "",
      beforeImage: "",
      afterImage: "",
      gallery: [],
      featured: false,
      published: false,
    });

  const validFiles = (files: File[]) => {
    const accepted = files.filter(
      (file) => IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_SIZE,
    );
    if (accepted.length !== files.length) {
      toast.error("Csak legfeljebb 10 MB-os JPEG, PNG, WebP vagy AVIF kép tölthető fel.");
    }
    return accepted;
  };

  const uploadSingle = async (files: File[], slot: "before" | "after") => {
    const file = validFiles(files)[0];
    if (!file || !editing) return;
    setUploading(slot);
    try {
      const url = await uploadMedia(file);
      const key = slot === "before" ? "beforeImage" : "afterImage";
      setEditing((current) => (current ? { ...current, [key]: url } : current));
      toast.success("Kép feltöltve.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A képfeltöltés nem sikerült.");
    } finally {
      setUploading(null);
    }
  };

  const uploadGallery = async (files: File[]) => {
    const accepted = validFiles(files);
    if (!accepted.length || !editing) return;
    if (editing.gallery.length + accepted.length > 100) {
      toast.error("Egy referenciához legfeljebb 100 galériakép tartozhat.");
      return;
    }
    setUploading("gallery");
    try {
      const urls: string[] = [];
      for (const file of accepted) urls.push(await uploadMedia(file));
      setEditing((current) =>
        current ? { ...current, gallery: [...current.gallery, ...urls] } : current,
      );
      toast.success(`${urls.length} galériakép feltöltve.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A képfeltöltés nem sikerült.");
    } finally {
      setUploading(null);
    }
  };

  const moveGalleryImage = (index: number, direction: -1 | 1) => {
    setEditing((current) => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.gallery.length) return current;
      const gallery = [...current.gallery];
      [gallery[index], gallery[target]] = [gallery[target]!, gallery[index]!];
      return { ...current, gallery };
    });
  };

  const saveProject = () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.location.trim()) {
      toast.error("A cím és a helyszín megadása kötelező.");
      return;
    }
    if (editing.published && (!editing.beforeImage || !editing.afterImage)) {
      toast.error("Publikáláshoz előtte- és utána-kép is szükséges.");
      return;
    }
    upsertProject({
      ...editing,
      title: editing.title.trim(),
      location: editing.location.trim(),
      problem: editing.problem.trim(),
      duration: editing.duration.trim(),
      works: editing.works.map((work) => work.trim()).filter(Boolean),
    });
    setEditing(null);
    toast.success("Referencia mentve az adatbázisba.");
  };

  return (
    <AdminPage
      title="Referenciák"
      intro="Tölts fel valódi előtte–utána képeket, rendezd a galériát, és csak a kész esettanulmányokat publikáld."
      actions={
        <Button size="sm" variant="ink" onClick={startNew} disabled={uploading !== null}>
          <Plus /> Új referencia
        </Button>
      }
    >
      {syncError ? (
        <p className="rounded-[var(--radius-button)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {syncError}
        </p>
      ) : null}

      {editing ? (
        <Panel
          title={editing.title || "Új referencia"}
          description={
            editing.published ? "Publikált esettanulmány" : "Még nem látható a weboldalon"
          }
          actions={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="copper"
                onClick={saveProject}
                disabled={uploading !== null}
              >
                Mentés
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={uploading !== null}
              >
                Mégsem
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Cím">
              <Input
                value={editing.title}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                placeholder="Például: Családi ház teljes tetőfelújítása"
              />
            </AdminField>
            <AdminField label="Helyszín">
              <Input
                value={editing.location}
                onChange={(event) => setEditing({ ...editing, location: event.target.value })}
                placeholder="Például: Szolnok térsége"
              />
            </AdminField>
            <AdminField label="Kivitelezési idő">
              <Input
                value={editing.duration}
                onChange={(event) => setEditing({ ...editing, duration: event.target.value })}
                placeholder="Például: 8 munkanap"
              />
            </AdminField>
            <AdminField label="Kapcsolódó szolgáltatások" hint="Kattintással kapcsolható.">
              <div className="flex flex-wrap gap-1.5 py-1">
                {services.map((service) => {
                  const selected = editing.services.includes(service.title);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          services: selected
                            ? editing.services.filter((title) => title !== service.title)
                            : [...editing.services, service.title],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        selected
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {service.title}
                    </button>
                  );
                })}
              </div>
            </AdminField>
            <AdminField label="Kiindulási állapot / probléma" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={editing.problem}
                onChange={(event) => setEditing({ ...editing, problem: event.target.value })}
              />
            </AdminField>
            <AdminField
              label="Elvégzett munkák"
              hint="Soronként egy munkafázis."
              className="sm:col-span-2"
            >
              <Textarea
                rows={5}
                value={editing.works.join("\n")}
                onChange={(event) =>
                  setEditing({ ...editing, works: event.target.value.split("\n") })
                }
              />
            </AdminField>

            <AdminField label="Előtte-kép">
              <div className="space-y-3">
                {editing.beforeImage ? (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border">
                    <img
                      src={editing.beforeImage}
                      alt="Előtte-kép előnézete"
                      className="aspect-[16/10] w-full object-cover"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      aria-label="Előtte-kép eltávolítása"
                      className="absolute top-2 right-2"
                      onClick={() => setEditing({ ...editing, beforeImage: "" })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
                <ImageDropZone
                  id={`before-${editing.id}`}
                  label={editing.beforeImage ? "Előtte-kép cseréje" : "Előtte-kép feltöltése"}
                  disabled={uploading !== null}
                  onFiles={(files) => void uploadSingle(files, "before")}
                />
              </div>
            </AdminField>

            <AdminField label="Utána-kép">
              <div className="space-y-3">
                {editing.afterImage ? (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border">
                    <img
                      src={editing.afterImage}
                      alt="Utána-kép előnézete"
                      className="aspect-[16/10] w-full object-cover"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      aria-label="Utána-kép eltávolítása"
                      className="absolute top-2 right-2"
                      onClick={() => setEditing({ ...editing, afterImage: "" })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
                <ImageDropZone
                  id={`after-${editing.id}`}
                  label={editing.afterImage ? "Utána-kép cseréje" : "Utána-kép feltöltése"}
                  disabled={uploading !== null}
                  onFiles={(files) => void uploadSingle(files, "after")}
                />
              </div>
            </AdminField>

            <AdminField
              label={`Projektgaléria (${editing.gallery.length} kép)`}
              hint="A nyilakkal állítható a publikus megjelenési sorrend."
              className="sm:col-span-2"
            >
              <div className="space-y-3">
                {editing.gallery.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {editing.gallery.map((image, index) => (
                      <li
                        key={`${image}-${index}`}
                        className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/20"
                      >
                        <img
                          src={image}
                          alt={`Galériakép ${index + 1}`}
                          className="aspect-[16/10] w-full object-cover"
                        />
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="text-xs font-semibold">{index + 1}. kép</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Kép előrébb mozgatása"
                              disabled={index === 0}
                              onClick={() => moveGalleryImage(index, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Kép hátrébb mozgatása"
                              disabled={index === editing.gallery.length - 1}
                              onClick={() => moveGalleryImage(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Galériakép eltávolítása"
                              onClick={() =>
                                setEditing({
                                  ...editing,
                                  gallery: editing.gallery.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState text="Még nincs galériakép." />
                )}
                <ImageDropZone
                  id={`gallery-${editing.id}`}
                  label="Galériaképek hozzáadása"
                  multiple
                  disabled={uploading !== null}
                  onFiles={(files) => void uploadGallery(files)}
                />
              </div>
            </AdminField>

            <AdminField label="Kiemelt a főoldalon">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={editing.featured}
                  onCheckedChange={(featured) => setEditing({ ...editing, featured })}
                />
                <span className="text-sm">{editing.featured ? "Kiemelt" : "Normál"}</span>
              </div>
            </AdminField>
            <AdminField label="Publikálás">
              <div className="flex h-10 items-center gap-3">
                <Switch
                  checked={editing.published}
                  onCheckedChange={(published) => setEditing({ ...editing, published })}
                />
                <span className="text-sm">{editing.published ? "Publikált" : "Piszkozat"}</span>
              </div>
            </AdminField>
          </div>
        </Panel>
      ) : null}

      <Panel
        title={`${projects.length} referencia`}
        description="A lista sorrendje megegyezik a publikus referenciaoldal sorrendjével."
      >
        {projects.length === 0 ? (
          <EmptyState text="Még nincs referencia." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project, index) => (
              <li
                key={project.id}
                className="overflow-hidden rounded-[var(--radius-card)] border border-border"
              >
                {project.afterImage ? (
                  <img
                    src={project.afterImage}
                    alt={project.title}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-muted text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                )}
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {project.title || "Névtelen referencia"}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        project.published
                          ? "bg-forest text-forest-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {project.published ? "Publikált" : "Piszkozat"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {project.location || "Nincs helyszín"} · {project.duration || "—"} ·{" "}
                    {project.gallery.length} galériakép
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(structuredClone(project))}
                    >
                      <Pencil /> Szerkesztés
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/admin/marketing" search={{ projectId: project.id }}>
                        <Sparkles /> Social poszt
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Referencia előrébb mozgatása"
                      disabled={index === 0}
                      onClick={() => moveProject(project.id, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Referencia hátrébb mozgatása"
                      disabled={index === projects.length - 1}
                      onClick={() => moveProject(project.id, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      size="sm"
                      variant={project.featured ? "copper" : "ghost"}
                      onClick={() => upsertProject({ ...project, featured: !project.featured })}
                    >
                      <Star /> {project.featured ? "Kiemelve" : "Kiemelés"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!project.published && (!project.beforeImage || !project.afterImage)) {
                          toast.error("Publikáláshoz előtte- és utána-kép is szükséges.");
                          return;
                        }
                        upsertProject({ ...project, published: !project.published });
                        toast.success(
                          project.published ? "Referencia elrejtve." : "Referencia publikálva.",
                        );
                      }}
                    >
                      {project.published ? "Elrejtés" : "Publikálás"}
                    </Button>
                    {project.published ? (
                      <Button asChild size="icon" variant="ghost">
                        <Link
                          to="/referenciak/$id"
                          params={{ id: project.id }}
                          target="_blank"
                          aria-label="Publikus referencia megnyitása"
                        >
                          <ExternalLink />
                        </Link>
                      </Button>
                    ) : null}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Referencia törlése">
                          <Trash2 className="text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Biztosan törlöd ezt a referenciát?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A „{project.title}” projekt eltűnik az adminból és a nyilvános oldalról
                            is.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Mégsem</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              removeProject(project.id);
                              if (editing?.id === project.id) setEditing(null);
                              toast.success("Referencia törölve.");
                            }}
                          >
                            Törlés
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminPage>
  );
}
