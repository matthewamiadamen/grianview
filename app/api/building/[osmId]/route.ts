import { NextResponse } from 'next/server';
import { getBuildingById } from '@/lib/data/buildingLookup';
import { buildSuitabilityResult } from '@/lib/solar/suitabilityScore';
import { checkHeritage } from '@/lib/api/heritage';
import { fetchBuildingGeometry, fetchBuildingTags } from '@/lib/api/overpass';

export async function GET(
  _req: Request,
  { params }: { params: { osmId: string } }
) {
  const building = getBuildingById(params.osmId);
  if (!building) {
    return NextResponse.json({ error: 'Building not found in dataset' }, { status: 404 });
  }

  // Fetch geometry + tags + heritage in parallel
  const [geometry, tags] = await Promise.all([
    fetchBuildingGeometry(params.osmId),
    fetchBuildingTags(params.osmId),
  ]);

  // Populate lat/lng from geometry centroid
  const enrichedBuilding = {
    ...building,
    lat: geometry?.lat ?? building.lat,
    lng: geometry?.lng ?? building.lng,
    name: building.name ?? tags.name ?? undefined,
  };

  const heritage = geometry
    ? await checkHeritage(geometry.lat, geometry.lng)
    : { heritage: false, conservation_area: false, planning_restricted: false };

  const result = await buildSuitabilityResult(enrichedBuilding, {
    heritage: heritage.heritage,
    conservation: heritage.conservation_area,
    planning_restricted: heritage.planning_restricted,
    building_type: tags.building_type,
    roof_material: tags.roof_material,
  });

  return NextResponse.json({
    ...result,
    geometry: geometry?.polygon ?? null,
    centroid: geometry ? { lat: geometry.lat, lng: geometry.lng } : null,
  });
}
