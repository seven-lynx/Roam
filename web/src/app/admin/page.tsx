import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModerationActions from "./ModerationActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/");

  const { data: queue } = await supabase
    .from("moderation_queue")
    .select("id, url, submitted_at, submitter_id")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(100);

  const items = queue ?? [];

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Moderation queue</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
            {items.length} pending submission{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-400 text-sm">
            Queue is empty. Nice work.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-zinc-900 dark:text-white hover:underline truncate"
                  >
                    {item.url}
                  </a>
                  <span className="text-xs text-zinc-400">
                    Submitted {new Date(item.submitted_at).toLocaleString()}
                  </span>
                </div>
                <ModerationActions item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
