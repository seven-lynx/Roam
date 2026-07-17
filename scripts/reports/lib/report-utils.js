/** report-utils.js — Shared utilities for the Roam report toolkit with offline support. */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

// ── DB backend selection ────────────────────────────────────────────────────
let _db = null, _mode = "supabase";

export function initDB(mode = "supabase") {
  _mode = mode;
  if (mode === "offline") {
    const dbPath = resolve(__dirname, "..", "offline", "roam.db");
    if (!existsSync(dbPath)) throw new Error("Offline database not found. Run: node scripts/reports/export-db.mjs");
    _db = new Database(dbPath, { readonly: true });
  }
}

/** Alias for backward compatibility with older report files */
export function getSupabase() { return getDB(); }
export async function getAnalytics() {
  const sb = getDB();
  const { data, error } = await sb.rpc("admin_analytics");
  if (error) throw new Error(`admin_analytics RPC failed: ${error.message}`);
  return data;
}

/** Get the current database backend (Supabase client or SQLite) */
export function getDB() {
  if (_mode === "offline" && _db) return _db;
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    _db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _db;
}

export function isOffline() { return _mode === "offline"; }
export function isSupabase() { return _mode === "supabase"; }

// ── Unified query helpers ───────────────────────────────────────────────────

/** Count rows in a table matching conditions (works both online/offline) */
export async function countWhere(table, where = {}) {
  if (isOffline()) {
    const clauses = Object.entries(where).map(([k, v]) => `"${k}" = ${typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v === true ? 1 : v === false ? 0 : v}`);
    const sql = clauses.length ? `SELECT COUNT(*) as cnt FROM "${table}" WHERE ${clauses.join(" AND ")}` : `SELECT COUNT(*) as cnt FROM "${table}"`;
    const row = getDB().prepare(sql).get();
    return { count: row?.cnt || 0, error: null };
  }
  let q = getDB().from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
  const { count, error } = await q;
  return { count, error: error?.message || null };
}

/** Count distinct values in a column */
export async function countDistinct(table, column, where = {}) {
  if (isOffline()) {
    const w = Object.entries(where).map(([k, v]) => `"${k}" = ${typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v ? 1 : 0}`);
    const sql = w.length ? `SELECT COUNT(DISTINCT "${column}") as cnt FROM "${table}" WHERE ${w.join(" AND ")}` : `SELECT COUNT(DISTINCT "${column}") as cnt FROM "${table}"`;
    const row = getDB().prepare(sql).get();
    return { count: row?.cnt || 0, error: null };
  }
  return { count: 0, error: "Online distinct not implemented" };
}

/** Run a raw SQL query on the offline DB */
export function sqlQuery(sql) {
  if (!isOffline()) throw new Error("sqlQuery only available in offline mode");
  return getDB().prepare(sql).all();
}

/** Run raw SQL and get single value */
export function sqlGet(sql) {
  if (!isOffline()) throw new Error("sqlGet only available in offline mode");
  return getDB().prepare(sql).get();
}

/** Paginated select for offline mode */
export function sqlAll(table, where = {}, orderBy = null, limit = 10000) {
  if (!isOffline()) throw new Error("sqlAll only available in offline mode");
  const w = Object.entries(where).map(([k, v]) => `"${k}" = ${typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v ? 1 : 0}`);
  let sql = `SELECT * FROM "${table}"`;
  if (w.length) sql += ` WHERE ${w.join(" AND ")}`;
  if (orderBy) sql += ` ORDER BY "${orderBy[0]}" ${orderBy[1] || "ASC"}`;
  if (limit > -1) sql += ` LIMIT ${limit}`;
  return getDB().prepare(sql).all();
}

// ── Animated progress & ETA ─────────────────────────────────────────────────
let _spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], _spinnerIdx = 0, _spinnerInterval = null;
function hideCursor() { try { process.stdout.write("\x1b[?25l"); } catch {} }
function showCursor() { try { process.stdout.write("\x1b[?25h"); } catch {} }
function startSpinner(label, eta) {
  hideCursor();
  const start = Date.now(), job = { label, start, eta, done: false };
  const draw = () => {
    if (job.done) return;
    const r = Math.max(0, eta - (Date.now() - start) / 1000);
    const frame = _spinnerFrames[_spinnerIdx % _spinnerFrames.length]; _spinnerIdx++;
    try { process.stdout.write(`\r\x1b[K${frame} ${label} \x1b[90m~${r.toFixed(0)}s remaining\x1b[0m`); } catch {}
  };
  _spinnerInterval = setInterval(draw, 120); draw(); return job;
}
function stopSpinner(job, status = "done", detail = "") {
  job.done = true;
  if (_spinnerInterval) { clearInterval(_spinnerInterval); _spinnerInterval = null; }
  const elapsed = ((Date.now() - job.start) / 1000).toFixed(1);
  const icon = status === "done" ? "✅" : "❌";
  try { process.stdout.write(`\r\x1b[K${icon} ${job.label} \x1b[90m(${elapsed}s${detail ? `, ${detail}` : ""})\x1b[0m\n`); } catch {}
  showCursor();
}
process.on("exit", showCursor);
process.on("SIGINT", () => { showCursor(); process.exit(1); });

export async function runQuery(label, fn, etaSeconds = 2) {
  const job = startSpinner(label, etaSeconds);
  try {
    const result = await fn();
    if (result?.error) { stopSpinner(job, "error", result.error); return result; }
    const detail = Array.isArray(result?.data) ? `${result.data.length} rows` : result?.count != null ? `count=${result.count}` : "";
    stopSpinner(job, "done", detail);
    return result;
  } catch (err) {
    stopSpinner(job, "error", err.message);
    return { data: null, error: err.message };
  }
}

// ── Checkpoint system ───────────────────────────────────────────────────────
const CHECKPOINT_DIR = resolve(__dirname, "..", ".checkpoints");
function cpDir() { if (!existsSync(CHECKPOINT_DIR)) mkdirSync(CHECKPOINT_DIR, { recursive: true }); }
export function readCheckpoint(n) { cpDir(); const p = resolve(CHECKPOINT_DIR, `${n}.checkpoint.json`); if (!existsSync(p)) return null; try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }
export function writeCheckpoint(n, d) { cpDir(); writeFileSync(resolve(CHECKPOINT_DIR, `${n}.checkpoint.json`), JSON.stringify({ report: n, timestamp: new Date().toISOString(), ...d }, null, 2)); }

// ── Markdown formatters ─────────────────────────────────────────────────────
export function mdH2(text) { return `## ${text}\n`; }
export function mdH3(text) { return `### ${text}\n`; }
export function mdTable(rows, columns) {
  if (!rows || rows.length === 0) return "_No data._\n\n";
  const lines = [];
  lines.push("| " + columns.map(c => c.label).join(" | ") + " |");
  lines.push("| " + columns.map(c => (c.align || "left") === "right" ? "---:" : "---").join(" | ") + " |");
  for (const row of rows) lines.push("| " + columns.map(c => { let v = row[c.key]; if (c.format) v = c.format(v, row); if (v == null) v = "-"; return String(v); }).join(" | ") + " |");
  return lines.join("\n") + "\n\n";
}
export function mdSummaryCards(items) {
  const lines = [];
  lines.push(`| ${items.map(i => i.label).join(" | ")} |`);
  lines.push(`| ${items.map(() => "---").join(" | ")} |`);
  lines.push(`| ${items.map(i => i.value).join(" | ")} |`);
  if (items.some(i => i.sub)) lines.push(`| ${items.map(i => i.sub || "").join(" | ")} |`);
  return lines.join("\n") + "\n\n";
}
export function pct(numerator, denominator) { if (!denominator || denominator === 0) return "-"; return (numerator / denominator * 100).toFixed(1) + "%"; }
export function fmtInt(n) { return (n ?? 0).toLocaleString(); }

// ── Suite registry ─────────────────────────────────────────────────────────
export const REGISTRY = [];
export function registerReport(entry) { REGISTRY.push(entry); }

// ── Output helpers ─────────────────────────────────────────────────────────
export function writeOutput(reportId, markdown, outputDir) {
  const dir = outputDir || resolve(__dirname, "..", "output");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${reportId}.md`), markdown, "utf8");
}
export function printBanner(suite, title) {
  const bar = "═".repeat(60);
  console.log(`\n\x1b[1;36m${bar}\x1b[0m\n\x1b[1;36m  Suite ${suite}: ${title}\x1b[0m\n\x1b[1;36m${bar}\x1b[0m\n`);
}