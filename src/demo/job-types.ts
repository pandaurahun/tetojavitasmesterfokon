// "Munkák" — the minimal job record that starts from a signed field quote.

export const JOB_STATUSES = [
  "PREPARATION",
  "SCHEDULED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "HANDED_OVER",
  "CLOSED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PREPARATION: "Előkészítés",
  SCHEDULED: "Ütemezve",
  IN_PROGRESS: "Folyamatban",
  ON_HOLD: "Várakozik",
  COMPLETED: "Elkészült",
  HANDED_OVER: "Átadva",
  CLOSED: "Lezárva",
};

export interface Job {
  id: string;
  fieldQuoteId: string;
  quoteNumber: string;
  quoteVersion: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | undefined;
  address?: string | undefined;
  surveyorAdminId: string;
  surveyorName?: string | undefined;
  workType?: string | undefined;
  /** Gross contract amount, whole forints, from the signed document. */
  contractAmount: number;
  /** YYYY-MM-DD */
  plannedStart?: string | undefined;
  status: JobStatus;
  internalNote?: string | undefined;
  /** The signed PDF, when the job is read individually. */
  pdfKey?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface JobEvent {
  id: string;
  eventType: string;
  detail?: string | undefined;
  actor: string;
  createdAt: string;
}
