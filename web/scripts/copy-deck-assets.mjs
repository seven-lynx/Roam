// Copy deck art assets from the local-only `.roam-local/assets` tree into the
// committed `web/public` tree, and regenerate the camera-roll manifest.
//
//   node web/scripts/copy-deck-assets.mjs
import { readdirSync, copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_WALLPAPERS = join(ROOT, '.roam-local', 'assets', 'wallpapers');
const SRC_PICTURES = join(ROOT, '.roam-local', 'assets', 'Pictures');
const OUT_WALLPAPERS = join(ROOT, 'web', 'public', 'wallpapers');
const OUT_ROLL = join(ROOT, 'web', 'public', 'roll');
const MANIFEST = join(ROOT, 'web', 'src', 'lib', 'camera-roll.ts');

mkdirSync(OUT_WALLPAPERS, { recursive: true });
mkdirSync(OUT_ROLL, { recursive: true });

// ── Wallpapers (30) ──────────────────────────────────────────────────────────
const wallpapers = readdirSync(SRC_WALLPAPERS).filter((f) => /\.jpe?g$/i.test(f)).sort();
for (let i = 0; i < wallpapers.length; i++) {
  const out = join(OUT_WALLPAPERS, `deck-wallpaper-${String(i + 1).padStart(2, '0')}.jpg`);
  copyFileSync(join(SRC_WALLPAPERS, wallpapers[i]), out);
}

// ── Camera roll: [album, source filename, slug, label] ───────────────────────
const rolls = [
  ['manual', 'Duck-ai-image-2026-11-02-15-40(5).jpeg', 'manual-01', 'Manual I'],
  ['manual', 'Duck-ai-image-2026-11-02-15-41(6).jpeg', 'manual-02', 'Manual II'],
  ['manual', 'Duck-ai-image-2026-11-02-16-15.jpeg', 'manual-03', 'Manual III'],
  ['manual', 'Duck-ai-image-2026-11-02-16-16(1).jpeg', 'manual-04', 'Manual IV'],
  ['manual', 'Duck-ai-image-2026-11-02-16-16.jpeg', 'manual-05', 'Manual V'],
  ['roll', 'Duck-ai-image-2026-11-02-17-09.jpeg', 'deck-01', 'Deck Render'],
  ['roll', 'IMG_0417_CYBERDECK_LastTram.jpg.jpeg', 'deck-02', 'Last Tram'],
  ['roll', 'IMG_0417_CYBERDECK_TransitConcourse.jpg.jpeg', 'deck-03', 'Transit Concourse'],
  ['roll', 'IMG_0419_CYBERDECK_FloodedStation.jpg.jpeg', 'deck-04', 'Flooded Station'],
  ['roll', 'IMG_0419_CYBERDECK_UndergroundMarket.jpg.jpeg', 'deck-05', 'Underground Market'],
  ['roll', 'IMG_0420_CYBERDECK_ArcticBeacon.jpg.jpeg', 'deck-06', 'Arctic Beacon'],
  ['roll', 'IMG_0420_CYBERDECK_RelayGarden.jpg.jpeg', 'deck-07', 'Relay Garden'],
  ['roll', 'IMG_0420_CYBERDECK_RelayHut.jpg.jpeg', 'deck-08', 'Relay Hut'],
  ['roll', 'IMG_0421_CYBERDECK_MountainCafe.jpg.jpeg', 'deck-09', 'Mountain Café'],
  ['roll', 'IMG_0421_CYBERDECK_WinterFerry.jpg.jpeg', 'deck-10', 'Winter Ferry'],
  ['roll', 'IMG_0422_CYBERDECK_HillsidePlanetarium.jpg.jpeg', 'deck-11', 'Hillside Planetarium'],
  ['roll', 'IMG_0423_CYBERDECK_MountainStation.jpg.jpeg', 'deck-12', 'Mountain Station'],
  ['roll', 'IMG_0423_CYBERDECK_RooftopBazaar.jpg.jpeg', 'deck-13', 'Rooftop Bazaar'],
  ['roll', 'IMG_0423_CYBERDECK_RooftopGarden.jpg.jpeg', 'deck-14', 'Rooftop Garden'],
  ['roll', 'IMG_0424_CYBERDECK_SaltflatRailcamp.jpg.jpeg', 'deck-15', 'Saltflat Railcamp'],
  ['roll', 'IMG_0424_CYBERDECK_SkiLiftTerminal.jpg.jpeg', 'deck-16', 'Ski Lift Terminal'],
  ['roll', 'IMG_0425_CYBERDECK_AmazonFactory.jpg.jpeg', 'deck-17', 'Amazon Factory'],
  ['roll', 'IMG_0425_CYBERDECK_CableCarWaypoint.jpg.jpeg', 'deck-18', 'Cable Car Waypoint'],
  ['roll', 'IMG_0425_CYBERDECK_MetaCampus.jpg.jpeg', 'deck-19', 'Meta Campus'],
  ['roll', 'IMG_0426_CYBERDECK_NightMarket.jpg.jpeg', 'deck-20', 'Night Market'],
  ['roll', 'IMG_0427_CYBERDECK_XRuins.jpg.jpeg', 'deck-21', 'X Ruins'],
  ['roll', 'IMG_0429_CYBERDECK_UndergroundArchive.jpg.jpeg', 'deck-22', 'Underground Archive'],
  ['roll', 'IMG_0431_CYBERDECK_UberCampus.jpg.jpeg', 'deck-23', 'Uber Campus'],
  ['roll', 'IMG_0433_CYBERDECK_AmazonWarehouse.jpg.jpeg', 'deck-24', 'Amazon Warehouse'],
  ['roll', 'IMG_0434_CYBERDECK_WhiteHouse.jpg.jpeg', 'deck-25', 'White House'],
  ['roll', 'IMG_0435_CYBERDECK_WhiteHouse.jpg.jpeg', 'deck-26', 'White House II'],
  ['drone', 'IMG_0417_DRONE_FloodedStation.jpg.jpeg', 'drone-01', 'Flooded Station'],
  ['drone', 'IMG_0420_DRONE_DesertWindFarm.jpg.jpeg', 'drone-02', 'Desert Wind Farm'],
  ['drone', 'IMG_0421_DRONE_BaggageHall.jpg.jpeg', 'drone-03', 'Baggage Hall'],
  ['drone', 'IMG_0421_DRONE_Greenhouse.jpg.jpeg', 'drone-04', 'Greenhouse'],
  ['drone', 'IMG_0422_DRONE_ForestRelay.jpg.jpeg', 'drone-05', 'Forest Relay'],
  ['drone', 'IMG_0422_DRONE_LowTideTerminal.jpg.jpeg', 'drone-06', 'Low Tide Terminal'],
  ['drone', 'IMG_0423_DRONE_SeasideAquarium.jpg.jpeg', 'drone-07', 'Seaside Aquarium'],
  ['drone', 'IMG_0424_DRONE_FloodedArcade.jpg.jpeg', 'drone-08', 'Flooded Arcade'],
  ['drone', 'IMG_0428_DRONE_StarlinkRuins.jpg.jpeg', 'drone-09', 'Starlink Ruins'],
  ['drone', 'IMG_0430_DRONE_CableLanding.jpg.jpeg', 'drone-10', 'Cable Landing'],
  ['drone', 'IMG_0432_DRONE_DoorDashHQ.jpg.jpeg', 'drone-11', 'DoorDash HQ'],
];

const dirOf = (album) => (album === 'manual' ? 'Cyberdeck Manual' : album === 'roll' ? 'Cyberdeck Roll' : 'Drone');

const manifest = [];
for (const [album, srcName, slug, label] of rolls) {
  const srcPath = join(SRC_PICTURES, dirOf(album), srcName);
  if (!existsSync(srcPath)) throw new Error(`Missing source: ${srcPath}`);
  copyFileSync(srcPath, join(OUT_ROLL, `${slug}.jpg`));
  manifest.push({ id: slug, album, label, src: `/roll/${slug}.jpg` });
}

const entries = manifest
  .map((p) => `  { id: '${p.id}', album: '${p.album}', label: '${p.label.replace(/'/g, "\\'")}', src: '${p.src}' }`)
  .join(',\n');

const ts = `/**
 * Camera-roll photo index for the in-OS "Cyberdeck Roll" gallery program.
 * Generated by web/scripts/copy-deck-assets.mjs — re-run to regenerate.
 */

export type RollAlbum = 'manual' | 'roll' | 'drone';

export interface RollPhoto {
  id: string;
  album: RollAlbum;
  label: string;
  src: string;
}

export const ROLL_ALBUMS: { id: RollAlbum; label: string }[] = [
  { id: 'manual', label: 'CYBERDECK MANUAL' },
  { id: 'roll', label: 'CYBERDECK ROLL' },
  { id: 'drone', label: 'DRONE' },
];

export const ROLL_PHOTOS: RollPhoto[] = [
${entries}
];
`;

writeFileSync(MANIFEST, ts, 'utf8');

console.log(`Wallpapers copied: ${wallpapers.length}`);
console.log(`Roll photos copied: ${manifest.length}`);
console.log(`Manifest written: ${MANIFEST}`);
