#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await sb
  .from("badges")
  .update({ description: "Roam on April 20 🌸" })
  .eq("slug", "easter-egg")
  .select("slug, name, description")
  .single();

if (error) {
  console.error("❌", error.message);
  process.exit(1);
}
console.log("✅ Updated:", data.slug, "-", data.description);