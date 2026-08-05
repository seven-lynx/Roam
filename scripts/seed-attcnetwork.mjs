/**
 * seed-attcnetwork.mjs — ATTC Network seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "attcnetwork.org",
  cacheFileName: "attcnetwork.json",
  displayName: "🧑‍⚕ ATTC Network",
  feedUrl: "https://attcnetwork.org/feed/",
  articlePathRegex: /(centers|products|news)/,
  siteSuffixRegex: \s*[-–—]\s*attcnetwork.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "attcnetwork",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
