"use server";

import { revalidateTag } from "next/cache";

export async function refreshDashboard() {
  // 'max' = stale-while-revalidate. On the next visit, fresh data is fetched in
  // the background while the existing cached value is served. A second refresh
  // (or page reload) will then show the new stats.
  revalidateTag("admin-dashboard-stats", "max");
}
