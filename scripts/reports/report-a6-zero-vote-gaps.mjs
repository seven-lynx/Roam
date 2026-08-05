/** A6: Zero-Vote Gaps — uses SQL COUNT + GROUP BY, no sampling. */
import { isOffline, sqlQuery, mdH2, mdTable, pct, registerReport, getDB } from "./lib/report-utils.js";

registerReport({
  id: "a6", suite: "A", title: "Zero-Vote URL Gaps",
  description: "Approved URLs never rated, grouped by category — full table, no sampling",
  etaSeconds: 3,
  async run() {
    let md = mdH2("A6: Zero-Vote URL Gaps");
    if (isOffline()) {
      const rows = sqlQuery(`
        SELECT
          COALESCE(c.name, 'Uncategorized') AS name,
          COUNT(*) AS zero_votes
        FROM urls u
        LEFT JOIN subcategories sc ON sc.id = u.subcategory_id
        LEFT JOIN categories c ON c.id = sc.category_id
        WHERE u.approved = 1
          AND u.inactive = 0
          AND u.upvotes = 0
          AND u.downvotes = 0
        GROUP BY COALESCE(c.name, 'Uncategorized')
        ORDER BY zero_votes DESC
      `);
      if (!rows || rows.length === 0) return md + "_No data._\n";
      const totalZero = rows.reduce((s, r) => s + r.zero_votes, 0);
      md += mdTable(rows, [
        { key: "name", label: "Category" },
        { key: "zero_votes", label: "Zero-Vote URLs", align: "right", format: v => v.toLocaleString() },
        { key: "pct", label: "% of All Zero", align: "right", format: (v, r) => pct(r.zero_votes, totalZero) },
      ]);
      md += `${totalZero.toLocaleString()} unrated approved URLs across ${rows.length} categories\n`;
    } else {
      // Online: use count-based approach
      const sb = getDB();
      const { data: cats } = await sb.from("categories").select("id, name");
      const map = new Map();
      let totalZero = 0;
      if (cats) {
        for (const c of cats) {
          // Get subcategories for this category
          const { data: subs } = await sb.from("subcategories").select("id").eq("category_id", c.id);
          if (!subs || subs.length === 0) continue;
          const subIds = subs.map(s => s.id);
          // Count zero-vote URLs via subcategory filter
          const { count } = await sb.from("urls")
            .select("*", { count: "exact", head: true })
            .eq("approved", true)
            .eq("inactive", false)
            .eq("upvotes", 0)
            .eq("downvotes", 0)
            .in("subcategory_id", subIds);
          if (count > 0) {
            map.set(c.name, { name: c.name, zeroVotes: count });
            totalZero += count;
          }
        }
      }
      const rows = [...map.values()].sort((a, b) => b.zeroVotes - a.zeroVotes);
      if (rows.length === 0) return md + "_No data._\n";
      md += mdTable(rows, [
        { key: "name", label: "Category" },
        { key: "zeroVotes", label: "Zero-Vote URLs", align: "right", format: v => v.toLocaleString() },
        { key: "pct", label: "% of All Zero", align: "right", format: (v, r) => pct(r.zeroVotes, totalZero) },
      ]);
      md += `${totalZero.toLocaleString()} unrated approved URLs across ${rows.length} categories\n`;
    }
    return md;
  }
});