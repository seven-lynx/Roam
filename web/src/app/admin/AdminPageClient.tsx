"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ModerationDetail from "./ModerationDetail";
import { getAdminAnalytics } from "./actions";


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

type AnalyticsData = {
  submissionsByDate: { date: string; count: number }[];
  submissionsByCategory: { category: string; count: number }[];
  topUrls: { url: string; title: string; wilson_score: number; upvotes: number; downvotes: number }[];
};

const EMPTY_ANALYTICS: AnalyticsData = {
  submissionsByDate: [],
  submissionsByCategory: [],
  topUrls: [],
};

type ReportedLink = {
  url_id: string;
  reported_at: string;
  report_count: number;
  url: string;
  title: string | null;
  inactive: boolean;
};

export default function AdminPageClient() {
  const supabase = createClient();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [view, setView] = useState<"queue" | "analytics" | "reports">("queue");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [reportedLinks, setReportedLinks] = useState<ReportedLink[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);

  async function loadCategories() {
    try {
      const { data: cats } = await supabase.from("categories").select("id, name").order("name");
      const { data: subs } = await supabase.from("subcategories").select("id, name, category_id").order("name");
      if (cats) setCategories(cats);
      if (subs) setAllSubcategories(subs);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  async function loadQueue() {
    try {
      const { data, error } = await supabase
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
          profile:profiles!submitted_by(display_name, username),
          subcategory:subcategories(id, name, category_id, category:categories(id, name))
        `)
        .order("created_at", { ascending: sortBy === "oldest" });

      if (error) {
        console.error("Failed to load moderation queue:", error);
        return;
      }

      setItems(
        (data ?? []).map((item) => ({
          ...item,
          profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile,
        }))
      );
    } catch (err) {
      console.error("Failed to load moderation queue:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAnalytics() {
    if (analyticsLoaded) return; // don't re-fetch on tab switch
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const { data: result, error } = await getAdminAnalytics();
      if (error || !result) throw new Error(error ?? "No data");
      setAnalyticsData({
        submissionsByDate: result.submissions_by_date ?? [],
        submissionsByCategory: result.submissions_by_category ?? [],
        topUrls: result.top_urls ?? [],
      });
      setAnalyticsLoaded(true);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setAnalyticsError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadReports() {
    setReportsLoading(true);
    try {
      // Aggregate report counts per URL, then join with urls for details
      const { data, error } = await supabase
        .from("url_reports")
        .select("url_id, reported_at, url:urls(url, title, inactive)")
        .order("reported_at", { ascending: false });

      if (error) throw error;

      // Group by url_id, keep the most recent reported_at and count reports
      const grouped = new Map<string, ReportedLink>();
      for (const row of data ?? []) {
        const urlData = Array.isArray(row.url) ? row.url[0] : row.url;
        if (!row.url_id || !urlData) continue;
        const existing = grouped.get(row.url_id);
        if (!existing) {
          grouped.set(row.url_id, {
            url_id: row.url_id,
            reported_at: row.reported_at,
            report_count: 1,
            url: urlData.url,
            title: urlData.title,
            inactive: urlData.inactive ?? false,
          });
        } else {
          existing.report_count += 1;
          if (row.reported_at > existing.reported_at) {
            existing.reported_at = row.reported_at;
          }
        }
      }

      setReportedLinks(
        [...grouped.values()].sort((a, b) => b.report_count - a.report_count)
      );
    } catch (err) {
      console.error("Failed to load dead link reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }

  async function restoreLink(urlId: string) {
    setRestoringId(urlId);
    try {
      await supabase.from("urls").update({ inactive: false }).eq("id", urlId);
      setReportedLinks((prev) =>
        prev.map((r) => r.url_id === urlId ? { ...r, inactive: false } : r)
      );
    } finally {
      setRestoringId(null);
    }
  }

  useEffect(() => {
    loadQueue();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  useEffect(() => {
    loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "analytics") {
      loadAnalytics();
    }
    if (view === "reports") {
      loadReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const statusCounts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.url.toLowerCase().includes(q) ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
          <button
            onClick={() => setView("reports")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "reports"
                ? "bg-red-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Dead Links
          </button>
          <Link
            href="/admin/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            System Dashboard
          </Link>
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
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">
                No submissions found.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredItems.map((item) => (
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
                      {new Date(item.created_at ?? '').toLocaleString()}
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
            ) : analyticsError ? (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-700 dark:text-red-400">
                Failed to load analytics: {analyticsError}
              </div>
            ) : (
              <>
                {/* Submissions by Date */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Submissions Over Time
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Last 30 days</p>
                  {analyticsData.submissionsByDate.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const max = Math.max(...analyticsData.submissionsByDate.map((x) => x.count), 1);
                        return analyticsData.submissionsByDate.map((d) => (
                          <div key={d.date} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-right text-zinc-500 shrink-0">
                              {new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                            </span>
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <div className="bg-blue-500 rounded h-4" style={{ width: `${(d.count / max) * 100}%` }} />
                            </div>
                            <span className="w-6 text-right text-zinc-700 dark:text-zinc-300">{d.count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No submissions in the last 30 days</p>
                  )}
                </div>

                {/* Submissions by Category */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Submissions by Category
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Top 10 parent categories, all time</p>
                  {analyticsData.submissionsByCategory.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const max = Math.max(...analyticsData.submissionsByCategory.map((x) => x.count), 1);
                        return analyticsData.submissionsByCategory.map((d) => (
                          <div key={d.category} className="flex items-center gap-2 text-xs">
                            <span className="w-36 truncate text-right text-zinc-500 shrink-0">{d.category}</span>
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <div className="bg-violet-500 rounded h-4" style={{ width: `${(d.count / max) * 100}%` }} />
                            </div>
                            <span className="w-6 text-right text-zinc-700 dark:text-zinc-300">{d.count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No category data available</p>
                  )}
                </div>

                {/* Top Rated URLs */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Top Rated URLs
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Highest Wilson score among rated URLs</p>
                  {analyticsData.topUrls.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">Title</th>
                            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white w-20">Score</th>
                            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white w-24">👍 / 👎</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.topUrls.map((url) => (
                            <tr
                              key={url.url}
                              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            >
                              <td className="py-3 px-4">
                                <a
                                  href={url.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                >
                                  {url.title}
                                </a>
                              </td>
                              <td className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white tabular-nums">
                                {url.wilson_score}%
                              </td>
                              <td className="text-center py-3 px-4 text-xs tabular-nums">
                                <span className="text-green-600 dark:text-green-400">{url.upvotes}</span>
                                <span className="text-zinc-400 mx-1">/</span>
                                <span className="text-red-600 dark:text-red-400">{url.downvotes}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No rated URLs yet</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* Dead Links View */}
        {view === "reports" && (
          <div className="flex flex-col gap-4">
            {reportsLoading ? (
              <div className="text-center text-zinc-500">Loading...</div>
            ) : reportedLinks.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">
                No dead link reports yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                      <th className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">URL</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-20">Reports</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-36">Last reported</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-24">Status</th>
                      <th className="py-3 px-4 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportedLinks.map((r) => (
                      <tr
                        key={r.url_id}
                        className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                      >
                        <td className="py-3 px-4">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs"
                          >
                            {r.url}
                          </a>
                          {r.title && (
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{r.title}</p>
                          )}
                        </td>
                        <td className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                          {r.report_count}
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(r.reported_at).toLocaleDateString()}
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            r.inactive
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                          }`}>
                            {r.inactive ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {r.inactive && (
                            <button
                              onClick={() => restoreLink(r.url_id)}
                              disabled={restoringId === r.url_id}
                              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                            >
                              {restoringId === r.url_id ? "…" : "Restore"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          categories={categories}
          allSubcategories={allSubcategories}
        />
      )}
    </main>
  );
}
