/**
 * seed-manyworlds.mjs — Many Worlds seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "manyworlds.space",
  cacheFileName: "manyworlds.json",
  displayName: "🌏 Many Worlds",
  feedUrl: "https://manyworlds.space/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*manyworlds.space\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "manyworlds",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
