/**
 * seed-audio-hifi.mjs — Hi-Fi Audio & Headphones seeder
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "whathifi.com",
  cacheFileName: "audio-hifi.json",
  displayName: "🎧 What Hi-Fi",
  articlePathRegex: /\/(news|reviews|features|best-buys|how-to)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*What\s*Hi-Fi\??$/i,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.HARDWARE_ELECTRONICS,
  source: "audio-hifi",
  maxPages: 20,
});