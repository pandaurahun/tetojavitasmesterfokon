#!/usr/bin/env node
// Prints the SQL that creates a TEST admin in the LOCAL D1 database (the one
// `wrangler dev` uses). It never touches a database itself and is meant for
// local runs of scripts/field-quote-e2e.mjs only — never run its output with
// --remote.
//
//   E2E_EMAIL=test-field-quote@example.invalid E2E_PASSWORD='ValamiHosszu!2026' \
//     node scripts/make-local-test-admin.mjs > local-admin.sql
//   npx wrangler d1 execute tetojavitasmesterfokon --local --config wrangler.jsonc --file local-admin.sql
//   del local-admin.sql
//
// The hash format matches hashPassword() in src/server/backend.server.ts:
// PBKDF2-SHA256, 32 bytes, base64url salt/hash, iteration count stored per row
// (the login transparently re-hashes to the current count on first success).
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

const email = process.env.E2E_EMAIL ?? "test-field-quote@example.invalid";
const password = process.env.E2E_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set E2E_PASSWORD (at least 12 characters).");
  process.exit(2);
}
if (!/@example\.(invalid|test|com)$/.test(email)) {
  console.error("Refusing a non-example e-mail address — this is for local TEST admins only.");
  process.exit(2);
}

const b64url = (buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const now = Date.now();
const quoted = (value) => `'${String(value).replace(/'/g, "''")}'`;

console.log(
  `INSERT INTO admins (id, email, password_hash, password_salt, password_iterations, role, created_at, updated_at) VALUES (${quoted(randomUUID())}, ${quoted(email)}, ${quoted(b64url(hash))}, ${quoted(b64url(salt))}, ${iterations}, 'admin', ${now}, ${now});`,
);
