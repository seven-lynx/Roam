"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ModerationDetail from "./ModerationDetail";
import { getAdminAnalytics, getAdminQueue, getAdminReports, getBetaSignups, deleteBetaSignup, restoreLinkAdmin, getNotificationCount, getEmailLogs, sendBulkEmail } from "./actions";
import type { BetaSignup, EmailLogEntry } from "./actions";


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
  queueStats: { approved: number; rejected: number; pending: number };
  topRatedCategories: { category: string; rated_urls: number; avg_score: number }[];
  sourceBreakdown: { source: string; count: number }[];
  languageDistribution: { language: string; count: number }[];
  deadByCategory: { category: string; total: number; inactive_count: number; dead_pct: number }[];
};

const EMPTY_ANALYTICS: AnalyticsData = {
  submissionsByDate: [],
  submissionsByCategory: [],
  topUrls: [],
  queueStats: { approved: 0, rejected: 0, pending: 0 },
  topRatedCategories: [],
  sourceBreakdown: [],
  languageDistribution: [],
  deadByCategory: [],
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
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "beta" ? "beta" : searchParams.get("view") === "reports" ? "reports" : searchParams.get("view") === "analytics" ? "analytics" : searchParams.get("view") === "email" ? "email" : "queue";
  const [view, setView] = useState<"queue" | "analytics" | "reports" | "beta" | "email">(initialView);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [reportedLinks, setReportedLinks] = useState<ReportedLink[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [betaSignups, setBetaSignups] = useState<BetaSignup[]>([]);
  const [betaLoading, setBetaLoading] = useState(false);
  const [deletingBetaId, setDeletingBetaId] = useState<number | null>(null);

  // ─── Email tab state ───────────────────────────────────────────────────
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  async function loadEmailLogs() {
    setEmailLogsLoading(true);
    try {
      const { data, error } = await getEmailLogs();
      if (error) throw new Error(error);
      setEmailLogs(data ?? []);
    } catch (err) {
      console.error("Failed to load email logs:", err);
    } finally {
      setEmailLogsLoading(false);
    }
  }

  async function loadNotificationCount() {
    const { count, error } = await getNotificationCount();
    if (!error) setNotificationCount(count);
  }

  async function handleSendEmail() {
    setEmailSending(true);
    setEmailResult(null);
    setEmailError(null);
    try {
      const { data, error } = await sendBulkEmail(emailSubject, emailBody);
      if (error) throw new Error(error);
      setEmailResult(`Sent to ${data?.sent ?? 0} recipients (${data?.failed ?? 0} failed)`);
      setEmailSubject("");
      setEmailBody("");
      loadEmailLogs();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  }

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
      const { data, error } = await getAdminQueue(sortBy);

      if (error || !data) {
        console.error("Failed to load moderation queue:", error);
        return;
      }

      setItems(
        data.map((item) => ({
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
        queueStats: result.queue_stats ?? { approved: 0, rejected: 0, pending: 0 },
        topRatedCategories: result.top_rated_categories ?? [],
        sourceBreakdown: result.source_breakdown ?? [],
        languageDistribution: result.language_distribution ?? [],
        deadByCategory: result.dead_by_category ?? [],
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
      const { data, error } = await getAdminReports();

      if (error) throw new Error(error);

      // Group by url_id, keep the most recent reported_at and count reports
      const grouped = new Map<string, ReportedLink>();
      for (const row of data ?? []) {
        const urlData = row.url;
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
      const { error } = await restoreLinkAdmin(urlId);
      if (error) {
        console.error("Failed to restore link:", error);
        return;
      }
      setReportedLinks((prev) =>
        prev.map((r) => r.url_id === urlId ? { ...r, inactive: false } : r)
      );
    } finally {
      setRestoringId(null);
    }
  }

  async function loadBetaSignups() {
    setBetaLoading(true);
    try {
      const { data, error } = await getBetaSignups();
      if (error) throw new Error(error);
      setBetaSignups(data ?? []);
    } catch (err) {
      console.error("Failed to load beta signups:", err);
    } finally {
      setBetaLoading(false);
    }
  }

  async function deleteSignup(id: number) {
    setDeletingBetaId(id);
    try {
      const { error } = await deleteBetaSignup(id);
      if (error) {
        console.error("Failed to delete signup:", error);
        return;
      }
      setBetaSignups((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingBetaId(null);
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
    if (view === "beta") {
      loadBetaSignups();
    }
    if (view === "email") {
      loadEmailLogs();
      loadNotificationCount();
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
        <div className="flex gap-2 flex-wrap">
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
          <button
            onClick={() => setView("beta")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "beta"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Beta Signups
          </button>
          <button
            onClick={() => setView("email")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "email"
                ? "bg-amber-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Email Users
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
                      {new Date(item.created_at ?? '').toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}
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

                {/* Queue Stats */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Moderation Queue
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">All-time submission counts by status</p>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { label: "Approved", value: analyticsData.queueStats.approved, color: "text-green-600 dark:text-green-400" },
                      { label: "Rejected", value: analyticsData.queueStats.rejected, color: "text-red-600 dark:text-red-400" },
                      { label: "Pending",  value: analyticsData.queueStats.pending,  color: "text-amber-600 dark:text-amber-400" },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
                        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                        <div className="text-xs text-zinc-500 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                  {(analyticsData.queueStats.approved + analyticsData.queueStats.rejected) > 0 && (
                    <p className="mt-3 text-xs text-zinc-400">
                      Approval rate:{" "}
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                        {Math.round(analyticsData.queueStats.approved / (analyticsData.queueStats.approved + analyticsData.queueStats.rejected) * 100)}%
                      </span>
                      {" "}of reviewed submissions
                    </p>
                  )}
                </div>

                {/* Top Rated Categories */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Top Rated Categories
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Average Wilson score per category (min. 5 rated URLs)</p>
                  {analyticsData.topRatedCategories.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const max = Math.max(...analyticsData.topRatedCategories.map((x) => x.avg_score), 1);
                        return analyticsData.topRatedCategories.map((d) => (
                          <div key={d.category} className="flex items-center gap-2 text-xs">
                            <span className="w-36 truncate text-right text-zinc-500 shrink-0">{d.category}</span>
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <div className="bg-emerald-500 rounded h-4" style={{ width: `${(d.avg_score / max) * 100}%` }} />
                            </div>
                            <span className="w-20 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {d.avg_score}% <span className="text-zinc-400">({d.rated_urls})</span>
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">Not enough rated URLs yet</p>
                  )}
                </div>

                {/* Source Breakdown */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Source Breakdown
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Approved, active URLs by seeder — refreshed weekly</p>
                  {analyticsData.sourceBreakdown.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const max = Math.max(...analyticsData.sourceBreakdown.map((x) => x.count), 1);
                        const total = analyticsData.sourceBreakdown.reduce((s, x) => s + x.count, 0);
                        return analyticsData.sourceBreakdown.map((d) => (
                          <div key={d.source} className="flex items-center gap-2 text-xs">
                            <span className="w-36 truncate text-right text-zinc-500 shrink-0 font-mono">{d.source}</span>
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <div className="bg-sky-500 rounded h-4" style={{ width: `${(d.count / max) * 100}%` }} />
                            </div>
                            <span className="w-28 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {d.count.toLocaleString()} <span className="text-zinc-400">({(d.count / total * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No data yet</p>
                  )}
                </div>

                {/* Language Distribution */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Language Distribution
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Top 15 languages — approved, active URLs — refreshed weekly</p>
                  {analyticsData.languageDistribution.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {(() => {
                        const max = Math.max(...analyticsData.languageDistribution.map((x) => x.count), 1);
                        const total = analyticsData.languageDistribution.reduce((s, x) => s + x.count, 0);
                        return analyticsData.languageDistribution.map((d) => (
                          <div key={d.language} className="flex items-center gap-2 text-xs">
                            <span className="w-8 text-right text-zinc-500 shrink-0 font-mono uppercase">{d.language}</span>
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                              <div className="bg-orange-400 rounded h-4" style={{ width: `${(d.count / max) * 100}%` }} />
                            </div>
                            <span className="w-28 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                              {d.count.toLocaleString()} <span className="text-zinc-400">({(d.count / total * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No data yet</p>
                  )}
                </div>

                {/* Dead URL Rate by Category */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Dead URL Rate by Category
                  </h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Inactive approved URLs as % of total — refreshed weekly</p>
                  {analyticsData.deadByCategory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">Category</th>
                            <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-28">Total</th>
                            <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-24">Inactive</th>
                            <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-20">Dead %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.deadByCategory.map((row) => (
                            <tr
                              key={row.category}
                              className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            >
                              <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{row.category}</td>
                              <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.total.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.inactive_count.toLocaleString()}</td>
                              <td className={`py-3 px-4 text-right tabular-nums font-semibold ${
                                row.dead_pct >= 3 ? "text-red-600 dark:text-red-400" :
                                row.dead_pct >= 1.5 ? "text-amber-600 dark:text-amber-400" :
                                "text-green-600 dark:text-green-400"
                              }`}>
                                {row.dead_pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No data yet</p>
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
                          {new Date(r.reported_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
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

      {/* Beta Signups View */}
      {view === "beta" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
              Beta Signups
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Emails submitted via /beta — newest first
            </p>
            {betaLoading ? (
              <div className="text-center text-zinc-500 py-8">Loading...</div>
            ) : betaSignups.length === 0 ? (
              <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">
                No signups yet.
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-center">
                    <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {betaSignups.length}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">total signups</div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                        <th className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">Email</th>
                        <th className="text-right py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-48">Signed up</th>
                        <th className="py-3 px-4 w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {betaSignups.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {s.email}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-zinc-500 whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => deleteSignup(s.id)}
                              disabled={deletingBetaId === s.id}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                            >
                              {deletingBetaId === s.id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Email View */}
      {view === "email" && (
        <div className="flex flex-col gap-8">
          {/* Compose */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
              Send Email to All Users
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Sends to every user with email notifications enabled. Emails include an unsubscribe link.
            </p>
            {notificationCount !== null && (
              <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <strong>{notificationCount}</strong> user{notificationCount !== 1 ? "s" : ""} with notifications enabled
              </div>
            )}
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Subject line"
                value={emailSubject}
                onChange={(e) => { setEmailSubject(e.target.value); setEmailResult(null); setEmailError(null); }}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
              <textarea
                placeholder={"Write your email in Markdown...\n\n# Heading\n\nThis is **bold** and *italic*.\n\n- List item 1\n- List item 2\n\n[Link text](https://example.com)"}
                value={emailBody}
                onChange={(e) => { setEmailBody(e.target.value); setEmailResult(null); setEmailError(null); }}
                rows={12}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-mono resize-y"
              />
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                  className="rounded-lg bg-amber-600 text-white py-2.5 px-6 text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition-opacity"
                >
                  {emailSending ? "Sending…" : "Send to All"}
                </button>
                {emailResult && (
                  <p className="text-sm text-green-600 dark:text-green-400">{emailResult}</p>
                )}
                {emailError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {emailBody.trim() && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Preview</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Rough preview — email clients may render differently.</p>
              <div className="rounded-lg border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap">
                {emailBody}
              </div>
            </div>
          )}

          {/* History */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Email History</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Last 50 sends</p>
            {emailLogsLoading ? (
              <div className="text-center text-zinc-500 py-8">Loading...</div>
            ) : emailLogs.length === 0 ? (
              <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">
                No emails sent yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                      <th className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">Subject</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-20">Sent</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-20">Failed</th>
                      <th className="text-right py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300 w-40">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                      >
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                          {log.subject}
                        </td>
                        <td className="text-center py-3 px-4 tabular-nums">
                          <span className="font-semibold text-green-600 dark:text-green-400">{log.success_count}</span>
                          <span className="text-zinc-400">/{log.recipient_count}</span>
                        </td>
                        <td className="text-center py-3 px-4 tabular-nums">
                          {log.fail_count > 0 ? (
                            <span className="font-semibold text-red-600 dark:text-red-400">{log.fail_count}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(log.sent_at).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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