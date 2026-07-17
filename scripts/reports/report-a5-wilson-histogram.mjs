/** A5: Wilson Score Distribution Histogram — bucketed counts. */
import { getSupabase, runQuery, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";

registerReport({
  id: "a5", suite: "A", title: "Wilson Score Histogram",
  description: "Bucketed distribution of Wilson scores across approved URLs",
  etaSeconds: 2,
  async run() {
    const sb = getSupabase();
    let md = mdH2("A5: Wilson Score Distribution");
    const { data: rows } = await runQuery("Loading Wilson data", () =>
      sb.from("urls").select("wilson_score").eq("approved", true).eq("inactive", false).limit(200000), 3);
    if (!rows) return md + "_No data._\n";
    const buckets = [
      { label: "0 (unrated)", min: -1, max: 0, count: 0 },
      { label: "1-10%", min: 0.01, max: 0.10, count: 0 },
      { label: "11-25%", min: 0.11, max: 0.25, count: 0 },
      { label: "26-50%", min: 0.26, max: 0.50, count: 0 },
      { label: "51-75%", min: 0.51, max: 0.75, count: 0 },
      { label: "76-90%", min: 0.76, max: 0.90, count: 0 },
      { label: "91-99%", min: 0.91, max: 0.99, count: 0 },
      { label: "100%", min: 1.0, max: 1.0, count: 0 },
    ];
    for (const r of rows) {
      const w = r.wilson_score || 0;
      for (const b of buckets) {
        if (w >= b.min && w <= b.max) { b.count++; break; }
      }
    }
    const total = rows.length;
    md += mdTable(buckets, [
      { key: "label", label: "Bucket" },
      { key: "count", label: "Count", align: "right", format: v => v.toLocaleString() },
      { key: "pct", label: "%", align: "right", format: (v, r) => pct(r.count, total) },
    ]);
    md += `Total active approved: ${total.toLocaleString()}\n`;
    return md;
  }
});