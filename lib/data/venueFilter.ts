import { getAllBuildings } from './buildingLookup';
import type { BuildingData } from '@/types/BuildingData';

const VENUE_TYPES = new Set([
  'pub', 'bar', 'cafe', 'restaurant', 'hotel',
  'community_centre', 'public_building', 'nightclub', 'biergarten',
]);

export function getPublicVenues(): BuildingData[] {
  return getAllBuildings().filter(
    (b) => b.building_type && VENUE_TYPES.has(b.building_type.toLowerCase())
  );
}
