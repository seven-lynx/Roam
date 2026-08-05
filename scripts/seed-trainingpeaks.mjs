/**
 * seed-trainingpeaks.mjs — TrainingPeaks seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.trainingpeaks.com",
  cacheFileName: "trainingpeaks.json",
  displayName: "🏃 TrainingPeaks",
  feedUrl: "https://www.trainingpeaks.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*trainingpeaks.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "trainingpeaks",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
