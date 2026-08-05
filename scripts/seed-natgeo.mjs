/**
 * seed-natgeo.mjs — National Geographic seeder
 * Travel, exploration, cultural anthropology, photography, geography.
 * Category: PEOPLE_PLACES → TRAVEL_EXPLORATION
 * Access: Wayback CDX
 *
 * National Geographic is behind aggressive bot protection (CloudFront WAF).
 * All sitemaps and RSS feeds return 403/404. The Wayback Machine CDX API
 * is our only viable discovery method. A very broad articlePathRegex is used
 * because NatGeo's URL structure varies widely across sections.
 */

import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "nationalgeographic.com",
  cacheFileName: "natgeo.json",
  displayName: "🌍 National Geographic",
  // NatGeo article paths follow patterns like:
  //   /section/article/slug/
  //   /section/subsection/article-slug/
  //   /premium/article-slug/
  // Exclude non-article paths via skipPaths rather than restricting here
  articlePathRegex: /^\/(?!cdn-cgi\/|search\/|tag\/|author\/|category\/|page\/|about\/|contact\/|privacy\/|terms\/|subscribe\/|newsletter\/|advertise\/|careers\/|store\/|login\/|register\/).+/i,
  siteSuffixRegex: /\s*[\|\-]\s*National Geographic\s*$/i,
  skipPaths: [
    /^\/cdn-cgi\//,
    /^\/search(\/|$)/,
    /^\/tag(\/|$)/,
    /^\/author(\/|$)/,
    /^\/category(\/|$)/,
    /^\/page(\/|$)/,
    /^\/about(\/|$)/,
    /^\/contact(\/|$)/,
    /^\/privacy(\/|$)/,
    /^\/terms(\/|$)/,
    /^\/subscribe(\/|$)/,
    /^\/newsletter(\/|$)/,
    /^\/advertise(\/|$)/,
    /^\/careers(\/|$)/,
    /^\/store(\/|$)/,
    /^\/login(\/|$)/,
    /^\/register(\/|$)/,
    /^\/subscription(\/|$)/,
    /^\/account(\/|$)/,
  ],
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.TRAVEL_EXPLORATION,
  source: "natgeo",
  seeder_score: 0.75,
  maxPages: 50,
});