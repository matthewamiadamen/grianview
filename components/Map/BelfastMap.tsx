'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Venue } from '@/types/Venue';

const BELFAST_CENTER: [number, number] = [-5.930, 54.597];
const BELFAST_BOUNDS: [[number, number], [number, number]] = [[-6.1, 54.5], [-5.7, 54.75]];

interface SelectedBuilding {
  osm_id: string;
  lat: number;
  lng: number;
  polygon: GeoJSON.Polygon | null;
  radiation: number;
}

interface BelfastMapProps {
  selectedBuilding: SelectedBuilding | null;
  sunnyVenues: Venue[];
  selectedVenue: Venue | null;
  sunnyMode: boolean;
  onBuildingClick?: (osmId: string) => void;
}

function radiationColor(mean: number): string {
  // Dataset-calibrated scale so the median value (2.56 kWh/m²/day) sits at t=0.5
  // and exactly half the buildings fall blue, half amber.
  // Stops: #2563EB (blue) → #FCD34D (yellow) → #F97316 (amber)
  // Piecewise: below-median range 1.6–2.56, above-median range 2.56–3.6
  const MEDIAN = 2.56;
  const LOW    = 1.6;
  const HIGH   = 3.6;

  let t: number;
  if (mean <= MEDIAN) {
    t = 0.5 * Math.max(0, (mean - LOW) / (MEDIAN - LOW));
  } else {
    t = 0.5 + 0.5 * Math.min(1, (mean - MEDIAN) / (HIGH - MEDIAN));
  }

  let r: number, g: number, b: number;
  if (t < 0.5) {
    // #2563EB → #FCD34D
    const s = t * 2;
    r = Math.round(37  + s * (252 - 37));
    g = Math.round(99  + s * (211 - 99));
    b = Math.round(235 + s * (77  - 235));
  } else {
    // #FCD34D → #F97316
    const s = (t - 0.5) * 2;
    r = Math.round(252 + s * (249 - 252));
    g = Math.round(211 + s * (115 - 211));
    b = Math.round(77  + s * (22  - 77));
  }
  return `rgb(${r},${g},${b})`;
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function BelfastMap({
  selectedBuilding,
  sunnyVenues,
  selectedVenue,
  sunnyMode,
  onBuildingClick,
}: BelfastMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onClickRef = useRef(onBuildingClick);
  onClickRef.current = onBuildingClick;

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: BELFAST_CENTER,
      zoom: 13,
      maxBounds: BELFAST_BOUNDS,
    });

    map.on('load', () => {
      // ── Belfast radiation overlay ─────────────────────────────
      // Uses circle layer (NOT heatmap) so colour is driven by the actual
      // radiation value per point, not density. circle-blur smooths the edges.
      map.addSource('belfast-heatmap', {
        type: 'geojson',
        data: '/belfast-heatmap.geojson',
      });
      map.addLayer({
        id: 'radiation-heatmap',
        type: 'circle',
        source: 'belfast-heatmap',
        maxzoom: 14,
        paint: {
          // Colour directly from radiation value — full gradient visible
          'circle-color': [
            'interpolate', ['linear'], ['get', 'r'],
            1.4,  '#93c5fd',   // least sunny (Cave Hill) — soft muted blue
            1.85, '#bfdbfe',   // dense west — pale blue
            2.20, '#fef9c3',   // city centre — near-white cream
            2.56, '#fde68a',   // median — warm yellow
            3.00, '#f59e0b',   // open east / titanic — amber
            3.60, '#ef4444',   // Malone / Belmont — warm red-amber
          ],
          // Large blurred circles overlap neighbours → smooth continuous gradient
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            7,  22,
            10, 38,
            12, 55,
            14, 75,
          ],
          'circle-blur': 1.0,
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            9,  0.72,
            13, 0.60,
            14, 0,
          ],
        },
      });

      // ── Outside-Belfast mask — fades heatmap at boundary edge ─
      map.addSource('belfast-boundary', {
        type: 'geojson',
        data: '/belfast-bounds.geojson',
      });
      // White overlay everywhere EXCEPT inside Belfast (inverted polygon)
      map.addSource('belfast-mask', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              // Outer ring — whole world
              [[-180,-90],[-180,90],[180,90],[180,-90],[-180,-90]],
              // Inner ring (hole) — Belfast boundary cut out
              [[-5.8720,54.6180],[-5.8560,54.6290],[-5.8520,54.6420],
               [-5.8680,54.6580],[-5.8900,54.6650],[-5.9080,54.6700],
               [-5.9300,54.6680],[-5.9520,54.6650],[-5.9680,54.6590],
               [-5.9820,54.6530],[-5.9940,54.6450],[-6.0050,54.6360],
               [-6.0100,54.6220],[-6.0120,54.6080],[-6.0050,54.5960],
               [-5.9980,54.5840],[-5.9900,54.5730],[-5.9800,54.5630],
               [-5.9680,54.5540],[-5.9530,54.5470],[-5.9360,54.5420],
               [-5.9160,54.5390],[-5.8980,54.5410],[-5.8820,54.5480],
               [-5.8680,54.5570],[-5.8580,54.5690],[-5.8520,54.5820],
               [-5.8500,54.5960],[-5.8520,54.6090],[-5.8620,54.6180],
               [-5.8720,54.6180]],
            ],
          },
          properties: {},
        } as GeoJSON.Feature,
      });
      map.addLayer({
        id: 'outside-mask',
        type: 'fill',
        source: 'belfast-mask',
        maxzoom: 14,
        paint: { 'fill-color': '#f7f7f5', 'fill-opacity': 0.82 },
      });

      // ── Boundary dashed outline ───────────────────────────────
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'belfast-boundary',
        paint: {
          'line-color': '#94a3b8',
          'line-width': 1.5,
          'line-dasharray': [4, 3],
          'line-opacity': 0.55,
        },
      });

      // Building polygon fill
      map.addSource('selected-building', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'building-fill',
        type: 'fill',
        source: 'selected-building',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.75,
        },
      });
      map.addLayer({
        id: 'building-outline',
        type: 'line',
        source: 'selected-building',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.5,
        },
      });

      // Sunny venue dots
      map.addSource('venues', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'venue-dots',
        type: 'circle',
        source: 'venues',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 12],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('mouseenter', 'venue-dots', () => { map.getCanvasContainer().classList.add('cursor-pointer'); });
      map.on('mouseleave', 'venue-dots', () => { map.getCanvasContainer().classList.remove('cursor-pointer'); });

      // Click anywhere on the map → find nearest building in dataset
      map.on('click', async (e) => {
        const { lat, lng } = e.lngLat;
        try {
          const res = await fetch(`/api/building/near?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data.osm_id) onClickRef.current?.(data.osm_id);
        } catch {
          // silently ignore network errors on click
        }
      });

      // Show pointer cursor when hovering buildings in the base map style
      map.on('mouseenter', 'building', () => { map.getCanvasContainer().classList.add('cursor-pointer'); });
      map.on('mouseleave', 'building', () => { map.getCanvasContainer().classList.remove('cursor-pointer'); });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update selected building polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const src = map.getSource('selected-building') as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;

      if (!selectedBuilding) {
        src.setData(EMPTY_FC);
        return;
      }

      const color = radiationColor(selectedBuilding.radiation);

      if (selectedBuilding.polygon) {
        src.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: selectedBuilding.polygon, properties: { color } }],
        });
      } else {
        // Fallback: show a circle approximation
        src.setData(EMPTY_FC);
      }

      map.flyTo({ center: [selectedBuilding.lng, selectedBuilding.lat], zoom: 20, duration: 900 });
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [selectedBuilding]);

  // Update sunny venues layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const src = map.getSource('venues') as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;

      if (!sunnyMode || sunnyVenues.length === 0) {
        src.setData(EMPTY_FC);
        return;
      }

      src.setData({
        type: 'FeatureCollection',
        features: sunnyVenues.map((v) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [v.lng, v.lat] },
          properties: {
            osm_id: v.osm_id,
            color: v.exposure === 'full' ? '#d97706' : v.exposure === 'partial' ? '#92400e' : '#8a8a84',
          },
        })),
      });
    };

    if (map.isStyleLoaded()) update();
    else map.once('load', update);
  }, [sunnyMode, sunnyVenues]);

  // Fly to selected venue
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVenue) return;
    map.flyTo({ center: [selectedVenue.lng, selectedVenue.lat], zoom: 17, duration: 700 });
  }, [selectedVenue]);

  const hasToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <div className="flex-1 relative bg-page">
      <div ref={containerRef} className="absolute inset-0" />
      {!hasToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-page/80 z-10">
          <p className="text-[13px] text-text-muted">Set NEXT_PUBLIC_MAPBOX_TOKEN to enable map.</p>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-white border border-border-default rounded-[4px] px-3 py-2 z-10">
        <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted mb-1.5">Solar radiation</p>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #2563EB, #FCD34D, #F97316)' }} />
          <div className="flex justify-between w-20">
            <span className="font-mono text-[10px] text-text-muted">Low</span>
            <span className="font-mono text-[10px] text-text-muted">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
