/**
 * seed-bluezones.mjs — Blue Zones seeder
 * Longevity research, healthy aging, centenarian lifestyles, wellness science.
 * Category: MIND_BODY → AGING_LONGEVITY
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "bluezones.com",
  cacheFileName: "bluezones.json",
  displayName: "🫒 Blue Zones",
  articlePathRegex: /\/(articles|recipes|science|exploration)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Blue Zones\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.AGING_LONGEVITY,
  source: "bluezones",
  seeder_score: 0.6,
  maxPages: 10,
});