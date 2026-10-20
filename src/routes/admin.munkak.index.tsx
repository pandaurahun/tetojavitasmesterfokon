import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPage, EmptyState } from "@/components/admin/ui";
import { JobStatusPill } from "@/components/admin/JobStatusPill";
import { jobsApi, JobsApiError } from "@/lib/jobs-client";
import { JOB_STATUSES, JOB_STATUS_LABELS, type Job, type JobStatus } from "@/demo/job-types";

export const Route = createFileRoute("/admin/munkak/")({
  head: () => ({ meta: [{ title: "Munkák — Admin" }, { name: "robots", content: "noindex" }] }),
  component: JobsPage,
});

const huf = (value: number) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.round(value)) + " Ft";

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : value;
};

function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");

  const load = useCallback(async () => {
    try {
      const result = await jobsApi.list();
      setJobs(result.items);
      setState("ready");
      setError(null);
    } catch (e) {
      setError(e instanceof JobsApiError ? e.message : "A munkák betöltése nem sikerült.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byStatus = new Map<JobStatus, number>();
    for (const job of jobs) byStatus.set(job.status, (byStatus.get(job.status) ?? 0) + 1);
    return byStatus;
  }, [jobs]);

  const visible = filter === "ALL" ? jobs : jobs.filter((job) => job.status === filter);
  const open = jobs.filter((job) => job.status !== "CLOSED").length;

  return (
    <AdminPage
      title="Munkák"
      intro="Az aláírt helyszíni ajánlatokból indított munkák állapota egy helyen — nem munkaszervező rendszer, csak a következő lépés és a jegyzetek."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Szűrés állapot szerint">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          Mind ({jobs.length})
        </FilterChip>
        {JOB_STATUSES.map((status) => (
          <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
            {JOB_STATUS_LABELS[status]} ({counts.get(status) ?? 0})
          </FilterChip>
        ))}
      </div>

      {state === "loading" ? <p className="text-sm text-muted-foreground">Betöltés...</p> : null}
      {state === "error" ? (
        <p className="text-sm text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Újrapróbálás
          </button>
        </p>
      ) : null}

      {state === "ready" && jobs.length === 0 ? (
        <EmptyState text="Még nincs munka. Munkát az aláírt helyszíni ajánlat oldaláról lehet indítani." />
      ) : null}
      {state === "ready" && jobs.length > 0 && visible.length === 0 ? (
        <EmptyState text="Nincs a szűrésnek megfelelő munka." />
      ) : null}

      {visible.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {visible.length} munka megjelenítve · {open} nincs lezárva
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((job) => (
              <li key={job.id}>
                <Link
                  to="/admin/munkak/$id"
                  params={{ id: job.id }}
                  className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-soft transition-colors hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold break-words">{job.customerName}</p>
                    <JobStatusPill status={job.status} />
                  </div>
                  {job.address ? (
                    <p className="mt-1 text-sm break-words text-muted-foreground">{job.address}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {job.quoteNumber} · {huf(job.contractAmount)}
                    {job.workType ? ` · ${job.workType}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.plannedStart
                      ? `Tervezett kezdés: ${formatDate(job.plannedStart)}`
                      : "Még nincs tervezett kezdés"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AdminPage>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
