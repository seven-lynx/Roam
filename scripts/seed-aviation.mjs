/**
 * seed-aviation.mjs — Aviation & Aircraft seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "flyingmag.com",
  cacheFileName: "aviation.json",
  displayName: "✈️ Flying Magazine",
  articlePathRegex: /\/(aircraft|news|technique|gear|travel|stories)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Flying$/i,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.HARDWARE_ELECTRONICS,
  source: "aviation",
  maxPages: 20,
});