import { NextResponse } from 'next/server';
import { getAllBuildings } from '@/lib/data/buildingLookup';

export interface LocalSearchResult {
  osm_id: string;
  label: string;
  sublabel?: string;
  matched_osm_id: string;
  count?: number; // >1 means unnumbered street entry
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim().toLowerCase();
  if (!q || q.length < 2) return NextResponse.json([]);

  const all = getAllBuildings();
  const tokens = q.split(/\s+/).filter(Boolean);

  const numbered: LocalSearchResult[] = [];
  // street → { osm_id, count }
  const unnumbered = new Map<string, { osm_id: string; count: number }>();

  for (const b of all) {
    const haystack = [b.address, b.name].filter(Boolean).join(' ').toLowerCase();
    if (!haystack) continue;
    if (!tokens.every((t) => haystack.includes(t))) continue;

    const hasNumber = /^\d/.test(b.address ?? '');
    const displayName = b.name
      ? `${b.name} — ${b.address ?? ''}`
      : b.address ?? b.osm_id;

    if (hasNumber) {
      numbered.push({
        osm_id: b.osm_id,
        label: displayName,
        matched_osm_id: b.osm_id,
      });
    } else {
      const street = b.address ?? 'Unknown';
      const existing = unnumbered.get(street);
      if (existing) {
        existing.count++;
      } else {
        unnumbered.set(street, { osm_id: b.osm_id, count: 1 });
      }
    }
  }

  const results: LocalSearchResult[] = [
    // Numbered houses first — up to 8
    ...numbered.slice(0, 8),
    // Then collapsed street entries — up to 4
    ...Array.from(unnumbered.entries()).slice(0, 4).map(([street, { osm_id, count }]) => ({
      osm_id,
      label: street,
      sublabel: count > 1 ? `${count} buildings in dataset` : undefined,
      matched_osm_id: osm_id,
      count,
    })),
  ].slice(0, 10);

  return NextResponse.json(results);
}
