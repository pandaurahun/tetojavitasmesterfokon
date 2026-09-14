import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminPage, AdminField, Panel, StatCard, NativeSelect } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/demo/store";
import { getTrackingStatus } from "@/lib/analytics";
import type { Lead, SocialPlatform } from "@/demo/types";
import { toast } from "sonner";
import { Copy, Sparkles, LoaderCircle, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/marketing")({
  validateSearch: (search: Record<string, unknown>): { projectId?: string } =>
    typeof search["projectId"] === "string" ? { projectId: search["projectId"] } : {},
  component: MarketingHub,
});

const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "messenger", label: "Messenger" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "whatsapp", label: "WhatsApp" },
];

function classifyChannel(lead: Lead): string {
  const attr = lead.attribution;
  if (attr?.gclid || attr?.medium === "cpc") return "Google Ads";
  if (attr?.fbclid || attr?.medium === "paid_social") return "Meta";
  if (lead.source === "ajanlas") return "Ajánlás";
  if (lead.source === "kereso" || attr?.medium === "organic") return "Organikus";
  return "Direkt / egyéb";
}

const FUNNEL_RANK: Record<string, number> = {
  uj: 0,
  "kapcsolatra-var": 0,
  megkeresve: 1,
  "felmeres-egyeztetve": 2,
  felmerve: 2,
  "ajanlat-keszul": 3,
  "ajanlat-elkuldve": 3,
  utankovetes: 3,
  elfogadva: 4,
  elutasitva: 3,
};

function copyText(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Vágólapra másolva."))
    .catch(() => toast.error("A másolás nem sikerült."));
}

interface SocialDraft {
  facebook: string;
  instagram: string;
  instagramCaption: string;
  googleBusinessProfile: string;
  ctaVariants: string[];
  hashtags: string[];
}

function MarketingHub() {
  const { leads, projects, settings, update } = useDemo();
  const { projectId: initialProjectId } = useSearch({ from: "/admin/marketing" });

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const channel = classifyChannel(lead);
      counts[channel] = (counts[channel] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const campaignCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const campaign = lead.attribution?.campaign;
      if (!campaign) continue;
      counts.set(campaign, (counts.get(campaign) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const attributionRows = useMemo(() => {
    const counts = new Map<string, { source: string; medium: string; campaign: string; count: number }>();
    for (const lead of leads) {
      const a = lead.attribution;
      if (!a) continue;
      const key = `${a.source ?? "—"}|${a.medium ?? "—"}|${a.campaign ?? "—"}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { source: a.source ?? "—", medium: a.medium ?? "—", campaign: a.campaign ?? "—", count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [leads]);

  const funnel = useMemo(() => {
    const rank = (l: Lead) => FUNNEL_RANK[l.status] ?? 0;
    const total = leads.length;
    const stages = [
      { label: "Lead", count: total },
      { label: "Megkeresve", count: leads.filter((l) => rank(l) >= 1).length },
      { label: "Felmérés", count: leads.filter((l) => rank(l) >= 2).length },
      { label: "Ajánlat", count: leads.filter((l) => rank(l) >= 3).length },
      { label: "Elfogadva", count: leads.filter((l) => l.status === "elfogadva").length },
    ];
    return stages.map((s, i) => ({
      ...s,
      rate: total === 0 ? 0 : Math.round((s.count / total) * 100),
      stepRate: i === 0 || stages[i - 1]!.count === 0 ? 100 : Math.round((s.count / stages[i - 1]!.count) * 100),
    }));
  }, [leads]);

  const tracking = getTrackingStatus();

  return (
    <AdminPage
      title="Marketing"
      intro="Valódi lead- és attribúciós adatokra épülő áttekintés, social beállítások és tartalom-asszisztens."
    >
      <Panel title="Áttekintés">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Összes lead" value={leads.length} />
          {Object.entries(channelCounts).map(([channel, count]) => (
            <StatCard key={channel} label={channel} value={count} />
          ))}
        </div>
        {campaignCounts.length ? (
          <div className="mt-4">
            <h4 className="label-eyebrow text-muted-foreground">Kampányonkénti bontás</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {campaignCounts.map(([campaign, count]) => (
                <li key={campaign} className="flex justify-between border-b border-border py-1">
                  <span>{campaign}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <Panel title="Funnel" description="Hány lead jutott el legalább az adott szakaszig.">
        <div className="space-y-2">
          {funnel.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">{stage.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent" style={{ width: `${stage.rate}%` }} />
              </div>
              <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                {stage.count} db · {stage.rate}%
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Kampány attribúció" description="utm_source / utm_medium / utm_campaign kombinációnként.">
        {attributionRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-2">Forrás</th>
                  <th className="p-2">Medium</th>
                  <th className="p-2">Kampány</th>
                  <th className="p-2">Lead</th>
                </tr>
              </thead>
              <tbody>
                {attributionRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-2">{row.source}</td>
                    <td className="p-2">{row.medium}</td>
                    <td className="p-2">{row.campaign}</td>
                    <td className="p-2 font-semibold">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Még nincs UTM/kattintás-attribúcióval érkezett lead.</p>
        )}
      </Panel>

      <SocialLinksPanel settings={settings} update={update} />

      <SocialContentAssistant projects={projects} initialProjectId={initialProjectId} />

      <UtmBuilderPanel />

      <Panel title="Tracking státusz">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <TrackingRow label="GA4" configured={tracking.ga4} />
          <TrackingRow label="Google Ads" configured={tracking.googleAds} />
          <TrackingRow label="Meta Pixel" configured={tracking.metaPixel} />
          <TrackingRow label="Search Console verification" configured={tracking.searchConsoleVerification} />
        </ul>
      </Panel>
    </AdminPage>
  );
}

function TrackingRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-[var(--radius-button)] border border-border px-3 py-2">
      <span>{label}</span>
      {configured ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-forest">
          <CheckCircle2 className="h-3.5 w-3.5" /> Konfigurálva
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" /> Nincs beállítva
        </span>
      )}
    </li>
  );
}

function SocialLinksPanel({
  settings,
  update,
}: {
  settings: ReturnType<typeof useDemo>["settings"];
  update: ReturnType<typeof useDemo>["update"];
}) {
  const links = settings.socialLinks ?? {};
  const set = (platform: SocialPlatform, value: string) =>
    update({ settings: { ...settings, socialLinks: { ...links, [platform]: value } } });

  return (
    <Panel
      title="Social média beállítások"
      description="Csak a kitöltött platformok jelennek meg a publikus oldalon."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <AdminField key={p.key} label={p.label}>
            <Input
              value={links[p.key] ?? ""}
              onChange={(e) => set(p.key, e.target.value)}
              placeholder={`https://...`}
            />
          </AdminField>
        ))}
      </div>
    </Panel>
  );
}

function SocialContentAssistant({
  projects,
  initialProjectId,
}: {
  projects: ReturnType<typeof useDemo>["projects"];
  initialProjectId?: string | undefined;
}) {
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SocialDraft | null>(null);

  const generate = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/admin/ai/social-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const payload = (await res.json().catch(() => ({}))) as SocialDraft & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "A generálás nem sikerült.");
      setDraft(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "A generálás nem sikerült.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialProjectId) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId]);

  return (
    <Panel
      title="Social Content Assistant"
      description="AI-vázlat egy referenciából — csak draft, nem publikál automatikusan."
    >
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Referencia" className="min-w-[220px]">
          <NativeSelect value={projectId} onChange={setProjectId}>
            <option value="">Válassz referenciát…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </AdminField>
        <Button size="sm" variant="copper" disabled={!projectId || loading} onClick={() => void generate()}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          Social poszt készítése
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <DraftField label="Facebook szöveg" value={draft.facebook} />
          <DraftField label="Instagram szöveg" value={draft.instagram} />
          <DraftField label="Instagram rövid caption" value={draft.instagramCaption} />
          <DraftField label="Google Business Profile poszt" value={draft.googleBusinessProfile} />
          <DraftField label="CTA javaslatok" value={draft.ctaVariants.join("\n")} />
          <DraftField label="Hashtagek" value={draft.hashtags.join(" ")} />
        </div>
      ) : null}
    </Panel>
  );
}

function DraftField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-button)] border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="label-eyebrow text-muted-foreground">{label}</span>
        <button
          onClick={() => copyText(value)}
          aria-label={`${label} másolása`}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "—"}</p>
    </div>
  );
}

function UtmBuilderPanel() {
  const [url, setUrl] = useState("https://tetojavitasmesterfokon.hu/");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");

  const finalUrl = useMemo(() => {
    try {
      const built = new URL(url || "https://tetojavitasmesterfokon.hu/");
      const params = { utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content, utm_term: term };
      for (const [key, value] of Object.entries(params)) {
        if (value) built.searchParams.set(key, value);
      }
      return built.toString();
    } catch {
      return "";
    }
  }, [url, source, medium, campaign, content, term]);

  return (
    <Panel title="UTM builder">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="Cél URL" className="sm:col-span-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </AdminField>
        <AdminField label="utm_source">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="facebook" />
        </AdminField>
        <AdminField label="utm_medium">
          <Input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="paid_social" />
        </AdminField>
        <AdminField label="utm_campaign">
          <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="nyar_akcio" />
        </AdminField>
        <AdminField label="utm_content">
          <Input value={content} onChange={(e) => setContent(e.target.value)} />
        </AdminField>
        <AdminField label="utm_term">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} />
        </AdminField>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-button)] border border-border p-3">
        <code className="min-w-0 flex-1 break-all text-xs">{finalUrl}</code>
        <Button size="sm" variant="outline" onClick={() => copyText(finalUrl)}>
          <Copy className="h-3.5 w-3.5" /> Másolás
        </Button>
      </div>
    </Panel>
  );
}
