/**
 * seed-buckinstitute.mjs — Buck Institute seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.buckinstitute.org",
  cacheFileName: "buckinstitute.json",
  displayName: "🔬 Buck Institute",
  feedUrl: "https://www.buckinstitute.org/feed/",
  articlePathRegex: /(news|research|labs)/,
  siteSuffixRegex: \s*[-–—]\s*buckinstitute.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "buckinstitute",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
