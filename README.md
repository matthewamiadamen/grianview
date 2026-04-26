# GrianView ☀️
### Belfast's Solar Intelligence Platform
*"Grían" (Irish): Sun*

---

## What Is GrianView?

GrianView is a civic web application built for Belfast — and only Belfast. It turns years of LiDAR survey data, solar radiation modelling, and rooftop geometry analysis into something any resident can use in thirty seconds: point at your house, find out if solar panels are worth it.

But GrianView is also something else. Beneath the solar suitability tool sits a second, live feature — **Sunny Side Up** — which uses the same underlying solar dataset to tell you, right now, which bars, cafés, and public buildings in the city are catching the most sun. It is a solar tool built for people who want a good afternoon pint as much as for people who want to cut their energy bill.

Both features run from the same data engine. The same rooftop radiation values that tell you your house gets 4.2 peak sun hours a day also tell you that the beer garden on Botanic Avenue is currently in full sun and the one on Great Victoria Street is in shade. One dataset. Two very different — and very Belfast — use cases.

This project was built for **HackBelfast**, in response to the *Belfast 2036* problem statement. The gap it addresses is specific: Belfast has extraordinary, unused LiDAR and solar radiation data that sits in government and research systems, inaccessible to the people it could most benefit. GrianView closes that gap.

---

## The Problem GrianView Solves

Belfast has ambitious climate targets. Solar adoption in Northern Ireland is among the lowest in the UK. The barrier is rarely cost alone — it is information. Homeowners do not know whether their roof faces the right direction, whether a nearby tree or chimney blocks their afternoon sun, or whether their roof pitch is too shallow to be effective. That information exists in the data. GrianView makes it usable.

At the same time, Belfast is a city built for outdoor socialising when the weather allows it. "Where is sunny right now?" is a real question people ask, and nobody has a good answer that is grounded in actual solar geometry rather than a quick look out the window.

GrianView answers both.

---

## The Data: How the Map Was Built (Layer by Layer)

This is the most important section to understand, because GrianView is not a wrapper around a generic solar API. Every value in the system comes from Belfast-specific data, processed through a deliberate pipeline of spatial layers. Here is how those layers were built, in order.

### Layer 1 — The LiDAR Surface Model (DSM)
**Source:** `Belfast_2006_DSM.tif` — a Digital Surface Model covering the Belfast city area, captured via airborne LiDAR survey.

The DSM is a raster file where every pixel represents the elevation of the highest surface at that point. Buildings appear as raised areas above the ground. This is the foundation of everything. Without an accurate surface model, you cannot calculate how a roof sits in space, where shadows fall, or how radiation strikes a surface.

### Layer 2 — Building Footprint Isolation (Shapefiles)
**Source:** Microsoft Building Footprints for Belfast, sourced from `data.nextgis.com` (region: `GB-CITY-014`).

Each building in Belfast is represented as a polygon in a shapefile. The research team used these polygons to clip the DSM — isolating the portion of the surface model that belongs to each individual building. This is the step that turns a city-wide elevation map into 116,000 individual rooftop patches.

Each building polygon carries an **OSM ID** (OpenStreetMap identifier). For buildings that have a corresponding OSM entry, this ID links to address data, building type (residential, commercial, pub, etc.), and other metadata. This OSM ID is the primary key that connects the geometry pipeline to the address lookup system.

### Layer 3 — Rooftop Geometry Derivation
**Derived from:** The clipped DSM per building.

From the isolated rooftop surface of each building, three geometric properties are calculated using standard raster analysis (ArcGIS / GDAL):

- **Slope (Tilt):** The angle of the roof surface from horizontal, in degrees. Optimal solar panel installation is typically 30–40° in Belfast's latitude.
- **Aspect:** The compass direction the roof surface faces (0° = North, 180° = South). South-facing aspects (135°–225°) receive the most annual solar radiation in the Northern Hemisphere.
- **Gradient:** The rate of elevation change across the rooftop. Used alongside slope to characterise roof geometry and flag unusually complex or fragmented roof surfaces.

### Layer 4 — Solar Radiation Raster (ArcGIS Solar Radiation Tool)
**Source:** ArcGIS Area Solar Radiation tool, applied to the Belfast DSM.

This is the computationally expensive step. The ArcGIS solar radiation model calculates, for every pixel of the surface model, how much solar energy (in Watt-hours per square metre, Wh/m²) that surface receives over a defined period — accounting for:

- **Direct radiation:** Sunlight hitting the surface directly from the sun's position.
- **Diffuse radiation:** Scattered skylight reaching the surface even when the sun is not directly visible.
- **Time of year:** Sun angle changes through the year at Belfast's latitude (54.6°N). The model integrates across the full year or a target day.
- **Local shading:** The DSM itself provides the shading geometry — a tall building or hill that casts a shadow on a neighbouring rooftop is captured automatically because the obstructing surface is present in the elevation model.

The output is a radiation raster: a pixel-by-pixel map of annual solar energy received across Belfast, in Wh/m².

### Layer 5 — Per-Building Aggregation (The CSV)
The radiation raster and the derived geometry values are combined using the building footprint polygons as the aggregation unit. For each of the ~116,000 buildings:

- The radiation raster pixels within the building polygon are summarised (mean, total).
- The slope, aspect, and gradient values are extracted.
- The OSM ID and any available address metadata are joined.

The result is a flat CSV (or GeoJSON) where each row is one building, and the columns are every solar-relevant value for that building. This is the dataset GrianView queries.

**Example row structure:**
```
osm_id, address, lat, lng, mean_radiation_wh_m2, total_wh_day, slope_deg, aspect_deg, gradient, roof_area_m2, building_type, ...
```

### Layer 6 — External Data Enrichment (APIs)
Several fields that the LiDAR pipeline does not provide are fetched at query time from external APIs:

- **Building type and material:** Queried from the OpenStreetMap Overpass API using the building's OSM ID. Returns tags such as `building=residential`, `building=pub`, `roof:material=slate`, `roof:shape=gabled`. Where OSM tags are absent, the building type from the NextGIS Microsoft Buildings dataset is used as a fallback.
- **Heritage / Planning restrictions:** Queried from the [Historic Environment Division NI API](https://www.communities-ni.gov.uk/topics/historic-environment) and/or the LPS (Land & Property Services NI) planning dataset. Buildings within listed status or conservation areas are flagged.
- **Address fuzzy resolution:** Nominatim (OpenStreetMap's geocoding service) converts free-text address input into coordinates and, where available, an OSM ID — enabling a direct join into the dataset without requiring exact address formatting.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GRIANVIEW FRONTEND                   │
│                   (Next.js / React)                     │
│                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Address    │   │  Mapbox GL   │   │  Results    │  │
│  │  Search Bar │   │  JS Map      │   │  Side Panel │  │
│  │  (Nominatim)│   │  (Building   │   │  + Sunny    │  │
│  │             │   │   Layer)     │   │  Side Up    │  │
│  └──────┬──────┘   └──────┬───────┘   └──────┬──────┘  │
│         └────────────┬────┘                  │         │
│                      ▼                        │         │
│              Building Selected                │         │
│              (OSM ID / coords)                │         │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   NEXT.JS API ROUTES                    │
│                                                         │
│  /api/building/[osmId]     → Solar suitability lookup  │
│  /api/search               → Nominatim proxy           │
│  /api/sunnynow             → Real-time sun angle +     │
│                              venue ranking             │
│  /api/enrich/[osmId]       → OSM Overpass + heritage   │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
   ┌─────────────┐ ┌────────┐  ┌────────────────┐
   │  Belfast    │ │  OSM   │  │  Solar Position│
   │  CSV/GeoJSON│ │ Overpass│  │  Calculator    │
   │  Dataset    │ │  API   │  │  (SunCalc.js)  │
   │  (local)    │ └────────┘  └────────────────┘
   └─────────────┘
```

---

## Feature 1 — Solar Suitability Checker

### User Flow

1. User lands on GrianView. They see a dark-mode map of Belfast with all ~116,000 buildings rendered as polygons, colour-coded by solar radiation (cool blue = low, amber/gold = high).
2. They type an address into the search bar — fuzzy matching, Belfast-aware. Nominatim resolves it to coordinates + OSM ID.
3. The matched building highlights on the map. A side panel slides open.
4. The panel shows the full suitability report for that building.

### The Suitability Report

Every report contains the following sections, all derived from real dataset values:

**Status Banner**
- `SUITABLE` / `MODERATELY SUITABLE` / `NOT SUITABLE`
- Colour-coded. Animated on load.

**Score (0–100)**
Calculated from a weighted combination of:
| Factor | Weight | Source |
|---|---|---|
| Annual solar radiation (Wh/m²) | 35% | Radiation raster |
| Roof aspect (south-facing = best) | 25% | DSM-derived aspect |
| Roof tilt (30–40° optimal) | 20% | DSM-derived slope |
| Roof area (minimum viable ~20m²) | 10% | Building footprint |
| Shading penalty | 10% | Radiation raster (relative to unobstructed baseline) |

**Confidence Level**
- `HIGH` — building has OSM ID, full address, complete dataset row
- `MEDIUM` — building matched by coordinates, partial data
- `LOW` — building polygon found but data fields incomplete

**Key Data Points (raw values displayed)**
- Annual radiation: `X Wh/m²/year`
- Daily radiation (today): `X Wh/m²`
- Roof tilt: `X°`
- Roof aspect: `X° (SW-facing)`
- Estimated roof area: `Xm²`
- Building type: `Residential / Commercial / Listed`

**Estimated Solar Potential**
- Estimated annual generation: `X kWh/year` (derived from radiation × assumed panel efficiency × usable roof area)
- Estimated annual saving: `£X` (using current NI average electricity rate)
- Estimated payback period: `X years` (using average NI installation cost per kWp)
- Estimated CO₂ offset: `X kg/year`

**Recommendation**
A 2–3 sentence plain-English summary. Examples:
- *"Your roof receives strong annual solar radiation and faces south-southwest, making it well-suited for a 4kWp system. Estimated payback in 7–9 years."*
- *"Your roof has good radiation but a north-east aspect significantly reduces effective generation. A smaller system on the rear roof may be more viable."*
- *"This building is within a conservation area. Planning permission for visible solar panels may be restricted — contact Belfast City Council before proceeding."*

**External Data Flags** *(fetched at query time)*
- Heritage / conservation area status (Historic Environment NI API)
- OSM building type and roof material (Overpass API)
- Planning restriction flag (LPS NI)

### API Integration Points

The following section of the codebase is deliberately separated and clearly marked for replacement with the team's real dataset endpoint:

```javascript
// ============================================================
// DATA INTEGRATION POINT — REPLACE WITH REAL DATASET ENDPOINT
// File: /lib/data/buildingLookup.js
//
// Currently reads from: /data/belfast_buildings.csv (local)
// Replace with: your hosted API, PostGIS query, or tile server
// Expected response shape: see /types/BuildingData.ts
// ============================================================
```

---

## Feature 2 — Sunny Side Up 🍺

*"Where in Belfast is sunny right now?"*

### Concept

Sunny Side Up is a real-time mode within GrianView that answers a simple question: given the current time and date, which bars, beer gardens, cafés, and public spaces in Belfast are currently receiving direct sunlight?

This is not a weather API feature. It uses the same rooftop radiation and aspect data that powers the suitability checker, combined with real-time solar position geometry, to calculate which building faces are lit and which are in shade at this exact moment.

### How It Works

**Step 1 — Filter the dataset to public venues**

The Belfast CSV is filtered to buildings where the OSM tag `building` is one of: `pub`, `bar`, `cafe`, `restaurant`, `hotel`, `community_centre`, `public_building`. This gives a subset of publicly accessible venues.

**Step 2 — Calculate current solar position**

Using [SunCalc.js](https://github.com/mourner/suncalc), the app computes the sun's current **azimuth** (compass bearing from Belfast, 54.6°N 5.93°W) and **altitude** (angle above horizon) for the current timestamp. This requires no API — it is pure astronomical calculation.

**Step 3 — Score each venue for current sun exposure**

For each venue in the subset:
- Compare the sun's current azimuth to the building's **aspect** (roof/facade facing direction).
- Check the sun's **altitude** against the building's known shading profile (derived from the radiation raster — a building that scores poorly in the annual radiation model is likely obstructed).
- A venue is marked **Currently Sunny** if the sun azimuth falls within ±60° of the building's aspect AND the sun altitude is above 10° (i.e. it is actually daytime and the sun is meaningfully above the horizon).

**Step 4 — Rank and display**

Venues are ranked by a composite of:
- Current sun exposure score
- Annual radiation score (a proxy for "generally sunny location")

The top results are shown in a card list alongside the map, with the sunniest venues highlighted in gold on the map layer.

### What the User Sees

- A toggle in the top nav: **☀️ Sunny Side Up**
- The map shifts to highlight venue polygons, coloured gold → grey by current sun exposure.
- A side panel shows a ranked list: venue name, address, current sun score, and a plain-English tag: `Full Sun`, `Partial Sun`, `In Shade`.
- Cards include OSM-sourced info: opening hours (where available), venue type.
- A subtle clock display shows the current time and sun position for Belfast.
- If it is after sunset or before sunrise, the panel shows a friendly message: *"The sun has set over Belfast — check back tomorrow, or use the time slider to preview tomorrow morning."*

### Time Slider (Optional / Stretch)

A draggable time slider lets the user scrub forward/backward through the day (00:00–23:59) and see the sun exposure scores update in real time. This uses the same SunCalc calculation but with a user-supplied timestamp. Useful for planning an afternoon out.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | Server components for data fetching, API routes for backend logic |
| Map rendering | Mapbox GL JS | Handles 116k building polygons as vector tiles efficiently |
| Building data | Local CSV → loaded into in-memory lookup at startup | Fast, no database needed for hackathon |
| Address search | Nominatim (OSM geocoding) | Free, Belfast-aware, returns OSM IDs |
| Solar position | SunCalc.js | Accurate astronomical calculation, no API needed |
| External enrichment | OSM Overpass API | Building type, roof material, opening hours |
| Heritage data | Historic Environment NI / LPS NI | Planning restriction flags |
| Styling | Tailwind CSS + custom CSS variables | Fast development, consistent design tokens |
| Animation | Framer Motion | Panel transitions, score counters, map highlights |
| Deployment | Vercel | Zero-config Next.js deployment |

---

## Project Structure

```
grianview/
├── app/
│   ├── page.tsx                    # Main map view
│   ├── layout.tsx                  # Root layout, fonts, metadata
│   └── api/
│       ├── building/[osmId]/       # Solar data for one building
│       │   └── route.ts
│       ├── search/                 # Nominatim proxy
│       │   └── route.ts
│       ├── sunnynow/               # Sunny Side Up endpoint
│       │   └── route.ts
│       └── enrich/[osmId]/         # OSM + heritage enrichment
│           └── route.ts
├── components/
│   ├── Map/
│   │   ├── BelfastMap.tsx          # Mapbox GL wrapper
│   │   ├── BuildingLayer.tsx       # 116k building polygons
│   │   └── SunnyLayer.tsx          # Sunny Side Up overlay
│   ├── Panel/
│   │   ├── SuitabilityPanel.tsx    # Solar report side panel
│   │   ├── ScoreGauge.tsx          # Animated score display
│   │   └── DataRow.tsx             # Raw data point display
│   ├── SunnySideUp/
│   │   ├── SunnyPanel.tsx          # Venue list panel
│   │   ├── VenueCard.tsx           # Individual venue card
│   │   └── SunClock.tsx            # Real-time sun position display
│   └── Search/
│       └── AddressSearch.tsx       # Fuzzy address input
├── lib/
│   ├── data/
│   │   ├── buildingLookup.ts       # ← DATA INTEGRATION POINT
│   │   ├── venueFilter.ts          # Filter CSV to public venues
│   │   └── csvLoader.ts            # Parse and index Belfast CSV
│   ├── solar/
│   │   ├── suitabilityScore.ts     # Scoring algorithm
│   │   ├── sunPosition.ts          # SunCalc wrapper
│   │   └── sunExposure.ts          # Real-time exposure calculation
│   └── api/
│       ├── nominatim.ts            # Address → coords → OSM ID
│       ├── overpass.ts             # OSM building enrichment
│       └── heritage.ts             # Historic Environment NI
├── data/
│   └── belfast_buildings.csv       # ← REPLACE WITH REAL DATASET
├── types/
│   ├── BuildingData.ts             # Full building data shape
│   ├── SuitabilityResult.ts        # Report output shape
│   └── Venue.ts                    # Sunny Side Up venue shape
├── public/
│   └── belfast-bounds.geojson      # Belfast city boundary
└── README.md
```

---

## Data Integration Guide

When the Belfast CSV is ready, drop it into `/data/belfast_buildings.csv`. The expected column schema is:

```typescript
// types/BuildingData.ts
export interface BuildingData {
  osm_id: string;                   // Primary key — links to Nominatim + OSM
  lat: number;
  lng: number;
  address?: string;                 // From NextGIS/OSM, may be absent
  mean_radiation_wh_m2: number;     // Annual mean from radiation raster
  total_wh_day: number;             // Representative daily total (Wh)
  slope_deg: number;                // Roof tilt in degrees
  aspect_deg: number;               // Roof facing direction (0–360)
  gradient: number;                 // Rate of elevation change
  roof_area_m2: number;             // Derived from building polygon area
  building_type?: string;           // From OSM tags (pub, residential, etc.)
  roof_material?: string;           // From OSM tags if available
}
```

If column names differ from the above, update the mapping in `/lib/data/csvLoader.ts` — there is a clearly marked `COLUMN_MAP` object at the top of that file.

---

## Belfast-Specific Design Decisions

- **Bounding box hard-locked to Belfast:** The map will not pan outside `[[-6.1, 54.5], [-5.7, 54.75]]`. This is intentional — GrianView is a Belfast tool, not a generic solar checker.
- **Nominatim queries are scoped:** Every address search appends `, Belfast, Northern Ireland` to the query to avoid false matches elsewhere in the UK.
- **Solar calculations use Belfast coordinates:** SunCalc is always called with `lat: 54.597, lng: -5.930`.
- **Radiation baseline is Belfast-calibrated:** The scoring algorithm's "excellent / good / poor" radiation thresholds are derived from the distribution of values within the Belfast dataset itself, not generic UK averages.
- **No generic fallbacks:** If a building has no data in the CSV, the app says so honestly rather than falling back to a national average or estimated value.

---

## Design Language

GrianView uses a clean, light, professional aesthetic modelled on civic data tools like **CrystalRoof** and **Rightmove** — not a "dark hacker" or "green startup" look. The data is serious; the interface should feel like a trusted local authority tool.

### Tone reference
- **CrystalRoof:** White surfaces, strong typographic hierarchy, data presented in compact labelled rows, professional-utilitarian without being cold.
- **Rightmove:** Clean white cards with crisp 1px borders, bold price/headline value, muted metadata text beneath, functional density without clutter.

### Colours
```
Background page:     #f7f7f5  (warm off-white — never pure white)
Panel / card:        #ffffff  with border: 1px solid #e2e1dc
Border strong:       #c8c7c2  (hover states, emphasis)
Text primary:        #1a1a18
Text secondary:      #5a5a55
Text muted:          #8a8a84
Amber accent:        #d97706  ← solar data ONLY — not decoration
Amber light fill:    #fef3c7  (Sunny Side Up backgrounds, warnings)
Green suitable:      #15803d  + fill #dcfce7
Red not suitable:    #dc2626  + fill #fee2e2
Blue confidence:     #1d4ed8  + fill #dbeafe
```

**Rule:** Amber is used exclusively where it means "sunlight" or "caution". It is never used as a general brand colour or button colour.

### Typography
```
Primary font:   DM Sans (weights: 300, 400, 500, 600)
Mono font:      DM Mono — used for ALL numeric data values, OSM IDs, coordinates
Fallback:       system-ui, sans-serif
```

- Navigation: 15px / weight 600, letter-spacing -0.3px
- Body / labels: 13–14px / weight 400
- Data values: 12px DM Mono / weight 500
- Section headers: 11px / uppercase / letter-spacing 0.5px / color muted
- Score number: 22px DM Mono / weight 600

**No Inter. No Roboto. No generic system fonts in headings.**

### Layout
```
Nav bar:              52px fixed height
Search bar:           64px fixed height
Main area:            remainder of viewport height, split:
  └── Map:            flex: 1 (fills remaining width)
  └── Panel:          340px fixed, right side, white, border-left
```

The panel is a **right-side fixed drawer**, never a bottom sheet on desktop. On mobile (<768px) it becomes a bottom sheet that slides up.

### Component patterns

**Nav:** Logo left (sun dot + wordmark) | Links centre | Map/List toggle right. Single 1px bottom border. No shadow.

**Search bar:** Full-width search input with left-aligned magnifier icon | "Check" button (dark fill, white text) | "☀ Sunny Side Up" button (amber-light fill, amber text, amber border).

**Status banner:** Full-width within panel, rounded 6px, coloured background (green/amber/red light) with 1px matching border. Tag text uppercase small-caps left, score number mono right.

**Data rows:** Key (text-secondary) left-aligned, value (DM Mono, text-primary or coloured) right-aligned, 1px border-bottom between rows, 9px vertical padding, 20px horizontal padding.

**Est. cards:** 2×2 grid, off-white background, 1px border, 6px radius. Muted 11px label above, 16px mono value below, 10px sub-label beneath.

**Venue cards (Sunny Side Up):** Rank number (mono, muted) | 8px coloured dot (full/partial/shade) | Venue name + address + tag pill | Wh reading mono right-aligned.

**Recommendation box:** Off-white background, 1px border, amber 3px left-border accent, 13px regular text, 1.6 line-height.

### Map style
- **Mapbox style:** `mapbox://styles/mapbox/light-v11` — NOT dark. Buildings are rendered on a cream/light-grey base.
- Buildings coloured by radiation value: cool blue (`#7AAED4`) for low, amber/gold (`#EF9F27`) for high. A gradient legend sits bottom-left of the map.
- Selected building: 2.5px dark stroke highlight + white outer glow ring.
- Layer pills (bottom-right of map): `Radiation | Aspect | Suitability` — pill shape, border, dark active state.

### Motion
- Panel slides in from right on building select (200ms ease-out).
- Score counter counts up from 0 on panel open (600ms).
- Selected building pulses once (single 300ms scale pulse) — no continuous animation.
- Sunny Side Up tab: amber dot next to venue name fades in staggered (50ms delay per card).
- Nothing animates on scroll. No parallax. No looping animations.

### Voice
The app speaks like a knowledgeable Belfast local, not a corporate energy consultant.

✓ *"Your roof is south-west facing — near ideal for Belfast."*
✗ *"Optimal azimuthal alignment detected for maximum photovoltaic yield."*

✓ *"Lavery's is currently in full sun."*
✗ *"Solar exposure index: HIGH. Recommend this venue."*

---

## Hackathon Framing

GrianView was not built to process data. It was built because Belfast residents deserve to know whether their home can generate clean energy, and because nobody should have to phone a solar installer just to find out their roof faces the wrong way.

The data pipeline is real. The 116,000 buildings are real. The radiation values are real. GrianView is the interface that makes that real data useful to real people.

The Sunny Side Up feature exists because the same data that answers serious questions about energy infrastructure also answers a very human question: *where should we go for a drink in the sunshine?* Both questions matter. Both are Belfast.

---

## Setup Instructions (for Claude Code)

```bash
# 1. Clone and install
git clone <repo>
cd grianview
npm install

# 2. Environment variables
cp .env.example .env.local
# Add: NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# 3. Add dataset
cp /path/to/belfast_buildings.csv ./data/belfast_buildings.csv

# 4. Run development server
npm run dev
```

**No database required.** The CSV is loaded into memory at server startup and indexed by OSM ID using a plain JavaScript Map. For 116k rows this is comfortably under 100ms startup time and under 50MB memory.

---

*GrianView — Built for Belfast. Powered by Belfast's own light.*