/**
 * seed-phantomsandmonsters.mjs — Phantoms & Monsters seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.phantomsandmonsters.com",
  cacheFileName: "phantomsandmonsters.json",
  displayName: "👾 Phantoms & Monsters",
  feedUrl: "https://www.phantomsandmonsters.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*phantomsandmonsters.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "phantomsandmonsters",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
