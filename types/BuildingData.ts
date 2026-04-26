export interface BuildingData {
  osm_id: string;
  osm_type: string;
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
  // Solar metrics (April 24–25 dataset)
  mean_radiation: number;       // kWh/m²/day — mean daily radiation from raster
  usable_sr: number;            // kWh total usable solar radiation on roof (2-day period)
  elec_prod: number;            // kWh electricity production estimate (2-day period)
  roof_area_m2: number;         // m² building footprint
  zone_code: number;
  building_type?: string;
  roof_material?: string;
}

// Geometry returned from Overpass when a building is selected
export interface BuildingGeometry {
  osm_id: string;
  lat: number;
  lng: number;
  polygon: GeoJSON.Polygon | null;
}
