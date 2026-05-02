import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPageClient from "./AdminPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/");

  return <AdminPageClient />;
}
