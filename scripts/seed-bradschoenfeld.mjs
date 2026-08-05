/**
 * seed-bradschoenfeld.mjs — Brad Schoenfeld seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lookgreatnaked.com",
  cacheFileName: "bradschoenfeld.json",
  displayName: "🔬 Brad Schoenfeld",
  feedUrl: "https://www.lookgreatnaked.com/blog/feed/",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*lookgreatnaked.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "schoenfeld",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
