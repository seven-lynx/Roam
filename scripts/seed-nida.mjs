/**
 * seed-nida.mjs — NIDA seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "nida.nih.gov",
  cacheFileName: "nida.json",
  displayName: "🧬 NIDA",
  feedUrl: "https://nida.nih.gov/feed/",
  articlePathRegex: /(news-events|research-topics|publications)/,
  siteSuffixRegex: \s*[-–—]\s*nida.nih.gov\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "nida",
  seeder_score: 0.9,
  maxArticles: 500,
  maxPages: 20,
});
