"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSubmitterEmail } from "./actions";

type Category = {
  id: string;
  name: string;
};

type Subcategory = {
  id: string;
  name: string;
  category_id: string;
};

type QueueItem = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected" | null;
  created_at: string | null;
  safe_browsing_passed: boolean | null;
  submitted_by: string | null;
  reviewed_at?: string | null;
  reviewer_note: string | null;
  reviewed_by: string | null;
  subcategory_id: string | null;
  profile?: { display_name: string; username: string } | null;
  subcategory?: { id: string; name: string; category_id: string; category?: { id: string; name: string }[] | null }[] | null;
};

interface ModerationDetailProps {
  item: QueueItem | null;
  onClose: () => void;
  onUpdate?: () => void;
  categories: Category[];
  allSubcategories: Subcategory[];
}

export default function ModerationDetail({
  item,
  onClose,
  onUpdate,
  categories,
  allSubcategories,
}: ModerationDetailProps) {
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitterEmail, setSubmitterEmail] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    const sub = item.subcategory?.[0];
    const catId = sub?.category_id ?? sub?.category?.[0]?.id ?? null;
    setSelectedCategoryId(catId);
    setSelectedSubcategoryId(item.subcategory_id ?? null);
    if (item.submitted_by) {
      setEmailLoading(true);
      setSubmitterEmail(null);
      getSubmitterEmail(item.submitted_by)
        .then((email) => setSubmitterEmail(email))
        .finally(() => setEmailLoading(false));
    } else {
      setSubmitterEmail(null);
    }
  }, [item]);

  const filteredSubcategories = selectedCategoryId
    ? allSubcategories.filter((s) => s.category_id === selectedCategoryId)
    : allSubcategories;

  if (!item) return null;

  const safeBrowsingStatus = item.safe_browsing_passed
    ? "✓ Passed"
    : item.safe_browsing_passed === false
      ? "✗ Rejected"
      : "—";

  async function handleDecision(action: "approved" | "rejected") {
    if (!item) return;
    setStatus("loading");
    setActionError(null);

    const finalSubcategoryId = selectedSubcategoryId ?? item.subcategory_id;

    const { data: { user } } = await supabase.auth.getUser();

    const { error: updateError } = await supabase
      .from("moderation_queue")
      .update({ status: action, subcategory_id: finalSubcategoryId, reviewed_by: user?.id ?? null })
      .eq("id", item.id);

    if (updateError) {
      console.error("moderation_queue update failed:", updateError);
      setActionError(updateError.message);
      setStatus("idle");
      return;
    }

    if (action === "approved") {
      const { error: upsertError } = await supabase.from("urls").upsert(
        {
          url: item.url,
          original_url: item.url,
          approved: true,
          title: item.title,
          description: item.description,
          subcategory_id: finalSubcategoryId,
        },
        { onConflict: "url" }
      );
      if (upsertError) {
        console.error("urls upsert failed:", upsertError);
        setActionError(`Queue updated but URL insert failed: ${upsertError.message}`);
        setStatus("idle");
        return;
      }
    }

    onUpdate?.();
    setStatus("idle");
    onClose();
  }

  async function handleUndo() {
    if (!item) return;
    setStatus("loading");
    setActionError(null);

    const { error: undoError } = await supabase
      .from("moderation_queue")
      .update({ status: "pending" })
      .eq("id", item.id);

    if (undoError) {
      console.error("undo failed:", undoError);
      setActionError(undoError.message);
      setStatus("idle");
      return;
    }

    if (item.status === "approved") {
      await supabase.from("urls").delete().eq("url", item.url);
    }

    onUpdate?.();
    setStatus("idle");
    onClose();
  }

  return (
    <>
      {/* Backdrop - full screen on mobile, semi-transparent overlay on desktop */}
      <div
        className="fixed inset-0 bg-screen/50 z-40"
        onClick={onClose}
      />

      {/* Modal - fullscreen on mobile, centered dialog on desktop */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-panel w-full sm:max-w-2xl sm:rounded-xl shadow-xl max-h-full sm:max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-b-xl overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-line px-4 sm:px-6 py-3 sm:py-4 bg-panel">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink transition-colors"
            >
              <span className="text-lg leading-none">←</span>
              <span className="hidden sm:inline">Back</span>
            </button>
            <h2 className="text-sm sm:text-lg font-semibold text-ink">URL Details</h2>
            <div className="w-14" /> {/* spacer for centering */}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            {/* URL */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                URL
              </label>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-panel-2 bg-panel-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-phosphor text-phosphor hover:underline break-all"
              >
                {item.url}
              </a>
            </div>

            {/* Title */}
            {item.title && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                  Title
                </label>
                <div className="bg-panel-2 bg-panel-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-ink">
                  {item.title}
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                  Description
                </label>
                <div className="bg-panel-2 bg-panel-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-ink">
                  {item.description}
                </div>
              </div>
            )}

            {/* Classification */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                Classification
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedCategoryId ?? ""}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value || null);
                    setSelectedSubcategoryId(null);
                  }}
                  className="flex-1 bg-panel-2 bg-panel-2 border border-line rounded-lg px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">— Category —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <select
                  value={selectedSubcategoryId ?? ""}
                  onChange={(e) => setSelectedSubcategoryId(e.target.value || null)}
                  className="flex-1 bg-panel-2 bg-panel-2 border border-line rounded-lg px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">— Subcategory —</option>
                  {filteredSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Safe Browsing */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                Safe Browsing
              </label>
              <div
                className={`rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium ${
                  item.safe_browsing_passed
                    ? "bg-panel-2 bg-panel-2/20 text-ok text-ok"
                    : item.safe_browsing_passed === false
                      ? "bg-panel-2 bg-panel-2/20 text-danger text-danger"
                      : "bg-panel-2 bg-panel-2 text-muted"
                }`}
              >
                {safeBrowsingStatus}
              </div>
            </div>

            {/* Submitter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                Submitted by
              </label>
              <div className="bg-panel-2 bg-panel-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-ink">
                {emailLoading
                  ? "Loading…"
                  : submitterEmail ?? item.profile?.username ?? item.submitted_by ?? "Unknown"}
              </div>
            </div>

            {/* Submission Date */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                Submitted
              </label>
              <div className="bg-panel-2 bg-panel-2 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-ink">
                {item.created_at ? new Date(item.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }) : '—'}
              </div>
            </div>

            {/* Current Status */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-muted mb-1.5">
                Status
              </label>
              <div
                className={`rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium ${
                  item.status === "approved"
                    ? "bg-panel-2 bg-panel-2/20 text-ok text-ok"
                    : item.status === "rejected"
                      ? "bg-panel-2 bg-panel-2/20 text-danger text-danger"
                      : "bg-panel-2 bg-panel-2/20 text-gold text-gold"
                }`}
              >
                {(item.status ?? 'pending').charAt(0).toUpperCase() + (item.status ?? 'pending').slice(1)}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 border-t border-line px-4 sm:px-6 py-3 sm:py-4 bg-panel-2 bg-panel-2/50 flex flex-col gap-2">
            {actionError && (
              <p className="text-xs text-danger text-danger bg-panel-2 bg-panel-2/20 rounded-lg px-3 py-2">
                {actionError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted hover:bg-panel-2 hover:bg-panel-2 transition-colors"
              >
                Close
              </button>

              {item.status === "pending" && (
                <>
                  <button
                    onClick={() => handleDecision("rejected")}
                    disabled={status === "loading"}
                    className="rounded-lg bg-ember px-4 py-2.5 text-sm font-medium text-ink hover:bg-danger disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleDecision("approved")}
                    disabled={status === "loading"}
                    className="rounded-lg bg-ok px-4 py-2.5 text-sm font-medium text-ink hover:bg-ok disabled:opacity-50 transition-colors"
                  >
                    Approve
                  </button>
                </>
              )}

              {item.status !== "pending" && (
                <button
                  onClick={handleUndo}
                  disabled={status === "loading"}
                  className="rounded-lg bg-panel-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-panel-3 disabled:opacity-50 transition-colors"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}