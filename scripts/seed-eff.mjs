/**
 * seed-eff.mjs — EFF Deeplinks seeder
 * Digital rights, privacy, cybersecurity — EFF's editorial blog.
 * Category: TECHNOLOGY → CYBERSECURITY_PRIVACY
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.eff.org",
  cacheFileName: "eff.json",
  displayName: "🔐 EFF Deeplinks",
  feedUrl: "https://www.eff.org/rss/updates.xml",
  articlePathRegex: /\/deeplinks\/20\d{2}\/\d{2}\/[a-z0-9-]+$/i,
  siteSuffixRegex: /[–\-|]\s*Electronic Frontier Foundation\s*$/i,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.CYBERSECURITY_PRIVACY,
  source: "eff",
  seeder_score: 0.8,
});