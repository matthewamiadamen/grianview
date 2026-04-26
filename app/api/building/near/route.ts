import { NextResponse } from 'next/server';
import { findBuildingWaysNear } from '@/lib/api/overpass';
import { getBuildingById } from '@/lib/data/buildingLookup';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  const ids = await findBuildingWaysNear(lat, lng, 25);
  for (const id of ids) {
    if (getBuildingById(id)) {
      return NextResponse.json({ osm_id: id });
    }
  }

  return NextResponse.json({ osm_id: null });
}
