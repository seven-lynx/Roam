"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { StatCard } from "@/app/admin/components/StatCard";
import { getAdminQueue, getAdminReports, restoreLinkAdmin } from "@/app/admin/actions";
import ModerationDetail from "@/app/admin/ModerationDetail";
import { AdminBadges } from "@/app/admin/views/AdminBadges";
import { ModeratorScrape } from "./views/ModeratorScrape";

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
type ViewType = "queue" | "analytics" | "badges" | "reports" | "scrape";

interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "queue",     label: "Moderation", icon: "🛂",  color: "bg-blue-600"   },
  { id: "analytics", label: "Analytics",  icon: "📊",  color: "bg-violet-600" },
  { id: "badges",    label: "Badges",     icon: "🏅",  color: "bg-purple-600" },
  { id: "reports",   label: "Dead Links", icon: "🚫",  color: "bg-red-600"    },
  { id: "scrape",    label: "Scrape",     icon: "🕷️",  color: "bg-teal-600"   },
];

const AdminAnalytics = dynamic(() => import("@/app/admin/views/AdminAnalytics"), { loading: () => <LoadingView /> });

function LoadingView() {
  return <div className="text-center text-zinc-500 py-12">Loading...</div>;
}

export default function ModeratorPageClient() {
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as ViewType | null) ?? "queue";
  const [view, setView] = useState<ViewType>(initialView);
  const [menuOpen, setMenuOpen] = useState(false);

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);

  const [reportedLinks, setReportedLinks] = useState<ReportedLink[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
        const urlStr = typeof urlData === "string" ? urlData : (urlData as { url?: string } | null)?.url ?? "";
        const existing = grouped.get(row.url_id);
        grouped.set(row.url_id, {
          url_id: row.url_id,
          reported_at: row.reported_at,
          report_count: (existing?.report_count ?? 0) + 1,
          url: urlStr,
          title: typeof urlData === "object" && urlData !== null ? (urlData as { title?: string }).title ?? null : null,
          inactive: typeof urlData === "object" && urlData !== null ? (urlData as { inactive?: boolean }).inactive ?? false : false,
        });
      }
      setReportedLinks([...grouped.values()].sort((a, b) => b.report_count - a.report_count));
    } catch (err) { console.error(err); }
    setReportsLoading(false);
  }, []);

  const restoreLink = useCallback(async (urlId: string) => {
    setRestoringId(urlId);
    await restoreLinkAdmin(urlId);
    setReportedLinks((prev) => prev.map((r) => r.url_id === urlId ? { ...r, inactive: false } : r));
    setRestoringId(null);
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (view === "reports") loadReports();
  }, [view, loadReports]);

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
      return item.url.toLowerCase().includes(q) || item.title?.toLowerCase().includes(q) || false;
    }
    return true;
  });

  const currentNav = NAV_ITEMS.find((n) => n.id === view) ?? NAV_ITEMS[0];

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 pb-20">
      <div className="mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col gap-4 sm:gap-6 max-w-4xl">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-zinc-900 dark:text-white">Moderation Panel</h1>
          <p className="mt-0.5 text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">Review submissions and manage content</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
          <StatCard label="Pending"  value={statusCounts.pending}  color="text-amber-600 dark:text-amber-400" />
          <StatCard label="Reports"  value={reportedLinks.length}  color="text-red-600 dark:text-red-400"    />
          <StatCard label="All Time" value={queueItems.length} />
        </div>

        {/* Nav dropdown */}
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
                  onClick={() => { setView(item.id); setMenuOpen(false); }}
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

        {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}

        <div>
          {view === "queue" && (
            <QueueView
              items={queueItems} loading={queueLoading} filteredItems={filteredItems}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              sortBy={sortBy} setSortBy={setSortBy}
              statusCounts={statusCounts} onSelectItem={setSelectedItem}
            />
          )}
          {view === "analytics" && <AdminAnalytics />}
          {view === "badges" && <AdminBadges />}
          {view === "scrape" && (
            <ModeratorScrape categories={categories} subcategories={allSubcategories} />
          )}
          {view === "reports" && (
            <ReportsView
              reportedLinks={reportedLinks} loading={reportsLoading}
              restoringId={restoringId} onRestore={restoreLink}
            />
          )}
        </div>
      </div>

      {view === "queue" && selectedItem && (
        <ModerationDetail
          item={selectedItem} onClose={() => setSelectedItem(null)}
          onUpdate={loadQueue} categories={categories} allSubcategories={allSubcategories}
        />
      )}
    </main>
  );
}

// ── Queue view ────────────────────────────────────────────────────────────────

function QueueView({
  items, loading, filteredItems, statusFilter, setStatusFilter,
  searchQuery, setSearchQuery, sortBy, setSortBy, statusCounts, onSelectItem,
}: {
  items: QueueItem[]; loading: boolean; filteredItems: QueueItem[];
  statusFilter: string; setStatusFilter: (v: "all" | "pending" | "approved" | "rejected") => void;
  searchQuery: string; setSearchQuery: (v: string) => void;
  sortBy: string; setSortBy: (v: "newest" | "oldest") => void;
  statusCounts: Record<string, number>; onSelectItem: (item: QueueItem | null) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  void items;
  return (
    <div className="flex flex-col gap-4">
      <input
        type="text" placeholder="Search URL, title..." value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400"
      />
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors self-start"
      >
        <span>{filtersOpen ? "▴" : "▾"}</span><span>Filters & Sort</span>
        {statusFilter !== "pending" && (
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 text-[10px]">{statusFilter}</span>
        )}
      </button>
      {filtersOpen && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {status === "all" ? `All (${statusCounts.all})` : `${status.charAt(0).toUpperCase() + status.slice(1)} (${statusCounts[status]})`}
              </button>
            ))}
          </div>
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      )}
      {loading
        ? <div className="text-center text-zinc-500 py-12">Loading...</div>
        : filteredItems.length === 0
          ? <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No submissions found.</div>
          : (
            <div className="flex flex-col gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id} onClick={() => onSelectItem(item)}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all line-clamp-2"
                      >{item.url}</a>
                      {item.title && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{item.title}</p>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded ${
                      item.status === "approved" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : item.status === "rejected" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    }`}>{item.status}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {item.created_at ? new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }) : "—"}
                  </span>
                </button>
              ))}
            </div>
          )
      }
    </div>
  );
}

// ── Reports view ──────────────────────────────────────────────────────────────

function ReportsView({ reportedLinks, loading, restoringId, onRestore }: {
  reportedLinks: ReportedLink[]; loading: boolean; restoringId: string | null; onRestore: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Dead Link Reports</h2>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 -mt-2">URLs reported as broken, sorted by report count</p>
      {loading
        ? <div className="text-center text-zinc-500 py-12">Loading...</div>
        : reportedLinks.length === 0
          ? <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center text-zinc-400 text-sm">No dead link reports yet.</div>
          : (
            <div className="flex flex-col gap-2">
              {reportedLinks.map((r) => (
                <div key={r.url_id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">{r.url}</a>
                  {r.title && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{r.title}</p>}
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                      <span><strong className="text-zinc-700 dark:text-zinc-300">{r.report_count}</strong> reports</span>
                      <span>{r.reported_at ? new Date(r.reported_at).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${r.inactive ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
                        {r.inactive ? "Inactive" : "Active"}
                      </span>
                      {r.inactive && (
                        <button
                          onClick={() => onRestore(r.url_id)} disabled={restoringId === r.url_id}
                          className="text-[10px] px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                        >
                          {restoringId === r.url_id ? "…" : "Restore"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
}
