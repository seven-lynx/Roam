"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface QueueItem {
  id: string;
  url: string;
  submitted_at: string;
  submitter_id: string | null;
}

export default function ModerationActions({ item }: { item: QueueItem }) {
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  async function decide(action: "approved" | "rejected") {
    setStatus("loading");
    await supabase
      .from("moderation_queue")
      .update({ status: action })
      .eq("id", item.id);

    if (action === "approved") {
      await supabase
        .from("urls")
        .upsert({ url: item.url, approved: true }, { onConflict: "url" });
    }

    setDecision(action);
    setStatus("done");
  }

  if (status === "done") {
    return (
      <span className={`text-sm font-medium ${decision === "approved" ? "text-ok" : "text-danger"}`}>
        {decision === "approved" ? "✓ Approved" : "✗ Rejected"}
      </span>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide("approved")}
        disabled={status === "loading"}
        className="rounded-lg bg-ok px-3 py-1.5 text-sm font-medium text-ink hover:bg-ok disabled:opacity-50 transition-colors"
      >
        Approve
      </button>
      <button
        onClick={() => decide("rejected")}
        disabled={status === "loading"}
        className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ink hover:bg-danger disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
    </div>
  );
}