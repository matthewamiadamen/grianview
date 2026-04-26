import { NextResponse } from 'next/server';
import { getPublicVenues } from '@/lib/data/venueFilter';
import { getSunPosition, getSunTimes } from '@/lib/solar/sunPosition';
import type { Venue } from '@/types/Venue';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ts = searchParams.get('ts');
  const date = ts ? new Date(parseInt(ts)) : new Date();

  const sun = getSunPosition(date);
  const times = getSunTimes(date);

  const venues = getPublicVenues();

  // Without aspect_deg in the new dataset, score by mean_radiation alone
  const results: Venue[] = venues
    .filter((b) => b.lat !== undefined && b.lng !== undefined)
    .map((b) => {
      const radScore = Math.min(100, Math.round((b.mean_radiation / 4) * 100));
      const exposure = radScore > 60 ? 'full' : radScore > 30 ? 'partial' : 'shade';
      return {
        osm_id: b.osm_id,
        name: b.name ?? b.address ?? `Venue (${b.osm_id})`,
        address: b.address,
        lat: b.lat as number,
        lng: b.lng as number,
        building_type: b.building_type ?? 'venue',
        aspect_deg: 180,
        mean_radiation_wh_m2: b.mean_radiation * 1000,
        sun_score: radScore,
        exposure,
      };
    });

  results.sort((a, b) => b.sun_score - a.sun_score);

  return NextResponse.json({
    venues: results.slice(0, 20),
    sun_position: sun,
    sunrise: times.sunrise.toISOString(),
    sunset: times.sunset.toISOString(),
    is_daylight: sun.isAboveHorizon,
  });
}
