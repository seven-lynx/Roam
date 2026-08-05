/**
 * seed-vintage-web.mjs — Web Design Museum / Version Museum seeder
 * Vintage internet history, old websites, web design evolution, digital nostalgia.
 * Category: WEIRD_WONDERFUL → VINTAGE_INTERNET
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "webdesignmuseum.org",
  cacheFileName: "vintage-web.json",
  displayName: "💾 Vintage Web",
  articlePathRegex: /\/(web-design|old-websites|timeline)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Web Design Museum\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
  source: "vintage-web",
  seeder_score: 0.6,
  maxPages: 10,
});