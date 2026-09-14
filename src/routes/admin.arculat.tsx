import { createFileRoute } from "@tanstack/react-router";
import { AdminPage, AdminField, NativeSelect, Panel } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useCmsSection, useDemo, brandingStyle } from "@/demo/store";
import { brandPresets, defaultBranding } from "@/demo/data";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/arculat")({
  component: BrandingAdmin,
});

const fonts = ["Sora", "Space Grotesk", "Manrope", "Inter"];
const MAX_FAVICON_BYTES = 256 * 1024;
const FAVICON_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("A favicon fájl nem olvasható."));
    reader.readAsDataURL(file);
  });
}

function sanitizeSvg(source: string): string {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = documentNode.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
    throw new Error("A kiválasztott SVG nem érvényes.");
  }

  documentNode
    .querySelectorAll("script, foreignObject, iframe, object, embed")
    .forEach((element) => element.remove());
  documentNode.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "xlink:href") &&
          (value.startsWith("javascript:") || value.startsWith("data:text/html")))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return new XMLSerializer().serializeToString(root);
}

async function faviconDataUrl(file: File): Promise<string> {
  if (file.size > MAX_FAVICON_BYTES) {
    throw new Error("A favicon legfeljebb 256 KB lehet.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedByExtension = extension === "svg" || extension === "png" || extension === "ico";
  if (!FAVICON_TYPES.has(file.type) && !supportedByExtension) {
    throw new Error("SVG, PNG vagy ICO fájl választható.");
  }

  if (file.type === "image/svg+xml" || extension === "svg") {
    const sanitized = sanitizeSvg(await file.text());
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized)}`;
  }

  return readAsDataUrl(file);
}

function BrandingAdmin() {
  const { branding, setBranding, resetBranding, updateCmsValue } = useDemo();
  const { value } = useCmsSection("home.hero");

  const handleFavicon = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      setBranding({ faviconUrl: await faviconDataUrl(file) });
      toast.success("A böngészőikon frissült.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A favicon frissítése nem sikerült.");
    } finally {
      input.value = "";
    }
  };

  return (
    <AdminPage
      title="Arculat"
      intro="A változtatások valós időben érvényesülnek az előnézetben és a publikus oldalon is."
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetBranding();
            toast.success("Az arculat visszaállítva.");
          }}
        >
          Alapértelmezett arculat
        </Button>
      }
    >
      <Panel title="Előre beállított témák">
        <div className="flex flex-wrap gap-2">
          {brandPresets.map((p) => (
            <button
              key={p.name}
              onClick={() => setBranding(p.branding)}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <span className="flex gap-1">
                {[
                  p.branding.primary,
                  p.branding.secondary,
                  p.branding.accent,
                  p.branding.background,
                ].map((c) => (
                  <span
                    key={c}
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ background: c }}
                  />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Favicon / Böngészőikon">
        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="flex h-24 w-24 items-center justify-center rounded-[var(--radius-card)] border border-border bg-muted/40">
            <img
              src={branding.faviconUrl || defaultBranding.faviconUrl}
              alt="Aktuális favicon előnézete"
              className="h-16 w-16 object-contain"
            />
          </div>
          <div className="grid gap-3">
            <AdminField label="Favicon URL">
              <Input
                value={branding.faviconUrl}
                onChange={(event) => setBranding({ faviconUrl: event.target.value })}
                placeholder="/favicon.svg vagy https://…"
              />
            </AdminField>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                Új ikon kiválasztása
                <input
                  type="file"
                  accept=".svg,.png,.ico,image/svg+xml,image/png,image/x-icon,image/vnd.microsoft.icon"
                  className="sr-only"
                  onChange={handleFavicon}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setBranding({ faviconUrl: defaultBranding.faviconUrl });
                  toast.success("Az alapértelmezett böngészőikon visszaállt.");
                }}
              >
                Alapértelmezett visszaállítása
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              SVG, PNG vagy ICO, legfeljebb 256 KB. A módosítás mentés nélkül, azonnal megjelenik a
              böngészőfülön.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Színek és tipográfia">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["primary", "Elsődleges szín"],
                ["secondary", "Másodlagos szín"],
                ["accent", "Kiemelőszín"],
                ["background", "Háttérszín"],
              ] as const
            ).map(([key, label]) => (
              <AdminField key={key} label={label}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding[key]}
                    onChange={(e) => setBranding({ [key]: e.target.value })}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-surface"
                    aria-label={label}
                  />
                  <Input
                    value={branding[key]}
                    onChange={(e) => setBranding({ [key]: e.target.value })}
                  />
                </div>
              </AdminField>
            ))}
            <AdminField label="Címbetűtípus">
              <NativeSelect
                value={branding.headingFont}
                onChange={(v) => setBranding({ headingFont: v })}
              >
                {fonts.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField label="Törzsszöveg betűtípusa">
              <NativeSelect
                value={branding.bodyFont}
                onChange={(v) => setBranding({ bodyFont: v })}
              >
                {fonts.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </NativeSelect>
            </AdminField>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <SliderField
              label={`Gomb lekerekítés — ${branding.buttonRadius}px`}
              value={branding.buttonRadius}
              max={24}
              onChange={(v) => setBranding({ buttonRadius: v })}
            />
            <SliderField
              label={`Kártya lekerekítés — ${branding.cardRadius}px`}
              value={branding.cardRadius}
              max={36}
              onChange={(v) => setBranding({ cardRadius: v })}
            />
            <SliderField
              label={`Árnyék erőssége — ${branding.shadowStrength}`}
              value={branding.shadowStrength}
              max={2}
              step={0.1}
              onChange={(v) => setBranding({ shadowStrength: v })}
            />
            <SliderField
              label={`Szakaszok térköze — ${branding.sectionSpace}`}
              value={branding.sectionSpace}
              max={1.6}
              step={0.1}
              onChange={(v) => setBranding({ sectionSpace: v })}
            />
            <SliderField
              label={`Animáció intenzitása — ${branding.motion}`}
              value={branding.motion}
              max={2}
              step={0.1}
              onChange={(v) => setBranding({ motion: v })}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Szövegek">
            <div className="grid gap-3">
              <AdminField label="Logó szöveg">
                <Input
                  value={branding.logoText}
                  onChange={(e) => setBranding({ logoText: e.target.value })}
                />
              </AdminField>
              <AdminField label="Hero főcím">
                <Input
                  value={value("title", branding.heroTitle)}
                  onChange={(e) => updateCmsValue("home.hero", "title", e.target.value)}
                />
              </AdminField>
              <AdminField label="Hero alcím">
                <Textarea
                  rows={3}
                  value={value("description", branding.heroSubtitle)}
                  onChange={(e) => updateCmsValue("home.hero", "description", e.target.value)}
                />
              </AdminField>
              <AdminField label="Elsődleges CTA">
                <Input
                  value={value("primaryCta", branding.primaryCta)}
                  onChange={(e) => updateCmsValue("home.hero", "primaryCta", e.target.value)}
                />
              </AdminField>
              <AdminField label="Másodlagos CTA">
                <Input
                  value={value("secondaryCta", branding.secondaryCta)}
                  onChange={(e) => updateCmsValue("home.hero", "secondaryCta", e.target.value)}
                />
              </AdminField>
            </div>
          </Panel>

          <Panel title="Élő előnézet">
            <div
              style={brandingStyle(branding)}
              className="rounded-[var(--radius-card)] border border-border p-6"
            >
              <div
                className="bg-[var(--background)] p-5"
                style={{ borderRadius: "var(--radius-card)" }}
              >
                <p className="label-eyebrow" style={{ color: "var(--accent)" }}>
                  {branding.logoText}
                </p>
                <h3
                  className="mt-3 text-2xl font-semibold"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--primary)" }}
                >
                  {value("title", branding.heroTitle)}
                </h3>
                <p
                  className="mt-2 text-sm"
                  style={{ fontFamily: "var(--font-body)", color: "var(--slate-cool)" }}
                >
                  {value("description", branding.heroSubtitle)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderRadius: "var(--radius-button)",
                    }}
                  >
                    {value("primaryCta", branding.primaryCta)}
                  </span>
                  <span
                    className="px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-foreground)",
                      borderRadius: "var(--radius-button)",
                    }}
                  >
                    {value("secondaryCta", branding.secondaryCta)}
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}

function SliderField({
  label,
  value,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <AdminField label={label}>
      <Slider
        value={[value]}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </AdminField>
  );
}
