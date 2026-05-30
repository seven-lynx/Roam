import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";
import RefreshButton from "./RefreshButton";

export const metadata: Metadata = { title: "Admin · Dashboard" };
export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────────────

type SupabaseStats = {
  totalUrls: number;
  approvedUrls: number;
  pendingModeration: number;
  totalUsers: number;
  newUsersThisWeek: number;
  recentUrls: number;
  totalRatings: number;
  inactiveUrls: number;
  queryErrors: string[];
};

type SentryIssue = {
  id: string;
  title: string;
  culprit: string;
  count: string; // event count is a string in the Sentry API
  userCount: number;
  level: string;
  lastSeen: string;
};

type VercelDeployment = {
  uid: string;
  state: string;
  created: number;
  meta: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
  };
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function getSupabaseStats(): Promise<SupabaseStats | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createSupabaseAdmin(url, serviceKey);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, approvedRes, pendingRes, usersRes, newUsersRes, recentRes, ratingsRes, inactiveRes] = await Promise.all([
    admin.from("urls").select("*", { count: "exact", head: true }),
    admin.from("urls").select("*", { count: "exact", head: true }).eq("approved", true),
    admin
      .from("moderation_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    admin
      .from("urls")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    admin.from("ratings").select("*", { count: "exact", head: true }),
    admin.from("urls").select("*", { count: "exact", head: true }).eq("inactive", true),
  ]);

  const queryErrors: string[] = [];
  const results = [
    ["totalUrls", totalRes],
    ["approvedUrls", approvedRes],
    ["pendingModeration", pendingRes],
    ["totalUsers", usersRes],
    ["newUsersThisWeek", newUsersRes],
    ["recentUrls", recentRes],
    ["totalRatings", ratingsRes],
    ["inactiveUrls", inactiveRes],
  ] as const;
  for (const [name, res] of results) {
    if (res.error) {
      console.error(`[dashboard] ${name} query failed:`, res.error.code, res.error.message);
      queryErrors.push(`${name}: ${res.error.message}`);
    }
  }

  return {
    totalUrls: totalRes.count ?? 0,
    approvedUrls: approvedRes.count ?? 0,
    pendingModeration: pendingRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    newUsersThisWeek: newUsersRes.count ?? 0,
    recentUrls: recentRes.count ?? 0,
    totalRatings: ratingsRes.count ?? 0,
    inactiveUrls: inactiveRes.count ?? 0,
    queryErrors,
  };
}

async function getSentryIssues(): Promise<SentryIssue[] | null> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  if (!token || !org) return null;

  const project = process.env.SENTRY_PROJECT;
  // US-region Sentry projects use us.sentry.io for API calls
  const sentryHost = "https://us.sentry.io";
  const endpoint = project
    ? `${sentryHost}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is%3Aunresolved&limit=5`
    : `${sentryHost}/api/0/organizations/${encodeURIComponent(org)}/issues/?query=is%3Aunresolved&limit=5`;

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getVercelDeployments(): Promise<VercelDeployment[] | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;

  const projectId = process.env.VERCEL_PROJECT_ID;
  const params = new URLSearchParams({ limit: "5" });
  if (projectId) params.set("projectId", projectId);

  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.deployments ?? null;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const STATE_BADGE: Record<string, string> = {
  READY:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  ERROR:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  BUILDING:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  INITIALIZING:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  QUEUED:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  CANCELED:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

const LEVEL_BADGE: Record<string, string> = {
  fatal:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  error:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  info:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  debug:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/");

  const [stats, sentryIssues, vercelDeps] = await Promise.all([
    getSupabaseStats(),
    getSentryIssues(),
    getVercelDeployments(),
  ]);

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              System Dashboard
            </h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
              Last refreshed: {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RefreshButton />
            <Link
              href="/admin"
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              ← Back to admin
            </Link>
          </div>
        </div>

        {/* ── Supabase stats ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Database
          </h2>
          {stats ? (
            <>
              {stats.queryErrors.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-900/10 dark:text-amber-400">
                  {stats.queryErrors.length} stat{stats.queryErrors.length > 1 ? "s" : ""} failed to load — check server logs for details.
                </div>
              )}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
              {(
                [
                  { label: "Total URLs", value: stats.totalUrls },
                  { label: "Approved URLs", value: stats.approvedUrls },
                  { label: "Added this week", value: stats.recentUrls },
                  { label: "Total ratings", value: stats.totalRatings },
                  { label: "Dead links", value: stats.inactiveUrls, highlight: stats.inactiveUrls > 50 },
                  { label: "Total users", value: stats.totalUsers },
                  { label: "New users this week", value: stats.newUsersThisWeek },
                  {
                    label: "Pending review",
                    value: stats.pendingModeration,
                    highlight: stats.pendingModeration > 0,
                    href: "/admin",
                  },
                ] as { label: string; value: number; highlight?: boolean; href?: string }[]
              ).map(({ label, value, highlight, href }) => {
                const inner = (
                  <>
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {value.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {label}
                    </span>
                  </>
                );
                const cls = `rounded-xl border px-4 py-4 flex flex-col gap-1 ${
                  highlight
                    ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                }`;
                return href ? (
                  <Link key={label} href={href} className={`${cls} hover:opacity-80 transition-opacity`}>
                    {inner}
                  </Link>
                ) : (
                  <div key={label} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Set{" "}
              <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              in your server environment to enable database stats.
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Sentry ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Sentry · Top Unresolved Issues
            </h2>
            {sentryIssues ? (
              sentryIssues.length === 0 ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  No unresolved issues.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {sentryIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            LEVEL_BADGE[issue.level] ?? LEVEL_BADGE.error
                          }`}
                        >
                          {issue.level}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {Number(issue.count).toLocaleString()} events ·{" "}
                          {timeAgo(new Date(issue.lastSeen))}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-900 dark:text-white font-medium truncate">
                        {issue.title}
                      </p>
                      {issue.culprit && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
                          {issue.culprit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Set{" "}
                <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  SENTRY_AUTH_TOKEN
                </code>{" "}
                and{" "}
                <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  SENTRY_ORG
                </code>{" "}
                to enable.
              </p>
            )}
          </section>

          {/* ── Vercel ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Vercel · Recent Deployments
            </h2>
            {vercelDeps ? (
              vercelDeps.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No deployments found.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {vercelDeps.map((dep) => (
                    <div
                      key={dep.uid}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            STATE_BADGE[dep.state] ?? STATE_BADGE.QUEUED
                          }`}
                        >
                          {dep.state}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {timeAgo(new Date(dep.created))}
                        </span>
                      </div>
                      {dep.meta.githubCommitRef && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                          {dep.meta.githubCommitRef}
                        </p>
                      )}
                      {dep.meta.githubCommitMessage && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                          {dep.meta.githubCommitMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Set{" "}
                <code className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  VERCEL_TOKEN
                </code>{" "}
                to enable.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
