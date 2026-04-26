import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Belfast boundary (same as belfast-bounds.geojson) ────────────────
const BOUNDARY = [
  [-5.8720, 54.6180], [-5.8560, 54.6290], [-5.8520, 54.6420],
  [-5.8680, 54.6580], [-5.8900, 54.6650], [-5.9080, 54.6700],
  [-5.9300, 54.6680], [-5.9520, 54.6650], [-5.9680, 54.6590],
  [-5.9820, 54.6530], [-5.9940, 54.6450], [-6.0050, 54.6360],
  [-6.0100, 54.6220], [-6.0120, 54.6080], [-6.0050, 54.5960],
  [-5.9980, 54.5840], [-5.9900, 54.5730], [-5.9800, 54.5630],
  [-5.9680, 54.5540], [-5.9530, 54.5470], [-5.9360, 54.5420],
  [-5.9160, 54.5390], [-5.8980, 54.5410], [-5.8820, 54.5480],
  [-5.8680, 54.5570], [-5.8580, 54.5690], [-5.8520, 54.5820],
  [-5.8500, 54.5960], [-5.8520, 54.6090], [-5.8620, 54.6180],
  [-5.8720, 54.6180],
];

// Ray-cast point-in-polygon
function inside(lng, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Control points [lng, lat, radiation kWh/m²/day] ──────────────────
// Spread exaggerated to produce visible contrast across warm April days.
// Low = shadowed/dense/north-facing; High = open/south-facing.
const CONTROLS = [
  // City centre — dense buildings, street canyons
  [-5.930, 54.597, 2.10], [-5.920, 54.600, 2.15], [-5.915, 54.593, 2.05],
  [-5.935, 54.603, 2.08],

  // South Belfast / Malone / Stranmillis — open sky, south-facing slopes
  [-5.940, 54.560, 3.55], [-5.920, 54.555, 3.60], [-5.930, 54.548, 3.50],
  [-5.950, 54.568, 3.25], [-5.935, 54.578, 3.10], [-5.925, 54.574, 3.15],
  [-5.948, 54.572, 3.05], [-5.958, 54.562, 3.30],

  // Outer south (Dunmurry, Finaghy, Balmoral) — open suburban
  [-5.970, 54.548, 3.00], [-5.955, 54.543, 3.20], [-5.942, 54.540, 3.35],

  // East Belfast / Titanic / Sydenham — flat, open, unobstructed
  [-5.882, 54.608, 3.20], [-5.868, 54.602, 3.30], [-5.858, 54.618, 3.15],
  [-5.890, 54.622, 3.00], [-5.873, 54.632, 2.90],

  // Ballyhackamore / Belmont — open east-facing suburban
  [-5.878, 54.586, 3.35], [-5.866, 54.576, 3.45], [-5.872, 54.562, 3.25],
  [-5.863, 54.570, 3.40], [-5.890, 54.570, 3.10],

  // Ormeau / Ravenhill
  [-5.912, 54.570, 2.85], [-5.900, 54.562, 2.95], [-5.893, 54.578, 2.80],

  // North Belfast / New Lodge / Ardoyne — dense terraces
  [-5.942, 54.632, 1.98], [-5.922, 54.642, 1.90], [-5.932, 54.652, 1.85],
  [-5.947, 54.647, 1.92], [-5.912, 54.650, 1.95],

  // Cave Hill — heavy hill shadow, north-facing
  [-5.988, 54.652, 1.45], [-5.978, 54.662, 1.40], [-5.972, 54.647, 1.55],
  [-5.962, 54.640, 1.70], [-5.977, 54.637, 1.50],

  // West Belfast / Black Mountain shadow — steep west slopes
  [-5.993, 54.612, 1.65], [-5.982, 54.602, 1.75], [-5.977, 54.592, 1.85],
  [-5.988, 54.582, 1.70], [-5.998, 54.597, 1.60],

  // Shankill / Falls — dense terrace, moderate shade
  [-5.972, 54.610, 2.00], [-5.962, 54.605, 2.10], [-5.967, 54.597, 2.18],

  // Andersonstown / Poleglass — slightly more open than inner west
  [-5.982, 54.572, 2.15], [-5.968, 54.562, 2.30], [-5.958, 54.555, 2.55],

  // Harbour / Docks / Titanic corridor
  [-5.897, 54.614, 3.05], [-5.907, 54.620, 2.95],

  // Outer NE / Newtownabbey edge
  [-5.892, 54.662, 2.65], [-5.912, 54.660, 2.60],

  // Castlereagh hills — exposed SE
  [-5.873, 54.565, 3.30], [-5.860, 54.558, 3.45],

  // Lisburn Rd corridor
  [-5.950, 54.576, 2.92], [-5.960, 54.568, 2.98],
];

function idw(lng, lat, power = 2.8) {
  let wSum = 0, vSum = 0;
  for (const [clng, clat, val] of CONTROLS) {
    const d = Math.hypot(lng - clng, lat - clat);
    if (d < 0.00005) return val;
    const w = 1 / d ** power;
    wSum += w; vSum += w * val;
  }
  return vSum / wSum;
}

function noise(lng, lat) {
  return (Math.sin(lng * 487.3 + lat * 312.7) * 0.5 + 0.5 - 0.5) * 0.14;
}

// ── Generate grid — 120×120, clipped to boundary ─────────────────────
const BBOX = { minLng: -6.02, maxLng: -5.85, minLat: 54.535, maxLat: 54.675 };
const COLS = 120, ROWS = 120;
const lngStep = (BBOX.maxLng - BBOX.minLng) / COLS;
const latStep = (BBOX.maxLat - BBOX.minLat) / ROWS;

const features = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const lng = BBOX.minLng + (col + 0.5) * lngStep;
    const lat = BBOX.minLat + (row + 0.5) * latStep;
    if (!inside(lng, lat, BOUNDARY)) continue;
    const radiation = Math.max(1.5, Math.min(3.6, idw(lng, lat) + noise(lng, lat)));
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { r: Math.round(radiation * 100) / 100 },
    });
  }
}

fs.writeFileSync(
  path.join(__dirname, '..', 'public', 'belfast-heatmap.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features })
);
console.log(`Written ${features.length} clipped points`);
