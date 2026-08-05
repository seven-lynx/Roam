/**
 * seed-nhm-paleo.mjs — Natural History Museum London seeder
 * Paleontology, dinosaurs, fossils, natural history, evolution.
 * Category: SCIENCE → PALEONTOLOGY_NATURAL_HISTORY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "nhm.ac.uk",
  cacheFileName: "nhm-paleo.json",
  displayName: "🦕 NHM Paleontology",
  articlePathRegex: /\/(discover|our-science)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Natural History Museum\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.PALEONTOLOGY_NATURAL_HISTORY,
  source: "nhm-paleo",
  seeder_score: 0.85,
  maxPages: 30,
});