/**
 * seed-recoveryanswers.mjs — Recovery Answers seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.recoveryanswers.org",
  cacheFileName: "recoveryanswers.json",
  displayName: "🧑‍⚕ Recovery Answers",
  feedUrl: "https://www.recoveryanswers.org/feed/",
  articlePathRegex: /(research|resources|about)/,
  siteSuffixRegex: \s*[-–—]\s*recoveryanswers.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "recoveryanswers",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
