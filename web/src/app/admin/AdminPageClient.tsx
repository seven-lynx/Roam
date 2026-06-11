"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { StatCard } from "./components/StatCard";
import { getAdminQueue, getAdminReports, getBetaSignups, deleteBetaSignup, restoreLinkAdmin, getNotificationCount, getEmailLogs, sendBulkEmail } from "./actions";
import type { BetaSignup, EmailLogEntry } from "./actions";
import ModerationDetail from "./ModerationDetail";

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

type ReportedLink = {
  url_id: string;
  reported_at: string;
  report_count: number;
  url: string;
  title: string | null;
  inactive: boolean;
};

type Category = { id: string; name: string };
type Subcategory = { id: string; name: string; category_id: string };

type ViewType = "queue" | "analytics" | "reports" | "beta" | "email";

interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "queue", label: "Moderation", icon: "\uD83D\uDEC3", color: "bg-blue-600" },
  { id: "analytics", label: "Analytics", icon: "\uD83D\uDCCA", color: "bg-violet-600" },
  { id: "reports", label: "Dead Links", icon: "\uD83D\uDEAB", color: "bg-red-600" },
  { id: "email", label: "Email", icon: "\uD83D\uDCE7", color: "bg-amber-600" },
  { id: "beta", label: "Beta Signups", icon: "\uD83D\uDD0C", color: "bg-emerald-600" },
];

// Lazy-loaded views
const AdminAnalytics = dynamic(() => import("./views/AdminAnalytics"), { loading: () => <LoadingView /> });
const AdminEmail = dynamic(() => import("./views/AdminEmail"), { loading: () => <LoadingView /> });

function LoadingView() {
  return <div className="text-center text-zinc-500 py-16">Loading...</div>;
}

export default function AdminPageClient() {
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as ViewType | null) || "queue";
  const [view, setView] = useState<ViewType>(initialView);

  // Shared state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);

  // Reports state
  const [reportedLinks, setReportedLinks] = useState<ReportedLink[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Beta state
  const [betaSignups, setBetaSignups] = useState<BetaSignup[]>([]);
  const [betaLoading, setBetaLoading] = useState(false);
  const [deletingBetaId, setDeletingBetaId] = useState<number | null>(null);

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const { data, error } = await getAdminQueue(sortBy);
      if (!error && data) {
        setQueueItems(data.map((item) => ({
          ...item,
          profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile,
        })));
      }
    } catch (err) { console.error(err); }
    setQueueLoading(false);
  }, [sortBy]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const { data, error } = await getAdminReports();
      if (error) throw new Error(error);
      const grouped = new Map<string, ReportedLink>();
      for (const row of data ?? []) {
        const urlData = row.url;
        if (!row.url_id || !urlData) continue;
        const existing = grouped.get(row.url_id);
        if (!existing) {
          grouped.set(row.url_id, { url_id: row.url_id, reported_at: row.reported_at, report_count: 1, url: urlData.url, title: urlData.title, inactive: urlData.inactive ?? false });
        } else {
          existing.report_count += 1;
          if (row.reported_at > existing.reported_at) existing.reported_at = row.reported_at;
        }
      }
      setReportedLinks([...grouped.values()].sort((a, b) => b.report_count - a.report_count));
    } catch (err) { console.error(err); }
    setReportsLoading(false);
  }, []);

  const loadBeta = useCallback(async () => {
    setBetaLoading(true);
    try {
      const { data, error } = await getBetaSignups();
      if (!error && data) setBetaSignups(data);
    } catch (err) { console.error(err); }
    setBetaLoading(false);
  }, []);

  const loadEmail = useCallback(async () => {
    setEmailLogsLoading(true);
    try {
      const { count } = await getNotificationCount();
      setNotificationCount(count);
      const { data } = await getEmailLogs();
      setEmailLogs(data ?? []);
    } catch (err) { console.error(err); }
    setEmailLogsLoading(false);
  }, []);

  const restoreLink = useCallback(async (urlId: string) => {
    setRestoringId(urlId);
    await restoreLinkAdmin(urlId);
    setReportedLinks((prev) => prev.map((r) => r.url_id === urlId ? { ...r, inactive: false } : r));
    setRestoringId(null);
  }, []);

  const deleteSignup = useCallback(async (id: number) => {
    setDeletingBetaId(id);
    await deleteBetaSignup(id);
    setBetaSignups((prev) => prev.filter((s) => s.id !== id));
    setDeletingBetaId(null);
  }, []);

  const handleSendEmail = useCallback(async () => {
    setEmailSending(true);
    setEmailResult(null);
    setEmailError(null);
    try {
      const { data, error } = await sendBulkEmail(emailSubject, emailBody);
      if (error) throw new Error(error);
      setEmailResult(`Sent to ${data?.sent ?? 0} recipients (${data?.failed ?? 0} failed)`);
      setEmailSubject("");
      setEmailBody("");
      loadEmail();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send email");
    }
    setEmailSending(false);
  }, [emailSubject, emailBody, loadEmail]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    switch (view) {
      case "reports": loadReports(); break;
      case "beta": loadBeta(); break;
      case "email": loadEmail(); break;
    }
  }, [view, loadReports, loadBeta, loadEmail]);

  // Load categories on mount
  useEffect(() => {
    (async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: cats } = await supabase.from("categories").select("id, name").order("name");
      const { data: subs } = await supabase.from("subcategories").select("id, name, category_id").order("name");
      if (cats) setCategories(cats);
      if (subs) setAllSubcategories(subs);
    })();
  }, []);

  const statusCounts = {
    all: queueItems.length,
    pending: queueItems.filter((i) => i.status === "pending").length,
    approved: queueItems.filter((i) => i.status === "approved").length,
    rejected: queueItems.filter((i) => i.status === "rejected").length,
  };

  const filteredItems = queueItems.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.url.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">Manage submissions and view analytics</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            System Dashboard
          </Link>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Pending" value={statusCounts.pending} color="text-amber-600 dark:text-amber-400" />
          <StatCard label="Reports" value={reportedLinks.length} color="text-red-600 dark:text-red-400" />
          <StatCard label="Beta Signups" value={betaSignups.length} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="All Time" value={queueItems.length} />
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="hidden md:flex flex-col gap-1 w-48 shrink-0">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  view === item.id
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.id === "queue" && statusCounts.pending > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {statusCounts.pending}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Mobile nav tabs */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === item.id
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            {view === "queue" && (
              <QueueView
                items={queueItems}
                loading={queueLoading}
                filteredItems={filteredItems}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                statusCounts={statusCounts}
                onSelectItem={setSelectedItem}
              />
            )}

            {view === "analytics" && <AdminAnalytics />}

            {view === "reports" && (
              <ReportsView
                reportedLinks={reportedLinks}
                loading={reportsLoading}
                restoringId={restoringId}
                onRestore={restoreLink}
              />
            )}

            {view === "beta" && (
              <BetaView
                signups={betaSignups}
                loading={betaLoading}
                deletingId={deletingBetaId}
                onDelete={deleteSignup}
              />
            )}

            {view === "email" && (
              <AdminEmail
                subject={emailSubject}
                body={emailBody}
                sending={emailSending}
                result={emailResult}
                error={emailError}
                notificationCount={notificationCount}
                logs={emailLogs}
                logsLoading={emailLogsLoading}
                onSubjectChange={setEmailSubject}
                onBodyChange={setEmailBody}
                onSend={handleSendEmail}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {view === "queue" && selectedItem && (
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

// ── Queue View ─────────────────────────────────────────────────────────────

function QueueView({
  items, loading, filteredItems, statusFilter, setStatusFilter,
  searchQuery, setSearchQuery, sortBy, setSortBy, statusCounts, onSelectItem,
}: {
  items: QueueItem[];
  loading: boolean;
  filteredItems: QueueItem[];
  statusFilter: string;
  setStatusFilter: (v: "all" | "pending" | "approved" | "rejected") => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  sortBy: string;
  setSortBy: (v: "newest" | "oldest") => void;
  statusCounts: Record<string, number>;
  onSelectItem: (item: QueueItem | null) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex gap-2 flex-wrap">
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
        <input
          type="text"
          placeholder="Search URL, title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-zinc-500 py-16">Loading...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">
          No submissions found.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left card-hover"
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
                  {item.title && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.title}</p>}
                </div>
                <span className={`whitespace-nowrap text-xs font-medium px-2 py-1 rounded ${
                  item.status === "approved"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : item.status === "rejected"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                }`}>
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
  );
}

// ── Reports View ────────────────────────────────────────────────────────────

function ReportsView({ reportedLinks, loading, restoringId, onRestore }: {
  reportedLinks: ReportedLink[];
  loading: boolean;
  restoringId: string | null;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Dead Link Reports</h2>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 -mt-3">URLs reported as broken, sorted by report count</p>
      {loading ? (
        <div className="text-center text-zinc-500 py-16">Loading...</div>
      ) : reportedLinks.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">No dead link reports yet.</div>
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
                <tr key={r.url_id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <td className="py-3 px-4">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all text-xs">{r.url}</a>
                    {r.title && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{r.title}</p>}
                  </td>
                  <td className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-white">{r.report_count}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">{new Date(r.reported_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</td>
                  <td className="text-center py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${r.inactive ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
                      {r.inactive ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.inactive && (
                      <button onClick={() => onRestore(r.url_id)} disabled={restoringId === r.url_id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >{restoringId === r.url_id ? "…" : "Restore"}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Beta View ───────────────────────────────────────────────────────────────

function BetaView({ signups, loading, deletingId, onDelete }: {
  signups: BetaSignup[];
  loading: boolean;
  deletingId: number | null;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Beta Signups</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Emails submitted via /android-beta</p>
          </div>
          {signups.length > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-center">
              <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{signups.length}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400">total</div>
            </div>
          )}
        </div>
        {loading ? (
          <div className="text-center text-zinc-500 py-8">Loading...</div>
        ) : signups.length === 0 ? (
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No signups yet.</div>
        ) : (
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
                {signups.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">{s.email}</td>
                    <td className="py-3 px-4 text-right text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => onDelete(s.id)} disabled={deletingId === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                      >{deletingId === s.id ? "…" : "Delete"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}