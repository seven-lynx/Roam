"use server";

import { createClient } from "@supabase/supabase-js";

export type AdminAnalyticsResult = {
  submissions_by_date: { date: string; count: number }[];
  submissions_by_category: { category: string; count: number }[];
  top_urls: { url: string; title: string; wilson_score: number; upvotes: number; downvotes: number }[];
  queue_stats: { approved: number; rejected: number; pending: number };
  top_rated_categories: { category: string; rated_urls: number; avg_score: number }[];
  source_breakdown: { source: string; count: number }[];
  language_distribution: { language: string; count: number }[];
  dead_by_category: { category: string; total: number; inactive_count: number; dead_pct: number }[];
  active_users: { dau: number; wau: number; mau: number };
  submissions_by_dow_hour: { dow: number; hour: number; count: number }[];
  velocity: { this_week: number; last_week: number };
  rejection_by_domain: { domain: string; total: number; rejected: number; rejection_pct: number }[];
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
      subcategory:subcategories(id, name, category_id, category:categories(id, name))
    `)
    .order("created_at", { ascending: sortBy === "oldest" });

  if (error) return { data: null, error: error.message };
  if (!data) return { data: [], error: null };

  // Fetch profiles separately — submitted_by FK targets auth.users, not profiles,
  // so PostgREST cannot navigate the join directly.
  const userIds = [...new Set(data.map((item) => item.submitted_by).filter(Boolean))] as string[];
  const profileMap: Record<string, { display_name: string | null; username: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds);
    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { display_name: p.display_name, username: p.username };
      }
    }
  }

  const enriched = data.map((item) => ({
    ...item,
    profile: item.submitted_by ? (profileMap[item.submitted_by] ?? null) : null,
  }));

  return { data: enriched as unknown as AdminQueueItem[], error: null };
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

// ─── Beta signups ──────────────────────────────────────────────────────────────

export type BetaSignup = {
  id: number;
  email: string;
  created_at: string;
};

export async function deleteBetaSignup(id: number): Promise<{ error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !id) return { error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from("beta_signups").delete().eq("id", id);
  return { error: error ? error.message : null };
}

export async function getBetaSignups(): Promise<{ data: BetaSignup[] | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("beta_signups")
    .select("id, email, created_at")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as BetaSignup[], error: null };
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

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function grantBadgeAdmin(
  username: string,
  badgeSlug: string,
): Promise<{ data: { message: string } | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the user by username
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (!profile) return { data: null, error: "User not found" };

  // Find the admin user who is granting (use the first admin account for audit trail)
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1 });
  const grantedBy = users?.[0]?.id ?? profile.id;

  const { data, error } = await admin.rpc("grant_badge", {
    p_user_id: profile.id,
    p_badge_slug: badgeSlug,
    p_granted_by: grantedBy,
  });

  if (error) return { data: null, error: error.message };
  return { data: { message: `Badge "${badgeSlug}" granted to @${username}!` }, error: null };
}

// ─── Email: types ────────────────────────────────────────────────────────────

export type EmailLogEntry = {
  id: string;
  subject: string;
  recipient_count: number;
  success_count: number;
  fail_count: number;
  sender_type: string;
  sent_at: string;
};

export type SendBulkEmailResult = {
  sent: number;
  failed: number;
  total: number;
};

// ─── Email: actions ──────────────────────────────────────────────────────────

export async function getNotificationCount(): Promise<{ count: number; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { count: 0, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await admin
    .from("user_settings")
    .select("*", { count: "exact", head: true })
    .eq("email_notifications", true);

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function getEmailLogs(): Promise<{ data: EmailLogEntry[] | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { data: null, error: "Server misconfiguration" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("email_log")
    .select("id, subject, recipient_count, success_count, fail_count, sender_type, sent_at")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) return { data: null, error: error.message };
  return { data: data as EmailLogEntry[], error: null };
}

export async function sendBulkEmail(
  subject: string,
  bodyMarkdown: string,
): Promise<{ data: SendBulkEmailResult | null; error: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { data: null, error: "Server misconfiguration" };

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-bulk-email`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, bodyMarkdown }),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      return { data: null, error: body?.error ?? `HTTP ${response.status}` };
    }
    return { data: body as SendBulkEmailResult, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to send email" };
  }
}
