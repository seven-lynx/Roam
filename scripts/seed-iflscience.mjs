/**
 * seed-iflscience.mjs — seed IFLScience articles via multi-method discovery
 *
 * IFLScience.com is behind AWS CloudFront WAF bot protection, so we can't
 * scrape it directly. Uses the 4-tier fallback chain via seedRssWithFallbacks:
 *   RSS → Sitemap → Wayback CDX → homepage RSS autodiscovery
 *
 * IFLScience has feeds per category: /category/space/feed/, etc.
 * We use the main /feed/ which aggregates all categories.
 *
 * Usage:
 *   node scripts/seed-iflscience.mjs
 *   node scripts/seed-iflscience.mjs --no-cache
 *
 * Category mapping (source labels written to DB):
 *   iflscience  → single source for all, categorized by subcategory inference
 */

import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "iflscience.com",
  cacheFileName: "iflscience.json",
  displayName: "🛰️ IFLScience",
  feedUrl: "https://www.iflscience.com/feed/",
  articlePathRegex: /^\/(?!category\/|tag\/|author\/|page\/|search\/|cdn-cgi\/).+/,
  skipPaths: [
    /^\/cdn-cgi\//,
    /^\/about(\/|$)/,
    /^\/contact(\/|$)/,
    /^\/privacy(\/|$)/,
    /^\/terms(\/|$)/,
    /^\/newsletter(\/|$)/,
    /^\/advertise(\/|$)/,
    /^\/staff(\/|$)/,
    /^\/category(\/|$)/,
    /^\/tag(\/|$)/,
    /^\/author(\/|$)/,
    /^\/page(\/|$)/,
  ],
  siteSuffixRegex: /\s*\|\s*IFLScience\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.SPACE_ASTRONOMY,
  source: "iflscience",
  seeder_score: 0.7,
  maxArticles: 2000,
  maxPages: 40,
});