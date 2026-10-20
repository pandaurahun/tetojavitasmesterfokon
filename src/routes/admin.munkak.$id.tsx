import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField, AdminPage, NativeSelect, Panel } from "@/components/admin/ui";
import { JobStatusPill } from "@/components/admin/JobStatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { jobsApi, JobsApiError } from "@/lib/jobs-client";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  type Job,
  type JobEvent,
  type JobStatus,
} from "@/demo/job-types";
import { FileDown } from "lucide-react";

export const Route = createFileRoute("/admin/munkak/$id")({
  head: () => ({ meta: [{ title: "Munka — Admin" }, { name: "robots", content: "noindex" }] }),
  component: JobDetailPage,
});

const huf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";

interface Draft {
  status: JobStatus;
  plannedStart: string;
  workType: string;
  internalNote: string;
}

const draftFrom = (job: Job): Draft => ({
  status: job.status,
  plannedStart: job.plannedStart ?? "",
  workType: job.workType ?? "",
  internalNote: job.internalNote ?? "",
});

const EVENT_LABELS: Record<string, string> = {
  created: "Létrehozva",
  status_changed: "Állapotváltás",
  updated: "Módosítva",
};

function JobDetailPage() {
  const { id } = Route.useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((nextJob: Job, nextEvents: JobEvent[]) => {
    setJob(nextJob);
    setEvents(nextEvents);
    setDraft(draftFrom(nextJob));
  }, []);

  useEffect(() => {
    let active = true;
    setJob(null);
    setLoadError(null);
    jobsApi
      .get(id)
      .then((result) => {
        if (active) apply(result.job, result.events);
      })
      .catch((e) => {
        if (active) {
          setLoadError(e instanceof JobsApiError ? e.message : "A munka betöltése nem sikerült.");
        }
      });
    return () => {
      active = false;
    };
  }, [id, apply]);

  if (loadError) {
    return (
      <AdminPage title="Munka">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/munkak">← Munkák</Link>
        </Button>
      </AdminPage>
    );
  }
  if (!job || !draft) {
    return (
      <AdminPage title="Munka">
        <p className="text-sm text-muted-foreground">Betöltés...</p>
      </AdminPage>
    );
  }

  const changed =
    draft.status !== job.status ||
    draft.plannedStart !== (job.plannedStart ?? "") ||
    draft.workType.trim() !== (job.workType ?? "") ||
    draft.internalNote.trim() !== (job.internalNote ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const result = await jobsApi.update(job.id, {
        status: draft.status,
        plannedStart: draft.plannedStart || null,
        workType: draft.workType,
        internalNote: draft.internalNote,
      });
      apply(result.job, result.events);
      toast.success("A munka mentve.");
    } catch (e) {
      toast.error(e instanceof JobsApiError ? e.message : "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage
      title={`${job.customerName} — ${job.quoteNumber}`}
      intro={job.address ?? "Nincs megadott cím"}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/munkak">← Munkák</Link>
        </Button>
      }
    >
      <Panel title="Szerződés">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Állapot">
            <JobStatusPill status={job.status} />
          </Info>
          <Info label="Szerződéses összeg (bruttó)">
            <span className="font-semibold">{huf(job.contractAmount)}</span>
          </Info>
          <Info label="Ügyfél">
            {job.customerName}
            <br />
            <a className="underline" href={`tel:${job.customerPhone.replace(/\s+/g, "")}`}>
              {job.customerPhone}
            </a>
            {job.customerEmail ? (
              <>
                {" · "}
                <a className="underline" href={`mailto:${job.customerEmail}`}>
                  {job.customerEmail}
                </a>
              </>
            ) : null}
          </Info>
          <Info label="Felmérő">{job.surveyorName ?? "—"}</Info>
          <Info label="Ajánlat">
            <Link
              to="/admin/helyszini-ajanlat/$id"
              params={{ id: job.fieldQuoteId }}
              className="underline"
            >
              {job.quoteNumber} / v{job.quoteVersion}
            </Link>
          </Info>
          <Info label="Aláírt dokumentum">
            {job.pdfKey ? (
              <a
                className="inline-flex items-center gap-1 underline"
                href={`/api/admin/field-quotes/media/${job.pdfKey}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileDown className="h-3.5 w-3.5" /> PDF megnyitása
              </a>
            ) : (
              "—"
            )}
          </Info>
        </dl>
      </Panel>

      <Panel title="A munka">
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="Állapot">
            <NativeSelect
              value={draft.status}
              onChange={(value) => setDraft({ ...draft, status: value as JobStatus })}
            >
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {JOB_STATUS_LABELS[status]}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField label="Tervezett kezdés">
            <Input
              type="date"
              value={draft.plannedStart}
              onChange={(e) => setDraft({ ...draft, plannedStart: e.target.value })}
            />
          </AdminField>
          <AdminField label="A munka típusa" className="sm:col-span-2">
            <Input
              value={draft.workType}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, workType: e.target.value })}
              placeholder="Pl. Tetőfedés, Bádogozás"
            />
          </AdminField>
          <AdminField label="Belső megjegyzés (az ügyfél nem látja)" className="sm:col-span-2">
            <Textarea
              rows={4}
              maxLength={5000}
              value={draft.internalNote}
              onChange={(e) => setDraft({ ...draft, internalNote: e.target.value })}
            />
          </AdminField>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="copper" disabled={saving || !changed} onClick={() => void save()}>
            Mentés
          </Button>
          {changed ? (
            <span className="text-xs text-muted-foreground">Mentetlen módosítások</span>
          ) : null}
        </div>
      </Panel>

      <Panel title="Előzmények">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Még nincs bejegyzés.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="border-b border-border/60 pb-2 last:border-b-0">
                <p className="font-medium">
                  {EVENT_LABELS[event.eventType] ?? event.eventType}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("hu-HU")}
                  </span>
                </p>
                {event.detail ? (
                  <p className="text-xs break-words text-muted-foreground">{event.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </AdminPage>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
