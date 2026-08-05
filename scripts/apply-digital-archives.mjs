// Apply Digital Archives subcategory + backfill 41,970 orphan URLs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const sql = readFileSync(
  resolve(__dirname, "../supabase/migrations/20260716000100_add_digital_archives_subcategory.sql"),
  "utf8"
);

const res = await fetch(`https://api.supabase.com/v1/projects/yrhckctwtdjowulfuaqc/database/query`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
  },
  body: JSON.stringify({ query: sql }),
});

console.log(`Status: ${res.status}`);
const text = await res.text();
console.log(res.ok ? "✅ Digital Archives subcategory created + 41,970 orphans backfilled" : `❌ ${text.slice(0, 300)}`);