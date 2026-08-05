/**
 * seed-whowhatwear.mjs — Who What Wear seeder
 * Fashion trends, style guides, runway coverage, and industry news.
 * Category: ARTS_CULTURE → FASHION_TEXTILES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.whowhatwear.com",
  cacheFileName: "whowhatwear.json",
  displayName: "👗 Who What Wear",
  feedUrl: "https://www.whowhatwear.com/feed",
  articlePathRegex: /\/(fashion|style|beauty|trends|runway|street-style|shopping)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*Who\s+What\s+Wear\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.FASHION_TEXTILES,
  source: "whowhatwear",
  seeder_score: 0.5,
  maxArticles: 2000,
  maxPages: 20,
});