/** B5: Paywall domain coverage — DB-side matching, no 0-count rows, no row sampling. */
import { isOffline, sqlQuery, mdH2, mdTable, registerReport, getDB } from "./lib/report-utils.js";

registerReport({
  id: "b5", suite: "B", title: "Paywall Domain Coverage",
  etaSeconds: 2,
  async run() {
    let md = mdH2("B5: Paywall Domain Coverage");
    if (isOffline()) {
      const rows = sqlQuery(`
        SELECT pd.domain, COUNT(u.id) AS cnt
        FROM paywalled_domains pd
        LEFT JOIN urls u ON u.domain = pd.domain
        GROUP BY pd.domain
        HAVING COUNT(u.id) > 0
        ORDER BY cnt DESC
      `);
      if (!rows || rows.length === 0) return md + "_No paywall domains found in the pool._\n";
      md += mdTable(rows, [
        { key: "domain", label: "Domain" },
        { key: "cnt", label: "Articles in Pool", align: "right", format: v => v.toLocaleString() },
      ]);
      md += `\n${rows.length} paywall domains represented in the pool.\n`;
    } else {
      const sb = getDB();
      const { data: domains } = await sb.from("paywalled_domains").select("domain").limit(1000);
      if (!domains || domains.length === 0) return md + "_No paywalled domains configured._\n";
      const domainSet = domains.map(d => d.domain);
      // Use count approach per domain — one query per domain
      const results = [];
      for (const d of domainSet) {
        const { count } = await sb.from("urls").select("*", { count: "exact", head: true }).eq("domain", d);
        if (count > 0) results.push({ domain: d, count });
      }
      if (results.length === 0) return md + "_No paywall domains found in the pool._\n";
      results.sort((a, b) => b.count - a.count);
      md += mdTable(results, [
        { key: "domain", label: "Domain" },
        { key: "count", label: "Articles in Pool", align: "right", format: v => v.toLocaleString() },
      ]);
      md += `\n${results.length} paywall domains represented in the pool.\n`;
    }
    return md;
  }
});