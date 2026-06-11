"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminAnalytics } from "../actions";
import { BarChart } from "../components/BarChart";
import { SectionCard } from "../components/BarChart";

type AnalyticsData = {
  submissionsByDate: { date: string; count: number }[];
  submissionsByCategory: { category: string; count: number }[];
  topUrls: { url: string; title: string; wilson_score: number; upvotes: number; downvotes: number }[];
  queueStats: { approved: number; rejected: number; pending: number };
  topRatedCategories: { category: string; rated_urls: number; avg_score: number }[];
  sourceBreakdown: { source: string; count: number }[];
  languageDistribution: { language: string; count: number }[];
  deadByCategory: { category: string; total: number; inactive_count: number; dead_pct: number }[];
  activeUsers: { dau: number; wau: number; mau: number };
  submissionsByDowHour: { dow: number; hour: number; count: number }[];
  velocity: { thisWeek: number; lastWeek: number };
  rejectionByDomain: { domain: string; total: number; rejected: number; rejectionPct: number }[];
};

const EMPTY: AnalyticsData = {
  submissionsByDate: [], submissionsByCategory: [], topUrls: [],
  queueStats: { approved: 0, rejected: 0, pending: 0 },
  topRatedCategories: [], sourceBreakdown: [], languageDistribution: [],
  deadByCategory: [], activeUsers: { dau: 0, wau: 0, mau: 0 },
  submissionsByDowHour: [], velocity: { thisWeek: 0, lastWeek: 0 },
  rejectionByDomain: [],
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = ["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"];

function AccordionSection({ title, description, defaultOpen = false, children }: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h2>
          {description && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{description}</p>}
        </div>
        <span className="text-zinc-400 text-sm shrink-0 ml-3">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">{children}</div>}
    </div>
  );
}

function MobileTable({ headers, rows }: {
  headers: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
}) {
  if (rows.length === 0) return <p className="text-zinc-500 dark:text-zinc-400 text-sm py-4">No data available.</p>;
  return (
    <>
      {/* Mobile card view */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            {headers.map((h) => (
              <div key={h.key} className="flex items-center justify-between py-1 first:pt-0 last:pb-0">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{h.label}</span>
                <span className="text-xs font-medium text-zinc-900 dark:text-white text-right">{row[h.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
              {headers.map((h) => (
                <th key={h.key} className="text-left py-3 px-4 font-semibold text-zinc-700 dark:text-zinc-300">{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                {headers.map((h) => (
                  <td key={h.key} className="py-3 px-4">{row[h.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedAll, setExpandedAll] = useState(false);

  const loadData = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const { data: result, error: err } = await getAdminAnalytics();
      if (err || !result) throw new Error(err ?? "No data");
      setData({
        submissionsByDate: result.submissions_by_date ?? [],
        submissionsByCategory: result.submissions_by_category ?? [],
        topUrls: result.top_urls ?? [],
        queueStats: result.queue_stats ?? { approved: 0, rejected: 0, pending: 0 },
        topRatedCategories: result.top_rated_categories ?? [],
        sourceBreakdown: result.source_breakdown ?? [],
        languageDistribution: result.language_distribution ?? [],
        deadByCategory: result.dead_by_category ?? [],
        activeUsers: result.active_users ?? { dau: 0, wau: 0, mau: 0 },
        submissionsByDowHour: result.submissions_by_dow_hour ?? [],
        velocity: { thisWeek: result.velocity?.this_week ?? 0, lastWeek: result.velocity?.last_week ?? 0 },
        rejectionByDomain: (result.rejection_by_domain ?? []).map((d: { domain: string; total: number; rejected: number; rejection_pct: number }) => ({ domain: d.domain, total: d.total, rejected: d.rejected, rejectionPct: d.rejection_pct })),
      });
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    }
    setLoading(false);
  }, [loaded]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="text-center text-zinc-500 py-12">Loading analytics...</div>;
  if (error) return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
      Failed to load analytics: {error}
      <button onClick={() => { setLoaded(false); setError(null); }} className="ml-3 underline hover:no-underline">Retry</button>
    </div>
  );

  // Build heatmap summaries
  const dowTotals = DOW_LABELS.map((label, dow) => ({
    label,
    count: data.submissionsByDowHour.filter((s) => s.dow === dow).reduce((sum, s) => sum + s.count, 0),
  }));
  const hourTotals = HOUR_LABELS.map((label, hour) => ({
    label,
    count: data.submissionsByDowHour.filter((s) => s.hour === hour).reduce((sum, s) => sum + s.count, 0),
  }));

  const maxDow = Math.max(...dowTotals.map((d) => d.count), 1);
  const maxHour = Math.max(...hourTotals.map((h) => h.count), 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Expand/collapse all */}
      <button
        onClick={() => setExpandedAll(!expandedAll)}
        className="self-end text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        {expandedAll ? "Collapse all" : "Expand all"}
      </button>

      {/* Active Users - always visible */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Active Users</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">Based on browsing + voting activity signals</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{data.activeUsers.dau.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">DAU</div>
            <div className="text-[10px] text-zinc-400">Past 24h</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{data.activeUsers.wau.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">WAU</div>
            <div className="text-[10px] text-zinc-400">Past 7d</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.activeUsers.mau.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">MAU</div>
            <div className="text-[10px] text-zinc-400">Past 30d</div>
          </div>
        </div>
        {data.activeUsers.mau > 0 && (
          <div className="mt-3 text-xs text-zinc-500">
            Stickiness: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums">{(data.activeUsers.dau / data.activeUsers.mau * 100).toFixed(1)}%</strong>
          </div>
        )}
      </div>

      {/* Submissions Over Time */}
      <AccordionSection title="Submissions Over Time" description="Last 30 days" defaultOpen={expandedAll}>
        <BarChart data={data.submissionsByDate.map(d => ({ label: new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: d.count }))} color="bg-blue-500" />
      </AccordionSection>

      {/* Submissions by Category */}
      <AccordionSection title="Submissions by Category" description="Top 10 parent categories" defaultOpen={expandedAll}>
        <BarChart data={data.submissionsByCategory.map(d => ({ label: d.category, value: d.count }))} color="bg-violet-500" />
      </AccordionSection>

      {/* Moderation Queue */}
      <AccordionSection title="Moderation Queue" description="All-time submission counts by status" defaultOpen={expandedAll}>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{data.queueStats.approved}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Approved</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{data.queueStats.rejected}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Rejected</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{data.queueStats.pending}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Pending</div>
          </div>
        </div>
      </AccordionSection>

      {/* Top Rated URLs */}
      <AccordionSection title="Top Rated URLs" description="Highest Wilson score" defaultOpen={expandedAll}>
        <MobileTable
          headers={[
            { key: "title", label: "Title" },
            { key: "score", label: "Score" },
            { key: "votes", label: "👍/👎" },
          ]}
          rows={data.topUrls.map((u) => ({
            title: <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{u.title}</a>,
            score: <span className="font-semibold tabular-nums">{u.wilson_score}%</span>,
            votes: <span className="text-xs"><span className="text-green-600 dark:text-green-400">{u.upvotes}</span><span className="text-zinc-400 mx-1">/</span><span className="text-red-600 dark:text-red-400">{u.downvotes}</span></span>,
          }))}
        />
      </AccordionSection>

      {/* Top Rated Categories */}
      <AccordionSection title="Top Rated Categories" description="Average Wilson score per category" defaultOpen={expandedAll}>
        <BarChart data={data.topRatedCategories.map(d => ({ label: d.category, value: d.avg_score }))} color="bg-emerald-500" />
      </AccordionSection>

      {/* Source Breakdown */}
      <AccordionSection title="Source Breakdown" description="Approved URLs by seeder" defaultOpen={expandedAll}>
        <BarChart data={data.sourceBreakdown.map(d => ({ label: d.source, value: d.count }))} color="bg-sky-500" />
      </AccordionSection>

      {/* Language Distribution */}
      <AccordionSection title="Language Distribution" description="Top 15 languages" defaultOpen={expandedAll}>
        <BarChart data={data.languageDistribution.map(d => ({ label: d.language.toUpperCase(), value: d.count }))} color="bg-orange-400" />
      </AccordionSection>

      {/* Content Velocity */}
      <AccordionSection title="Content Velocity" description="Approved URLs this week vs last week" defaultOpen={expandedAll}>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{data.velocity.thisWeek.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">This week</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{data.velocity.lastWeek.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">Last week</div>
          </div>
        </div>
        {data.velocity.lastWeek > 0 && (
          <p className="mt-3 text-xs text-zinc-400">
            Change: <span className={`font-semibold tabular-nums ${data.velocity.thisWeek >= data.velocity.lastWeek ? "text-green-600" : "text-red-600"}`}>
              {data.velocity.thisWeek >= data.velocity.lastWeek ? "+" : ""}{Math.round((data.velocity.thisWeek - data.velocity.lastWeek) / data.velocity.lastWeek * 100)}%
            </span>
          </p>
        )}
      </AccordionSection>

      {/* Submission Timing - simplified for mobile */}
      <AccordionSection title="Submission Timing" description="Day-of-week × hour (ET)" defaultOpen={expandedAll}>
        {data.submissionsByDowHour.length > 0 ? (
          <div className="flex flex-col gap-4">
            {/* By Day of Week */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">By Day of Week</h3>
              <div className="flex flex-col gap-1">
                {dowTotals.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-right text-zinc-500 dark:text-zinc-400 shrink-0">{d.label}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded h-5 overflow-hidden">
                      <div
                        className="bg-blue-500 rounded h-5 transition-all"
                        style={{ width: `${(d.count / maxDow) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Hour */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">By Hour</h3>
              <div className="flex flex-col gap-1">
                {hourTotals.map((h) => (
                  <div key={h.label} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-right text-zinc-500 dark:text-zinc-400 shrink-0">{h.label}</span>
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded h-5 overflow-hidden">
                      <div
                        className="bg-blue-500 rounded h-5 transition-all"
                        style={{ width: `${(h.count / maxHour) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-zinc-700 dark:text-zinc-300 tabular-nums shrink-0">{h.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : <p className="text-zinc-500 text-sm">No data yet</p>}
      </AccordionSection>

      {/* Dead URL Rate by Category */}
      <AccordionSection title="Dead URL Rate by Category" description="Inactive approved URLs as % of total" defaultOpen={expandedAll}>
        <MobileTable
          headers={[
            { key: "category", label: "Category" },
            { key: "total", label: "Total" },
            { key: "inactive", label: "Inactive" },
            { key: "deadPct", label: "Dead %" },
          ]}
          rows={data.deadByCategory.map((row) => ({
            category: <span className="text-zinc-700 dark:text-zinc-300">{row.category}</span>,
            total: <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{row.total.toLocaleString()}</span>,
            inactive: <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{row.inactive_count.toLocaleString()}</span>,
            deadPct: (
              <span className={`font-semibold tabular-nums ${row.dead_pct >= 3 ? "text-red-600 dark:text-red-400" : row.dead_pct >= 1.5 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                {row.dead_pct}%
              </span>
            ),
          }))}
        />
      </AccordionSection>

      {/* Rejection Rate by Domain */}
      <AccordionSection title="Rejection Rate by Domain" description="Top domains with highest rejection rate (min. 5 submissions)" defaultOpen={expandedAll}>
        <MobileTable
          headers={[
            { key: "domain", label: "Domain" },
            { key: "total", label: "Total" },
            { key: "rejected", label: "Rejected" },
            { key: "rejPct", label: "Rej. %" },
          ]}
          rows={data.rejectionByDomain.map((d) => ({
            domain: <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-[160px] block">{d.domain}</span>,
            total: <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{d.total}</span>,
            rejected: <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{d.rejected}</span>,
            rejPct: (
              <span className={`font-semibold tabular-nums ${d.rejectionPct >= 50 ? "text-red-600 dark:text-red-400" : d.rejectionPct >= 25 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                {d.rejectionPct}%
              </span>
            ),
          }))}
        />
      </AccordionSection>
    </div>
  );
}