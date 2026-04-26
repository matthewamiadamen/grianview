import type { BuildingData } from '@/types/BuildingData';
import type { SuitabilityResult, SuitabilityStatus, ConfidenceLevel } from '@/types/SuitabilityResult';

// Belfast-calibrated thresholds derived from the April 24–25 dataset distribution
const RADIATION_EXCELLENT = 3.5;  // kWh/m²/day — top ~15% of dataset
const RADIATION_POOR = 1.5;       // kWh/m²/day — bottom ~10%

// NI electricity rate (£/kWh) and install cost
const NI_ELECTRICITY_RATE = 0.28;
const NI_INSTALL_COST_PER_KWP = 1800;
const KWP_PER_M2 = 0.18;        // 18% efficient panels
const CO2_PER_KWH_KG = 0.233;

function radScore(mean: number): number {
  return Math.min(1, Math.max(0, (mean - RADIATION_POOR) / (RADIATION_EXCELLENT - RADIATION_POOR)));
}

function areaScore(m2: number): number {
  if (m2 >= 40) return 1;
  if (m2 >= 25) return 0.7;
  if (m2 >= 15) return 0.45;
  return 0.2;
}

function elecScore(kwh: number, area: number): number {
  // Normalise against expected output for the area at good radiation
  const expected = area * RADIATION_EXCELLENT * KWP_PER_M2;
  return Math.min(1, kwh / expected);
}

export function computeSuitabilityScore(b: BuildingData): number {
  const weighted =
    radScore(b.mean_radiation) * 0.45 +
    areaScore(b.roof_area_m2) * 0.25 +
    elecScore(b.elec_prod, b.roof_area_m2) * 0.30;
  return Math.round(weighted * 100);
}

function buildRecommendation(b: BuildingData, score: number, flags: SuitabilityResult['flags']): string {
  if (flags.heritage) {
    return `This building is within a conservation area. Planning permission for visible solar panels may be restricted — contact Belfast City Council before proceeding.`;
  }
  const label = b.name ? `"${b.name}"` : b.address ? b.address.split(',')[0] : 'This building';
  if (score >= 65) {
    const payback = Math.round((b.roof_area_m2 * KWP_PER_M2 * NI_INSTALL_COST_PER_KWP) / (b.elec_prod * 182.5 * NI_ELECTRICITY_RATE));
    return `${label} receives strong solar radiation for Belfast. Based on today's data, it's generating well. Estimated payback in ${payback}–${payback + 2} years.`;
  }
  if (score >= 40) {
    return `${label} has moderate solar potential. Today's radiation figures suggest a small system (2–3 kWp) would be worthwhile, though returns will be below the Belfast average.`;
  }
  return `${label} has limited solar potential — likely due to shading or a north-facing aspect. Today's radiation is below the Belfast average for this roof.`;
}

export function buildSuitabilityResult(
  building: BuildingData,
  enrichment: { heritage: boolean; conservation: boolean; planning_restricted: boolean; building_type: string | null; roof_material: string | null }
): SuitabilityResult {
  const score = computeSuitabilityScore(building);

  let status: SuitabilityStatus;
  if (score >= 65) status = 'SUITABLE';
  else if (score >= 40) status = 'MODERATELY SUITABLE';
  else status = 'NOT SUITABLE';

  let confidence: ConfidenceLevel;
  if (building.osm_id && building.mean_radiation > 0) confidence = building.address ? 'HIGH' : 'MEDIUM';
  else confidence = 'LOW';

  // elec_prod is for the 2-day measurement window (Apr 24–25) — extrapolate to annual
  const dailyKwh = building.elec_prod / 2;
  const annualKwh = dailyKwh * 365;
  const annualSaving = annualKwh * NI_ELECTRICITY_RATE;
  const systemKwp = building.roof_area_m2 * KWP_PER_M2;
  const installCost = systemKwp * NI_INSTALL_COST_PER_KWP;
  const paybackYears = annualSaving > 0 ? Math.round((installCost / annualSaving) * 10) / 10 : 0;
  const co2Year = annualKwh * CO2_PER_KWH_KG;

  const flags = {
    heritage: enrichment.heritage,
    conservation_area: enrichment.conservation,
    planning_restricted: enrichment.planning_restricted,
    building_type: enrichment.building_type ?? building.building_type ?? null,
    roof_material: enrichment.roof_material ?? building.roof_material ?? null,
  };

  return {
    status,
    score,
    confidence,
    building,
    data_period: 'April 24–25, 2025',
    estimated: {
      daily_kwh: Math.round(dailyKwh * 10) / 10,
      daily_saving_gbp: Math.round(dailyKwh * NI_ELECTRICITY_RATE * 100) / 100,
      annual_kwh: Math.round(annualKwh),
      annual_saving_gbp: Math.round(annualSaving),
      payback_years: paybackYears,
      co2_offset_kg_year: Math.round(co2Year),
    },
    recommendation: buildRecommendation(building, score, flags),
    flags,
  };
}
