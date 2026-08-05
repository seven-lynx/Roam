/**
 * seed-archdaily.mjs — ArchDaily seeder
 * Architecture projects, design writing, urban planning.
 * Category: ARTS_CULTURE → ARCHITECTURE_URBAN
 * Multi-method: RSS → Sitemap → Wayback CDX
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.archdaily.com",
  cacheFileName: "archdaily.json",
  displayName: "🏛️ ArchDaily",
  feedUrl: "https://www.archdaily.com/feed/",
  articlePathRegex: /\/(\d{6,})\/[a-z0-9-]+\.html?$/i,
  siteSuffixRegex: /[–\-|]\s*ArchDaily\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.ARCHITECTURE_URBAN,
  source: "archdaily",
  seeder_score: 0.8,
});