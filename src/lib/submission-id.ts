// A public form submission needs an id that stays the SAME while one request is
// being retried — a double click, a refresh after a slow or failed response, a
// response lost on a bad mobile connection — so the server can recognise the
// repeat and store it once. The id must change as soon as the content changes
// (a corrected phone number is a new request, not a duplicate) and once the
// request succeeded (the next form is a new request).
//
// Kept in localStorage so it survives a page refresh, with an in-memory
// fallback for browsers/modes where storage is blocked.

const KEY_PREFIX = "tetovonal-submission-";

interface StoredSubmission {
  id: string;
  fingerprint: string;
}

const memory = new Map<string, StoredSubmission>();

// Not a security hash — only a cheap, stable "did the content change" check.
function fingerprintOf(content: unknown[]): string {
  const text = JSON.stringify(content);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

// 64 random bits as 16 hex characters: unique for any realistic number of
// requests, and short enough to be shown to the visitor as a reference.
function randomId(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function read(scope: string): StoredSubmission | undefined {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + scope);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSubmission>;
      if (typeof parsed.id === "string" && typeof parsed.fingerprint === "string") {
        return { id: parsed.id, fingerprint: parsed.fingerprint };
      }
    }
  } catch {
    /* storage blocked or corrupt — fall back to memory */
  }
  return memory.get(scope);
}

function write(scope: string, value: StoredSubmission): void {
  memory.set(scope, value);
  try {
    window.localStorage.setItem(KEY_PREFIX + scope, JSON.stringify(value));
  } catch {
    /* memory copy is enough for this page view */
  }
}

/** The id to submit for `content`: the same one while it is unchanged. */
export function submissionId(scope: string, content: unknown[]): string {
  const fingerprint = fingerprintOf(content);
  const stored = read(scope);
  if (stored && stored.fingerprint === fingerprint) return stored.id;
  const id = `lead-${randomId()}`;
  write(scope, { id, fingerprint });
  return id;
}

/** Call after a successful submit so the next form gets a fresh id. */
export function clearSubmissionId(scope: string): void {
  memory.delete(scope);
  try {
    window.localStorage.removeItem(KEY_PREFIX + scope);
  } catch {
    /* nothing to clear */
  }
}
