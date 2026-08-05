/**
 * seed-humankinetics.mjs — Human Kinetics seeder
 * Category: CATEGORY.MIND_BODY → SUBCATEGORY.HUMAN_PERFORMANCE
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.humankinetics.com",
  cacheFileName: "humankinetics.json",
  displayName: "📚 Human Kinetics",
  
  articlePathRegex: /(pages|news|blog)/,
  siteSuffixRegex: \s*[-–—]\s*humankinetics.com\s*$,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.HUMAN_PERFORMANCE,
  source: "humankinetics",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
