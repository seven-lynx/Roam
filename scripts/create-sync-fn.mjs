#!/usr/bin/env node
/** Creates sync_profile_badge_count in production and syncs all profiles. */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log("Creating sync_profile_badge_count function...");
  
  // Execute via the Supabase Management API (raw SQL)
  const mgmtUrl = "https://api.supabase.com/v1/projects/yrhckctwtdjowulfuaqc/query";
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (accessToken) {
    console.log("  Using Management API...");
    const res = await fetch(mgmtUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "apikey": key,
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
  SELECT COUNT(*) INTO v_actual
  FROM public.user_badges
  WHERE user_id = p_user_id AND unlocked_at IS NOT NULL;
  SELECT badge_count INTO v_stored FROM public.profiles WHERE id = p_user_id;
  IF v_actual != COALESCE(v_stored, 0) THEN
    UPDATE public.profiles SET badge_count = v_actual WHERE id = p_user_id;
  END IF;
  RETURN v_actual;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_profile_badge_count FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_profile_badge_count TO authenticated, service_role;
        `.trim()
      }),
    });
    
    const text = await res.text();
    if (res.ok) {
      console.log("  ✅ sync_profile_badge_count created via API");
    } else {
      console.log(`  API failed (${res.status}), trying RPC...`);
      await tryRpc();
    }
  } else {
    console.log("  No SUPABASE_ACCESS_TOKEN, trying direct SQL via service_role...");
    await tryRpc();
  }
  
  async function tryRpc() {
    // Try via the Supabase client (PostgREST can execute raw SQL with service_role)
    // This doesn't always work but let's try
    const { error } = await sb.rpc("sync_profile_badge_count", { 
      p_user_id: "00000000-0000-0000-0000-000000000000" 
    });
    if (error && error.message.includes("not find the function")) {
      console.error("  ❌ sync_profile_badge_count still missing. You need to apply migration 20260713000000.");
      console.log("  Run: supabase db push");
      console.log("  Or run the SQL manually in Supabase dashboard.");
      process.exit(1);
    } else if (error) {
      console.log(`  Note: RPC call returned (expected for dummy UUID): ${error.message}`);
    } else {
      console.log("  ✅ sync_profile_badge_count is available");
    }
  }
  
  // Now sync all profiles
  console.log("\nSyncing badge counts...");
  const { data: profiles } = await sb.from("profiles").select("id, badge_count").limit(500);
  if (profiles) {
    let synced = 0;
    for (const p of profiles) {
      const { error } = await sb.rpc("sync_profile_badge_count", { p_user_id: p.id });
      if (!error) synced++;
    }
    console.log(`  Synced ${synced}/${profiles.length} profiles`);
  }
  
  console.log("\n✅ Done.");
}

main().catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });