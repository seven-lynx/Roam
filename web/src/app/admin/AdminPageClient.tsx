"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ModerationDetail from "./ModerationDetail";
import type { Database } from "@/lib/supabase/types";

type QueueItem = Database["public"]["Tables"]["moderation_queue"]["Row"] & {
  profile?: { display_name: string; username: string };
  subcategory?: { label: string };
};

export default function AdminPageClient() {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  async function loadQueue() {
    try {
      let query = supabase
        .from("moderation_queue")
        .select(`
          id,
          url,
          title,
          description,
          status,
          safe_browsing_passed,
          submitted_by,
          created_at,
          updated_at,
          reviewer_note,
          reviewed_by,
          subcategory_id,
          subcategory:subcategories(label)
        `);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query.order("created_at", {
        ascending: sortBy === "oldest",
      });

      let filtered = data ?? [];

      if (searchQuery) {
        const query_lower = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.url.toLowerCase().includes(query_lower) ||
            item.title?.toLowerCase().includes(query_lower) ||
            item.description?.toLowerCase().includes(query_lower)
        );
      }

      setItems(filtered);
    } catch (err) {
      console.error("Failed to load moderation queue:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [statusFilter, searchQuery, sortBy]);

  const statusCounts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Moderation queue</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
            {statusCounts[statusFilter]} item{statusCounts[statusFilter] !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Status Filter */}
          <div className="flex gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {status === "all"
                  ? `All (${statusCounts.all})`
                  : `${status.charAt(0).toUpperCase() + status.slice(1)} (${statusCounts[status]})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search URL, title, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {/* Queue Items */}
        {isLoading ? (
          <div className="text-center text-zinc-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">
            No submissions found.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {item.url}
                    </a>
                    {item.title && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {item.title}
                      </p>
                    )}
                  </div>
                  <span
                    className={`whitespace-nowrap text-xs font-medium px-2 py-1 rounded ${
                      item.status === "approved"
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : item.status === "rejected"
                          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                          : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ModerationDetail
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={loadQueue}
      />
    </main>
  );
}
