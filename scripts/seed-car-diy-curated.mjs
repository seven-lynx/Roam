/**
 * seed-car-diy-curated.mjs — Curated car DIY & culture seeder
 *
 * Seeds a hand-picked list of the best car repair, DIY, modding, and car
 * culture resources on the web. Every URL is individually selected for
 * quality and relevance to car enthusiasts, DIYers, and gearheads.
 *
 * Sources included:
 *   - ChrisFix YouTube tutorials (legendary DIY repair videos)
 *   - Engineering Explained (car tech deep-dives)
 *   - Donut Media (car culture, builds, Up to Speed series)
 *   - Mighty Car Mods (Australian car modding)
 *   - Garage Journal forum builds
 *   - Lowrider Magazine culture pieces
 *   - Speedhunters (global car culture)
 *   - Car Throttle (project cars, DIY)
 *
 * Add new URLs to the ENTRIES array. Run with --no-cache to force re-upsert.
 *
 * Run from repo root:
 *   node scripts/seed-car-diy-curated.mjs
 *
 * Category: GAMES_HOBBIES → CRAFTS_DIY_MAKING + COLLECTING
 */

import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const G = CATEGORY.GAMES_HOBBIES;
const DIY = SUBCATEGORY.CRAFTS_DIY_MAKING;
const COLL = SUBCATEGORY.COLLECTING;
const SPORT = SUBCATEGORY.SPORTS_ATHLETICS;
const HW = SUBCATEGORY.HARDWARE_ELECTRONICS;

// ── Curated entries ──────────────────────────────────────────────────────────
const ENTRIES = [
  // ── ChrisFix — DIY repairs, most popular car repair channel ──────────────
  {
    url: 'https://www.youtube.com/watch?v=O1jLm0LIfI0',
    title: 'How to Fix a Car That Wont Start (ChrisFix)',
    description: 'Step-by-step diagnostic guide to figure out why your car won\'t start and how to fix it yourself. Battery, starter, alternator, and fuel system troubleshooting.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.youtube.com/watch?v=Bm93UopmFP0',
    title: 'How to Replace Brake Pads and Rotors (ChrisFix)',
    description: 'Complete DIY brake job tutorial: replace pads and rotors on any car. Save hundreds by doing it yourself with basic tools.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.youtube.com/watch?v=YrBArM0L86E',
    title: 'How to Do a Complete Engine Oil Change (ChrisFix)',
    description: 'Everything you need to know about changing your own oil: drain plug, filter, choosing the right oil, and proper disposal.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.youtube.com/watch?v=_35BBbV5m7c',
    title: 'How to Diagnose a Check Engine Light (ChrisFix)',
    description: 'Learn to use an OBD2 scanner, read diagnostic trouble codes, and figure out what your check engine light actually means.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Engineering Explained — car engineering deep-dives ───────────────────
  {
    url: 'https://www.youtube.com/watch?v=O8VDX2t7SUI',
    title: 'How a Car Engine Works (Engineering Explained)',
    description: 'Animated walkthrough of the four-stroke cycle, pistons, valves, and combustion — the fundamentals of internal combustion engines.',
    category_id: G, subcategory_id: HW,
  },
  {
    url: 'https://www.youtube.com/watch?v=OcqvEPmB7nY',
    title: 'How Turbochargers and Superchargers Work (Engineering Explained)',
    description: 'Visual explanation of forced induction: compressors, turbos, intercoolers, and why boost transforms engine performance.',
    category_id: G, subcategory_id: HW,
  },
  {
    url: 'https://www.youtube.com/watch?v=lp1vlNQP8Rg',
    title: 'How Manual Transmissions Work — Simply Explained',
    description: 'Animated breakdown of the clutch, gears, synchros, and shift forks inside a manual gearbox.',
    category_id: G, subcategory_id: HW,
  },

  // ── Donut Media — car culture, builds, Up to Speed ───────────────────────
  {
    url: 'https://www.youtube.com/watch?v=9CKKIsKQhlA',
    title: 'Everything You Need to Know About the Nissan GT-R (Up to Speed)',
    description: 'The complete history of Godzilla: from the Skyline lineage through the R32, R34, and the modern R35 GT-R supercar.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.youtube.com/watch?v=1oDMecp7LKU',
    title: 'Everything You Need to Know About the Toyota Supra (Up to Speed)',
    description: 'The story of the Mk4 Supra — the 2JZ engine, The Fast and the Furious, and why this car became an icon of car culture.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.youtube.com/playlist?list=PLFl907chpCa6PayRySKJ4kMRWsfOUOwdX',
    title: 'Donut Media — Money Pit (Miata Build Series)',
    description: 'Zach Jobe builds his dream Miata from the ground up: suspension, turbo, aero, and all the brutal realities of a project car.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.youtube.com/playlist?list=PLFl907chpCa5vC5sFXTVDLnV9cEX1P2vP',
    title: 'Donut Media — HiLow (Compare Cheap vs Expensive Parts)',
    description: 'Two identical cars, one built with cheap eBay parts and one with expensive name-brand parts. Which performs better?',
    category_id: G, subcategory_id: DIY,
  },

  // ── Mighty Car Mods — Australian DIY car modding legends ─────────────────
  {
    url: 'https://www.youtube.com/watch?v=UlJdX07j3dE',
    title: 'Building a Turbo MX-5 Miata in a Driveway (Mighty Car Mods)',
    description: 'Two guys build a turbocharged Miata using basic tools in a driveway — proof you don\'t need a shop to build a fast car.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.youtube.com/watch?v=bX3jjFwPUig',
    title: 'How to Buy a Used Car and Not Get Scammed (Mighty Car Mods)',
    description: 'Practical advice on inspecting a used car before you buy: what to look for, what to listen for, and what to walk away from.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Garage Journal — tool reviews, garage builds, restoration projects ───
  {
    url: 'https://www.garagejournal.com/forum/forums/garage-gallery.7/',
    title: 'Garage Journal — Garage Gallery (Build Threads)',
    description: 'Hundreds of detailed garage build threads: floor plans, epoxy flooring, lifts, lighting, workbenches — everything for the perfect workshop.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.garagejournal.com/forum/forums/fabrication-and-techniques.45/',
    title: 'Garage Journal — Fabrication & Techniques',
    description: 'Welding, metalworking, custom fabrication, and restoration techniques shared by a community of experienced DIYers and professionals.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.garagejournal.com/forum/forums/tool-discussion.14/',
    title: 'Garage Journal — Tool Discussion',
    description: 'In-depth discussions on hand tools, power tools, tool storage, and what gear is actually worth the money for home mechanics.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Lowrider Magazine — car customization, culture, builder profiles ─────
  {
    url: 'https://www.lowrider.com/features/car-features/',
    title: 'Lowrider Magazine — Car Features',
    description: 'Profiles of the most stunning lowrider builds: custom paint, hydraulics, engraving, and the artistry of Chicano car culture.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.lowrider.com/technical/',
    title: 'Lowrider Magazine — Technical Articles',
    description: 'DIY guides for hydraulic installations, air ride suspension, paint and bodywork, and custom interior fabrication.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Speedhunters — global car culture photography and stories ────────────
  {
    url: 'https://www.speedhunters.com/category/car-features/',
    title: 'Speedhunters — Car Features',
    description: 'The world\'s best automotive photography paired with deep stories about car builders, tuners, and car culture from every continent.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.speedhunters.com/category/car-builds/',
    title: 'Speedhunters — Car Builds',
    description: 'In-depth build breakdowns: engine swaps, widebody kits, suspension tuning, and the stories behind the world\'s most extreme modified cars.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.speedhunters.com/category/events/',
    title: 'Speedhunters — Event Coverage',
    description: 'Coverage of car meets, race events, drift competitions, and automotive gatherings from Tokyo to SEMA to Goodwood.',
    category_id: G, subcategory_id: COLL,
  },

  // ── Car Throttle — project cars, challenges, DIY ─────────────────────────
  {
    url: 'https://www.carthrottle.com/news/diy',
    title: 'Car Throttle — DIY Car Projects',
    description: 'Relatable car projects done on a real budget: buying cheap cars, fixing them up, and the comedy of roadside wrenching.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Classic car restoration & preservation guides ────────────────────────
  {
    url: 'https://www.hemmings.com/stories/restoration/',
    title: 'Hemmings — Restoration Stories',
    description: 'Deep dives into classic car restorations: barn finds brought back to life, concours-quality restorations, and preservation philosophy.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.hagerty.com/media/maintenance-and-tech/',
    title: 'Hagerty — Maintenance & Tech Articles',
    description: 'Technical articles on classic car maintenance, storage, rust repair, and keeping vintage cars on the road.',
    category_id: G, subcategory_id: DIY,
  },

  // ── The Drive — car tech explainers ──────────────────────────────────────
  {
    url: 'https://www.thedrive.com/category/guides-and-gear',
    title: 'The Drive — Guides & Gear',
    description: 'Car tech deep-dives, how-to guides, tool recommendations, and automotive engineering explainers.',
    category_id: G, subcategory_id: DIY,
  },
  {
    url: 'https://www.thedrive.com/category/maintenance',
    title: 'The Drive — Maintenance Guides',
    description: 'DIY maintenance walkthroughs: oil changes, fluid flushes, tire rotations, belt replacements, and seasonal prep.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Iconic car culture documentaries & articles ──────────────────────────
  {
    url: 'https://www.youtube.com/watch?v=7JkxPGF3XqI',
    title: 'Apex: The Story of the Hypercar (Documentary)',
    description: 'Documentary exploring the birth and evolution of the hypercar: Bugatti, Koenigsegg, Pagani, and the engineering arms race to 300 mph.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.youtube.com/watch?v=Luw68t8Uf_k',
    title: 'How the Ford GT40 Beat Ferrari at Le Mans',
    description: 'The story of Ford vs Ferrari — how an American car company built a car to beat the unbeatable Italians at the 24 Hours of Le Mans.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.youtube.com/playlist?list=PLj1mBvF4MbuF3CUN9ejMsBeBHkci3Dp9e',
    title: 'Hoonigan — Build Biology (Car Build Walkthroughs)',
    description: 'Detailed walkthroughs of wild custom builds: drift cars, drag cars, rallycross machines, and one-off engineering marvels.',
    category_id: G, subcategory_id: DIY,
  },

  // ── Formula 1 & motorsport engineering ───────────────────────────────────
  {
    url: 'https://www.youtube.com/watch?v=VbW4o3C0EhA',
    title: 'How a Formula 1 Car Works — Every System Explained',
    description: 'Comprehensive tour of an F1 car: power unit recovery, DRS, suspension kinematics, aero philosophy, and the steering wheel\'s 25+ controls.',
    category_id: G, subcategory_id: HW,
  },
  {
    url: 'https://www.youtube.com/watch?v=QTZ8nG0P78o',
    title: 'How Differential Steering Works (1937) — Engineering Classic',
    description: 'The single best explanation of how a differential works, originally produced by Chevrolet in 1937. Still the gold standard.',
    category_id: G, subcategory_id: HW,
  },
  {
    url: 'https://www.youtube.com/watch?v=hNsI4LdM16k',
    title: 'How Car Suspensions Work — Springs, Dampers, and Roll Bars',
    description: 'Visual breakdown of MacPherson struts, double wishbones, multi-link, and leaf spring suspensions. Why handling matters.',
    category_id: G, subcategory_id: HW,
  },

  // ── Hot Rod Magazine — American hot rodding & custom car culture ─────────
  {
    url: 'https://www.motortrend.com/hotrod/',
    title: 'Hot Rod Magazine — American Hot Rodding & Custom Cars',
    description: 'The definitive source for American hot rodding: engine swaps, drag racing builds, custom fabrication, and the culture of speed.',
    category_id: G, subcategory_id: COLL,
  },
  {
    url: 'https://www.motortrend.com/how-to/',
    title: 'MotorTrend — How-To Articles (All Makes & Models)',
    description: 'Comprehensive DIY guides covering engine building, bodywork, suspension, brakes, and electrical systems for all types of vehicles.',
    category_id: G, subcategory_id: DIY,
  },
];

// ─── Deduplicate by URL ──────────────────────────────────────────────────────
const seen = new Set();
const dedupedEntries = ENTRIES.filter(e => {
  if (seen.has(e.url)) return false;
  seen.add(e.url);
  return true;
});

const totalUnique = dedupedEntries.length;
if (totalUnique !== ENTRIES.length) {
  console.log(`[car-diy-curated] Deduped: ${totalUnique} unique (removed ${ENTRIES.length - totalUnique} duplicates)`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────
console.log(`[car-diy-curated] Upserting ${totalUnique} curated car DIY/culture URLs...`);

const result = await upsertUrls(dedupedEntries.map(e => ({
  url:             e.url,
  title:           e.title,
  description:     e.description,
  category_id:     e.category_id,
  subcategory_id:  e.subcategory_id,
  source:          'car-diy-curated',
  seeder_score:    0.8,
})), { checkLive: true, fetchOg: false, verbose: true });

console.log(`[car-diy-curated] Done. Inserted: ${result.inserted}, Skipped: ${result.skipped}`);