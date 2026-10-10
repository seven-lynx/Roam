#!/usr/bin/env node
/**
 * check-migrations.mjs — Report drift between local migration files and the
 * production Supabase database.
 *
 * Uses the Supabase Management API (SUPABASE_ACCESS_TOKEN) rather than the
 * Supabase CLI or a direct Postgres driver, so it works without Docker and
 * without hitting the CLI password bug (supabase/cli#5175).
 *
 * Usage:
 *   node supabase/scripts/check-migrations.mjs
 *
 * Exit codes:
 *   0 — no drift (local === remote)
 *   1 — drift detected, or an error occurred
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const migrationsDir = resolve(repoRoot, "supabase", "migrations");
const envPath = resolve(repoRoot, ".env");

const PROJECT_REF = "yrhckctwtdjowulfuaqc";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function localVersions() {
  const re = /^(\d{14})_.+\.sql$/;
  return readdirSync(migrationsDir)
    .filter((f) => re.test(f))
    .map((f) => f.match(re)[1])
    .sort();
}

async function remoteVersions(token) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Avoid a lingering keep-alive socket, which on Windows can trigger a
      // benign-but-noisy libuv assertion ("UV_HANDLE_CLOSING") at exit.
      Connection: "close",
    },
    body: JSON.stringify({
      query:
        "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
    }),
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json.value ?? [];
  return rows.map((r) => r.version).sort();
}

const env = loadEnv(envPath);
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN not found in .env");
  process.exitCode = 1;
} else {
  const local = localVersions();
  const remote = await remoteVersions(env.SUPABASE_ACCESS_TOKEN);

  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const pending = local.filter((v) => !remoteSet.has(v));
  const uncommitted = remote.filter((v) => !localSet.has(v));

  console.log(`Local migrations:  ${local.length}`);
  console.log(`Remote migrations: ${remote.length}`);
  console.log("");

  if (pending.length === 0 && uncommitted.length === 0) {
    console.log("OK — no drift: local and remote are in sync.");
  } else {
    if (pending.length) {
      console.log(`Pending (local -> remote, ${pending.length}):`);
      for (const v of pending) console.log(`  ${v}`);
    }
    if (uncommitted.length) {
      console.log(`Uncommitted (remote-only, ${uncommitted.length}):`);
      for (const v of uncommitted) console.log(`  ${v}`);
    }
    console.log("");
    console.log("Reconcile with: supabase db push --include-all");
    console.log("Remote-only entries must be pulled into the repo (supabase db remote commit).");
    process.exitCode = 1;
  }
}
