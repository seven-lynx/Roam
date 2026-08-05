#!/usr/bin/env node
/** Applies the badge audit & expansion migration to production. */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

const ROOT = resolve(import.meta.dirname, "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error("❌ Need SUPABASE_ACCESS_TOKEN in .env");
  process.exit(1);
}

const projectRef = "yrhckctwtdjowulfuaqc";
const sql = readFileSync(resolve(ROOT, "supabase/migrations/20260718000004_badge_audit_and_expansion.sql"), "utf8");

console.log("🚀 Applying badge audit & expansion migration...");
console.log(`   SQL size: ${(sql.length / 1024).toFixed(1)} KB`);

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (res.ok) {
  console.log(`✅ Migration applied (${res.status})`);
  console.log(`   Response: ${text.slice(0, 300)}`);
} else {
  console.error(`❌ Failed (${res.status}): ${text.slice(0, 500)}`);
  process.exit(1);
}