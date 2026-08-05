/**
 * seed-webgames.mjs — Curated browser experiences seeder
 *
 * Seeds a hand-picked list of browser-based interactive experiences: games,
 * creative sandboxes, simulations, generative art, and web experiments.
 * Everything here is playable or interactive instantly in the browser.
 *
 * Sources included:
 *   - Neal.fun — interactive essays and experiments by Neal Agarwal
 *   - Google Arts & Experiments — creative coding experiments
 *   - Chrome Experiments (via experiments.withgoogle.com)
 *   - Patatap / Incredibox / other audio-visual playgrounds
 *   - Misc curated browser classics
 *
 * Add new URLs to the ENTRIES array. Run with --no-cache to force re-upsert.
 *
 * Run from repo root:
 *   node scripts/seed-webgames.mjs
 */

import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const B = SUBCATEGORY.BROWSER_INTERACTIVE;
const G = CATEGORY.GAMES_HOBBIES;
const W = CATEGORY.WEIRD_WONDERFUL;
const T = CATEGORY.TECHNOLOGY;

// ── Curated entries ──────────────────────────────────────────────────────────
// Format: { url, title, description, category_id, subcategory_id }
const ENTRIES = [

  // ── Neal.fun ────────────────────────────────────────────────────────────────
  {
    url: 'https://neal.fun/size-of-space/',
    title: 'Size of Space',
    description: 'An interactive scale model of the solar system and beyond, from the smallest particles to the observable universe.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/deep-sea/',
    title: 'The Deep Sea',
    description: 'Scroll down into the ocean and discover the creatures that live at every depth, from sunlit shallows to the hadal zone.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/internet-in-real-time/',
    title: 'Internet in Real Time',
    description: 'Watch data pulse across the internet in real time — tweets, emails, searches, and more ticking up every second.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/spend/',
    title: 'Spend Bill Gates\' Money',
    description: 'A simple, addictive game: spend $100 billion as fast as you can by buying everyday items and luxury goods.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/password-game/',
    title: 'The Password Game',
    description: 'A devilishly escalating game where every rule you follow to create a valid password spawns three more absurd rules.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/infinite-craft/',
    title: 'Infinite Craft',
    description: 'Combine elements to craft anything imaginable. Start with fire, water, wind, and earth — where you end up is up to you.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/universe-forecast/',
    title: 'Universe Forecast',
    description: 'A lighthearted forecast for the next several billion years of the universe, presented as a weather report.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/planet-sizes/',
    title: 'Planet Sizes',
    description: 'Drag and compare the sizes of planets in our solar system side by side.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/aggregated-intelligence/',
    title: 'Aggregated Intelligence',
    description: 'Watch thousands of AI-generated answers to the same question and see what they collectively believe.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/life-stats/',
    title: 'Life Stats',
    description: 'Enter your birthday and see mind-bending statistics about your life: heartbeats, breaths taken, distance traveled around the sun.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/prime-clocks/',
    title: 'Prime Clocks',
    description: 'Clocks that only tick on prime numbers — a mesmerizing visual meditation on primes.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/absurd-trolley-problems/',
    title: 'Absurd Trolley Problems',
    description: 'Increasingly ridiculous moral dilemmas that push the trolley problem to its logical (and illogical) extremes.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/drawing-with-boids/',
    title: 'Drawing with Boids',
    description: 'Flocking simulation where the collective motion of birds traces your drawings on a canvas.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://neal.fun/the-auction/',
    title: 'The Auction',
    description: 'You have $100. Bid against the internet for random prize packages and see if you overpay.',
    category_id: G, subcategory_id: B,
  },

  // ── Google / Experiments with Google ────────────────────────────────────────
  {
    url: 'https://experiments.withgoogle.com/ai/giorgio-cam',
    title: 'Giorgio Cam',
    description: 'Point your camera at something and Giorgio will rap about it. A playful AI music experiment.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://experiments.withgoogle.com/ai/bird-sounds',
    title: 'Bird Sounds',
    description: 'Explore and visualize thousands of bird sounds using machine learning and an interactive map.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://experiments.withgoogle.com/ai/drum-machine',
    title: 'AI Duet',
    description: 'Play a few notes and have an AI respond, creating a spontaneous piano duet in real time.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://musiclab.chromeexperiments.com/Song-Maker/',
    title: 'Chrome Music Lab — Song Maker',
    description: 'A simple, visual music sequencer in the browser. Make a song in seconds, no experience needed.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://musiclab.chromeexperiments.com/Spectrogram/',
    title: 'Chrome Music Lab — Spectrogram',
    description: 'See a real-time visual representation of sound frequencies as you hum, sing, or play music.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://artsandculture.google.com/experiment/bloom',
    title: 'Bloom — Google Arts & Culture',
    description: 'A generative art experiment where petals bloom from your cursor, creating infinite floral patterns.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://quickdraw.withgoogle.com/',
    title: 'Quick, Draw!',
    description: 'Can a neural network recognize your doodles? Draw something in 20 seconds and find out.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://teachablemachine.withgoogle.com/',
    title: 'Teachable Machine',
    description: 'Train a machine learning model in your browser using images, sounds, or poses from your webcam.',
    category_id: T, subcategory_id: SUBCATEGORY.AI_MACHINE_LEARNING,
  },

  // ── Audio / Music playgrounds ────────────────────────────────────────────────
  {
    url: 'https://www.incredibox.com/',
    title: 'Incredibox',
    description: 'Drag and drop sound icons onto animated beatboxers to create your own layered musical mix.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://patatap.com/',
    title: 'Patatap',
    description: 'Press any key to trigger abstract animations and sounds — a kinetic audio-visual toy by Jonobr1.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.beepbox.co/',
    title: 'BeepBox',
    description: 'A browser chiptune sequencer for composing retro-sounding music directly in the browser, no install.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://asoftmurmur.com/',
    title: 'A Soft Murmur',
    description: 'Mix ambient sounds — rain, thunder, waves, fire — to create your own calming background noise.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://typedrummer.com/',
    title: 'TypeDrummer',
    description: 'Type any text and it becomes a beat. Each letter triggers a different drum sound.',
    category_id: G, subcategory_id: B,
  },

  // ── Classic browser experiments and simulations ──────────────────────────────
  {
    url: 'https://www.fallingfalling.com/',
    title: 'Falling Falling',
    description: 'An endless, hypnotic descent through geometric shapes. A classic internet art piece.',
    category_id: W, subcategory_id: SUBCATEGORY.ODDITIES_CURIOSITIES,
  },
  {
    url: 'https://labs.nearpod.com/bodyparts3d/',
    title: 'BioDigital Human',
    description: 'Explore an interactive 3D model of the human body, navigating organs, muscles, and systems.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.windows93.net/',
    title: 'Windows 93',
    description: 'A fake operating system running in the browser — full of easter eggs, surreal apps, and retro nostalgia.',
    category_id: W, subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
  },
  {
    url: 'https://hextris.io/',
    title: 'Hextris',
    description: 'Tetris meets hexagons — a fast-paced, colorful browser game where blocks fall toward a spinning hexagon.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.sketchpad.net/',
    title: 'Sketchpad',
    description: 'A free, feature-rich online drawing and painting app — works entirely in the browser.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.autodraw.com/',
    title: 'AutoDraw',
    description: 'Draw something rough and Google\'s AI guesses what you meant, offering clean vector alternatives instantly.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://monstercat.github.io/connect/',
    title: 'Monstercat Visualizer',
    description: 'A real-time audio visualizer synced to Monstercat music — geometry dancing to the beat.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://pixelator.co/',
    title: 'Pixelator',
    description: 'Upload an image and convert it to pixel art in your browser, with adjustable resolution and palette.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://thisissand.com/',
    title: 'This is Sand',
    description: 'Pour and layer colored sand to create geological cross-sections and abstract patterns.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.geoguessr.com/',
    title: 'GeoGuessr',
    description: 'You are dropped somewhere on Earth in Street View. Guess where you are based only on your surroundings.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://sandspiel.club/',
    title: 'Sandspiel',
    description: 'A falling sand browser game with elements like water, fire, plant, and fungus. Build and watch it evolve.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://jsfiddle.net/user/patatap/fiddles/',
    title: 'Patatap Fiddler',
    description: 'Variants and remixes of the Patatap audio-visual toy built in the browser.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.staggeringbeauty.com/',
    title: 'Staggering Beauty',
    description: 'Shake your mouse to trigger a seizure-warning psychedelic light show from a wiggly worm.',
    category_id: W, subcategory_id: SUBCATEGORY.ABSURDIST_HUMOUR,
  },
  {
    url: 'https://zoomquilt.org/',
    title: 'Zoomquilt',
    description: 'An infinite zooming collaborative painting — an endless hypnotic descent through surreal illustrated worlds.',
    category_id: W, subcategory_id: SUBCATEGORY.ODDITIES_CURIOSITIES,
  },
  {
    url: 'https://zoomquilt2.com/',
    title: 'Zoomquilt 2',
    description: 'The sequel to the original Zoomquilt — another infinite collaborative zoom through detailed illustrated landscapes.',
    category_id: W, subcategory_id: SUBCATEGORY.ODDITIES_CURIOSITIES,
  },
  {
    url: 'https://webglsamples.org/aquarium/aquarium.html',
    title: 'WebGL Aquarium',
    description: 'A real-time 3D fish tank rendered in WebGL — watch thousands of fish swim in your browser.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.findtheinvisiblecow.com/',
    title: 'Find the Invisible Cow',
    description: 'Move your mouse to find the invisible cow. The closer you get, the louder the shouting.',
    category_id: W, subcategory_id: SUBCATEGORY.ABSURDIST_HUMOUR,
  },
  {
    url: 'https://hakim.se/experiments',
    title: 'Hakim El Hattab Experiments',
    description: 'A collection of creative coding experiments in CSS and JavaScript by the developer behind Reveal.js.',
    category_id: T, subcategory_id: SUBCATEGORY.DESIGN_UX,
  },
  {
    url: 'https://www.mrdoob.com/',
    title: 'Mr.doob Experiments',
    description: 'Three.js creator Ricardo Cabello\'s interactive experiments — particle systems, cloth simulation, and more.',
    category_id: T, subcategory_id: SUBCATEGORY.DESIGN_UX,
  },
  {
    url: 'https://paveldogreat.github.io/WebGL-Fluid-Simulation/',
    title: 'WebGL Fluid Simulation',
    description: 'Swirl colorful fluid with your mouse. A mesmerizing, real-time fluid dynamics simulation in WebGL.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.noclip.website/',
    title: 'noclip',
    description: 'Explore the level geometry of classic video games rendered in your browser — fly through empty N64 worlds.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.mrspeaker.net/dev/fractal/',
    title: 'JavaScript Fractal Explorer',
    description: 'Zoom into the Mandelbrot set entirely in your browser. Real-time, high-resolution fractal exploration.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://humanbenchmark.com/',
    title: 'Human Benchmark',
    description: 'Test your reaction time, memory, typing speed, and other cognitive benchmarks. See how you compare.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.gameoflife.co.uk/',
    title: "Conway's Game of Life",
    description: 'An interactive version of John Conway\'s cellular automaton. Draw patterns and watch them evolve.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.twitch.tv/directory/game/Science%20%26%20Technology',
    title: 'Pointer Pointer',
    description: 'Move your cursor anywhere and a photograph of a person pointing directly at it appears.',
    category_id: W, subcategory_id: SUBCATEGORY.ABSURDIST_HUMOUR,
  },
  {
    url: 'https://pointerpointer.com/',
    title: 'Pointer Pointer',
    description: 'Move your cursor anywhere and a photograph of a person pointing directly at it appears.',
    category_id: W, subcategory_id: SUBCATEGORY.ABSURDIST_HUMOUR,
  },
  {
    url: 'https://www.effectgames.com/demos/canvascycle/',
    title: 'Canvas Cycle',
    description: '8-bit painted scenes brought to life with palette cycling — living pixel art landscapes.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://100000stars.withgoogle.com/',
    title: '100,000 Stars',
    description: 'An interactive 3D visualization of the 100,000 stars nearest to our sun, built with WebGL.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://stars.chromeexperiments.com/',
    title: '100,000 Stars (Chrome Experiments)',
    description: 'Interactive 3D map of stellar neighbors — zoom from our sun outward through the galactic neighborhood.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.planetarium.com/',
    title: 'Stellarium Web',
    description: 'A full-featured online planetarium — explore the night sky from anywhere on Earth, at any time.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://stellarium-web.org/',
    title: 'Stellarium Web',
    description: 'A full-featured online planetarium. Explore the night sky from anywhere on Earth, at any time.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.websequencediagrams.com/',
    title: 'Web Sequence Diagrams',
    description: 'Type text, get a sequence diagram instantly. Simple, fast browser tool for software design sketches.',
    category_id: T, subcategory_id: SUBCATEGORY.PROGRAMMING_SOFTWARE,
  },
  {
    url: 'https://codepen.io/spark/',
    title: 'CodePen Spark',
    description: 'A curated collection of the most creative and visually stunning browser experiments on CodePen.',
    category_id: T, subcategory_id: SUBCATEGORY.DESIGN_UX,
  },
  {
    url: 'https://tholman.com/elevator.js/',
    title: 'Elevator.js',
    description: 'A browser experiment that scrolls you back to the top of the page with elevator music and floor announcements.',
    category_id: W, subcategory_id: SUBCATEGORY.ABSURDIST_HUMOUR,
  },
  {
    url: 'https://histography.io/',
    title: 'Histography',
    description: 'An interactive timeline of human history — 14 billion years of events mapped and explorable.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://webaim.org/resources/contrastchecker/',
    title: 'Accessible Color Palette Builder',
    description: 'Interactive tool for checking color contrast ratios and building accessible palettes.',
    category_id: T, subcategory_id: SUBCATEGORY.DESIGN_UX,
  },
  {
    url: 'https://jezzamon.com/fourier/index.html',
    title: 'An Interactive Introduction to Fourier Transforms',
    description: 'Draw anything with spinning circles. Understand Fourier transforms through beautiful, interactive animation.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.chipdisco.com/',
    title: 'Chip Disco',
    description: 'An interactive chiptune music experience. Press keys to trigger different synth sounds and rhythms.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.drawastickman.com/',
    title: 'Draw a Stickman',
    description: 'Draw a stickman and watch it come to life in an interactive adventure across different worlds.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.rainymood.com/',
    title: 'Rainy Mood',
    description: 'Rain sounds and thunderstorms looped in the browser. Simple, effective, beloved by millions.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://hearthis.at/ambient',
    title: 'Ambient Noise',
    description: 'Stream ambient and atmospheric music to block out distractions and improve focus.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.yarnit.com/',
    title: 'Make Me a Story',
    description: 'Interactive collaborative storytelling in the browser — you and an AI weave a narrative together.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://window-swap.com/',
    title: 'WindowSwap',
    description: 'Open a window anywhere in the world and watch what someone else sees from their home — live or recorded.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://www.electricboogaloo.net/',
    title: 'Electric Boogaloo',
    description: 'Click-driven generative art — each interaction spawns flowing electric arcs and neon patterns.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://isthissnappy.com/',
    title: 'Is This Snappy?',
    description: 'A reaction time test disguised as a question. Click as fast as you can after the signal.',
    category_id: G, subcategory_id: B,
  },
  {
    url: 'https://n.agarwala.net/',
    title: 'Nik Agarwala\'s Experiments',
    description: 'A collection of browser-based experiments: physics simulations, animations, and interactive toys.',
    category_id: G, subcategory_id: B,
  },
];

// ─── Deduplicate by URL ──────────────────────────────────────────────────────
const seen = new Set();
const dedupedEntries = ENTRIES.filter(e => {
  if (seen.has(e.url)) return false;
  seen.add(e.url);
  return true;
});

// ─── Run ─────────────────────────────────────────────────────────────────────
console.log(`[webgames] Upserting ${dedupedEntries.length} curated browser experiences...`);

await upsertUrls(dedupedEntries.map(e => ({
  url:            e.url,
  title:          e.title,
  description:    e.description,
  category_id:    e.category_id,
  subcategory_id: e.subcategory_id,
  source:         'webgames',
})), { checkLive: false, fetchOg: false, verbose: true });

console.log('[webgames] Done.');
