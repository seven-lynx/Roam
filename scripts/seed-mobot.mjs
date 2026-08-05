/**
 * seed-mobot.mjs — MoBot seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.BOTANY_PLANT_SCIENCE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.missouribotanicalgarden.org",
  cacheFileName: "mobot.json",
  displayName: "🌺 MoBot",
  feedUrl: "https://www.missouribotanicalgarden.org/feed",
  articlePathRegex: /(plant-science|conservation|news)/,
  siteSuffixRegex: \s*[-–—]\s*missouribotanicalgarden.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "mobot",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
