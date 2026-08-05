/**
 * seed-botany-one.mjs — Botany One / Kew Gardens seeder
 * Plant science, botany, horticulture research, plant conservation.
 * Category: SCIENCE → BOTANY_PLANT_SCIENCE
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "botany.one",
  cacheFileName: "botany-one.json",
  displayName: "🌿 Botany One",
  articlePathRegex: /\/\d{4}\/\d{2}\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Botany One\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  source: "botany-one",
  seeder_score: 0.75,
  maxPages: 20,
});