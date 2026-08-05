/**
 * seed-usbg.mjs — USBG seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.usbg.gov",
  cacheFileName: "usbg.json",
  displayName: "🌸 USBG",
  feedUrl: "https://www.usbg.gov/rss.xml",
  articlePathRegex: /(news|plants|programs)/,
  siteSuffixRegex: \s*[-–—]\s*usbg.gov\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "usbg",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
