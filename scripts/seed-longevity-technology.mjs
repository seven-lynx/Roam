/**
 * seed-longevity-technology.mjs — Longevity.Technology seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "longevity.technology",
  cacheFileName: "longevity-technology.json",
  displayName: "🧬 Longevity.Technology",
  feedUrl: "https://longevity.technology/feed/",
  articlePathRegex: /(news|science|lifestyle)/,
  siteSuffixRegex: \s*[-–—]\s*longevity.technology\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "longevity-tech",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
