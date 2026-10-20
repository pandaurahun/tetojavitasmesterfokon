import { z } from "zod";
import { apiError, authenticate, json, readJson, sameOrigin } from "./backend.server";
import {
  createJobFromSignedQuote,
  listJobEvents,
  listJobs,
  loadJob,
  updateJob,
} from "./jobs.server";
import { JOB_STATUSES } from "@/demo/job-types";

const ID = "[a-zA-Z0-9-]{1,80}";
const RE_LIST = /^\/api\/admin\/jobs$/;
const RE_ID = new RegExp(`^/api/admin/jobs/(${ID})$`);

const shortText = z.string().max(300);
const mediumText = z.string().max(5_000);

const jobCreateSchema = z.object({ fieldQuoteId: z.string().min(1).max(80) });

const jobUpdateSchema = z
  .object({
    status: z.enum(JOB_STATUSES).optional(),
    // A calendar date, or empty/null to clear it.
    plannedStart: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
      .optional(),
    workType: shortText.optional(),
    internalNote: mediumText.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Nincs módosítandó adat.",
  });

// Admin only (session cookie + same-origin for writes). There is no delete:
// a finished job is closed (status CLOSED), never erased.
export async function handleJobsAdminRequest(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (url.pathname !== "/api/admin/jobs" && !url.pathname.startsWith("/api/admin/jobs/")) {
    return null;
  }
  const session = await authenticate(request, env);
  if (!session) return apiError(401, "Bejelentkezés szükséges.");
  const actor = session.admin_id;

  if (request.method === "GET" && RE_LIST.test(url.pathname)) {
    const status = url.searchParams.get("status")?.slice(0, 40) || undefined;
    return json({ items: await listJobs(env.DB, { status }) });
  }

  if (request.method === "POST" && RE_LIST.test(url.pathname)) {
    if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
    const parsed = jobCreateSchema.safeParse(await readJson(request, 2_000));
    if (!parsed.success) return apiError(400, "Hiányzik az ajánlat azonosítója.");
    const result = await createJobFromSignedQuote(env.DB, parsed.data.fieldQuoteId, actor);
    if (!result.ok) {
      return result.reason === "NOT_FOUND"
        ? apiError(404, "A helyszíni ajánlat nem található.")
        : apiError(409, "Munka csak aláírt helyszíni ajánlatból indítható.");
    }
    // 201 for a new job, 200 when it already existed — so a double click or a
    // retry is harmless and answers with the same job.
    return json(
      { job: result.job, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  }

  const idMatch = RE_ID.exec(url.pathname);
  if (idMatch?.[1]) {
    if (request.method === "GET") {
      const job = await loadJob(env.DB, idMatch[1]);
      if (!job) return apiError(404, "A munka nem található.");
      return json({ job, events: await listJobEvents(env.DB, job.id) });
    }
    if (request.method === "PUT") {
      if (!sameOrigin(request)) return apiError(403, "Érvénytelen kérés.");
      const parsed = jobUpdateSchema.safeParse(await readJson(request, 20_000));
      if (!parsed.success) return apiError(400, "A munka adatai nem megfelelőek.");
      const job = await updateJob(env.DB, idMatch[1], parsed.data, actor);
      if (!job) return apiError(404, "A munka nem található.");
      return json({ job, events: await listJobEvents(env.DB, job.id) });
    }
  }

  return apiError(404, "Az API-végpont nem található.");
}
