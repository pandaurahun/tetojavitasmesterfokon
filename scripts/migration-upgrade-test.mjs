#!/usr/bin/env node
// Upgrade-path test for the D1 migrations, on a THROWAWAY local database
// (its own --persist-to directory — the real local database is not touched,
// and nothing here ever reaches a remote database).
//
//   node scripts/migration-upgrade-test.mjs
//
// 1. applies 0001-0003 (the schema before the integrity migration)
// 2. writes a signed quote the OLD way (signature row without hash/number columns)
// 3. applies 0004, 0005 and 0006 on top
// 4. checks the old row survived with sane defaults and the new objects exist
// 5. re-runs every migration to document which ones are idempotent
// 6. checks the number-uniqueness index really rejects a duplicate root number
//
// Exit code 1 if an expectation fails. Expected and documented: 0004 is NOT
// re-runnable (ALTER TABLE ADD COLUMN has no IF NOT EXISTS) — wrangler records
// applied migrations, so it never runs twice in practice.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const persist = mkdtempSync(path.join(tmpdir(), "d1-upgrade-"));
const failures = [];

function run(args) {
  try {
    return {
      ok: true,
      out: execFileSync(
        process.execPath,
        [
          WRANGLER,
          "d1",
          "execute",
          "tetojavitasmesterfokon",
          "--local",
          "--persist-to",
          persist,
          "--config",
          "wrangler.jsonc",
          ...args,
        ],
        { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    };
  } catch (error) {
    return { ok: false, out: String(error.stderr || error.stdout || error.message) };
  }
}
const applyFile = (name) => run(["--file", `migrations/${name}`]);
function sql(query) {
  const result = run(["--json", "--command", query]);
  if (!result.ok) return { error: result.out.slice(0, 300) };
  return JSON.parse(result.out.slice(result.out.indexOf("["))).flatMap((r) => r.results ?? []);
}
function expect(label, condition, detail = "") {
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}${condition || !detail ? "" : `  -> ${detail}`}`,
  );
  if (!condition) failures.push(label);
}
const must = (label, result) => {
  if (result && result.error) throw new Error(`${label}: ${result.error}`);
  return result;
};

try {
  const all = readdirSync(path.join(ROOT, "migrations"))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const before = all.filter((f) => f < "0004");
  const after = all.filter((f) => f >= "0004");

  for (const name of before) expect(`apply ${name}`, applyFile(name).ok);
  expect(
    "signature table has no hash column yet",
    !sql("SELECT name FROM pragma_table_info('field_quote_signatures')").some(
      (c) => c.name === "document_hash",
    ),
  );

  must(
    "admin",
    sql(
      "INSERT INTO admins (id, email, password_hash, password_salt, password_iterations, role, created_at, updated_at) VALUES ('adm','a@example.invalid','x','y',100000,'owner',1,1)",
    ),
  );
  must(
    "quote",
    sql(
      "INSERT INTO field_quotes (id, number, version, root_id, status, customer_name, customer_phone, discount_value, acceptance_text, surveyor_admin_id, created_at, updated_at, signed_at) VALUES ('q-old','HJA-2026-000001',1,'q-old','SIGNED','Régi Ügyfél','+36',0,'x','adm',1,1,1)",
    ),
  );
  must(
    "signature",
    sql(
      `INSERT INTO field_quote_signatures (id, field_quote_id, signature_storage_key, pdf_storage_key, accepted_statement_text, document_snapshot, surveyor_admin_id, signed_at, created_at) VALUES ('sig-old','q-old','k1','k2','stmt','{"old":true}','adm',1,1)`,
    ),
  );

  for (const name of after) expect(`apply ${name} on top of existing data`, applyFile(name).ok);

  const sig = sql(
    "SELECT id, quote_number, quote_version, document_hash, document_snapshot FROM field_quote_signatures",
  );
  expect(
    "the pre-existing signed record survived with defaults",
    sig.length === 1 &&
      sig[0].document_snapshot === '{"old":true}' &&
      sig[0].quote_number === "" &&
      sig[0].quote_version === 1 &&
      sig[0].document_hash === "",
    JSON.stringify(sig),
  );
  const objects = sql(
    "SELECT name FROM sqlite_master WHERE name IN ('field_quote_counters','idx_fq_number_root_unique','idx_fq_root_version','jobs','job_events','idx_jobs_status')",
  ).map((r) => r.name);
  expect("counter table, indexes and jobs tables exist", objects.length === 6, objects.join(","));
  expect(
    "the redundant idx_fq_public_token index is gone",
    sql("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'idx_fq_public_token'")[0]?.n === 0,
  );

  console.log("\n-- re-running every migration on the migrated database --");
  const nonIdempotent = [];
  for (const name of all) {
    const result = applyFile(name);
    console.log(`   ${name}: ${result.ok ? "idempotent" : "NOT re-runnable"}`);
    if (!result.ok) nonIdempotent.push(name);
  }
  expect(
    "only 0004 (ALTER TABLE ADD COLUMN) is non-re-runnable",
    nonIdempotent.length === 1 && nonIdempotent[0].startsWith("0004"),
    nonIdempotent.join(","),
  );

  const dup = sql(
    "INSERT INTO field_quotes (id, number, version, root_id, status, customer_name, customer_phone, discount_value, acceptance_text, surveyor_admin_id, created_at, updated_at) VALUES ('q-dup','HJA-2026-000001',1,'q-dup','DRAFT','Másik','+36',0,'x','adm',1,1)",
  );
  expect("a second ROOT quote with the same number is rejected", Boolean(dup.error));

  const twoJobs = sql(
    "INSERT INTO jobs (id, field_quote_id, quote_number, quote_version, customer_name, customer_phone, surveyor_admin_id, contract_amount, created_at, updated_at) VALUES ('j1','q-old','HJA-2026-000001',1,'x','y','adm',1,1,1)",
  );
  expect("a job can be inserted for the signed quote", !twoJobs.error, JSON.stringify(twoJobs));
  const secondJob = sql(
    "INSERT INTO jobs (id, field_quote_id, quote_number, quote_version, customer_name, customer_phone, surveyor_admin_id, contract_amount, created_at, updated_at) VALUES ('j2','q-old','HJA-2026-000001',1,'x','y','adm',1,1,1)",
  );
  expect("...but never a second job for the same quote (UNIQUE)", Boolean(secondJob.error));
  const badStatus = sql("UPDATE jobs SET status = 'BOGUS' WHERE id = 'j1'");
  expect("job status is constrained by the database itself (CHECK)", Boolean(badStatus.error));
} finally {
  rmSync(persist, { recursive: true, force: true });
}

console.log(
  failures.length ? `\n${failures.length} expectation(s) FAILED` : "\nall expectations met",
);
process.exit(failures.length ? 1 : 0);
