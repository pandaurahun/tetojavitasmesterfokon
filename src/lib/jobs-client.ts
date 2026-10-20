import type { Job, JobEvent, JobStatus } from "@/demo/job-types";

export class JobsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new JobsApiError(0, "A kapcsolat megszakadt. Ellenőrizze a hálózatot, és próbálja újra.");
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new JobsApiError(
      res.status,
      (payload as { error?: string }).error ?? "A kérés nem sikerült.",
    );
  }
  return payload as T;
}

const base = "/api/admin/jobs";

export const jobsApi = {
  list: (status?: JobStatus) =>
    call<{ items: Job[] }>(status ? `${base}?status=${encodeURIComponent(status)}` : base),
  get: (id: string) => call<{ job: Job; events: JobEvent[] }>(`${base}/${id}`),
  /** Starts the job for a signed quote — or returns the one that already exists. */
  create: (fieldQuoteId: string) =>
    call<{ job: Job; created: boolean }>(base, {
      method: "POST",
      body: JSON.stringify({ fieldQuoteId }),
    }),
  update: (
    id: string,
    patch: {
      status?: JobStatus;
      plannedStart?: string | null;
      workType?: string;
      internalNote?: string;
    },
  ) =>
    call<{ job: Job; events: JobEvent[] }>(`${base}/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
};
