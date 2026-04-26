export interface OverpassTags {
  building_type: string | null;
  roof_material: string | null;
  name: string | null;
  opening_hours: string | null;
}

export interface OverpassGeometry {
  lat: number;
  lng: number;
  polygon: GeoJSON.Polygon | null;
}

const OVERPASS = 'https://overpass-api.de/api/interpreter';

async function query(q: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'GrianView/1.0' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBuildingTags(osmId: string): Promise<OverpassTags> {
  const q = `[out:json][timeout:10];way(${osmId});out tags;`;
  const data = await query(q);
  const tags = (data as { elements?: { tags?: Record<string, string> }[] } | null)?.elements?.[0]?.tags ?? {};
  return {
    building_type: tags['building'] ?? tags['amenity'] ?? null,
    roof_material: tags['roof:material'] ?? tags['roof:colour'] ?? null,
    name: tags['name'] ?? null,
    opening_hours: tags['opening_hours'] ?? null,
  };
}

export async function fetchBuildingGeometry(osmId: string): Promise<OverpassGeometry | null> {
  const q = `[out:json][timeout:15];way(${osmId});out geom;`;
  const data = await query(q);

  type OsmWay = { geometry?: { lat: number; lon: number }[] };
  const el = (data as { elements?: OsmWay[] } | null)?.elements?.[0];
  if (!el?.geometry?.length) return null;

  const pts = el.geometry;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lon);
  const lat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  // GeoJSON polygon (close the ring)
  const coords = pts.map((p): [number, number] => [p.lon, p.lat]);
  if (coords[0][0] !== coords[coords.length - 1][0]) coords.push(coords[0]);
  const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [coords] };

  return { lat, lng, polygon };
}

// Find building way IDs within `radius` metres of a point
export async function findBuildingWaysNear(
  lat: number,
  lng: number,
  radius = 40
): Promise<string[]> {
  const q = `[out:json][timeout:15];way["building"](around:${radius},${lat},${lng});out ids;`;
  const data = await query(q);
  type OsmEl = { id?: number };
  return (
    (data as { elements?: OsmEl[] } | null)?.elements?.map((e) => String(e.id)).filter(Boolean) ?? []
  );
}
