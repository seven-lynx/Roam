/**
 * seed-fightaging.mjs — Fight Aging! seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.fightaging.org",
  cacheFileName: "fightaging.json",
  displayName: "🧬 Fight Aging!",
  feedUrl: "https://www.fightaging.org/feed/",
  articlePathRegex: /archives/,
  siteSuffixRegex: \s*[-–—]\s*fightaging.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "fightaging",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
