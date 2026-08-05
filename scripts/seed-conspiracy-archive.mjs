/**
 * seed-conspiracy-archive.mjs — Conspiracy theory / fringe archive seeder
 * Conspiracy theories, fringe science, alternative history, anomalous phenomena.
 * Category: WEIRD_WONDERFUL → CONSPIRACY_FRINGE
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "conspiracyarchive.com",
  cacheFileName: "conspiracy-archive.json",
  displayName: "👽 Conspiracy Archive",
  articlePathRegex: /\/(articles|archives|topics)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Conspiracy Archive\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CONSPIRACY_FRINGE,
  source: "conspiracy-archive",
  seeder_score: 0.5,
  maxPages: 10,
});