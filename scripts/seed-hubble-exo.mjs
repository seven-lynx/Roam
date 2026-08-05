/**
 * seed-hubble-exo.mjs — HubbleSite seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "hubblesite.org",
  cacheFileName: "hubble-exo.json",
  displayName: "🔭 HubbleSite",
  feedUrl: "https://hubblesite.org/contents/news-releases?format=rss",
  articlePathRegex: /contents/,
  siteSuffixRegex: \s*[-–—]\s*hubblesite.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  source: "hubble-exo",
  seeder_score: 0.85,
  maxArticles: 500,
  maxPages: 20,
});
