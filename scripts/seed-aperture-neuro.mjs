/**
 * seed-aperture-neuro.mjs — Aperture Neuro seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.apertureneuro.org",
  cacheFileName: "aperture-neuro.json",
  displayName: "📖 Aperture Neuro",
  
  articlePathRegex: /(pub|article)/,
  siteSuffixRegex: \s*[-–—]\s*apertureneuro.org\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "aperture-neuro",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
