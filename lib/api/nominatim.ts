export interface NominatimResult {
  osm_id: string;
  display_name: string;
  lat: number;
  lng: number;
  type: string;
  class: string;
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
  const scoped = `${query}, Belfast, Northern Ireland`;

  // Fetch a larger pool so we can sort by specificity
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(scoped)}&format=json&addressdetails=1&limit=10`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GrianView/1.0 (matthewamiadamen@gmail.com)' },
    next: { revalidate: 0 }, // don't cache — addresses need live results
  });

  if (!res.ok) return [];

  const data: Record<string, string>[] = await res.json();

  const results: NominatimResult[] = data.map((item) => ({
    osm_id: item.osm_id ?? '',
    display_name: item.display_name ?? '',
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type ?? '',
    class: item.class ?? '',
  }));

  // Sort: specific buildings/houses first, streets last
  const specificityScore = (r: NominatimResult) => {
    if (r.type === 'house' || r.type === 'residential') return 0;
    if (r.class === 'building') return 1;
    if (r.type === 'yes') return 2;
    if (r.class === 'place' || r.type === 'neighbourhood') return 4;
    if (r.class === 'highway') return 5;
    return 3;
  };

  results.sort((a, b) => specificityScore(a) - specificityScore(b));

  return results.slice(0, 5);
}
