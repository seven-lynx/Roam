"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ModerationDetail from "./ModerationDetail";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Database } from "@/lib/supabase/types";

type QueueItem = Database["public"]["Tables"]["moderation_queue"]["Row"] & {
  profile?: { display_name: string; username: string };
  subcategory?: { label: string };
};

type AnalyticsData = {
  submissionsByDate: { date: string; count: number }[];
  submissionsByCategory: { category: string; count: number }[];
  topUrls: { url: string; title: string; wilson_score: number; upvotes: number; downvotes: number }[];
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
  const [view, setView] = useState<"queue" | "analytics">("queue");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    submissionsByDate: [],
    submissionsByCategory: [],
    topUrls: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

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

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      // Fetch all moderation queue items for analytics
      const { data: queueItems } = await supabase
        .from("moderation_queue")
        .select(`
          created_at,
          subcategory_id,
          subcategory:subcategories(label),
          status
        `);

      // Fetch all URLs for top-rated table
      const { data: urls } = await supabase
        .from("urls")
        .select("url, title, wilson_score, upvotes, downvotes")
        .order("wilson_score", { ascending: false })
        .limit(10);

      // Process submissions by date
      const dateMap: { [key: string]: number } = {};
      queueItems?.forEach((item) => {
        if (item.created_at) {
          const date = new Date(item.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          dateMap[date] = (dateMap[date] || 0) + 1;
        }
      });

      const submissionsByDate = Object.entries(dateMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 days

      // Process submissions by category
      const categoryMap: { [key: string]: number } = {};
      queueItems?.forEach((item) => {
        if (item.subcategory?.label) {
          const category = item.subcategory.label;
          categoryMap[category] = (categoryMap[category] || 0) + 1;
        }
      });

      const submissionsByCategory = Object.entries(categoryMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 categories

      setAnalyticsData({
        submissionsByDate,
        submissionsByCategory,
        topUrls: urls?.map((u) => ({
          url: u.url,
          title: u.title || "Untitled",
          wilson_score: u.wilson_score || 0,
          upvotes: u.upvotes || 0,
          downvotes: u.downvotes || 0,
        })) || [],
      });
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [statusFilter, searchQuery, sortBy]);

  useEffect(() => {
    if (view === "analytics") {
      loadAnalytics();
    }
  }, [view]);

  const statusCounts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
            Manage submissions and view analytics
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView("queue")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "queue"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Moderation Queue
          </button>
          <button
            onClick={() => setView("analytics")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "analytics"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Queue View */}
        {view === "queue" && (
          <div className="flex flex-col gap-8">
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
        )}

        {/* Analytics View */}
        {view === "analytics" && (
          <div className="flex flex-col gap-8">
            {analyticsLoading ? (
              <div className="text-center text-zinc-500">Loading analytics...</div>
            ) : (
              <>
                {/* Submissions by Date (Line Chart) */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                    Submissions Over Time
                  </h2>
                  {analyticsData.submissionsByDate.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData.submissionsByDate}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          stroke="#71717a"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          stroke="#71717a"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#27272a",
                            border: "1px solid #52525b",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#fafafa" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#3b82f6"
                          name="Submissions"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-zinc-500">No submission data available</p>
                  )}
                </div>

                {/* Top Categories (Bar Chart) */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                    Top Submission Categories
                  </h2>
                  {analyticsData.submissionsByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.submissionsByCategory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                        <XAxis
                          dataKey="category"
                          tick={{ fontSize: 12 }}
                          stroke="#71717a"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          stroke="#71717a"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#27272a",
                            border: "1px solid #52525b",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#fafafa" }}
                        />
                        <Legend />
                        <Bar
                          dataKey="count"
                          fill="#8b5cf6"
                          name="Submissions"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-zinc-500">No category data available</p>
                  )}
                </div>

                {/* Top Rated URLs (Table) */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                    Top Rated URLs
                  </h2>
                  {analyticsData.topUrls.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                              Title
                            </th>
                            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                              Rating
                            </th>
                            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                              👍
                            </th>
                            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                              👎
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.topUrls.map((url, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            >
                              <td className="py-3 px-4">
                                <a
                                  href={url.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                                >
                                  {url.title}
                                </a>
                              </td>
                              <td className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                                {(url.wilson_score * 100).toFixed(1)}%
                              </td>
                              <td className="text-center py-3 px-4 text-green-600 dark:text-green-400">
                                {url.upvotes}
                              </td>
                              <td className="text-center py-3 px-4 text-red-600 dark:text-red-400">
                                {url.downvotes}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-zinc-500">No URL data available</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {view === "queue" && (
        <ModerationDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={loadQueue}
        />
      )}
    </main>
  );
}
