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
const OPENAI_MODEL = 'gpt-4o-mini';

type OpenAIResponsesApi = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

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

async function buildLlmRecommendation(
  b: BuildingData,
  score: number,
  status: SuitabilityStatus,
  flags: SuitabilityResult['flags'],
  estimated: SuitabilityResult['estimated']
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[suitability][llm] Missing OPENAI_API_KEY. Using fallback recommendation.');
    return null;
  }

  const label = b.name ? `"${b.name}"` : b.address ? b.address.split(',')[0] : 'This building';
  const prompt = [
    'You are a Belfast solar suitability assistant.',
    'Write one concise recommendation in plain English (max 75 words).',
    'Always include clear reasons based on the supplied values (aspect, slope, radiation, roof area, payback).',
    'If score is below 60, explicitly say this building may not be suitable for solar and explain why.',
    'If score is 60 or above, still include at least two reasons for the recommendation quality.',
    'If heritage/conservation/planning restrictions are true, mention planning checks clearly.',
    'Do not use marketing language. Keep it practical and decision-oriented.',
    `Building: ${label}`,
    `Status: ${status}`,
    `Score: ${score}/100`,
    `Aspect: ${aspectLabel(b.aspect_deg)} (${b.aspect_deg.toFixed(0)} deg)`,
    `Slope: ${b.slope_deg.toFixed(0)} deg`,
    `Roof area: ${b.roof_area_m2.toFixed(1)} m2`,
    `Mean radiation: ${b.mean_radiation.toFixed(2)} kWh/m2/day`,
    `Estimated annual generation: ${estimated.annual_kwh} kWh`,
    `Estimated annual saving: GBP ${estimated.annual_saving_gbp}`,
    `Estimated payback: ${estimated.payback_years} years`,
    `Flags: heritage=${flags.heritage}, conservation_area=${flags.conservation_area}, planning_restricted=${flags.planning_restricted}`,
  ].join('\n');

  try {
    console.log(`[suitability][llm] Requesting recommendation for osm_id=${b.osm_id ?? 'unknown'} score=${score}`);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are a Belfast solar suitability assistant. Provide concise, factual recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_output_tokens: 120,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.log(`[suitability][llm] OpenAI request failed: status=${response.status} body=${errorBody.slice(0, 400)}`);
      return null;
    }

    const data = await response.json() as OpenAIResponsesApi;

    const textFromArray = data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((contentItem) => contentItem.type === 'output_text' || contentItem.type === 'text')
      .map((contentItem) => contentItem.text?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();

    const text = (data.output_text?.trim() || textFromArray || '').trim();

    if (!text) {
      console.log('[suitability][llm] Empty response content from OpenAI. Using fallback recommendation.');
      return null;
    }

    let finalText = text;
    if (score < 60) {
      const lowerText = finalText.toLowerCase();
      const hasCriticalWording =
        lowerText.includes('may not be suitable') ||
        lowerText.includes('not suitable') ||
        lowerText.includes('limited solar potential');
      if (!hasCriticalWording) {
        finalText = `This building may not be suitable for solar. ${finalText}`;
      }
    }

    console.log(`[suitability][llm] LLM recommendation generated successfully (chars=${finalText.length}).`);
    return finalText;
  } catch (error) {
    console.log('[suitability][llm] Error calling OpenAI. Using fallback recommendation.', error);
    return null;
  }
}

export async function buildSuitabilityResult(
  building: BuildingData,
  enrichment: { heritage: boolean; conservation: boolean; planning_restricted: boolean; building_type: string | null; roof_material: string | null }
): Promise<SuitabilityResult> {
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

  const fallbackRecommendation = buildRecommendation(building, score, flags);
  const llmRecommendation = await buildLlmRecommendation(building, score, status, flags, {
    daily_kwh: Math.round(dailyKwh * 10) / 10,
    daily_saving_gbp: Math.round(dailyKwh * NI_ELECTRICITY_RATE * 100) / 100,
    annual_kwh: Math.round(annualKwh),
    annual_saving_gbp: Math.round(annualSaving),
    payback_years: paybackYears,
    co2_offset_kg_year: Math.round(co2Year),
  });

  if (llmRecommendation) {
    console.log(`[suitability][llm] Using LLM recommendation for osm_id=${building.osm_id ?? 'unknown'}.`);
  } else {
    console.log(`[suitability][llm] Using fallback recommendation for osm_id=${building.osm_id ?? 'unknown'}.`);
  }

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
    recommendation: llmRecommendation ?? fallbackRecommendation,
    flags,
  };
}
