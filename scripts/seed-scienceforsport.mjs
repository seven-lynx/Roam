/**
 * seed-scienceforsport.mjs — Science for Sport seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.scienceforsport.com",
  cacheFileName: "scienceforsport.json",
  displayName: "⚽ Science for Sport",
  feedUrl: "https://www.scienceforsport.com/feed/",
  articlePathRegex: /(articles|podcast|resources)/,
  siteSuffixRegex: \s*[-–—]\s*scienceforsport.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "scienceforsport",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
