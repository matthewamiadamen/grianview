export type SunExposure = 'full' | 'partial' | 'shade';

export interface Venue {
  osm_id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  building_type: string;
  aspect_deg: number;
  mean_radiation_wh_m2: number;
  sun_score: number;
  exposure: SunExposure;
  opening_hours?: string;
}
