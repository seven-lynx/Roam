// Edge function: cron-exhaustion-notify
// Runs daily. Nudges users whose discovery went dry, once per episode.
//
// Why there is no "select then insert" here: claim_exhaustion_notifications()
// claims the exhaustion rows and writes the notifications in a single statement.
// If this function were interrupted between those two steps, the next run would
// either deliver a duplicate or skip a user entirely. The whole job is therefore
// one RPC, and a retry is free.
//
// Delivery is the existing notifications -> push-notify webhook. This type is not
// in EMAIL_NOTIFICATION_TYPES, so it is push (and in-app) only by construction.
//
// Deploy: supabase functions deploy cron-exhaustion-notify
// Schedule: declared in config.toml under [functions.cron-exhaustion-notify]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow requests from the cron scheduler (or other authorized callers).
  // Mirrors the guard in cron-daily-challenges.
  const authHeader = req.headers.get("Authorization");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("claim_exhaustion_notifications");
    if (error) {
      console.error("claim_exhaustion_notifications failed:", error.message, error.details ?? "");
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notified = typeof data === "number" ? data : 0;
    console.log(`discovery exhaustion: notified ${notified} user(s)`);
    return new Response(JSON.stringify({ success: true, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cron-exhaustion-notify error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
