/** A5: Wilson Score Distribution Histogram — uses SQL COUNT with bucketing. */
import { isOffline, sqlQuery, sqlGet, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";

registerReport({
  id: "a5", suite: "A", title: "Wilson Score Histogram",
  description: "Bucketed distribution of Wilson scores across approved URLs (full table, no sampling)",
  etaSeconds: 3,
  async run() {
    let md = mdH2("A5: Wilson Score Distribution");
    let rows;
    if (isOffline()) {
      rows = sqlQuery(`
        SELECT
          CASE
            WHEN wilson_score IS NULL THEN '0 (unrated)'
            WHEN wilson_score = 0 THEN '0 (scored zero)'
            WHEN wilson_score BETWEEN 0.01 AND 0.10 THEN '1-10%'
            WHEN wilson_score BETWEEN 0.11 AND 0.25 THEN '11-25%'
            WHEN wilson_score BETWEEN 0.26 AND 0.50 THEN '26-50%'
            WHEN wilson_score BETWEEN 0.51 AND 0.75 THEN '51-75%'
            WHEN wilson_score BETWEEN 0.76 AND 0.90 THEN '76-90%'
            WHEN wilson_score BETWEEN 0.91 AND 0.99 THEN '91-99%'
            WHEN wilson_score >= 1.0 THEN '100%'
            ELSE 'unknown'
          END AS bucket,
          COUNT(*) AS cnt
        FROM urls
        WHERE approved = 1 AND inactive = 0
        GROUP BY bucket
        ORDER BY CASE bucket
          WHEN '0 (unrated)' THEN 1
          WHEN '0 (scored zero)' THEN 2
          WHEN '1-10%' THEN 3
          WHEN '11-25%' THEN 4
          WHEN '26-50%' THEN 5
          WHEN '51-75%' THEN 6
          WHEN '76-90%' THEN 7
          WHEN '91-99%' THEN 8
          WHEN '100%' THEN 9
          ELSE 10
        END
      `);
    } else {
      // Online: use admin_analytics RPC if available, else fall back to estimated
      md += "_Online mode — run with --offline for full Wilson histogram._\n";
      return md;
    }
    if (!rows || rows.length === 0) return md + "_No data._\n";
    const total = rows.reduce((s, r) => s + r.cnt, 0);
    md += mdTable(rows, [
      { key: "bucket", label: "Bucket" },
      { key: "cnt", label: "Count", align: "right", format: v => v.toLocaleString() },
      { key: "pct", label: "%", align: "right", format: (v, r) => pct(r.cnt, total) },
    ]);
    md += `Total active approved: ${total.toLocaleString()}\n`;
    return md;
  }
});