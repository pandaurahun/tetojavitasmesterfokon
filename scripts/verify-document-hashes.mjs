#!/usr/bin/env node
// Read-only integrity check of every signed field quote: recomputes
// SHA-256(document_snapshot) and compares it with the stored document_hash.
// A mismatch means the snapshot was altered after signing (it never should be).
//
//   node scripts/verify-document-hashes.mjs            # the LOCAL database
//   node scripts/verify-document-hashes.mjs --remote   # production (needs `wrangler login`)
//
// Only runs a SELECT. Exit code 1 if any hash does not match.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

const output = execFileSync(
  process.execPath,
  [
    WRANGLER,
    "d1",
    "execute",
    "tetojavitasmesterfokon",
    remote ? "--remote" : "--local",
    "--config",
    "wrangler.jsonc",
    "--json",
    "--command",
    "SELECT field_quote_id, quote_number, quote_version, document_snapshot, document_hash FROM field_quote_signatures ORDER BY signed_at",
  ],
  { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 },
);
const rows = JSON.parse(output.slice(output.indexOf("["))).flatMap((r) => r.results ?? []);

let ok = 0;
let missing = 0;
const bad = [];
for (const row of rows) {
  if (!row.document_hash) {
    missing += 1; // signed before the hash column existed (migration 0004)
    continue;
  }
  const actual = createHash("sha256")
    .update(row.document_snapshot ?? "", "utf8")
    .digest("hex");
  if (actual === row.document_hash) ok += 1;
  else bad.push(`${row.quote_number} v${row.quote_version} (${row.field_quote_id})`);
}

console.log(`${remote ? "REMOTE" : "local"} database — ${rows.length} signed document(s)`);
console.log(`  hash matches: ${ok}`);
console.log(`  no hash recorded (signed before migration 0004): ${missing}`);
console.log(`  MISMATCH: ${bad.length}`);
for (const line of bad) console.log(`    - ${line}`);
process.exit(bad.length > 0 ? 1 : 0);
