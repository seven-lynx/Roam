/** A6: Zero-Vote Gaps — approved URLs with zero votes, grouped by category. */
import { getSupabase, runQuery, mdH2, mdTable, pct, registerReport } from "./lib/report-utils.js";

registerReport({
  id: "a6", suite: "A", title: "Zero-Vote URL Gaps",
  description: "Approved URLs never rated, grouped by category — untested content",
  etaSeconds: 3,
  async run() {
    const sb = getSupabase();
    let md = mdH2("A6: Zero-Vote URL Gaps");
    const { data: rows } = await runQuery("Loading unrated approved URLs", () =>
      sb.from("urls").select("subcategory:subcategories!inner(category:categories(id, name)), inactive").eq("approved", true).eq("upvotes", 0).eq("downvotes", 0).limit(200000), 4);
    if (!rows) return md + "_No data._\n";
    const map = new Map();
    let totalZero = 0;
    for (const r of rows) {
      const cat = r.subcategory?.category?.name || "unknown";
      let e = map.get(cat);
      if (!e) { e = { name: cat, zeroVotes: 0 }; map.set(cat, e); }
      e.zeroVotes++;
      totalZero++;
    }
    const sorted = [...map.values()].sort((a, b) => b.zeroVotes - a.zeroVotes);
    md += mdTable(sorted, [
      { key: "name", label: "Category" },
      { key: "zeroVotes", label: "Zero-Vote URLs", align: "right", format: v => v.toLocaleString() },
      { key: "pct", label: "% of All Zero", align: "right", format: (v, r) => pct(r.zeroVotes, totalZero) },
    ]);
    md += `${totalZero.toLocaleString()} unrated approved URLs across ${sorted.length} categories\n`;
    return md;
  }
});