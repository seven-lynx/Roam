/**
 * seed-addictioncenter.mjs — Addiction Center seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.addictioncenter.com",
  cacheFileName: "addictioncenter.json",
  displayName: "🧑‍⚕ Addiction Center",
  feedUrl: "https://www.addictioncenter.com/feed/",
  articlePathRegex: /(community|treatment|drugs)/,
  siteSuffixRegex: \s*[-–—]\s*addictioncenter.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "addictioncenter",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
