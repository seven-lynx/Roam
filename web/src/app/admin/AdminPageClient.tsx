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

const AdminAnalytics = dynamic(() => import("./views/AdminAnalytics"), { loading: () => <LoadingView /> });
const AdminEmail = dynamic(() => import("./views/AdminEmail"), { loading: () => <LoadingView /> });

function LoadingView() {
  return <div className="text-center text-zinc-500 py-12">Loading...</div>;
}

export default function AdminPageClient() {
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as ViewType | null) || "queue";
  const [view, setView] = useState<ViewType>(initialView);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const currentNav = NAV_ITEMS.find((n) => n.id === view) ?? NAV_ITEMS[0];

  const handleNavSelect = (id: ViewType) => {
    setView(id);
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
      <div className="mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col gap-4 sm:gap-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
            <p className="mt-0.5 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">Manage submissions and view analytics</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            System Dashboard
          </Link>
        </div>

        {/* Quick stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <StatCard label="Pending" value={statusCounts.pending} color="text-amber-600 dark:text-amber-400" />
          <StatCard label="Reports" value={reportedLinks.length} color="text-red-600 dark:text-red-400" />
          <StatCard label="Beta" value={betaSignups.length} color="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="All Time" value={queueItems.length} />
        </div>

        {/* Mobile menu dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>{currentNav.icon}</span>
            <span>{currentNav.label}</span>
            {view === "queue" && statusCounts.pending > 0 && (
              <span className="ml-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {statusCounts.pending}
              </span>
            )}
            <span className="ml-auto text-zinc-400 text-lg leading-none">{menuOpen ? "▴" : "▾"}</span>
          </button>

          {menuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavSelect(item.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ${
                    view === item.id
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
            </div>
          )}
        </div>

        {/* Backdrop for menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
        )}

        {/* Content */}
        <div>
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <input
        type="text"
        placeholder="Search URL, title..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400"
      />

      {/* Filters toggle */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors self-start"
      >
        <span>{filtersOpen ? "▴" : "▾"}</span>
        <span>Filters & Sort</span>
        {statusFilter !== "all" && (
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[10px]">
            {statusFilter}
          </span>
        )}
      </button>

      {filtersOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/50">
          {/* Status chips */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {status === "all"
                  ? `All (${statusCounts.all})`
                  : `${status.charAt(0).toUpperCase() + status.slice(1)} (${statusCounts[status]})`}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center text-zinc-500 py-12">Loading...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">
          No submissions found.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all line-clamp-2"
                  >
                    {item.url}
                  </a>
                  {item.title && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{item.title}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded ${
                  item.status === "approved"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : item.status === "rejected"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                }`}>
                  {item.status}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">
                {item.created_at ? new Date(item.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }) : '—'}
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
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Dead Link Reports</h2>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 -mt-2">URLs reported as broken, sorted by report count</p>

      {loading ? (
        <div className="text-center text-zinc-500 py-12">Loading...</div>
      ) : reportedLinks.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">
          No dead link reports yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reportedLinks.map((r) => (
            <div key={r.url_id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">
                {r.url}
              </a>
              {r.title && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{r.title}</p>}
              <div className="flex items-center justify-between mt-2 text-xs">
                <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                  <span><strong className="text-zinc-700 dark:text-zinc-300">{r.report_count}</strong> reports</span>
                  <span>{r.reported_at ? new Date(r.reported_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${r.inactive ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
                    {r.inactive ? "Inactive" : "Active"}
                  </span>
                  {r.inactive && (
                    <button onClick={() => onRestore(r.url_id)} disabled={restoringId === r.url_id}
                      className="text-[10px] px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >{restoringId === r.url_id ? "…" : "Restore"}</button>
                  )}
                </div>
              </div>
            </div>
          ))}
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
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Beta Signups</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Emails submitted via /android-beta</p>
          </div>
          {signups.length > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-center shrink-0">
              <div className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{signups.length}</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">total</div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 py-8">Loading...</div>
        ) : signups.length === 0 ? (
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No signups yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {signups.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{s.email}</span>
                  <span className="block text-[10px] text-zinc-400 mt-0.5">
                    {s.created_at ? new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }) : '—'}
                  </span>
                </div>
                <button onClick={() => onDelete(s.id)} disabled={deletingId === s.id}
                  className="shrink-0 ml-3 text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                >{deletingId === s.id ? "…" : "Delete"}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}