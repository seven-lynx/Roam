/**
 * seed-emcdda.mjs — EMCDDA seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.emcdda.europa.eu",
  cacheFileName: "emcdda.json",
  displayName: "🇪🇺 EMCDDA",
  feedUrl: "https://www.emcdda.europa.eu/rss.xml",
  articlePathRegex: /(news|publications|topics)/,
  siteSuffixRegex: \s*[-–—]\s*emcdda.europa.eu\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "emcdda",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
