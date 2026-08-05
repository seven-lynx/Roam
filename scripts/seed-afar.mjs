/**
 * seed-afar.mjs — AFAR seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.afar.org",
  cacheFileName: "afar.json",
  displayName: "🧬 AFAR",
  feedUrl: "https://www.afar.org/feed/",
  articlePathRegex: /(news|research|grants)/,
  siteSuffixRegex: \s*[-–—]\s*afar.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "afar",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
