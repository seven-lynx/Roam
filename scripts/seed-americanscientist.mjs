/**
 * seed-americanscientist.mjs — American Scientist seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.americanscientist.org",
  cacheFileName: "americanscientist.json",
  displayName: "📖 American Scientist",
  feedUrl: "https://www.americanscientist.org/feed",
  articlePathRegex: /(article|blog)/,
  siteSuffixRegex: \s*[-–—]\s*americanscientist.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,
  source: "americanscientist",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
