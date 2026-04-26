import { getSunPosition } from './sunPosition';
import type { SunExposure } from '@/types/Venue';

export function calculateSunExposure(
  aspectDeg: number,
  meanRadiation: number,
  date: Date = new Date()
): { score: number; exposure: SunExposure } {
  const sun = getSunPosition(date);

  if (!sun.isAboveHorizon || sun.altitude < 10) {
    return { score: 0, exposure: 'shade' };
  }

  // Angular difference between sun azimuth and building aspect
  let diff = Math.abs(sun.azimuth - aspectDeg);
  if (diff > 180) diff = 360 - diff;

  // Within 60° of facing the sun → exposed
  const azimuthScore = Math.max(0, 1 - diff / 60);

  // Radiation quality factor — normalise against Belfast dataset typical range
  // ~400k Wh/m² annual = very good, ~200k = poor
  const radScore = Math.min(1, Math.max(0, (meanRadiation - 200_000) / 200_000));

  const score = azimuthScore * 0.7 + radScore * 0.3;

  let exposure: SunExposure;
  if (score > 0.6) exposure = 'full';
  else if (score > 0.2) exposure = 'partial';
  else exposure = 'shade';

  return { score: Math.round(score * 100), exposure };
}
