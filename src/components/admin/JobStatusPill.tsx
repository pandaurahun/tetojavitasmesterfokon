import { JOB_STATUS_LABELS, type JobStatus } from "@/demo/job-types";

const TONES: Record<JobStatus, string> = {
  PREPARATION: "bg-muted text-foreground",
  SCHEDULED: "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-foreground",
  IN_PROGRESS: "bg-accent text-accent-foreground",
  ON_HOLD: "bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-destructive",
  COMPLETED: "bg-forest text-forest-foreground",
  HANDED_OVER: "bg-forest text-forest-foreground",
  CLOSED: "bg-muted text-muted-foreground",
};

export function JobStatusPill({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[status]}`}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
