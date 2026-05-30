"use server";

import { createClient } from "@supabase/supabase-js";

type AdminAnalyticsResult = {
  submissions_by_date: { date: string; count: number }[];
  submissions_by_category: { category: string; count: number }[];
  top_urls: { url: string; title: string; wilson_score: number; upvotes: number; downvotes: number }[];
  queue_stats: { approved: number; rejected: number; pending: number };
  top_rated_categories: { category: string; rated_urls: number; avg_score: number }[];
  source_breakdown: { source: string; count: number }[];
  language_distribution: { language: string; count: number }[];
  dead_by_category: { category: string; total: number; inactive_count: number; dead_pct: number }[];
};

export async function getAdminAnalytics(): Promise<{ data: AdminAnalyticsResult | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc("admin_analytics");
  if (error) return { data: null, error: error.message };
  return { data: data as AdminAnalyticsResult, error: null };
}

/**
 * Look up the email address for a given auth user ID.
 * Requires the service role key — only callable from admin server actions.
 */
export async function getSubmitterEmail(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !userId) return null;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return data.user.email ?? null;
}

// ─── Types shared with AdminPageClient ───────────────────────────────────────

export type AdminQueueItem = {
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

export type AdminReportRow = {
  url_id: string;
  reported_at: string;
  url: { url: string; title: string | null; inactive: boolean } | null;
};

// ─── Admin queue ─────────────────────────────────────────────────────────────

export async function getAdminQueue(
  sortBy: "newest" | "oldest" = "newest",
): Promise<{ data: AdminQueueItem[] | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
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

  if (error) return { data: null, error: error.message };
  return { data: data as AdminQueueItem[], error: null };
}

// ─── Admin reports ────────────────────────────────────────────────────────────

export async function getAdminReports(): Promise<{ data: AdminReportRow[] | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("url_reports")
    .select("url_id, reported_at, url:urls(url, title, inactive)")
    .order("reported_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  return {
    data: (data ?? []).map((row) => ({
      url_id: row.url_id,
      reported_at: row.reported_at,
      url: Array.isArray(row.url) ? (row.url[0] ?? null) : row.url,
    })) as AdminReportRow[],
    error: null,
  };
}

// ─── Restore link ─────────────────────────────────────────────────────────────

export async function restoreLinkAdmin(urlId: string): Promise<{ error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !urlId) return { error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from("urls").update({ inactive: false }).eq("id", urlId);
  return { error: error ? error.message : null };
}
