/**
 * seed-lifespan-io.mjs — Lifespan.io seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.AGING_LONGEVITY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lifespan.io",
  cacheFileName: "lifespan-io.json",
  displayName: "🧬 Lifespan.io",
  feedUrl: "https://www.lifespan.io/feed/",
  articlePathRegex: /(news|topic)/,
  siteSuffixRegex: \s*[-–—]\s*lifespan.io\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "lifespanio",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
