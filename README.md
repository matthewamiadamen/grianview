# GrianView ☀️
### Belfast's Solar Intelligence Platform
*"Grían" (Irish): Sun*

Built for **HackBelfast** in response to the *Belfast 2036* problem statement.

---

## What Is GrianView?

GrianView turns Belfast's unused LiDAR survey data into something any resident can use in thirty seconds: type your address, see your building in 3D, and find out whether solar panels are worth it.

Beneath the solar tool sits a second feature — **Sunny & Social** — which uses the same solar dataset combined with real-time astronomical calculation to tell you which bars and cafés in Belfast are catching the most sun right now.

---

## The Dataset

**52,872 buildings** across Belfast, each with:

| Field | Source |
|---|---|
| Mean solar radiation (kWh/m²/day) | ArcGIS Area Solar Radiation tool applied to Belfast DSM |
| Roof aspect (°) | Mean aspect derived from LiDAR surface model |
| Roof slope (°) | Mean slope derived from LiDAR surface model |
| Roof elevation (m) | Mean elevation from DSM |
| Usable solar radiation (kWh) | Computed from radiation raster × roof area |
| Electricity production estimate (kWh) | Panel efficiency model applied to usable radiation |
| Building footprint area (m²) | Microsoft Building Footprints / OSM polygons |
| OSM ID | Links to OpenStreetMap for geometry + address enrichment |

Data period: **April 24–25, 2025** — two consecutive clear days captured from the LiDAR-derived radiation model.

---

## Features

### 1 — Solar Suitability Checker

Type any Belfast address. The app:

1. Searches 52,872 buildings instantly via an in-memory CSV index
2. Fetches the real building polygon geometry from the OpenStreetMap Overpass API
3. Renders a **3D model** of the building — walls extruded from the actual footprint polygon, roof type inferred from footprint shape and slope data, oriented correctly to compass north
4. Scores the building on five factors:

| Factor | Weight |
|---|---|
| Annual solar radiation | 35% |
| Roof aspect (south = best) | 25% |
| Roof pitch (30–40° optimal) | 20% |
| Roof area | 10% |
| Shading relative to baseline | 10% |

5. Returns estimated annual generation, saving, payback period and CO₂ offset
6. Checks Historic Environment NI for listed building / conservation area status

**Note on aspect and slope:** Both are derived from the mean surface values of the LiDAR raster across the full roof polygon. On gabled roofs this averages both faces. The suitability score applies a confidence weighting to the aspect factor based on slope — low slope readings reduce aspect weight, since a near-flat mean slope may indicate a symmetric gabled roof rather than a truly flat surface.

### 2 — Sunny & Social

*"Where in Belfast is sunny right now?"*

Uses **SunCalc.js** to compute the sun's current azimuth and altitude for Belfast (54.597°N, 5.930°W) at any given timestamp. Each venue is scored by the angular relationship between the sun's bearing and the building's aspect angle.

- A time slider lets users scrub through the full day (00:00–23:59) and watch venues re-rank in real time as the sun moves
- East-facing venues peak in the morning, south-facing venues at midday, west-facing venues in the evening — driven entirely by spherical trigonometry, not pre-programmed rankings
- Sunrise and sunset for Belfast are shown as markers on the slider track

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GRIANVIEW FRONTEND                   │
│                   (Next.js 14 / React)                  │
│                                                         │
│  Left sidebar      Map (Mapbox GL)     Right panel      │
│  ─────────────     ───────────────     ─────────────    │
│  Previously        Radiation           3D renderer      │
│  selected          heatmap overlay     (Three.js)       │
│  buildings         Belfast boundary    Score + data     │
│                    Selected polygon    Recommendation   │
│                    (radiation colour)                   │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       CSV index     Overpass API   SunCalc.js
       (52k rows,    (geometry +    (sun position
        in-memory)    tags)          astronomy)
```

### API Routes

| Route | Purpose |
|---|---|
| `GET /api/search?q=` | Instant local CSV search — no external API |
| `GET /api/building/[osmId]` | Full suitability result + Overpass geometry |
| `GET /api/building/near?lat=&lng=` | Nearest dataset building to map click coordinates |
| `GET /api/sunnynow` | Venue list with SunCalc exposure scores |
| `GET /api/enrich/[osmId]` | OSM tags + heritage flags |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Map | Mapbox GL JS |
| 3D rendering | Three.js (vanilla — no React Three Fiber) |
| Solar astronomy | SunCalc.js |
| Heatmap generation | Custom IDW interpolation script → Mapbox circle layer |
| Address search | In-memory CSV index (instant, no external API) |
| Building geometry | OSM Overpass API |
| Heritage data | Historic Environment NI |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Fonts | DM Sans + DM Mono |
| Deployment | Vercel |

---

## Project Structure

```
grianview/
├── app/
│   ├── page.tsx                         # Main layout + state
│   ├── layout.tsx
│   └── api/
│       ├── building/[osmId]/route.ts    # Suitability result + geometry
│       ├── building/near/route.ts       # Nearest building to click
│       ├── search/route.ts              # Local CSV search
│       ├── sunnynow/route.ts            # Sunny & Social endpoint
│       └── enrich/[osmId]/route.ts      # OSM + heritage enrichment
├── components/
│   ├── Map/BelfastMap.tsx               # Mapbox GL + heatmap + polygon
│   ├── Panel/
│   │   ├── SuitabilityPanel.tsx         # Main right panel
│   │   ├── BuildingRenderer.tsx         # Three.js 3D building render
│   │   ├── ScoreGauge.tsx
│   │   └── DataRow.tsx
│   ├── SunnySideUp/
│   │   ├── SunnyPanel.tsx               # Time slider + venue list
│   │   └── VenueCard.tsx
│   └── Search/AddressSearch.tsx         # Instant local search
├── lib/
│   ├── data/
│   │   ├── csvLoader.ts                 # Parses + indexes CSV at startup
│   │   └── buildingLookup.ts
│   ├── solar/
│   │   ├── suitabilityScore.ts          # 5-factor weighted scorer
│   │   ├── sunPosition.ts               # SunCalc wrapper
│   │   ├── sunExposure.ts               # Real-time venue exposure
│   │   └── venueData.ts                 # Curated Belfast venues
│   └── api/
│       ├── overpass.ts                  # Geometry + tag fetching
│       ├── nominatim.ts
│       └── heritage.ts
├── data/
│   └── belfast_buildings.csv            # 52,872 building dataset
├── public/
│   ├── belfast-heatmap.geojson          # IDW radiation heatmap (9,820 pts)
│   └── belfast-bounds.geojson           # Belfast city boundary
├── scripts/
│   └── generate-heatmap.mjs             # Heatmap point generation
└── types/
    ├── BuildingData.ts
    ├── SuitabilityResult.ts
    └── Venue.ts
```

---

## Setup

```bash
git clone https://github.com/matthewamiadamen/grianview.git
cd grianview
npm install

# Add Mapbox token
echo "NEXT_PUBLIC_MAPBOX_TOKEN=your_token" > .env.local

npm run dev
```

No database required. The CSV is loaded into memory at server startup and indexed by OSM ID. For 52,872 rows this is under 200ms startup and under 80MB memory.

---

## Belfast-Specific Design Decisions

- Map hard-locked to Belfast bounding box `[[-6.1, 54.5], [-5.7, 54.75]]`
- All SunCalc calls use `lat: 54.597, lng: -5.930` (Belfast city centre)
- Radiation scoring thresholds derived from the dataset's own distribution — median 2.56 kWh/m²/day is the colour scale midpoint
- Heatmap control points calibrated to Belfast's actual geography: Cave Hill and Black Mountain shadow zones, open south-facing suburban areas, Titanic Quarter flatlands
- No generic fallbacks — if a building has no data, the app says so

---

*GrianView — Built for Belfast. Powered by Belfast's own light.*
