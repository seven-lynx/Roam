/**
 * seed-wmo.mjs — WMO seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "public.wmo.int",
  cacheFileName: "wmo.json",
  displayName: "🌐 WMO",
  feedUrl: "https://public.wmo.int/en/rss.xml",
  articlePathRegex: /(en/media|en/resources)/,
  siteSuffixRegex: \s*[-–—]\s*public.wmo.int\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  source: "wmo",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
