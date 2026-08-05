/**
 * seed-longecity.mjs — LongeCity seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.longecity.org",
  cacheFileName: "longecity.json",
  displayName: "🧬 LongeCity",
  feedUrl: "https://www.longecity.org/forum/blog/rss/",
  articlePathRegex: /(articles|research|blog)/,
  siteSuffixRegex: \s*[-–—]\s*longecity.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "longecity",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
