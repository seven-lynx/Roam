/**
 * seed-comics-journal.mjs — The Comics Journal seeder
 * Comics criticism, illustration history, graphic novel reviews, cartoonist profiles.
 * Category: ARTS_CULTURE → COMICS_ILLUSTRATION
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "tcj.com",
  cacheFileName: "comics-journal.json",
  displayName: "💬 Comics Journal",
  articlePathRegex: /\/(reviews|interviews|features|columns)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*The Comics Journal\s*$/i,
  category_id: CATEGORY.ARTS_CULTURE,
  subcategory_id: SUBCATEGORY.COMICS_ILLUSTRATION,
  source: "comics-journal",
  seeder_score: 0.75,
  maxPages: 25,
});