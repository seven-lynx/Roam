/** A11: Subcategory Balance — per-category subpopulation, sorted by count ascending
 *  so the most starved subcategories (needing seeders) appear first. */
import { isOffline, sqlQuery, mdH2, mdTable, pct, registerReport, getDB } from "./lib/report-utils.js";

registerReport({
  id: "a11", suite: "A", title: "Subcategory Balance (Seeding Targets)",
  description: "Per-category subcategory counts sorted by most starved first — helps prioritize seeder building",
  etaSeconds: 3,
  async run() {
    let md = mdH2("A11: Subcategory Balance (Seeding Targets)");
    md += "_Subcategories sorted within each category by URL count (ascending) — the most starved are at the top._\n\n";
    if (isOffline()) {
      const rows = sqlQuery(`
        SELECT
          COALESCE(c.name, 'Uncategorized') AS category,
          sc.name AS subcategory,
          COUNT(*) AS total,
          SUM(COUNT(*)) OVER (PARTITION BY sc.category_id) AS cat_total
        FROM urls u
        LEFT JOIN subcategories sc ON sc.id = u.subcategory_id
        LEFT JOIN categories c ON c.id = sc.category_id
        WHERE u.approved = 1 AND u.inactive = 0
        GROUP BY c.name, sc.name, sc.category_id
        ORDER BY cat_total DESC, total ASC
      `);
      if (!rows || rows.length === 0) return md + "_No data._\n";
      md += mdTable(rows, [
        { key: "category", label: "Category" },
        { key: "subcategory", label: "Subcategory" },
        { key: "total", label: "URLs", align: "right", format: v => v.toLocaleString() },
        { key: "pct", label: "% of Pillar", align: "right", format: (v, r) => pct(r.total, r.cat_total) },
      ]);
      // Summary: count of subcategories with < 1000 URLs (starved)
      const starved = rows.filter(r => r.total < 1000).length;
      md += `\n**${starved}** subcategories have fewer than 1,000 URLs and are seeding candidates.\n`;
    } else {
      const sb = getDB();
      const { data: cats } = await sb.from("categories").select("id, name").order("name");
      if (!cats) return md + "_No categories found._\n";
      const allRows = [];
      for (const cat of cats) {
        const { data: subs } = await sb.from("subcategories").select("id, name").eq("category_id", cat.id);
        if (!subs || subs.length === 0) continue;
        for (const sub of subs) {
          const { count } = await sb.from("urls")
            .select("*", { count: "exact", head: true })
            .eq("approved", true)
            .eq("inactive", false)
            .eq("subcategory_id", sub.id);
          if (count > 0) {
            allRows.push({ category: cat.name, subcategory: sub.name, total: count });
          }
        }
      }
      if (allRows.length === 0) return md + "_No data._\n";
      // Compute category totals
      const catTotals = new Map();
      for (const r of allRows) {
        catTotals.set(r.category, (catTotals.get(r.category) || 0) + r.total);
      }
      allRows.sort((a, b) => (catTotals.get(b.category) || 0) - (catTotals.get(a.category) || 0) || a.total - b.total);
      md += mdTable(allRows, [
        { key: "category", label: "Category" },
        { key: "subcategory", label: "Subcategory" },
        { key: "total", label: "URLs", align: "right", format: v => v.toLocaleString() },
        { key: "pct", label: "% of Pillar", align: "right", format: (v, r) => {
          const catTotal = catTotals.get(r.category) || 1;
          return pct(r.total, catTotal);
        }},
      ]);
      const starved = allRows.filter(r => r.total < 1000).length;
      md += `\n**${starved}** subcategories have fewer than 1,000 URLs and are seeding candidates.\n`;
    }
    return md;
  }
});