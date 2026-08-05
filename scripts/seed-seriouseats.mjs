/**
 * seed-seriouseats.mjs — Serious Eats seeder
 * Food science + rigorously tested recipes — Kenji López-Alt editorial quality.
 * Category: GAMES_HOBBIES → COOKING_FOOD
 * Multi-method: Wayback CDX → Sitemap → RSS
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "seriouseats.com",
  cacheFileName: "seriouseats.json",
  displayName: "🍳 Serious Eats",
  articlePathRegex: /\/(recipes|techniques|guides|science)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /[\-\|]\s*Serious Eats\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "seriouseats",
  seeder_score: 0.8,
  maxPages: 40,
});