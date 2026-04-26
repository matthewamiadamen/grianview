import { NextResponse } from 'next/server';
import { fetchBuildingTags } from '@/lib/api/overpass';
import { checkHeritage } from '@/lib/api/heritage';
import { getBuildingById } from '@/lib/data/buildingLookup';

export async function GET(
  _req: Request,
  { params }: { params: { osmId: string } }
) {
  const building = getBuildingById(params.osmId);
  const lat = building?.lat ?? 54.597;
  const lng = building?.lng ?? -5.930;

  const [tags, heritage] = await Promise.all([
    fetchBuildingTags(params.osmId),
    checkHeritage(lat, lng),
  ]);

  return NextResponse.json({ ...tags, ...heritage });
}
