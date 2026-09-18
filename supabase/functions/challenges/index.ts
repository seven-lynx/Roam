// GET /functions/v1/challenges
// Returns active challenges with progress for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Fetch active user challenges joined with challenge data
    const { data, error } = await supabase
      .from("user_challenges")
      .select(`
        instance_id,
        progress_current,
        completed_at,
        challenge_instances!inner(
          id,
          challenge_type,
          starts_at,
          expires_at,
          challenges!inner(
            id,
            challenge_key,
            title,
            goal_description,
            goal_count,
            xp_reward,
            condition_type
          )
        )
      `)
      .eq("user_id", user.id)
      .gte("challenge_instances.expires_at", now)
      .order("created_at", { ascending: true, referencedTable: "challenge_instances" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const challenges = (data ?? []).map((uc: any) => ({
      instance_id: uc.instance_id,
      progress_current: uc.progress_current ?? 0,
      completed_at: uc.completed_at,
      challenge: {
        id: uc.challenge_instances?.challenges?.id,
        key: uc.challenge_instances?.challenges?.challenge_key,
        title: uc.challenge_instances?.challenges?.title,
        goal_description: uc.challenge_instances?.challenges?.goal_description,
        goal_count: uc.challenge_instances?.challenges?.goal_count,
        xp_reward: uc.challenge_instances?.challenges?.xp_reward,
        type: uc.challenge_instances?.challenge_type,
        expires_at: uc.challenge_instances?.expires_at,
      },
    }));

    return new Response(JSON.stringify({ challenges }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});