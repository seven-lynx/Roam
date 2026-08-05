/** B6: Missing OG Metadata — with per-category breakdown for actionability. */
import { isOffline, sqlQuery, sqlGet, mdH2, mdTable, mdSummaryCards, registerReport, getDB } from "./lib/report-utils.js";

registerReport({
  id: "b6", suite: "B", title: "Missing OG Metadata",
  etaSeconds: 3,
  async run() {
    let md = mdH2("B6: Missing OG Metadata");
    if (isOffline()) {
      const total = sqlGet("SELECT COUNT(*) as cnt FROM urls WHERE approved = 1 AND inactive = 0").cnt;
      const noTitle = sqlGet("SELECT COUNT(*) as cnt FROM urls WHERE approved = 1 AND inactive = 0 AND (og_title IS NULL OR og_title = '')").cnt;
      const noDesc = sqlGet("SELECT COUNT(*) as cnt FROM urls WHERE approved = 1 AND inactive = 0 AND (og_description IS NULL OR og_description = '')").cnt;
      const noImg = sqlGet("SELECT COUNT(*) as cnt FROM urls WHERE approved = 1 AND inactive = 0 AND (og_image_url IS NULL OR og_image_url = '')").cnt;
      md += mdSummaryCards([
        { label: "No Title", value: noTitle.toLocaleString(), sub: ((noTitle / total) * 100).toFixed(1) + "%" },
        { label: "No Description", value: noDesc.toLocaleString(), sub: ((noDesc / total) * 100).toFixed(1) + "%" },
        { label: "No Image", value: noImg.toLocaleString(), sub: ((noImg / total) * 100).toFixed(1) + "%" },
        { label: "Total Approved", value: total.toLocaleString() },
      ]);

      // Per-category breakdown of missing OG images
      const catRows = sqlQuery(`
        SELECT
          COALESCE(c.name, 'Uncategorized') AS category,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE u.og_image_url IS NULL OR u.og_image_url = '') AS missing_img,
          COUNT(*) FILTER (WHERE u.og_description IS NULL OR u.og_description = '') AS missing_desc,
          COUNT(*) FILTER (WHERE u.og_title IS NULL OR u.og_title = '') AS missing_title
        FROM urls u
        LEFT JOIN subcategories sc ON sc.id = u.subcategory_id
        LEFT JOIN categories c ON c.id = sc.category_id
        WHERE u.approved = 1 AND u.inactive = 0
        GROUP BY COALESCE(c.name, 'Uncategorized')
        ORDER BY missing_img DESC
      `);
      if (catRows && catRows.length > 0) {
        md += "\n### Missing OG Images by Category\n";
        md += mdTable(catRows, [
          { key: "category", label: "Category" },
          { key: "total", label: "Total URLs", align: "right", format: v => v.toLocaleString() },
          { key: "missing_img", label: "No Image", align: "right", format: v => v.toLocaleString() },
          { key: "pct", label: "% Missing", align: "right", format: (v, r) => r.total > 0 ? ((r.missing_img / r.total) * 100).toFixed(1) + "%" : "-" },
        ]);
      }
    } else {
      const sb = getDB();
      const { count: total } = await sb.from("urls").select("*", { count: "exact", head: true }).eq("approved", true).eq("inactive", false);
      const { count: noTitle } = await sb.from("urls").select("*", { count: "exact", head: true }).eq("approved", true).eq("inactive", false).or("og_title.is.null,og_title.eq.");
      const { count: noDesc } = await sb.from("urls").select("*", { count: "exact", head: true }).eq("approved", true).eq("inactive", false).or("og_description.is.null,og_description.eq.");
      const { count: noImg } = await sb.from("urls").select("*", { count: "exact", head: true }).eq("approved", true).eq("inactive", false).or("og_image_url.is.null,og_image_url.eq.");

      md += mdSummaryCards([
        { label: "No Title", value: (noTitle ?? 0).toLocaleString(), sub: total ? ((noTitle / total) * 100).toFixed(1) + "%" : "-" },
        { label: "No Description", value: (noDesc ?? 0).toLocaleString(), sub: total ? ((noDesc / total) * 100).toFixed(1) + "%" : "-" },
        { label: "No Image", value: (noImg ?? 0).toLocaleString(), sub: total ? ((noImg / total) * 100).toFixed(1) + "%" : "-" },
        { label: "Total Approved", value: (total ?? 0).toLocaleString() },
      ]);
      md += "\n_Category breakdown requires --offline mode._\n";
    }
    return md;
  }
});