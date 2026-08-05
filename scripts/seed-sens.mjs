/**
 * seed-sens.mjs — SENS Research Foundation seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sens.org",
  cacheFileName: "sens.json",
  displayName: "🧬 SENS Research Foundation",
  feedUrl: "https://www.sens.org/feed/",
  articlePathRegex: /(research|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*sens.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "sens",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
