#!/usr/bin/env node
/** Creates ONLY sync_profile_badge_count — production already has the fixed evaluate_badges from 20260714000000. */
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

async function main() {
  console.log("🔧 Creating sync_profile_badge_count only...\n");

  // Use the Supabase Management API with the access token
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("❌ Need SUPABASE_ACCESS_TOKEN in .env");
    console.log("   Get it from: https://supabase.com/dashboard/account/tokens");
    console.log("   Or run this SQL in the Supabase SQL editor:");
    console.log(`
CREATE OR REPLACE FUNCTION public.sync_profile_badge_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actual INT;
  v_stored INT;
BEGIN
  SELECT COUNT(*) INTO v_actual FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL;
  SELECT badge_count INTO v_stored FROM public.profiles WHERE id = p_user_id;
  IF v_actual != COALESCE(v_stored, 0) THEN
    UPDATE public.profiles SET badge_count = v_actual WHERE id = p_user_id;
  END IF;
  RETURN v_actual;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_profile_badge_count FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_badge_count TO authenticated, service_role;
    `);
    process.exit(1);
  }

  const projectRef = "yrhckctwtdjowulfuaqc";

  // Use the SQL endpoint
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `
CREATE OR REPLACE FUNCTION public.sync_profile_badge_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actual INT;
  v_stored INT;
BEGIN
  SELECT COUNT(*) INTO v_actual FROM public.user_badges WHERE user_id = p_user_id AND unlocked_at IS NOT NULL;
  SELECT badge_count INTO v_stored FROM public.profiles WHERE id = p_user_id;
  IF v_actual != COALESCE(v_stored, 0) THEN
    UPDATE public.profiles SET badge_count = v_actual WHERE id = p_user_id;
  END IF;
  RETURN v_actual;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_profile_badge_count FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_badge_count TO authenticated, service_role;
      `.trim(),
    }),
  });

  const text = await res.text();
  console.log(`  Management API: ${res.status} ${text.slice(0, 200)}`);

  if (res.ok) {
    console.log("  ✅ sync_profile_badge_count created");

    // Now sync all profiles
    console.log("\n  Syncing badge counts...");
    const { data: profiles } = await sb.from("profiles").select("id, badge_count").limit(500);
    if (profiles) {
      let synced = 0, errors = 0;
      for (const p of profiles) {
        const { error } = await sb.rpc("sync_profile_badge_count", { p_user_id: p.id });
        if (!error) synced++;
        else { errors++; if (errors <= 2) console.error(`    Failed ${p.id.slice(0,8)}: ${error.message}`); }
      }
      console.log(`  Synced ${synced}/${profiles.length} profiles (${errors} errors)`);
    }
  } else {
    console.log("\n  ❌ API failed. You may need to run the SQL manually.");
    console.log("  Go to: https://supabase.com/dashboard/project/yrhckctwtdjowulfuaqc/sql/new");
  }

  console.log("\n✅ Done.");
}

main().catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });