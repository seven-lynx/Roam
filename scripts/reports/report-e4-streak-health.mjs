/** E4: Streak health — uses correct column names streak_days and max_streak. */
import { isOffline, sqlQuery, sqlGet, mdH2, mdSummaryCards, registerReport, getDB } from "./lib/report-utils.js";

registerReport({
  id: "e4", suite: "E", title: "Streak Health",
  etaSeconds: 2,
  async run() {
    let md = mdH2("E4: Streak Health");
    if (isOffline()) {
      const total = sqlGet("SELECT COUNT(*) as cnt FROM profiles").cnt;
      const active = sqlGet("SELECT COUNT(*) as cnt FROM profiles WHERE streak_days > 0").cnt;
      const maxStreak = sqlGet("SELECT COALESCE(MAX(max_streak), 0) as cnt FROM profiles").cnt;
      const avgStreak = sqlGet("SELECT ROUND(AVG(streak_days), 1) as cnt FROM profiles WHERE streak_days > 0").cnt;
      md += mdSummaryCards([
        { label: "Total Users", value: String(total ?? 0) },
        { label: "Active Streaks", value: String(active ?? 0) },
        { label: "Max Streak", value: String(maxStreak ?? 0) },
        { label: "Avg Streak (active)", value: String(avgStreak ?? 0) },
      ]);
      if ((active ?? 0) === 0) {
        md += "\n⚠ **All streaks are 0.** Verify that `update_streak` is being called (currently only from the roam edge function as fire-and-forget).\n";
      }
    } else {
      const sb = getDB();
      const { data: rows } = await sb.from("profiles").select("streak_days, max_streak").limit(100000);
      if (!rows) return md + "_No data._\n";
      let active = 0, total = 0, maxStreak = 0, sum = 0;
      for (const r of rows) {
        total++;
        const s = r.streak_days || 0;
        if (s > 0) { active++; sum += s; }
        if ((r.max_streak || 0) > maxStreak) maxStreak = r.max_streak;
      }
      md += mdSummaryCards([
        { label: "Total Users", value: String(total) },
        { label: "Active Streaks", value: String(active) },
        { label: "Max Streak", value: String(maxStreak) },
        { label: "Avg Streak (active)", value: active > 0 ? (sum / active).toFixed(1) : "0" },
      ]);
      if (active === 0) {
        md += "\n⚠ **All streaks are 0.** Verify that `update_streak` is being called (currently only from the roam edge function as fire-and-forget).\n";
      }
    }
    return md;
  }
});