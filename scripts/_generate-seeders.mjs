/**
 * _generate-seeders.mjs — one-shot script to create all 400 seeder files.
 * Run: node scripts/_generate-seeders.mjs
 *
 * Writes 20 seeders per subcategory into scripts/ directory.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Seeder template ──────────────────────────────────────────────────────────
function seeder({
  filename, displayName, siteDomain, feedUrl,
  category, subcategory, source, seeder_score = 0.7,
  maxArticles = 500, maxPages = 20, siteSuffixRegex,
  articlePathRegex, sitemapOnly = false,
}) {
  const displayEmoji = displayName.match(/^[🎯🔬🪐🧬🔭🌵🌍🧠💾🔐🖥⚖📜🧭🏛📚🐲👽🕳🌊🏜️🏔⌛💪]/)?.[0] || '📌';
  const suffixDefault = siteSuffixRegex || `\\s*[-–—]\\s*${siteDomain.replace(/^www\./, '')}\\s*$`;

  return `/**
 * seed-${filename}.mjs — ${displayName.replace(/^[^\s]+\s/, '')} seeder
 * Category: ${category} → ${subcategory}
 * Access: ${sitemapOnly ? 'Sitemap → Wayback' : 'RSS feed → Sitemap → Wayback'}
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "${siteDomain}",
  cacheFileName: "${filename}.json",
  displayName: "${displayName}",
  ${feedUrl ? `feedUrl: "${feedUrl}",` : ''}
  articlePathRegex: ${articlePathRegex},
  siteSuffixRegex: ${suffixDefault},
  category_id: ${category},
  subcategory_id: ${subcategory},
  source: "${source}",
  seeder_score: ${seeder_score},
  maxArticles: ${maxArticles},
  maxPages: ${maxPages},
});
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL 400 SEEDER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const seeders = [

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ASTROBIOLOGY & EXOPLANETS (Pillar 1, sort 10)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'astrobiology-nasa',displayName:'🪐 NASA Astrobiology',siteDomain:'astrobiology.nasa.gov',feedUrl:'https://astrobiology.nasa.gov/feed/',articlePathRegex:`/(news|articles|about)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'astrobiology-nasa',seeder_score:0.9})],
  [seeder({filename:'nasa-exoplanets',displayName:'🔭 NASA Exoplanets',siteDomain:'exoplanets.nasa.gov',feedUrl:'https://exoplanets.nasa.gov/feed/',articlePathRegex:`/(news|blog|resources)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'nasa-exoplanets',seeder_score:0.9})],
  [seeder({filename:'seti',displayName:'👽 SETI Institute',siteDomain:'www.seti.org',feedUrl:'https://www.seti.org/rss.xml',articlePathRegex:`/(press-release|article|event)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'seti',seeder_score:0.8})],
  [seeder({filename:'eana',displayName:'🛸 EANA',siteDomain:'www.eana-net.eu',feedUrl:'https://www.eana-net.eu/feed/',articlePathRegex:`/./`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'eana',seeder_score:0.7})],
  [seeder({filename:'exoplanet-eu',displayName:'🌌 Exoplanet.eu',siteDomain:'exoplanet.eu',feedUrl:'https://exoplanet.eu/feed/',articlePathRegex:`/./`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'exoplanet-eu',seeder_score:0.85})],
  [seeder({filename:'astrobites',displayName:'🛰 Astrobites',siteDomain:'astrobites.org',feedUrl:'https://astrobites.org/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'astrobites',seeder_score:0.75})],
  [seeder({filename:'centauri-dreams',displayName:'🌠 Centauri Dreams',siteDomain:'www.centauri-dreams.org',feedUrl:'https://www.centauri-dreams.org/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'centauri-dreams',seeder_score:0.75})],
  [seeder({filename:'manyworlds',displayName:'🌏 Many Worlds',siteDomain:'manyworlds.space',feedUrl:'https://manyworlds.space/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'manyworlds',seeder_score:0.7})],
  [seeder({filename:'planetary-society-exo',displayName:'🪐 Planetary Society',siteDomain:'www.planetary.org',feedUrl:'https://www.planetary.org/feeds/latest',articlePathRegex:`/(articles|space-images)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'planetary-society',seeder_score:0.8})],
  [seeder({filename:'astrobiology-uk',displayName:'🇬🇧 UK Astrobiology',siteDomain:'astrobiology.ac.uk',feedUrl:'https://astrobiology.ac.uk/feed/',articlePathRegex:`/(news|events)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'astrobiology-uk',seeder_score:0.7})],
  [seeder({filename:'issol',displayName:'🧫 ISSOL',siteDomain:'issol.org',feedUrl:'https://issol.org/feed/',articlePathRegex:`/./`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'issol',seeder_score:0.65})],
  [seeder({filename:'esa-exoplanets',displayName:'🛰 ESA Exoplanets',siteDomain:'sci.esa.int',feedUrl:'https://sci.esa.int/web/exoplanets/-/rss',articlePathRegex:`/web/exoplanets/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'esa-exoplanets',seeder_score:0.85})],
  [seeder({filename:'exoclock',displayName:'⏱ ExoClock',siteDomain:'www.exoclock.space',articlePathRegex:`/(news|targets)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'exoclock',seeder_score:0.6,sitemapOnly:true})],
  [seeder({filename:'nexss',displayName:'🔬 NExSS',siteDomain:'nexusfordata.org',articlePathRegex:`/./`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'nexss',seeder_score:0.6,sitemapOnly:true})],
  [seeder({filename:'tess-mit',displayName:'🛰 TESS MIT',siteDomain:'tess.mit.edu',feedUrl:'https://tess.mit.edu/feed/',articlePathRegex:`/(news|publications|events)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'tess-mit',seeder_score:0.8})],
  [seeder({filename:'spitzer',displayName:'🔭 Spitzer',siteDomain:'www.spitzer.caltech.edu',feedUrl:'https://www.spitzer.caltech.edu/news/feed',articlePathRegex:`/news/|/image/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'spitzer',seeder_score:0.75})],
  [seeder({filename:'jwst',displayName:'🔭 JWST',siteDomain:'webb.nasa.gov',feedUrl:'https://webb.nasa.gov/feed/',articlePathRegex:`/(news|content)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'jwst',seeder_score:0.9})],
  [seeder({filename:'hubble-exo',displayName:'🔭 HubbleSite',siteDomain:'hubblesite.org',feedUrl:'https://hubblesite.org/contents/news-releases?format=rss',articlePathRegex:`/contents/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'hubble-exo',seeder_score:0.85})],
  [seeder({filename:'nasa-ame',displayName:'🪐 NASA AME',siteDomain:'www.nasa.gov',feedUrl:'https://www.nasa.gov/subject/7530/astrobiology/feed/',articlePathRegex:`/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'nasa-ame',seeder_score:0.8})],
  [seeder({filename:'kepler-mission',displayName:'🛰 Kepler Mission',siteDomain:'www.nasa.gov',feedUrl:'https://www.nasa.gov/mission_pages/kepler/main/rss.xml',articlePathRegex:`/mission_pages/kepler/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS',source:'kepler-mission',seeder_score:0.85})],

  // ──────────────────────────────────────────────────────────────────────────
  // 2. BOTANY & PLANT SCIENCE (Pillar 1, sort 11)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'kew',displayName:'🌿 Kew Gardens',siteDomain:'www.kew.org',feedUrl:'https://www.kew.org/rss.xml',articlePathRegex:`/(read-and-watch|science|news)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'kew',seeder_score:0.9})],
  [seeder({filename:'bgci',displayName:'🌱 BGCI',siteDomain:'www.bgci.org',feedUrl:'https://www.bgci.org/feed/',articlePathRegex:`/(news|resources)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'bgci',seeder_score:0.75})],
  [seeder({filename:'nybg',displayName:'🌷 NYBG',siteDomain:'www.nybg.org',feedUrl:'https://www.nybg.org/feed/',articlePathRegex:`/(blogs|events|collections)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'nybg',seeder_score:0.75})],
  [seeder({filename:'mobot',displayName:'🌺 MoBot',siteDomain:'www.missouribotanicalgarden.org',feedUrl:'https://www.missouribotanicalgarden.org/feed',articlePathRegex:`/(plant-science|conservation|news)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'mobot',seeder_score:0.75})],
  [seeder({filename:'botany-one',displayName:'📖 Botany One',siteDomain:'www.botany.one',feedUrl:'https://www.botany.one/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'botany-one',seeder_score:0.8})],
  [seeder({filename:'arnold-arboretum',displayName:'🌳 Arnold Arboretum',siteDomain:'arnoldarboretum.org',feedUrl:'https://arboretum.harvard.edu/feed/',articlePathRegex:`/(plants|stories|research)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'arnold-arboretum',seeder_score:0.75})],
  [seeder({filename:'usbg',displayName:'🌸 USBG',siteDomain:'www.usbg.gov',feedUrl:'https://www.usbg.gov/rss.xml',articlePathRegex:`/(news|plants|programs)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'usbg',seeder_score:0.65})],
  [seeder({filename:'rhs',displayName:'🌻 RHS',siteDomain:'www.rhs.org.uk',feedUrl:'https://www.rhs.org.uk/feed',articlePathRegex:`/(plants|gardening|science)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'rhs',seeder_score:0.75})],
  [seeder({filename:'inaturalist-plants',displayName:'🍃 iNaturalist Plants',siteDomain:'www.inaturalist.org',feedUrl:'https://www.inaturalist.org/blog.rss',articlePathRegex:`/(blog|observations)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'inaturalist-plants',seeder_score:0.75})],
  [seeder({filename:'apsnet',displayName:'🦠 APSNet',siteDomain:'www.apsnet.org',feedUrl:'https://apsjournals.apsnet.org/loi/phyto.rss',articlePathRegex:`/doi/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'apsnet',seeder_score:0.7})],
  [seeder({filename:'defenseofplants',displayName:'🌵 In Defense of Plants',siteDomain:'www.indefenseofplants.com',feedUrl:'https://www.indefenseofplants.com/blog?format=rss',articlePathRegex:`/blog/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'indefenseofplants',seeder_score:0.7})],
  [seeder({filename:'carnivorous-plants',displayName:'🌿 Carnivorous Plants',siteDomain:'www.carnivorousplants.org',feedUrl:'https://www.carnivorousplants.org/feed/',articlePathRegex:`/(news|events|articles)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'carnivorousplants',seeder_score:0.65})],
  [seeder({filename:'usda-plants',displayName:'🌾 USDA Plants',siteDomain:'plants.usda.gov',articlePathRegex:`/home/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'usda-plants',seeder_score:0.75,sitemapOnly:true})],
  [seeder({filename:'desert-bg',displayName:'🌵 Desert Botanical Garden',siteDomain:'www.dbg.org',feedUrl:'https://www.dbg.org/feed/',articlePathRegex:`/(blog|events|plants)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'desert-bg',seeder_score:0.65})],
  [seeder({filename:'bspb',displayName:'🔬 BSPB Plant Pathology',siteDomain:'www.bspb.org',feedUrl:'https://www.bspb.org/feed/',articlePathRegex:`/(news|publications|events)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'bspb',seeder_score:0.65})],
  [seeder({filename:'worldfloraonline',displayName:'🌐 World Flora Online',siteDomain:'www.worldfloraonline.org',articlePathRegex:`/(taxon|about)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'worldfloraonline',seeder_score:0.7,sitemapOnly:true})],
  [seeder({filename:'the-plant-list',displayName:'📋 The Plant List',siteDomain:'www.theplantlist.org',articlePathRegex:`/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'the-plant-list',seeder_score:0.65,sitemapOnly:true})],
  [seeder({filename:'botanical-online',displayName:'🌿 Botanical Online',siteDomain:'www.botanical-online.com',feedUrl:'https://www.botanical-online.com/feed/',articlePathRegex:`/(las-plantas|propiedades|medicinales)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'botanical-online',seeder_score:0.55})],
  [seeder({filename:'conifers-org',displayName:'🌲 Conifers.org',siteDomain:'www.conifers.org',articlePathRegex:`/(topics|ar)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'conifers-org',seeder_score:0.6,sitemapOnly:true})],
  [seeder({filename:'bionet-intl',displayName:'🌍 Bionet Intl',siteDomain:'www.bionet-intl.org',articlePathRegex:`/(news|resources|publications)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.BOTANY_PLANT_SCIENCE',source:'bionet-intl',seeder_score:0.55,sitemapOnly:true})],

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CLIMATE & ATMOSPHERIC SCIENCE (Pillar 1, sort 12)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'climate-gov',displayName:'🌡 Climate.gov',siteDomain:'www.climate.gov',feedUrl:'https://www.climate.gov/rss.xml',articlePathRegex:`/(news-features|teaching|data)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'climate-gov',seeder_score:0.95})],
  [seeder({filename:'carbonbrief',displayName:'⚡ Carbon Brief',siteDomain:'www.carbonbrief.org',feedUrl:'https://www.carbonbrief.org/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'carbonbrief',seeder_score:0.85})],
  [seeder({filename:'realclimate',displayName:'🌍 RealClimate',siteDomain:'www.realclimate.org',feedUrl:'https://www.realclimate.org/feed/',articlePathRegex:`/index.php/archives/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'realclimate',seeder_score:0.8})],
  [seeder({filename:'skeptical-science',displayName:'🔍 Skeptical Science',siteDomain:'skepticalscience.com',feedUrl:'https://skepticalscience.com/feed.php',articlePathRegex:`/(argument|news)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'skepticalscience',seeder_score:0.75})],
  [seeder({filename:'climatecentral',displayName:'📊 Climate Central',siteDomain:'www.climatecentral.org',feedUrl:'https://www.climatecentral.org/feed',articlePathRegex:`/(news|research|climate-matters)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'climatecentral',seeder_score:0.75})],
  [seeder({filename:'nsidc',displayName:'❄ NSIDC',siteDomain:'nsidc.org',feedUrl:'https://nsidc.org/feed',articlePathRegex:`/(news|data|arcticseaicenews)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'nsidc',seeder_score:0.75})],
  [seeder({filename:'yale-climate',displayName:'🌳 Yale Climate Connections',siteDomain:'yaleclimateconnections.org',feedUrl:'https://yaleclimateconnections.org/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'yale-climate',seeder_score:0.75})],
  [seeder({filename:'ipcc',displayName:'📘 IPCC',siteDomain:'www.ipcc.ch',feedUrl:'https://www.ipcc.ch/feed/',articlePathRegex:`/(report|news|documentation)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'ipcc',seeder_score:0.9})],
  [seeder({filename:'unfccc',displayName:'🇺🇳 UNFCCC',siteDomain:'unfccc.int',feedUrl:'https://unfccc.int/rss.xml',articlePathRegex:`/(news|process-and-meetings|topics)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'unfccc',seeder_score:0.85})],
  [seeder({filename:'wmo',displayName:'🌐 WMO',siteDomain:'public.wmo.int',feedUrl:'https://public.wmo.int/en/rss.xml',articlePathRegex:`/(en/media|en/resources)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'wmo',seeder_score:0.8})],
  [seeder({filename:'copernicus-atmos',displayName:'🛰 Copernicus Atmosphere',siteDomain:'atmosphere.copernicus.eu',feedUrl:'https://atmosphere.copernicus.eu/rss.xml',articlePathRegex:`/(news|data|about)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'copernicus-atmos',seeder_score:0.8})],
  [seeder({filename:'ncar',displayName:'🌪 NCAR',siteDomain:'news.ucar.edu',feedUrl:'https://news.ucar.edu/feed',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'ncar',seeder_score:0.75})],
  [seeder({filename:'tyndall',displayName:'🏴 Tyndall Centre',siteDomain:'www.tyndall.ac.uk',feedUrl:'https://www.tyndall.ac.uk/feed',articlePathRegex:`/(news|research|publications)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'tyndall',seeder_score:0.7})],
  [seeder({filename:'whoi-climate',displayName:'🌊 WHOI Climate',siteDomain:'www.whoi.edu',feedUrl:'https://www.whoi.edu/who-we-are/media-relations/news-releases/feed/',articlePathRegex:`/(news-release|oceanus)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'whoi-climate',seeder_score:0.7})],
  [seeder({filename:'metoffice',displayName:'🌦 UK Met Office',siteDomain:'www.metoffice.gov.uk',feedUrl:'https://www.metoffice.gov.uk/about-us/press-office/news/weather-and-climate/feed',articlePathRegex:`/about-us/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'metoffice',seeder_score:0.8})],
  [seeder({filename:'noaa-climate',displayName:'🐟 NOAA Climate',siteDomain:'www.noaa.gov',feedUrl:'https://www.noaa.gov/rss-feeds/climate',articlePathRegex:`/(news|climate)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'noaa-climate',seeder_score:0.85})],
  [seeder({filename:'climatereality',displayName:'🌐 Climate Reality',siteDomain:'www.climaterealityproject.org',feedUrl:'https://www.climaterealityproject.org/feed',articlePathRegex:`/(blog|news)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'climatereality',seeder_score:0.6})],
  [seeder({filename:'350org',displayName:'🌍 350.org',siteDomain:'350.org',feedUrl:'https://350.org/feed/',articlePathRegex:`/(news|resources)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'350org',seeder_score:0.55})],
  [seeder({filename:'uci-ess',displayName:'🔬 UCI ESS',siteDomain:'ess.uci.edu',feedUrl:'https://ess.uci.edu/news/rss',articlePathRegex:`/(news|research)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'uci-ess',seeder_score:0.65})],
  [seeder({filename:'lamont',displayName:'🌎 Lamont-Doherty',siteDomain:'lamont.columbia.edu',feedUrl:'https://lamont.columbia.edu/rss.xml',articlePathRegex:`/(news|research|events)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE',source:'lamont',seeder_score:0.7})],

  // ──────────────────────────────────────────────────────────────────────────
  // 4. NEUROSCIENCE & COGNITION (Pillar 1, sort 13)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'allen-brain',displayName:'🧠 Allen Institute',siteDomain:'alleninstitute.org',feedUrl:'https://alleninstitute.org/news/feed/',articlePathRegex:`/(news|what-we-do)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'allen-brain',seeder_score:0.85})],
  [seeder({filename:'brainfacts',displayName:'🧠 BrainFacts',siteDomain:'www.brainfacts.org',feedUrl:'https://www.brainfacts.org/rss.xml',articlePathRegex:`/(thinking-sensing-and-behaving|diseases-and-disorders|brain-anatomy-and-function)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'brainfacts',seeder_score:0.75})],
  [seeder({filename:'ninds',displayName:'🔬 NINDS',siteDomain:'www.ninds.nih.gov',feedUrl:'https://www.ninds.nih.gov/news-events/news-releases/feed',articlePathRegex:`/(news-events|health-information)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'ninds',seeder_score:0.85})],
  [seeder({filename:'neurosciencenews',displayName:'🧠 Neuroscience News',siteDomain:'neurosciencenews.com',feedUrl:'https://neurosciencenews.com/feed/',articlePathRegex:`/(neuroscience|psychology|neurology|genetics|artificial-intelligence|robotics|neurotech)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'neurosciencenews',seeder_score:0.75})],
  [seeder({filename:'bna',displayName:'🇬🇧 BNA',siteDomain:'www.bna.org.uk',feedUrl:'https://www.bna.org.uk/feed/',articlePathRegex:`/(mediacentre|events|news)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'bna',seeder_score:0.65})],
  [seeder({filename:'sfn',displayName:'🧬 SfN',siteDomain:'www.sfn.org',feedUrl:'https://www.sfn.org/rss/news',articlePathRegex:`/(news|publications)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'sfn',seeder_score:0.7})],
  [seeder({filename:'mind-hacks',displayName:'💡 Mind Hacks',siteDomain:'mindhacks.com',feedUrl:'https://mindhacks.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'mind-hacks',seeder_score:0.7})],
  [seeder({filename:'mpi-brain',displayName:'🔬 MPI Brain',siteDomain:'brain.mpg.de',articlePathRegex:`/(research|news|publications)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'mpi-brain',seeder_score:0.7,sitemapOnly:true})],
  [seeder({filename:'janelia',displayName:'🔬 Janelia',siteDomain:'www.janelia.org',feedUrl:'https://www.janelia.org/news/feed',articlePathRegex:`/(news|research|publication)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'janelia',seeder_score:0.75})],
  [seeder({filename:'brainblogger',displayName:'✍ Brain Blogger',siteDomain:'brainblogger.com',feedUrl:'https://brainblogger.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'brainblogger',seeder_score:0.6})],
  [seeder({filename:'dana',displayName:'🧠 Dana Foundation',siteDomain:'dana.org',feedUrl:'https://dana.org/feed/',articlePathRegex:`/(article|news|resources)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'dana',seeder_score:0.65})],
  [seeder({filename:'simons-collab',displayName:'🔬 Simons Foundation',siteDomain:'www.simonsfoundation.org',feedUrl:'https://www.simonsfoundation.org/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'simons-collab',seeder_score:0.75})],
  [seeder({filename:'hhmi-neuro',displayName:'🔬 HHMI Neuro',siteDomain:'www.hhmi.org',feedUrl:'https://www.hhmi.org/news/rss.xml',articlePathRegex:`/(news|research)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'hhmi-neuro',seeder_score:0.75})],
  [seeder({filename:'sainsbury-wellcome',displayName:'🇬🇧 SWC',siteDomain:'www.sainsburywellcome.org',articlePathRegex:`/(research|news|publications)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'sainsbury-wellcome',seeder_score:0.7,sitemapOnly:true})],
  [seeder({filename:'cambridge-neuro',displayName:'🎓 Cambridge Neuroscience',siteDomain:'www.neuroscience.cam.ac.uk',feedUrl:'https://www.neuroscience.cam.ac.uk/news/feed/',articlePathRegex:`/(news|research|people)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'cambridge-neuro',seeder_score:0.75})],
  [seeder({filename:'ucsf-neuro',displayName:'🏥 UCSF Neuroscience',siteDomain:'neuroscience.ucsf.edu',articlePathRegex:`/(news|research|education)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'ucsf-neuro',seeder_score:0.6,sitemapOnly:true})],
  [seeder({filename:'cognitivesciencesociety',displayName:'📚 Cognitive Science Society',siteDomain:'www.cognitivesciencesociety.org',feedUrl:'https://www.cognitivesciencesociety.org/feed/',articlePathRegex:`/(cognitive-science|news|conference)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'cognitivesciencesociety',seeder_score:0.65})],
  [seeder({filename:'open-neuroscience',displayName:'🔓 Open Neuroscience',siteDomain:'www.open-neuroscience.com',articlePathRegex:`/(post|data|software)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'open-neuroscience',seeder_score:0.5,sitemapOnly:true})],
  [seeder({filename:'aperture-neuro',displayName:'📖 Aperture Neuro',siteDomain:'www.apertureneuro.org',articlePathRegex:`/(pub|article)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'aperture-neuro',seeder_score:0.55,sitemapOnly:true})],
  [seeder({filename:'inb-ucla',displayName:'🎓 UCLA INB',siteDomain:'www.bri.ucla.edu',articlePathRegex:`/(news|research|education)/`,category:'CATEGORY.SCIENCE',subcategory:'SUBCATEGORY.NEUROSCIENCE_COGNITION',source:'inb-ucla',seeder_score:0.55,sitemapOnly:true})],

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DATABASES & DATA ENGINEERING (Pillar 2, sort 10)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'databricks-blog',displayName:'🧱 Databricks',siteDomain:'www.databricks.com',feedUrl:'https://www.databricks.com/blog/feed',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'databricks',seeder_score:0.75})],
  [seeder({filename:'confluent',displayName:'📨 Confluent',siteDomain:'www.confluent.io',feedUrl:'https://www.confluent.io/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'confluent',seeder_score:0.75})],
  [seeder({filename:'postgresql',displayName:'🐘 PostgreSQL',siteDomain:'www.postgresql.org',feedUrl:'https://www.postgresql.org/feed/news/',articlePathRegex:`/(about|docs)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'postgresql',seeder_score:0.8})],
  [seeder({filename:'citus-data',displayName:'🏗 Citus Data',siteDomain:'www.citusdata.com',feedUrl:'https://www.citusdata.com/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'citusdata',seeder_score:0.7})],
  [seeder({filename:'cockroachlabs',displayName:'🪳 CockroachDB',siteDomain:'www.cockroachlabs.com',feedUrl:'https://www.cockroachlabs.com/blog/index.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'cockroachlabs',seeder_score:0.7})],
  [seeder({filename:'timescale',displayName:'⏱ Timescale',siteDomain:'www.timescale.com',feedUrl:'https://www.timescale.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'timescale',seeder_score:0.7})],
  [seeder({filename:'cmu-db',displayName:'🎓 CMU Database Group',siteDomain:'db.cs.cmu.edu',feedUrl:'https://db.cs.cmu.edu/feeds/blog.shtml',articlePathRegex:`/(blog|seminar|project)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'cmu-db',seeder_score:0.8})],
  [seeder({filename:'mongodb',displayName:'🍃 MongoDB',siteDomain:'www.mongodb.com',feedUrl:'https://www.mongodb.com/blog/rss.xml',articlePathRegex:`/(blog|developer)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'mongodb',seeder_score:0.7})],
  [seeder({filename:'snowflake',displayName:'❄ Snowflake',siteDomain:'www.snowflake.com',feedUrl:'https://www.snowflake.com/blog/feed/',articlePathRegex:`/(blog|guides)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'snowflake',seeder_score:0.7})],
  [seeder({filename:'airflow',displayName:'💨 Airflow',siteDomain:'airflow.apache.org',feedUrl:'https://airflow.apache.org/blog/feed.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'airflow',seeder_score:0.75})],
  [seeder({filename:'dbt-blog',displayName:'🔧 dbt Labs',siteDomain:'www.getdbt.com',feedUrl:'https://www.getdbt.com/blog/feed',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'dbt-lab',seeder_score:0.7})],
  [seeder({filename:'grafana',displayName:'📊 Grafana',siteDomain:'grafana.com',feedUrl:'https://grafana.com/blog/index.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'grafana',seeder_score:0.7})],
  [seeder({filename:'elasticsearch',displayName:'🔍 Elasticsearch',siteDomain:'www.elastic.co',feedUrl:'https://www.elastic.co/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'elasticsearch',seeder_score:0.7})],
  [seeder({filename:'redis',displayName:'🔴 Redis',siteDomain:'redis.io',feedUrl:'https://redis.io/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'redis',seeder_score:0.75})],
  [seeder({filename:'dataversity',displayName:'📚 DATAVERSITY',siteDomain:'www.dataversity.net',feedUrl:'https://www.dataversity.net/feed/',articlePathRegex:`/(data-topics|category)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'dataversity',seeder_score:0.65})],
  [seeder({filename:'oreilly-data',displayName:'📘 OReilly Data',siteDomain:'www.oreilly.com',feedUrl:'https://www.oreilly.com/radar/topics/data/feed/',articlePathRegex:`/radar/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'oreilly-data',seeder_score:0.7})],
  [seeder({filename:'dagster',displayName:'⚙ Dagster',siteDomain:'dagster.io',feedUrl:'https://dagster.io/blog/rss.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'dagster',seeder_score:0.65})],
  [seeder({filename:'materialize',displayName:'📡 Materialize',siteDomain:'materialize.com',feedUrl:'https://materialize.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'materialize',seeder_score:0.65})],
  [seeder({filename:'sqlite',displayName:'📦 SQLite',siteDomain:'www.sqlite.org',articlePathRegex:`/(docs|draft|about)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'sqlite',seeder_score:0.7,sitemapOnly:true})],
  [seeder({filename:'singlestore',displayName:'⚡ SingleStore',siteDomain:'www.singlestore.com',feedUrl:'https://www.singlestore.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DATABASES_DATA_ENGINEERING',source:'singlestore',seeder_score:0.65})],

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CRYPTOGRAPHY & SECURITY RESEARCH (Pillar 2, sort 11)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'schneier',displayName:'🔐 Schneier on Security',siteDomain:'www.schneier.com',feedUrl:'https://www.schneier.com/feed/atom/',articlePathRegex:`/blog/archives/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'schneier',seeder_score:0.9})],
  [seeder({filename:'iacr',displayName:'🔑 IACR',siteDomain:'www.iacr.org',feedUrl:'https://iacr.org/feed.xml',articlePathRegex:`/(news|tools|publications)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'iacr',seeder_score:0.85})],
  [seeder({filename:'trailofbits',displayName:'🛡 Trail of Bits',siteDomain:'blog.trailofbits.com',feedUrl:'https://blog.trailofbits.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'trailofbits',seeder_score:0.8})],
  [seeder({filename:'project-zero',displayName:'🔍 Project Zero',siteDomain:'googleprojectzero.blogspot.com',feedUrl:'https://googleprojectzero.blogspot.com/feeds/posts/default',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'project-zero',seeder_score:0.85})],
  [seeder({filename:'cryptography-engineering',displayName:'🔐 Crypto Engineering',siteDomain:'blog.cryptographyengineering.com',feedUrl:'https://blog.cryptographyengineering.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'cryptography-engineering',seeder_score:0.85})],
  [seeder({filename:'cryptome',displayName:'📁 Cryptome',siteDomain:'cryptome.org',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'cryptome',seeder_score:0.65,sitemapOnly:true})],
  [seeder({filename:'ssllabs',displayName:'🔒 SSL Labs',siteDomain:'www.ssllabs.com',articlePathRegex:`/(downloads|projects)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'ssllabs',seeder_score:0.7,sitemapOnly:true})],
  [seeder({filename:'cve',displayName:'🕳 CVE',siteDomain:'cve.mitre.org',feedUrl:'https://cve.mitre.org/news/rss.xml',articlePathRegex:`/(cgi-bin|news)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'cve',seeder_score:0.8})],
  [seeder({filename:'ncsc',displayName:'🇬🇧 NCSC',siteDomain:'www.ncsc.gov.uk',feedUrl:'https://www.ncsc.gov.uk/feeds/news.xml',articlePathRegex:`/(news|guidance|information)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'ncsc',seeder_score:0.8})],
  [seeder({filename:'us-cert',displayName:'🛡 CISA',siteDomain:'www.cisa.gov',feedUrl:'https://www.cisa.gov/uscert/ncas/alerts.xml',articlePathRegex:`/(news-events|uscert)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'us-cert',seeder_score:0.85})],
  [seeder({filename:'msrc',displayName:'🪟 MSRC',siteDomain:'msrc.microsoft.com',feedUrl:'https://msrc.microsoft.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'msrc',seeder_score:0.75})],
  [seeder({filename:'google-security',displayName:'🔐 Google Security',siteDomain:'security.googleblog.com',feedUrl:'https://security.googleblog.com/feeds/posts/default',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'google-security',seeder_score:0.8})],
  [seeder({filename:'zdi',displayName:'🎯 Zero Day Initiative',siteDomain:'www.zerodayinitiative.com',feedUrl:'https://www.zerodayinitiative.com/blog?format=rss',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'zdi',seeder_score:0.75})],
  [seeder({filename:'portswigger',displayName:'🔬 PortSwigger Research',siteDomain:'portswigger.net',feedUrl:'https://portswigger.net/daily-swig/rss',articlePathRegex:`/(daily-swig|research)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'portswigger',seeder_score:0.75})],
  [seeder({filename:'nccgroup',displayName:'🔓 NCC Group',siteDomain:'research.nccgroup.com',feedUrl:'https://research.nccgroup.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'nccgroup',seeder_score:0.7})],
  [seeder({filename:'sans',displayName:'🎓 SANS ISC',siteDomain:'isc.sans.edu',feedUrl:'https://isc.sans.edu/rssfeed_full.xml',articlePathRegex:`/(diary|podcast|data)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'sans',seeder_score:0.8})],
  [seeder({filename:'bishopfox',displayName:'🦊 Bishop Fox',siteDomain:'bishopfox.com',feedUrl:'https://bishopfox.com/blog/rss.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'bishopfox',seeder_score:0.7})],
  [seeder({filename:'qualys',displayName:'🔎 Qualys',siteDomain:'blog.qualys.com',feedUrl:'https://blog.qualys.com/feed/',articlePathRegex:`/(vulnerabilities-threat-research|product-tech)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'qualys',seeder_score:0.7})],
  [seeder({filename:'offensive-security',displayName:'💀 Offensive Security',siteDomain:'www.offensive-security.com',articlePathRegex:`/(blog|learn|resources)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'offensive-security',seeder_score:0.65,sitemapOnly:true})],
  [seeder({filename:'bsi',displayName:'🇩🇪 BSI',siteDomain:'www.bsi.bund.de',articlePathRegex:`/(DE|EN)/Themen/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.CRYPTOGRAPHY_SECURITY',source:'bsi',seeder_score:0.6,sitemapOnly:true})],

  // ──────────────────────────────────────────────────────────────────────────
  // 7. DEVOPS & INFRASTRUCTURE (Pillar 2, sort 12)
  // ──────────────────────────────────────────────────────────────────────────
  [seeder({filename:'cncf',displayName:'☸ CNCF',siteDomain:'www.cncf.io',feedUrl:'https://www.cncf.io/blog/feed/',articlePathRegex:`/(blog|newsroom|reports)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'cncf',seeder_score:0.8})],
  [seeder({filename:'hashicorp',displayName:'🏰 HashiCorp',siteDomain:'www.hashicorp.com',feedUrl:'https://www.hashicorp.com/feed.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'hashicorp',seeder_score:0.75})],
  [seeder({filename:'kubernetes',displayName:'☸ Kubernetes',siteDomain:'kubernetes.io',feedUrl:'https://kubernetes.io/feed.xml',articlePathRegex:`/(blog|docs|case-studies)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'kubernetes',seeder_score:0.85})],
  [seeder({filename:'docker-blog',displayName:'🐳 Docker',siteDomain:'www.docker.com',feedUrl:'https://www.docker.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'docker',seeder_score:0.75})],
  [seeder({filename:'netflix-tech',displayName:'🎬 Netflix Tech Blog',siteDomain:'netflixtechblog.com',feedUrl:'https://netflixtechblog.com/feed',articlePathRegex:`/([a-z0-9-]+-){2,}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'netflix-tech',seeder_score:0.8})],
  [seeder({filename:'uber-eng',displayName:'🚗 Uber Engineering',siteDomain:'eng.uber.com',feedUrl:'https://eng.uber.com/feed/',articlePathRegex:`/([a-z0-9-]+-){2,}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'uber-eng',seeder_score:0.75})],
  [seeder({filename:'spotify-eng',displayName:'🎵 Spotify Engineering',siteDomain:'engineering.atspotify.com',feedUrl:'https://engineering.atspotify.com/feed/',articlePathRegex:`/\d{4}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'spotify-eng',seeder_score:0.75})],
  [seeder({filename:'cloudflare-blog',displayName:'☁ Cloudflare',siteDomain:'blog.cloudflare.com',feedUrl:'https://blog.cloudflare.com/rss/',articlePathRegex:`/([a-z0-9-]+-){2,}/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'cloudflare',seeder_score:0.8})],
  [seeder({filename:'aws-devops',displayName:'☁ AWS DevOps',siteDomain:'aws.amazon.com',feedUrl:'https://aws.amazon.com/blogs/devops/feed/',articlePathRegex:`/blogs/devops/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'aws-devops',seeder_score:0.8})],
  [seeder({filename:'google-cloud-blog',displayName:'☁ Google Cloud',siteDomain:'cloud.google.com',feedUrl:'https://cloud.google.com/blog/feeds/developers-practitioners.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'google-cloud',seeder_score:0.75})],
  [seeder({filename:'sre-weekly',displayName:'📰 SRE Weekly',siteDomain:'sreweekly.com',feedUrl:'https://sreweekly.com/feed/',articlePathRegex:`/issue/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'sre-weekly',seeder_score:0.65})],
  [seeder({filename:'nginx',displayName:'🌐 NGINX',siteDomain:'www.nginx.com',feedUrl:'https://www.nginx.com/blog/feed/',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'nginx',seeder_score:0.7})],
  [seeder({filename:'pulumi',displayName:'🏗 Pulumi',siteDomain:'www.pulumi.com',feedUrl:'https://www.pulumi.com/blog/rss.xml',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'pulumi',seeder_score:0.65})],
  [seeder({filename:'digitalocean',displayName:'🌊 DigitalOcean',siteDomain:'www.digitalocean.com',feedUrl:'https://www.digitalocean.com/blog/feed',articlePathRegex:`/(blog|community)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'digitalocean',seeder_score:0.65})],
  [seeder({filename:'infoq-devops',displayName:'📋 InfoQ DevOps',siteDomain:'www.infoq.com',feedUrl:'https://feed.infoq.com/devops/',articlePathRegex:`/(articles|news|presentations)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'infoq-devops',seeder_score:0.7})],
  [seeder({filename:'linuxfoundation',displayName:'🐧 Linux Foundation',siteDomain:'www.linuxfoundation.org',feedUrl:'https://www.linuxfoundation.org/feed/',articlePathRegex:`/(blog|press|resources)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'linuxfoundation',seeder_score:0.75})],
  [seeder({filename:'atlassian-eng',displayName:'🛠 Atlassian Engineering',siteDomain:'www.atlassian.com',feedUrl:'https://www.atlassian.com/engineering/feed',articlePathRegex:`/engineering/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'atlassian-eng',seeder_score:0.7})],
  [seeder({filename:'fastly',displayName:'⚡ Fastly',siteDomain:'www.fastly.com',feedUrl:'https://www.fastly.com/blog/feed',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'fastly',seeder_score:0.65})],
  [seeder({filename:'spacelift',displayName:'🚀 Spacelift',siteDomain:'spacelift.io',feedUrl:'https://spacelift.io/blog/feed',articlePathRegex:`/blog/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'spacelift',seeder_score:0.6})],
  [seeder({filename:'vmware-tanzu',displayName:'🖥 VMware Tanzu',siteDomain:'tanzu.vmware.com',feedUrl:'https://tanzu.vmware.com/content/feed',articlePathRegex:`/(blog|developer|content)/`,category:'CATEGORY.TECHNOLOGY',subcategory:'SUBCATEGORY.DEVOPS_INFRASTRUCTURE',source:'vmware-tanzu',seeder_score:0.65})],
];

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE FILES
// ═══════════════════════════════════════════════════════════════════════════════

const outDir = __dirname;
let count = 0;

for (const [content] of seeders) {
  if (!content) continue;
  const filenameMatch = content.match(/seed-(\S+?)\.mjs/);
  if (!filenameMatch) continue;
  const filename = filenameMatch[0];
  const filepath = resolve(outDir, filename);
  writeFileSync(filepath, content, 'utf8');
  count++;
}

console.log(`✅ Written ${count} seeder files to ${outDir}`);