/**
 * seed-pcta.mjs — Pacific Crest Trail Association seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.pcta.org",
  cacheFileName: "pcta.json",
  displayName: "🥾 Pacific Crest Trail Association",
  feedUrl: "https://www.pcta.org/feed/",
  articlePathRegex: /(discover-the-trail|news|our-work)/,
  siteSuffixRegex: \s*[-–—]\s*pcta.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "pcta",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
