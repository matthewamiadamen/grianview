import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type { BuildingData } from '@/types/BuildingData';

// Column names in belfast_buildings.csv (SMALL.csv schema)
const COL = {
  osm_id: 'OSM_ID',
  osm_type: 'OSM_TYPE',
  street: 'A_STRT',
  house_no: 'A_HSNMBR',
  place: 'A_PLACE',
  postcode: 'A_PSTCD',
  name: 'NAME',
  area: 'Area',
  mean: 'MEAN',
  usable_sr: 'usable_sr',
  elec_prod: 'elec_prod',
  aspect: 'MEAN_aspect',
  slope: 'MEAN_slope',
  elevation: 'MEAN_elev',
  zone_code: 'ZONE_CODE',
  building_type: 'BUILDING',
} as const;

function buildAddress(row: Record<string, string>): string | undefined {
  const parts = [
    row[COL.house_no],
    row[COL.street],
    row[COL.place],
    row[COL.postcode],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function parseRow(row: Record<string, string>): BuildingData {
  return {
    osm_id: row[COL.osm_id] ?? '',
    osm_type: row[COL.osm_type] ?? 'way',
    address: buildAddress(row),
    name: row[COL.name] || undefined,
    mean_radiation: parseFloat(row[COL.mean]) || 0,
    usable_sr: parseFloat(row[COL.usable_sr]) || 0,
    elec_prod: parseFloat(row[COL.elec_prod]) || 0,
    roof_area_m2: parseFloat(row[COL.area]) || 0,
    aspect_deg: parseFloat(row[COL.aspect]) || 180,
    slope_deg: parseFloat(row[COL.slope]) || 0,
    elevation_m: parseFloat(row[COL.elevation]) || 0,
    zone_code: parseInt(row[COL.zone_code]) || 0,
  };
}

let cache: Map<string, BuildingData> | null = null;
let allBuildings: BuildingData[] | null = null;

export function loadBuildings(): { byId: Map<string, BuildingData>; all: BuildingData[] } {
  if (cache && allBuildings) return { byId: cache, all: allBuildings };

  const csvPath = path.join(process.cwd(), 'data', 'belfast_buildings.csv');
  if (!fs.existsSync(csvPath)) {
    cache = new Map();
    allBuildings = [];
    return { byId: cache, all: allBuildings };
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  cache = new Map();
  allBuildings = [];

  for (const row of result.data) {
    const building = parseRow(row);
    if (building.osm_id) {
      cache.set(building.osm_id, building);
      allBuildings.push(building);
    }
  }

  console.log(`[GrianView] Loaded ${allBuildings.length} buildings from CSV`);
  return { byId: cache, all: allBuildings };
}
