/**
 * extract-stumbleupon-awesome.mjs — Extracts URLs from StumbleUponAwesome curated lists
 *
 * Reads the pre-scraped URL files from StumbleUponAwesome/extension/data/urls/awesome/
 * Each file is CSV: url,title,source_repo,category
 * Maps awesome-list categories to Roam categories using UUID constants from seed.js.
 *
 * Usage: node scripts/extract-stumbleupon-awesome.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const AWESOME_URLS_DIR = resolve(CACHE_DIR, "stumbleupon-awesome", "extension", "data", "urls", "awesome");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-awesome.json");

// ── Awesome-list category → Roam subcategory UUID ──────────────────────────
// Maps all known awesome-list topic names to specific SUBCATEGORY UUIDs.
// Unmapped categories fall through to fuzzy keyword matching, then WEIRD_WONDERFUL default.
const CATEGORY_MAP = {
  // ── TECHNOLOGY > PROGRAMMING_SOFTWARE ──
  "Node.js": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Frontend Development": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "iOS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Android": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Electron": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "React Native": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Xamarin": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Flutter": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  ".NET": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Deno": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Cross-Platform": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Programming": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Python": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Rust": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Go": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "JavaScript": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "TypeScript": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "React": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Vue.js": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Angular": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Svelte": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Java": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Kotlin": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Swift": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Ruby": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "PHP": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "C++": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "C#": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Scala": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Elixir": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Haskell": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Clojure": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Lua": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Shell": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Blazor": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Ember": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Perl": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "C": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "R": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Common Lisp": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Laravel": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Rails": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Play1 Framework": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Craft CMS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "AutoIt": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "CircuitPython": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Apps": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Software Engineering Blogs": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Tools of the Trade": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Static Analysis & Code Quality": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Web Components": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Offline-First": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "No-Login Web Apps": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Free for Developers": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Billing": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Competitive Programming": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Web Development": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Framework": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Algorithms": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Git": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Refactoring": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Code Review": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "API": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "SDK": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Jamstack": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Serverless": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Free Programming Books": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "GraphQL": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "CSS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "HTML": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Tailwind CSS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Bootstrap": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "jQuery": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Django": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Flask": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "FastAPI": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Spring Boot": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "NPM": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Yarn": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Webpack": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Vite": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "ESLint": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Prettier": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Testing": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "JMeter": SUBCATEGORY.PROGRAMMING_SOFTWARE,

  // ── TECHNOLOGY > AI_MACHINE_LEARNING ──
  "Machine Learning": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Deep Learning": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Artificial Intelligence": SUBCATEGORY.AI_MACHINE_LEARNING,
  "AI in Finance": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Computer Vision": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Deep Vision": SUBCATEGORY.AI_MACHINE_LEARNING,
  "NLP": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Natural Language Processing": SUBCATEGORY.AI_MACHINE_LEARNING,
  "Data Science": SUBCATEGORY.AI_MACHINE_LEARNING,
  "TensorFlow": SUBCATEGORY.AI_MACHINE_LEARNING,
  "PyTorch": SUBCATEGORY.AI_MACHINE_LEARNING,

  // ── TECHNOLOGY > DATABASES_DATA_ENGINEERING ──
  "Big Data": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "Public Datasets": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "Database": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "SQL": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "NoSQL": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "PostgreSQL": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "MySQL": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "MongoDB": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "Redis": SUBCATEGORY.DATABASES_DATA_ENGINEERING,
  "Data Engineering": SUBCATEGORY.DATABASES_DATA_ENGINEERING,

  // ── TECHNOLOGY > DEVOPS_INFRASTRUCTURE ──
  "Self Hosted": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Site Reliability Engineering": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Microservices": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Integration": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "DevOps": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Docker": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Kubernetes": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Containers": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "CI/CD": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Terraform": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Monitoring": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Observability": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Cloud Computing": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Amazon Web Services": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Google Cloud": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Azure": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Cloudflare": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Heroku": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "DigitalOcean": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "IBM Cloud": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Firebase": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "NGINX": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Apache": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Linux": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "Arch-based Projects": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  "AppImage": SUBCATEGORY.DEVOPS_INFRASTRUCTURE,

  // ── TECHNOLOGY > CYBERSECURITY_PRIVACY ──
  "Web Security": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Security": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Hacking": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Hacking Spots": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Malware Analysis": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Cybersecurity": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Penetration Testing": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "CTF": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "IAM": SUBCATEGORY.CYBERSECURITY_PRIVACY,
  "Privacy": SUBCATEGORY.CYBERSECURITY_PRIVACY,

  // ── TECHNOLOGY > HARDWARE_ELECTRONICS ──
  "Raspberry Pi": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "Hardware": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "Electronics": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "Arduino": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "ESP": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "IoT & Hybrid Apps": SUBCATEGORY.ROBOTICS_AUTOMATION,
  "Robot Operating System 2.0": SUBCATEGORY.ROBOTICS_AUTOMATION,
  "Home Assistant": SUBCATEGORY.HARDWARE_ELECTRONICS,

  // ── TECHNOLOGY > INTERNET_CULTURE ──
  "Unicode": SUBCATEGORY.INTERNET_CULTURE,
  "Email Newsletters": SUBCATEGORY.INTERNET_CULTURE,
  "Internet": SUBCATEGORY.INTERNET_CULTURE,
  "Social Media": SUBCATEGORY.INTERNET_CULTURE,
  "Mastodon": SUBCATEGORY.INTERNET_CULTURE,
  "Discord Communities": SUBCATEGORY.SUBCULTURES_COMMUNITIES,
  "YouTubers": SUBCATEGORY.INTERNET_CULTURE,

  // ── TECHNOLOGY > OPEN_SOURCE ──
  "Open Source": SUBCATEGORY.OPEN_SOURCE,
  "Open Source Apps": SUBCATEGORY.OPEN_SOURCE,

  // ── TECHNOLOGY > EMERGING_TECHNOLOGY ──
  "Blockchain": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "Cryptocurrency": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "Web3": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "Decentralized": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "IPFS": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "Quantum Computing": SUBCATEGORY.EMERGING_TECHNOLOGY,
  "eBPF": SUBCATEGORY.EMERGING_TECHNOLOGY,

  // ── TECHNOLOGY > DESIGN_UX ──
  "Design": SUBCATEGORY.DESIGN_UX,
  "UI": SUBCATEGORY.DESIGN_UX,
  "UX": SUBCATEGORY.DESIGN_UX,
  "Figma": SUBCATEGORY.DESIGN_UX,
  "Accessibility": SUBCATEGORY.DESIGN_UX,
  "Typography": SUBCATEGORY.DESIGN_UX,

  // ── TECHNOLOGY unclassified → PROGRAMMING_SOFTWARE ──
  "Visual Studio Code": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "macOS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Windows": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Screensavers": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Fuse": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Qt": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "WebExtensions": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Rubymotion": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Smart TV": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "GNOME": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "KDE": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Roslyn": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Amazon Alexa": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Actions on Google": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Adafruit IO": SUBCATEGORY.HARDWARE_ELECTRONICS,
  "DOS": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Salesforce": SUBCATEGORY.PROGRAMMING_SOFTWARE,
  "Alfred Workflows": SUBCATEGORY.PROGRAMMING_SOFTWARE,

  // ── SCIENCE ──
  "Science": CATEGORY.SCIENCE,
  "Computational Neuroscience": SUBCATEGORY.NEUROSCIENCE_COGNITION,
  "Bioinformatics": SUBCATEGORY.BIOLOGY_EVOLUTION,
  "Biology": SUBCATEGORY.BIOLOGY_EVOLUTION,
  "Chemistry": SUBCATEGORY.PHYSICS_CHEMISTRY,
  "Physics": SUBCATEGORY.PHYSICS_CHEMISTRY,
  "Astronomy": SUBCATEGORY.SPACE_ASTRONOMY,
  "Space": SUBCATEGORY.SPACE_ASTRONOMY,
  "Math": SUBCATEGORY.MATHEMATICS_LOGIC,
  "Mathematics": SUBCATEGORY.MATHEMATICS_LOGIC,
  "Earth": SUBCATEGORY.GEOLOGY_EARTH_SCIENCE,
  "Earth Science": SUBCATEGORY.GEOLOGY_EARTH_SCIENCE,
  "Climate": SUBCATEGORY.CLIMATE_ATMOSPHERIC_SCIENCE,
  "Environment": SUBCATEGORY.ENVIRONMENT_CLIMATE,
  "Paleontology": SUBCATEGORY.PALEONTOLOGY_NATURAL_HISTORY,
  "Oceanography": SUBCATEGORY.OCEANOGRAPHY_MARINE_LIFE,
  "Astrobiology": SUBCATEGORY.ASTROBIOLOGY_EXOPLANETS,
  "Botany": SUBCATEGORY.BOTANY_PLANT_SCIENCE,
  "Neuroscience": SUBCATEGORY.NEUROSCIENCE_COGNITION,
  "Medicine": SUBCATEGORY.MEDICINE_HEALTH_SCIENCE,
  "Network Analysis": SUBCATEGORY.MATHEMATICS_LOGIC,
  "Research Tools": CATEGORY.SCIENCE,
  "Public Datasets": SUBCATEGORY.DATABASES_DATA_ENGINEERING,

  // ── ARTS_CULTURE ──
  "Science Fiction": SUBCATEGORY.SCIFI_FANTASY,
  "Fantasy": SUBCATEGORY.SCIFI_FANTASY,
  "Creative Coding": SUBCATEGORY.VISUAL_ART,
  "Music": SUBCATEGORY.MUSIC,
  "Film": SUBCATEGORY.FILM_TELEVISION,
  "Photography": SUBCATEGORY.PHOTOGRAPHY,
  "Architecture": SUBCATEGORY.ARCHITECTURE_URBAN,
  "Literature": SUBCATEGORY.LITERATURE_WRITING,
  "Writing": SUBCATEGORY.LITERATURE_WRITING,
  "Comics": SUBCATEGORY.COMICS_ILLUSTRATION,
  "Animation": SUBCATEGORY.ANIME_MANGA,
  "Anime": SUBCATEGORY.ANIME_MANGA,
  "Art": CATEGORY.ARTS_CULTURE,
  "Fashion": SUBCATEGORY.FASHION_TEXTILES,
  "Architecture": SUBCATEGORY.ARCHITECTURE_URBAN,
  "Theatre": SUBCATEGORY.THEATRE_PERFORMANCE,
  "Podcasts": SUBCATEGORY.MUSIC,
  "Stock Resources": SUBCATEGORY.PHOTOGRAPHY,
  "Books": SUBCATEGORY.LITERATURE_WRITING,

  // ── HISTORY_IDEAS ──
  "History": SUBCATEGORY.MODERN_HISTORY,
  "Ancient History": SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY,
  "Philosophy": SUBCATEGORY.PHILOSOPHY_ETHICS,
  "Politics": SUBCATEGORY.POLITICS_GEOPOLITICS,
  "Economics": SUBCATEGORY.ECONOMICS_HISTORY,
  "Religion": SUBCATEGORY.RELIGION_MYTHOLOGY,
  "Mythology": SUBCATEGORY.RELIGION_MYTHOLOGY,
  "Anthropology": SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY,
  "Archaeology": SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY,
  "Military History": SUBCATEGORY.MILITARY_HISTORY,
  "Legal": SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  "Law": SUBCATEGORY.LEGAL_HISTORY_CONSTITUTIONAL,
  "Social History": SUBCATEGORY.SOCIAL_HISTORY,
  "Exploration": SUBCATEGORY.EXPLORATION_DISCOVERY,
  "Discovery": SUBCATEGORY.EXPLORATION_DISCOVERY,
  "Cultural History": SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  "History of Science": SUBCATEGORY.HISTORY_SCIENCE_TECHNOLOGY,

  // ── GAMES_HOBBIES ──
  "Game Development": SUBCATEGORY.VIDEO_GAMES,
  "Gaming": SUBCATEGORY.VIDEO_GAMES,
  "Video Games": SUBCATEGORY.VIDEO_GAMES,
  "Board Games": SUBCATEGORY.BOARD_GAMES_TABLETOP,
  "Tabletop": SUBCATEGORY.BOARD_GAMES_TABLETOP,
  "Sports": SUBCATEGORY.SPORTS_ATHLETICS,
  "Cooking": SUBCATEGORY.COOKING_FOOD,
  "Food": SUBCATEGORY.COOKING_FOOD,
  "Crafts": SUBCATEGORY.CRAFTS_DIY_MAKING,
  "DIY": SUBCATEGORY.CRAFTS_DIY_MAKING,
  "Gardening": SUBCATEGORY.GARDENING_HORTICULTURE,
  "Pets": SUBCATEGORY.PETS,
  "Fishing": SUBCATEGORY.FISHING,
  "Outdoors": SUBCATEGORY.OUTDOOR_ADVENTURE,
  "Cars": SUBCATEGORY.CARS_AUTOMOTIVE,
  "Automotive": SUBCATEGORY.CARS_AUTOMOTIVE,
  "Puzzles": SUBCATEGORY.PUZZLES_BRAIN_TEASERS,
  "Collecting": SUBCATEGORY.COLLECTING,
  "Browser Games": SUBCATEGORY.BROWSER_INTERACTIVE,

  // ── MIND_BODY ──
  "Mind Expanding Books": SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR,
  "Humane Technology": SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR,
  "Health": SUBCATEGORY.NUTRITION_HEALTH,
  "Fitness": SUBCATEGORY.FITNESS_MOVEMENT,
  "Mental Health": SUBCATEGORY.MENTAL_HEALTH,
  "Nutrition": SUBCATEGORY.NUTRITION_HEALTH,
  "Mindfulness": SUBCATEGORY.MINDFULNESS_MEDITATION,
  "Meditation": SUBCATEGORY.MINDFULNESS_MEDITATION,
  "Sleep": SUBCATEGORY.SLEEP_RECOVERY,
  "Psychology": SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR,
  "Neuroscience": SUBCATEGORY.NEUROSCIENCE_COGNITION,
  "Relationships": SUBCATEGORY.RELATIONSHIPS_SOCIAL,
  "Personal Development": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Productivity": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Education": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "University Courses": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Learning": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Remote Jobs": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Engineering Team Management": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Programming Interviews": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Career": SUBCATEGORY.PERSONAL_DEVELOPMENT,
  "Aging": SUBCATEGORY.AGING_LONGEVITY,
  "Longevity": SUBCATEGORY.AGING_LONGEVITY,
  "Addiction Recovery": SUBCATEGORY.ADDICTION_RECOVERY,
  "Human Performance": SUBCATEGORY.HUMAN_PERFORMANCE,
  "Biohacking": SUBCATEGORY.HUMAN_PERFORMANCE,

  // ── PEOPLE_PLACES ──
  "Travel": SUBCATEGORY.TRAVEL_EXPLORATION,
  "Urban & Regional Planning": SUBCATEGORY.CITIES_URBAN_LIFE,
  "Cities": SUBCATEGORY.CITIES_URBAN_LIFE,
  "Languages": SUBCATEGORY.LANGUAGES_LINGUISTICS,
  "Linguistics": SUBCATEGORY.LANGUAGES_LINGUISTICS,
  "Maps": SUBCATEGORY.MAPS_CARTOGRAPHY,
  "Cartography": SUBCATEGORY.MAPS_CARTOGRAPHY,
  "Biography": SUBCATEGORY.BIOGRAPHIES_PROFILES,
  "Indigenous": SUBCATEGORY.INDIGENOUS_CULTURES,
  "Subcultures": SUBCATEGORY.SUBCULTURES_COMMUNITIES,
  "Festivals": SUBCATEGORY.FESTIVALS_CUSTOMS,
  "Oceans": SUBCATEGORY.OCEANS_MARITIME,
  "Maritime": SUBCATEGORY.OCEANS_MARITIME,
  "Mountains": SUBCATEGORY.MOUNTAINS_ALPINE,
  "Alpine": SUBCATEGORY.MOUNTAINS_ALPINE,
  "Deserts": SUBCATEGORY.DESERTS_ARID_LANDS,
  "Migration": SUBCATEGORY.MIGRATION_DIASPORA,
  "Diaspora": SUBCATEGORY.MIGRATION_DIASPORA,
  "Region": CATEGORY.PEOPLE_PLACES,

  // ── WEIRD_WONDERFUL ──
  "Oddities": SUBCATEGORY.ODDITIES_CURIOSITIES,
  "Curiosities": SUBCATEGORY.ODDITIES_CURIOSITIES,
  "True Crime": SUBCATEGORY.TRUE_CRIME_MYSTERIES,
  "Mystery": SUBCATEGORY.TRUE_CRIME_MYSTERIES,
  "Paranormal": SUBCATEGORY.PARANORMAL_UNEXPLAINED,
  "Unexplained": SUBCATEGORY.PARANORMAL_UNEXPLAINED,
  "Vintage Internet": SUBCATEGORY.VINTAGE_INTERNET,
  "Retro": SUBCATEGORY.VINTAGE_INTERNET,
  "Humor": SUBCATEGORY.ABSURDIST_HUMOUR,
  "Fun": SUBCATEGORY.ABSURDIST_HUMOUR,
  "Urban Legends": SUBCATEGORY.URBAN_LEGENDS_FOLKLORE,
  "Folklore": SUBCATEGORY.URBAN_LEGENDS_FOLKLORE,
  "Conspiracy": SUBCATEGORY.CONSPIRACY_FRINGE,
  "Fringe": SUBCATEGORY.CONSPIRACY_FRINGE,
  "Unusual Places": SUBCATEGORY.UNUSUAL_PLACES,
  "Lost Media": SUBCATEGORY.LOST_MEDIA,
  "Mythical": SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  "Anomalies": SUBCATEGORY.FORTEANA_ANOMALIES,
  "Underground": SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
};

// ── Keyword-based fuzzy matching for unmapped categories ─────────────────────
const KEYWORD_MAP = Object.fromEntries(
  "js node react vue angular svelte ember backbone jquery next nuxt gatsby remix astro sveltekit laravel rails django flask fastapi spring boot .net dotnet c# f# java kotlin scala groovy clojure elixir erlang haskell ocaml reason ml rust go golang zig nim crystal lua php perl ruby python swift objc objective-c typescript coffeescript elm purescript idris agda solidity vyper c c++ cpp pascal delphi fortran cobol basic assembly wasm webassembly babel webpack vite rollup esbuild parcel swc turbopack npm yarn pnpm bun deno electron tauri react-native flutter xamarin maui cordova capacitor ionic nativescript framework language compiler interpreter transpiler toolchain sdk library package module bundle minify lint eslint prettier".split(" ").map(k => [k, SUBCATEGORY.PROGRAMMING_SOFTWARE])
);

const KEYWORD_MAP_AI = Object.fromEntries(
  "ai ml artificial intelligence machine learning deep neural network nlp natural language processing computer vision cv tensorflow pytorch keras jax onnx llama gpt transformer diffusion stable huggingface dataset training inference model classification regression clustering embedding llm".split(" ").map(k => [k, SUBCATEGORY.AI_MACHINE_LEARNING])
);

const KEYWORD_MAP_DEVOPS = Object.fromEntries(
  "devops infrastructure cloud aws gcp azure terraform pulumi ansible chef puppet docker kubernetes k8s container pod helm istio envoy nginx apache caddy traefik ci cd pipeline github actions gitlab jenkins circleci monitoring observability prometheus grafana datadog newrelic elk elasticsearch logstash kibana opentelemetry serverless faas lambda function edge netlify vercel cloudflare workers fly.io render heroku digitalocean linode vps bare metal colocation self hosted homelab raspberry pi arduino iot".split(" ").map(k => [k, SUBCATEGORY.DEVOPS_INFRASTRUCTURE])
);

const KEYWORD_MAP_SECURITY = Object.fromEntries(
  "security cybersecurity infosec hacking hack penetration pentest ctf capture flag exploit vulnerability cve bug bounty malware reverse engineering forensics incident response threat hunting osint privacy encryption cryptography ssl tls https authentication authorization oauth saml sso iam identity access zero trust firewall waf ids ips siem".split(" ").map(k => [k, SUBCATEGORY.CYBERSECURITY_PRIVACY])
);

const KEYWORD_MAP_DATABASE = Object.fromEntries(
  "database db sql nosql postgresql mysql mariadb sqlite mongodb redis cassandra cockroachdb tidb neo4j graph time series influxdb timescaledb clickhouse duckdb databricks snowflake bigquery redshift etl elt data engineering pipeline warehouse lake lakehouse analytics spark hadoop hive presto trino dbt airflow dagster".split(" ").map(k => [k, SUBCATEGORY.DATABASES_DATA_ENGINEERING])
);

const KEYWORD_MAP_DESIGN = Object.fromEntries(
  "design ui ux figma sketch adobe xd invision prototyping wireframe mockup css tailwind bootstrap chakra material ant mui shadcn radix accessibility a11y wcag color palette typography font icon illustration svg animation motion".split(" ").map(k => [k, SUBCATEGORY.DESIGN_UX])
);

const KEYWORD_MAP_SCIENCE = Object.fromEntries(
  "science biology chemistry physics astronomy space planet star galaxy cosmology geology earth ocean marine climate weather environment ecology botany plant zoology animal genetics genomics neuroscience brain cognition paleontology fossil dinosaur anthropology archaeology".split(" ").map(k => [k, SUBCATEGORY.BIOLOGY_EVOLUTION])
);

const KEYWORD_MAP_GAMES = Object.fromEntries(
  "game gaming gamedev indie game-development unity unreal godot phaser pixi sdl sfml opengl vulkan directx 3d 2d sprite pixel art board card tabletop rpg dnd dungeons dragons wargame miniature chess go poker magic".split(" ").map(k => [k, SUBCATEGORY.VIDEO_GAMES])
);

const KEYWORD_MAP_MIND = Object.fromEntries(
  "mind health fitness mental meditation mindfulness yoga wellness nutrition diet exercise workout gym running cycling swimming sleep recovery therapy psychology psychiatry cognitive behavior cbt dbt self-help personal development productivity gtd pomodoro habit discipline motivation focus learning education course university mooc book reading writing journal".split(" ").map(k => [k, SUBCATEGORY.PERSONAL_DEVELOPMENT])
);

const KEYWORD_MAP_ARTS = Object.fromEntries(
  "art artist music song album band orchestra symphony jazz rock pop hip hop rap edm electronic classical folk country blues soul funk rnb film movie cinema tv television show series documentary animation anime manga comic graphic novel illustration painting drawing sculpture photography photo picture".split(" ").map(k => [k, SUBCATEGORY.VISUAL_ART])
);

const KEYWORD_MAP_HISTORY = Object.fromEntries(
  "history ancient medieval renaissance modern contemporary 20th century war wwi wwii cold civil revolution philosophy ethics politics government democracy republic monarchy dictatorship economics economy trade finance capitalism socialism communism religion theology mythology myth legend folklore culture civilization society".split(" ").map(k => [k, SUBCATEGORY.MODERN_HISTORY])
);

const ALL_KEYWORD_MAPS = [
  KEYWORD_MAP,
  KEYWORD_MAP_AI,
  KEYWORD_MAP_DEVOPS,
  KEYWORD_MAP_SECURITY,
  KEYWORD_MAP_DATABASE,
  KEYWORD_MAP_DESIGN,
  KEYWORD_MAP_SCIENCE,
  KEYWORD_MAP_GAMES,
  KEYWORD_MAP_MIND,
  KEYWORD_MAP_ARTS,
  KEYWORD_MAP_HISTORY,
];

// ── Domain blocklist ───────────────────────────────────────────────────────
// Domains that are never editorial/interest-worthy content
const BLOCKED_DOMAINS = new Set([
  // Link shorteners & redirect services
  "bit.ly", "tinyurl.com", "t.co", "ow.ly", "is.gd", "buff.ly", "goo.gl",
  "shorturl.at", "rb.gy", "cutt.ly", "tiny.cc", "shrtco.de",
  // Parked / expired domains
  "buynow.com", "domainmarket.com", "parked.free.com", "sedoparking.com",
  // Adult content
  "xvideos.com", "pornhub.com", "redtube.com", "xnxx.com", "xhamster.com",
  "onlyfans.com", "fansly.com",
  // Ad/tracking
  "doubleclick.net", "adservice.google.com", "googlesyndication.com",
  // Social media profiles (not content)
  "facebook.com", "instagram.com", "twitter.com", "tiktok.com",
  "linkedin.com/in", "linkedin.com/company",
  // Spam / low-quality aggregators
  "pinterest.com", "quora.com",
  // E-commerce only (no editorial)
  "amazon.com", "ebay.com", "etsy.com", "aliexpress.com", "walmart.com",
  "shopify.com",
]);

function isBlockedDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    // Direct match
    if (BLOCKED_DOMAINS.has(host)) return true;
    // Subdomain match (e.g., subdomain.wordpress.com)
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join('.');
      if (BLOCKED_DOMAINS.has(suffix)) return true;
    }
    return false;
  } catch { return true; }
}

// ── Validate URL ─────────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Map category name → subcategory UUID ────────────────────────────────────
function mapCategory(categoryName) {
  if (!categoryName) return SUBCATEGORY.ODDITIES_CURIOSITIES;

  // 1. Exact match
  if (CATEGORY_MAP[categoryName]) return CATEGORY_MAP[categoryName];

  // 2. Keyword-based fuzzy matching
  const lower = categoryName.toLowerCase();
  const words = lower.split(/[\s\-_/&]+/).filter(Boolean);

  for (const word of words) {
    for (const map of ALL_KEYWORD_MAPS) {
      if (map[word]) return map[word];
    }
  }

  // 3. Default fallback
  return SUBCATEGORY.ODDITIES_CURIOSITIES;
}

// ── Clean title ──────────────────────────────────────────────────────────────
function cleanTitle(t) {
  if (!t) return null;
  return t.trim()
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/\s+/g, " ")
    .slice(0, 300) || null;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("========== StumbleUponAwesome URL Extractor ==========\n");

  if (!existsSync(AWESOME_URLS_DIR)) {
    console.error(`❌ Awesome URLs directory not found: ${AWESOME_URLS_DIR}`);
    console.error("   Run: git clone https://github.com/basharovV/StumbleUponAwesome.git scripts/.cache/stumbleupon-awesome");
    process.exit(1);
  }

  const files = readdirSync(AWESOME_URLS_DIR).filter(f => f.endsWith(".txt"));
  console.log(`Found ${files.length} category files\n`);

  const urlMap = new Map();
  let totalLines = 0;
  let skippedInvalid = 0;
  const categoryStats = {};

  for (const file of files) {
    const filePath = resolve(AWESOME_URLS_DIR, file);
    const categoryName = file.replace(".txt", "");
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(l => l.trim());

    for (const line of lines) {
      totalLines++;
      const parts = line.split(",");
      if (parts.length < 2) { skippedInvalid++; continue; }

      const url = parts[0]?.trim();
      const title = cleanTitle(parts[1]) || undefined;

      if (!url || !isValidHttpUrl(url)) { skippedInvalid++; continue; }
      if (isBlockedDomain(url)) { skippedInvalid++; continue; }

      if (!urlMap.has(url) || (title && !urlMap.get(url).title)) {
        const subcategoryId = mapCategory(categoryName);
        urlMap.set(url, {
          url,
          title: title || undefined,
          description: `${categoryName} — curated from awesome lists`,
          category_id: extractCategoryFromSub(subcategoryId),
          subcategory_id: subcategoryId,
          source: "stumbleupon-awesome",
          seeder_score: 0.65,
          awesome_category: categoryName,
        });
      }

      categoryStats[categoryName] = (categoryStats[categoryName] || 0) + 1;
    }
  }

  const rows = [...urlMap.values()];

  console.log(`📊 Stats:`);
  console.log(`  Total lines parsed:    ${totalLines}`);
  console.log(`  Unique valid URLs:     ${rows.length}`);
  console.log(`  Skipped (invalid):     ${skippedInvalid}`);
  console.log(`  Categories found:      ${Object.keys(categoryStats).length}`);

  console.log(`\n  Top categories by URL count:`);
  const sorted = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted.slice(0, 15)) {
    console.log(`    ${String(count).padStart(5)}  ${cat}`);
  }

  // Write output
  writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);

  // Print Roam category distribution
  console.log(`\n  Roam subcategory distribution (top 20):`);
  const subDist = {};
  for (const row of rows) {
    const key = row.subcategory_id || "null";
    subDist[key] = (subDist[key] || 0) + 1;
  }
  const subSorted = Object.entries(subDist).sort((a, b) => b[1] - a[1]);
  for (const [uuid, count] of subSorted.slice(0, 20)) {
    const name = getSubName(uuid) || uuid;
    console.log(`    ${String(count).padStart(6)}  ${name}`);
  }

  console.log("\n✅ Extraction complete!\n");
}

// ── Helper: extract category UUID from subcategory UUID ───────────────────
function extractCategoryFromSub(subId) {
  if (!subId) return CATEGORY.WEIRD_WONDERFUL;
  // Sub UUID format: c2{pillar:06d}-...
  const pillarNum = parseInt(subId.slice(2, 8), 10);
  const pillarMap = {
    1: CATEGORY.SCIENCE,
    2: CATEGORY.TECHNOLOGY,
    3: CATEGORY.ARTS_CULTURE,
    4: CATEGORY.HISTORY_IDEAS,
    5: CATEGORY.GAMES_HOBBIES,
    6: CATEGORY.WEIRD_WONDERFUL,
    7: CATEGORY.PEOPLE_PLACES,
    8: CATEGORY.MIND_BODY,
  };
  return pillarMap[pillarNum] || CATEGORY.WEIRD_WONDERFUL;
}

// ── Helper: get subcategory name from UUID (for logging) ──────────────────
function getSubName(uuid) {
  const entries = Object.entries(SUBCATEGORY);
  for (const [name, id] of entries) {
    if (id === uuid) return name;
  }
  return null;
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});