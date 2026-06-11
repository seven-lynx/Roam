"use client";

import { useEffect, useState } from "react";
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

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    (async () => {
      setLoading(true);
      try {
        const { data: result, error } = await getAdminAnalytics();
        if (error || !result) throw new Error(error ?? "No data");
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
    })();
  }, [loaded]);

  if (loading) return <div className="text-center text-zinc-500 py-16">Loading analytics...</div>;
  if (error) return <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-700 dark:text-red-400">Failed to load analytics: {error}</div>;

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOUR_LABELS = ["12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p"];

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Active Users" description="Based on browsing + voting activity signals">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{data.activeUsers.dau.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">DAU</div>
            <div className="text-xs text-zinc-400 mt-0.5">Past 24h</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{data.activeUsers.wau.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">WAU</div>
            <div className="text-xs text-zinc-400 mt-0.5">Past 7d</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.activeUsers.mau.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">MAU</div>
            <div className="text-xs text-zinc-400 mt-0.5">Past 30d</div>
          </div>
        </div>
        {data.activeUsers.mau > 0 && (
          <div className="mt-4 flex gap-6 text-xs text-zinc-500">
            <span>Stickiness: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums">{(data.activeUsers.dau / data.activeUsers.mau * 100).toFixed(1)}%</strong></span>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Submissions Over Time" description="Last 30 days">
        <BarChart data={data.submissionsByDate.map(d => ({ label: new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: d.count }))} color="bg-blue-500" />
      </SectionCard>

      <SectionCard title="Submissions by Category" description="Top 10 parent categories">
        <BarChart data={data.submissionsByCategory.map(d => ({ label: d.category, value: d.count }))} color="bg-violet-500" />
      </SectionCard>

      <SectionCard title="Moderation Queue" description="All-time submission counts by status">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{data.queueStats.approved}</div>
            <div className="text-xs text-zinc-500 mt-1">Approved</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{data.queueStats.rejected}</div>
            <div className="text-xs text-zinc-500 mt-1">Rejected</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{data.queueStats.pending}</div>
            <div className="text-xs text-zinc-500 mt-1">Pending</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Top Rated URLs" description="Highest Wilson score">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">Title</th>
                <th className="text-center py-3 px-2 font-semibold text-zinc-900 dark:text-white w-20">Score</th>
                <th className="text-center py-3 px-2 font-semibold text-zinc-900 dark:text-white w-24">👍/👎</th>
              </tr>
            </thead>
            <tbody>
              {data.topUrls.map((u) => (
                <tr key={u.url} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="py-3 px-4">
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{u.title}</a>
                  </td>
                  <td className="text-center py-3 px-2 font-semibold tabular-nums">{u.wilson_score}%</td>
                  <td className="text-center py-3 px-2 text-xs">
                    <span className="text-green-600 dark:text-green-400">{u.upvotes}</span>
                    <span className="text-zinc-400 mx-1">/</span>
                    <span className="text-red-600 dark:text-red-400">{u.downvotes}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Top Rated Categories" description="Average Wilson score per category">
        <BarChart data={data.topRatedCategories.map(d => ({ label: d.category, value: d.avg_score }))} color="bg-emerald-500" />
      </SectionCard>

      <SectionCard title="Source Breakdown" description="Approved URLs by seeder">
        <BarChart data={data.sourceBreakdown.map(d => ({ label: d.source, value: d.count }))} color="bg-sky-500" />
      </SectionCard>

      <SectionCard title="Language Distribution" description="Top 15 languages">
        <BarChart data={data.languageDistribution.map(d => ({ label: d.language.toUpperCase(), value: d.count }))} color="bg-orange-400" />
      </SectionCard>

      <SectionCard title="Content Velocity" description="Approved URLs this week vs last week">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums">{data.velocity.thisWeek.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">This week</div>
          </div>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-center">
            <div className="text-2xl font-bold tabular-nums">{data.velocity.lastWeek.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-1">Last week</div>
          </div>
        </div>
        {data.velocity.lastWeek > 0 && (
          <p className="mt-3 text-xs text-zinc-400">
            Change: <span className={`font-semibold tabular-nums ${data.velocity.thisWeek >= data.velocity.lastWeek ? "text-green-600" : "text-red-600"}`}>
              {data.velocity.thisWeek >= data.velocity.lastWeek ? "+" : ""}{Math.round((data.velocity.thisWeek - data.velocity.lastWeek) / data.velocity.lastWeek * 100)}%
            </span>
          </p>
        )}
      </SectionCard>

      <SectionCard title="Submission Timing Heatmap" description="Day-of-week × hour (ET)">
        {data.submissionsByDowHour.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs mx-auto">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  {HOUR_LABELS.map((h) => <th key={h} className="w-9 text-center text-zinc-400 font-normal py-1">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {DOW_LABELS.map((day, dow) => (
                  <tr key={day}>
                    <td className="text-right pr-2 text-zinc-500 font-medium whitespace-nowrap">{day}</td>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const count = data.submissionsByDowHour.find((s) => s.dow === dow && s.hour === hour)?.count ?? 0;
                      const max = Math.max(...data.submissionsByDowHour.map((s) => s.count), 1);
                      const intensity = count / max;
                      let bgClass = "bg-zinc-50 dark:bg-zinc-900";
                      if (intensity >= 0.9) bgClass = "bg-blue-600 dark:bg-blue-500";
                      else if (intensity >= 0.7) bgClass = "bg-blue-500 dark:bg-blue-400";
                      else if (intensity >= 0.5) bgClass = "bg-blue-400 dark:bg-blue-500/70";
                      else if (intensity >= 0.3) bgClass = "bg-blue-300 dark:bg-blue-500/50";
                      else if (intensity >= 0.1) bgClass = "bg-blue-200 dark:bg-blue-500/30";
                      return (
                        <td key={hour} className={`text-center py-1 ${bgClass} ${intensity > 0.3 ? "text-white dark:text-white font-medium" : "text-zinc-400"}`}
                          title={`${day} ${HOUR_LABELS[hour]}: ${count}`}
                        >{count > 0 ? count : ""}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-zinc-500 text-sm">No data yet</p>}
      </SectionCard>

      <SectionCard title="Dead URL Rate by Category" description="Inactive approved URLs as % of total">
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
              {data.deadByCategory.map((row) => (
                <tr key={row.category} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{row.category}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.inactive_count.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right tabular-nums font-semibold ${row.dead_pct >= 3 ? "text-red-600 dark:text-red-400" : row.dead_pct >= 1.5 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>{row.dead_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Rejection Rate by Domain" description="Top domains with highest rejection rate (min. 5 submissions)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">Domain</th>
                <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-24">Total</th>
                <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-24">Rejected</th>
                <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white w-24">Rej. %</th>
              </tr>
            </thead>
            <tbody>
              {data.rejectionByDomain.map((d) => (
                <tr key={d.domain} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="py-3 px-4 font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xs">{d.domain}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.total}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{d.rejected}</td>
                  <td className={`py-3 px-4 text-right tabular-nums font-semibold ${d.rejectionPct >= 50 ? "text-red-600 dark:text-red-400" : d.rejectionPct >= 25 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>{d.rejectionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}