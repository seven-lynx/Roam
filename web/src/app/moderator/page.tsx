import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModeratorPageClient from "./ModeratorPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Moderation panel" };

export default async function ModeratorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  if (!user || (role !== "admin" && role !== "moderator")) redirect("/");

  return <ModeratorPageClient />;
}
