/**
 * seed-hazelden.mjs — Hazelden Betty Ford seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.hazeldenbettyford.org",
  cacheFileName: "hazelden.json",
  displayName: "🧑‍⚕ Hazelden Betty Ford",
  feedUrl: "https://www.hazeldenbettyford.org/articles/rss",
  articlePathRegex: /(articles|treatment|about)/,
  siteSuffixRegex: \s*[-–—]\s*hazeldenbettyford.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "hazelden",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
