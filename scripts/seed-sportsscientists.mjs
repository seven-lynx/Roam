/**
 * seed-sportsscientists.mjs — Sports Scientists seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.sportsscientists.com",
  cacheFileName: "sportsscientists.json",
  displayName: "🔬 Sports Scientists",
  feedUrl: "https://www.sportsscientists.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*sportsscientists.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "sportsscientists",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
