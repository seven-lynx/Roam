import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const handler = async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { failed_urls } = body;

    if (!Array.isArray(failed_urls) || failed_urls.length === 0) {
      return new Response(JSON.stringify({ error: "No failed URLs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Normalize and insert failed URLs into moderation queue
    const queueEntries = failed_urls.map((failedUrl: any) => ({
      url: failedUrl.url,
      status: "auto_flagged",
      reason: `URL validation failed: ${failedUrl.failure_reason} (retry_count: ${failedUrl.retry_count})`,
      submitted_by_id: null, // Auto-flagged, no submitter
      created_at: new Date(failedUrl.timestamp).toISOString(),
    }));

    // Batch insert into moderation_queue
    // Use INSERT ... ON CONFLICT DO NOTHING to skip duplicates
    const { error: insertError } = await supabase
      .from("moderation_queue")
      .insert(queueEntries, { onConflict: "url" });

    if (insertError) {
      console.error("Failed to insert into moderation_queue:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log failed URLs" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        logged_count: queueEntries.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in log-failed-urls function:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
