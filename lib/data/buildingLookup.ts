// ============================================================
// DATA INTEGRATION POINT
// Currently reads from: /data/belfast_buildings.csv (SMALL.csv)
// Dataset: Belfast buildings <50m², April 24–25 solar data
// ============================================================

import { loadBuildings } from './csvLoader';
import type { BuildingData } from '@/types/BuildingData';

export function getBuildingById(osmId: string): BuildingData | null {
  const { byId } = loadBuildings();
  return byId.get(osmId) ?? null;
}

export function getAllBuildings(): BuildingData[] {
  return loadBuildings().all;
}
