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

// ── Camera roll: [album, source filename, slug, label, out-file] ───────────────────────
const rolls = [
  ['manual', 'Duck-ai-image-2026-11-02-15-40(5).jpeg', 'manual-01', 'Manual I', 'manual-01'],
  ['manual', 'Duck-ai-image-2026-11-02-15-41(6).jpeg', 'manual-02', 'Manual II', 'manual-02'],
  ['manual', 'Duck-ai-image-2026-11-02-16-15.jpeg', 'manual-03', 'Manual III', 'manual-03'],
  ['manual', 'Duck-ai-image-2026-11-02-16-16(1).jpeg', 'manual-04', 'Manual IV', 'manual-04'],
  ['manual', 'Duck-ai-image-2026-11-02-16-16.jpeg', 'manual-05', 'Manual V', 'manual-05'],
  ['roll', 'Duck-ai-image-2026-11-02-17-09.jpeg', 'deck-01', 'Deck Render', 'IMG_2831'],
  ['roll', 'IMG_0417_CYBERDECK_LastTram.jpg.jpeg', 'deck-02', 'Last Tram', 'IMG_9064'],
  ['roll', 'IMG_0417_CYBERDECK_TransitConcourse.jpg.jpeg', 'deck-03', 'Transit Concourse', 'IMG_1147'],
  ['roll', 'IMG_0419_CYBERDECK_FloodedStation.jpg.jpeg', 'deck-04', 'Flooded Station', 'IMG_5529'],
  ['roll', 'IMG_0419_CYBERDECK_UndergroundMarket.jpg.jpeg', 'deck-05', 'Underground Market', 'IMG_7213'],
  ['roll', 'IMG_0420_CYBERDECK_ArcticBeacon.jpg.jpeg', 'deck-06', 'Arctic Beacon', 'IMG_0387'],
  ['roll', 'IMG_0420_CYBERDECK_RelayGarden.jpg.jpeg', 'deck-07', 'Relay Garden', 'IMG_6402'],
  ['roll', 'IMG_0420_CYBERDECK_RelayHut.jpg.jpeg', 'deck-08', 'Relay Hut', 'IMG_2910'],
  ['roll', 'IMG_0421_CYBERDECK_MountainCafe.jpg.jpeg', 'deck-09', 'Mountain Café', 'IMG_8174'],
  ['roll', 'IMG_0421_CYBERDECK_WinterFerry.jpg.jpeg', 'deck-10', 'Winter Ferry', 'IMG_4651'],
  ['roll', 'IMG_0422_CYBERDECK_HillsidePlanetarium.jpg.jpeg', 'deck-11', 'Hillside Planetarium', 'IMG_1735'],
  ['roll', 'IMG_0423_CYBERDECK_MountainStation.jpg.jpeg', 'deck-12', 'Mountain Station', 'IMG_8593'],
  ['roll', 'IMG_0423_CYBERDECK_RooftopBazaar.jpg.jpeg', 'deck-13', 'Rooftop Bazaar', 'IMG_6207'],
  ['roll', 'IMG_0423_CYBERDECK_RooftopGarden.jpg.jpeg', 'deck-14', 'Rooftop Garden', 'IMG_3948'],
  ['roll', 'IMG_0424_CYBERDECK_SaltflatRailcamp.jpg.jpeg', 'deck-15', 'Saltflat Railcamp', 'IMG_7521'],
  ['roll', 'IMG_0424_CYBERDECK_SkiLiftTerminal.jpg.jpeg', 'deck-16', 'Ski Lift Terminal', 'IMG_1086'],
  ['roll', 'IMG_0425_CYBERDECK_AmazonFactory.jpg.jpeg', 'deck-17', 'Amazon Factory', 'IMG_4863'],
  ['roll', 'IMG_0425_CYBERDECK_CableCarWaypoint.jpg.jpeg', 'deck-18', 'Cable Car Waypoint', 'IMG_9312'],
  ['roll', 'IMG_0425_CYBERDECK_MetaCampus.jpg.jpeg', 'deck-19', 'Meta Campus', 'IMG_2708'],
  ['roll', 'IMG_0426_CYBERDECK_NightMarket.jpg.jpeg', 'deck-20', 'Night Market', 'IMG_6045'],
  ['roll', 'IMG_0427_CYBERDECK_XRuins.jpg.jpeg', 'deck-21', 'X Ruins', 'IMG_3591'],
  ['roll', 'IMG_0429_CYBERDECK_UndergroundArchive.jpg.jpeg', 'deck-22', 'Underground Archive', 'IMG_7820'],
  ['roll', 'IMG_0431_CYBERDECK_UberCampus.jpg.jpeg', 'deck-23', 'Uber Campus', 'IMG_2104'],
  ['roll', 'IMG_0433_CYBERDECK_AmazonWarehouse.jpg.jpeg', 'deck-24', 'Amazon Warehouse', 'IMG_9476'],
  ['roll', 'IMG_0434_CYBERDECK_WhiteHouse.jpg.jpeg', 'deck-25', 'White House', 'IMG_5718'],
  ['roll', 'IMG_0435_CYBERDECK_WhiteHouse.jpg.jpeg', 'deck-26', 'White House II', 'IMG_3359'],
  ['drone', 'IMG_0417_DRONE_FloodedStation.jpg.jpeg', 'drone-01', 'Flooded Station', 'IMG_6601'],
  ['drone', 'IMG_0420_DRONE_DesertWindFarm.jpg.jpeg', 'drone-02', 'Desert Wind Farm', 'IMG_4097'],
  ['drone', 'IMG_0421_DRONE_BaggageHall.jpg.jpeg', 'drone-03', 'Baggage Hall', 'IMG_1230'],
  ['drone', 'IMG_0421_DRONE_Greenhouse.jpg.jpeg', 'drone-04', 'Greenhouse', 'IMG_8865'],
  ['drone', 'IMG_0422_DRONE_ForestRelay.jpg.jpeg', 'drone-05', 'Forest Relay', 'IMG_5413'],
  ['drone', 'IMG_0422_DRONE_LowTideTerminal.jpg.jpeg', 'drone-06', 'Low Tide Terminal', 'IMG_1988'],
  ['drone', 'IMG_0423_DRONE_SeasideAquarium.jpg.jpeg', 'drone-07', 'Seaside Aquarium', 'IMG_7024'],
  ['drone', 'IMG_0424_DRONE_FloodedArcade.jpg.jpeg', 'drone-08', 'Flooded Arcade', 'IMG_3672'],
  ['drone', 'IMG_0428_DRONE_StarlinkRuins.jpg.jpeg', 'drone-09', 'Starlink Ruins', 'IMG_8249'],
  ['drone', 'IMG_0430_DRONE_CableLanding.jpg.jpeg', 'drone-10', 'Cable Landing', 'IMG_1536'],
  ['drone', 'IMG_0432_DRONE_DoorDashHQ.jpg.jpeg', 'drone-11', 'DoorDash HQ', 'IMG_9781'],
];

const dirOf = (album) => (album === 'manual' ? 'Cyberdeck Manual' : 'Cyberdeck Roll');

const manifest = [];
for (const [album, srcName, slug, label, file] of rolls) {
  const srcPath = join(SRC_PICTURES, dirOf(album), srcName);
  if (!existsSync(srcPath)) throw new Error(`Missing source: ${srcPath}`);
  copyFileSync(srcPath, join(OUT_ROLL, `${file}.jpg`));
  manifest.push({ id: slug, album, label, src: `/roll/${file}.jpg` });
}

const entries = manifest
  .map((p) => `  { id: '${p.id}', album: '${p.album}', label: '${p.label.replace(/'/g, "\\'")}', src: '${p.src}' }`)
  .join(',\n');

const ts = `/**
 * Camera-roll photo index for the in-OS "Gallery" program.
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
  { id: 'roll', label: 'GALLERY' },
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
