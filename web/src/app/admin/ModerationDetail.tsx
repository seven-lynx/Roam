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
    // Initialise category/subcategory from item data
    const sub = item.subcategory?.[0];
    const catId = sub?.category_id ?? sub?.category?.[0]?.id ?? null;
    setSelectedCategoryId(catId);
    setSelectedSubcategoryId(item.subcategory_id ?? null);
    // Fetch submitter email
    if (item.submitted_by) {
      setEmailLoading(true);
      setSubmitterEmail(null);
      getSubmitterEmail(item.submitted_by)
        .then((email) => setSubmitterEmail(email))
        .finally(() => setEmailLoading(false));
    } else {
      setSubmitterEmail(null);
    }
  }, [item?.id]);

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

    const { error: updateError } = await supabase
      .from("moderation_queue")
      .update({ status: action, subcategory_id: finalSubcategoryId })
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            URL Details
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              URL
            </label>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {item.url}
            </a>
          </div>

          {/* Title */}
          {item.title && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Title
              </label>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white">
                {item.title}
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Description
              </label>
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white">
                {item.description}
              </div>
            </div>
          )}

          {/* Classification — category + subcategory assignment */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Classification
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCategoryId ?? ""}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value || null);
                  setSelectedSubcategoryId(null);
                }}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">— Category —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={selectedSubcategoryId ?? ""}
                onChange={(e) => setSelectedSubcategoryId(e.target.value || null)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white"
              >
                <option value="">— Subcategory —</option>
                {filteredSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Safe Browsing Result */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Safe Browsing
            </label>
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                item.safe_browsing_passed
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : item.safe_browsing_passed === false
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {safeBrowsingStatus}
            </div>
          </div>

          {/* Submitter */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Submitted by
            </label>
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white">
              {emailLoading
                ? "Loading…"
                : submitterEmail ?? item.profile?.username ?? item.submitted_by ?? "Unknown"}
            </div>
          </div>

          {/* Submission Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Submitted
            </label>
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-white">
              {new Date(item.created_at ?? '').toLocaleString()}
            </div>
          </div>

          {/* Current Status */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Status
            </label>
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                item.status === "approved"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : item.status === "rejected"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}
            >
              {(item.status ?? 'pending').charAt(0).toUpperCase() + (item.status ?? 'pending').slice(1)}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col gap-3">
          {actionError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}
          <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>

          {item.status === "pending" && (
            <>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={status === "loading"}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleDecision("approved")}
                disabled={status === "loading"}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
            </>
          )}

          {item.status !== "pending" && (
            <button
              onClick={handleUndo}
              disabled={status === "loading"}
              className="rounded-lg bg-zinc-400 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-500 disabled:opacity-50 transition-colors"
            >
              Undo
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
