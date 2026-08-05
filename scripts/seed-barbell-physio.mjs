/**
 * seed-barbell-physio.mjs — The Barbell Physio seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thebarbellphysio.com",
  cacheFileName: "barbell-physio.json",
  displayName: "💪 The Barbell Physio",
  feedUrl: "https://www.thebarbellphysio.com/feed/",
  articlePathRegex: /(articles|blog|about)/,
  siteSuffixRegex: \s*[-–—]\s*thebarbellphysio.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "barbell-physio",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
