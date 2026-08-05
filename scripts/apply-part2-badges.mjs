#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

const ROOT = resolve(import.meta.dirname, "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error("Need SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const sql = readFileSync(resolve(ROOT, "supabase/migrations/20260718000005_holiday_and_part2_badges.sql"), "utf8");
console.log(`Applying Part 2 badges + holidays (${sql.length} bytes)...`);

const res = await fetch("https://api.supabase.com/v1/projects/yrhckctwtdjowulfuaqc/database/query", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
if (res.ok) console.log(`Done: ${res.status} ${text.slice(0,200)}`);
else { console.error(`Failed: ${res.status} ${text.slice(0,500)}`); process.exit(1); }