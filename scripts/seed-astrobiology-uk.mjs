/**
 * seed-astrobiology-uk.mjs — UK Astrobiology seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "astrobiology.ac.uk",
  cacheFileName: "astrobiology-uk.json",
  displayName: "🇬🇧 UK Astrobiology",
  feedUrl: "https://astrobiology.ac.uk/feed/",
  articlePathRegex: /(news|events)/,
  siteSuffixRegex: \s*[-–—]\s*astrobiology.ac.uk\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "astrobiology-uk",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
