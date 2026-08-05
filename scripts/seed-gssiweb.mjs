/**
 * seed-gssiweb.mjs — GSSI seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.gssiweb.org",
  cacheFileName: "gssiweb.json",
  displayName: "🔬 GSSI",
  feedUrl: "https://www.gssiweb.org/rss.xml",
  articlePathRegex: /(sports-science-exchange|articles|research)/,
  siteSuffixRegex: \s*[-–—]\s*gssiweb.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "gssiweb",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
