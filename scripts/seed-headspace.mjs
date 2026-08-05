/**
 * seed-headspace.mjs — Headspace articles seeder
 * Mindfulness, meditation techniques, mental wellness, stress management.
 * Category: MIND_BODY → MINDFULNESS_MEDITATION
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "headspace.com",
  cacheFileName: "headspace.json",
  displayName: "🧘 Headspace",
  articlePathRegex: /\/(articles|meditation|mindfulness|science)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Headspace\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.MINDFULNESS_MEDITATION,
  source: "headspace",
  seeder_score: 0.7,
  maxPages: 10,
});