/**
 * seed-renaissance-periodization.mjs — Renaissance Periodization seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.renaissanceperiodization.com",
  cacheFileName: "renaissance-periodization.json",
  displayName: "💪 Renaissance Periodization",
  feedUrl: "https://www.renaissanceperiodization.com/feed/",
  articlePathRegex: /(blog|guides|about)/,
  siteSuffixRegex: \s*[-–—]\s*renaissanceperiodization.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "rp",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
