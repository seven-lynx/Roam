/**
 * seed-inaturalist-plants.mjs — iNaturalist Plants seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.inaturalist.org",
  cacheFileName: "inaturalist-plants.json",
  displayName: "🍃 iNaturalist Plants",
  feedUrl: "https://www.inaturalist.org/blog.rss",
  articlePathRegex: /(blog|observations)/,
  siteSuffixRegex: \s*[-–—]\s*inaturalist.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "inaturalist-plants",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
