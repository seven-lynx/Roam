/**
 * seed-csam-asam.mjs — CSAM-ASAM seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.ADDICTION_RECOVERY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "csam-asam.org",
  cacheFileName: "csam-asam.json",
  displayName: "🧑‍⚕ CSAM-ASAM",
  feedUrl: "https://csam-asam.org/feed/",
  articlePathRegex: /(news|education|resources)/,
  siteSuffixRegex: \s*[-–—]\s*csam-asam.org\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.ADDICTION_RECOVERY,
  source: "csam-asam",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
