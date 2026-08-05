/**
 * seed-strength-fitness.mjs — Strength & Bodybuilding (RSS → Sitemap → Wayback)
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "t-nation.com",
  cacheFileName: "strength-fitness.json",
  displayName: "💪 T Nation",
  feedUrl: "https://www.t-nation.com/feed/",
  articlePathRegex: /\/(t\/|article)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*T\s*NATION$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.FITNESS_MOVEMENT,
  source: "strength-fitness",
  maxArticles: 1000,
  maxPages: 15,
});