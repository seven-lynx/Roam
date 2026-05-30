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
