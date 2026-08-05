/**
 * seed-bl.mjs — British Library seeder
 * Illuminated manuscripts, historical maps, artifacts with curator notes.
 * Category: ARTS_CULTURE → VISUAL_ART
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blogs.bl.uk",
  cacheFileName: "bl.json",
  displayName: "📖 British Library",
  feedUrl: "https://blogs.bl.uk/atom.xml",
  articlePathRegex: /\/(d[^\s\/]+|20\d{2}\/\d{2}\/[a-z0-9-]+)/i,
  siteSuffixRegex: /[–\-|]\s*The British Library\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.VISUAL_ART,
  source: "bl",
  seeder_score: 0.9,
});