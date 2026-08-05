/**
 * seed-who-drugs.mjs — WHO Drugs seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.who.int",
  cacheFileName: "who-drugs.json",
  displayName: "🌐 WHO Drugs",
  feedUrl: "https://www.who.int/feeds/entity/health-topics/drugs/en/rss.xml",
  articlePathRegex: /(health-topics|news-room)/,
  siteSuffixRegex: \s*[-–—]\s*who.int\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "who-drugs",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
