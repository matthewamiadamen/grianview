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

function aspectScore(deg: number, slope: number): number {
  // Softer penalty curve — mean aspect on a gabled roof averages both faces
  // so we don't penalise as hard for deviation from south
  const diff = Math.abs(deg - 180);
  const normalised = diff > 180 ? 360 - diff : diff;
  const base = Math.max(0, 1 - normalised / 200); // gentler than /180

  // Low slope = high uncertainty about which face the mean represents
  // Reduce aspect weight proportionally — flat roofs are aspect-agnostic anyway
  const confidence = Math.min(1, slope / 20);
  return base * confidence + (1 - confidence) * 0.5; // blend toward neutral 0.5
}

function slopeScore(deg: number): number {
  // Optimal 30–40° for Belfast latitude
  if (deg >= 30 && deg <= 40) return 1;
  if (deg < 30) return deg / 30;
  return Math.max(0, 1 - (deg - 40) / 50);
}

function areaScore(m2: number): number {
  if (m2 >= 40) return 1;
  if (m2 >= 25) return 0.7;
  if (m2 >= 15) return 0.45;
  return 0.2;
}

function shadingScore(mean: number): number {
  return Math.min(1, mean / RADIATION_EXCELLENT);
}

export function computeSuitabilityScore(b: BuildingData): number {
  const weighted =
    radScore(b.mean_radiation)        * 0.35 +
    aspectScore(b.aspect_deg, b.slope_deg) * 0.25 +
    slopeScore(b.slope_deg)           * 0.20 +
    areaScore(b.roof_area_m2)    * 0.10 +
    shadingScore(b.mean_radiation) * 0.10;
  return Math.round(weighted * 100);
}

function aspectLabel(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function buildRecommendation(b: BuildingData, score: number, flags: SuitabilityResult['flags']): string {
  if (flags.heritage) {
    return `This building is within a conservation area. Planning permission for visible solar panels may be restricted — contact Belfast City Council before proceeding.`;
  }
  const label = b.name ? `"${b.name}"` : b.address ? b.address.split(',')[0] : 'This building';
  const dir = aspectLabel(b.aspect_deg);
  const slopeNote = b.slope_deg >= 28 && b.slope_deg <= 42
    ? `a well-pitched roof at ${b.slope_deg.toFixed(0)}°`
    : b.slope_deg < 20
    ? `a shallow pitch of ${b.slope_deg.toFixed(0)}° which limits output`
    : `a steep pitch of ${b.slope_deg.toFixed(0)}°`;

  if (score >= 65) {
    const payback = Math.round((b.roof_area_m2 * KWP_PER_M2 * NI_INSTALL_COST_PER_KWP) / (b.elec_prod * 182.5 * NI_ELECTRICITY_RATE));
    return `${label} faces ${dir} with ${slopeNote} — well-suited for solar in Belfast. Estimated payback in ${payback}–${payback + 2} years.`;
  }
  if (score >= 40) {
    return `${label} faces ${dir} with ${slopeNote}. Moderate solar potential — a small system (2–3 kWp) is likely worthwhile, though returns will be below the Belfast average.`;
  }
  return `${label} faces ${dir} with ${slopeNote}. Limited solar potential — the ${aspectLabel(b.aspect_deg)}-facing aspect reduces effective generation for this location.`;
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
