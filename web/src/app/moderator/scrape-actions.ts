"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export type ScrapeSuggestion = {
  id: string;
  suggestion_type: "url" | "domain";
  value: string;
  category_id: string | null;
  subcategory_id: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "scraped";
  created_at: string;
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

async function getModerator() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (!user || (role !== "admin" && role !== "moderator")) return null;
  return user;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function addScrapeSuggestion(
  type: "url" | "domain",
  value: string,
  categoryId: string | null,
  subcategoryId: string | null,
  notes: string | null,
): Promise<{ error: string | null }> {
  const user = await getModerator();
  if (!user) return { error: "Forbidden" };

  const { error } = await adminClient()
    .from("scrape_suggestions")
    .insert({
      suggestion_type: type,
      value: value.trim(),
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      notes: notes?.trim() || null,
      suggested_by: user.id,
    });

  return { error: error?.message ?? null };
}

export async function getScrapeSuggestions(): Promise<{
  data: ScrapeSuggestion[] | null;
  error: string | null;
}> {
  const user = await getModerator();
  if (!user) return { data: null, error: "Forbidden" };

  const { data, error } = await adminClient()
    .from("scrape_suggestions")
    .select(`
      id, suggestion_type, value, category_id, subcategory_id, notes, status, created_at,
      category:categories(name),
      subcategory:subcategories(name)
    `)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as unknown as ScrapeSuggestion[], error: null };
}

export async function scrapeUrl(
  url: string,
  categoryId: string | null,
  subcategoryId: string | null,
): Promise<{ data: { id: string; url: string; title: string | null } | null; error: string | null }> {
  const user = await getModerator();
  if (!user) return { data: null, error: "Forbidden" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: "No session" };

  const res = await fetch(`${supabaseUrl}/functions/v1/scrape-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ url, category_id: categoryId, subcategory_id: subcategoryId }),
  });

  const body = await res.json();
  if (!res.ok) return { data: null, error: body?.error ?? `HTTP ${res.status}` };
  return { data: body.data, error: null };
}
