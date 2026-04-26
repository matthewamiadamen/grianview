import type { BuildingData } from './BuildingData';

export type SuitabilityStatus = 'SUITABLE' | 'MODERATELY SUITABLE' | 'NOT SUITABLE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SuitabilityResult {
  status: SuitabilityStatus;
  score: number;
  confidence: ConfidenceLevel;
  building: BuildingData;
  estimated: {
    daily_kwh: number;
    daily_saving_gbp: number;
    annual_kwh: number;
    annual_saving_gbp: number;
    payback_years: number;
    co2_offset_kg_year: number;
  };
  recommendation: string;
  data_period: string;
  flags: {
    heritage: boolean;
    conservation_area: boolean;
    planning_restricted: boolean;
    building_type: string | null;
    roof_material: string | null;
  };
}
