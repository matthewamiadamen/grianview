import SunCalc from 'suncalc';

const BELFAST_LAT = 54.597;
const BELFAST_LNG = -5.930;

export interface SunPosition {
  azimuth: number;   // degrees from north, 0–360
  altitude: number;  // degrees above horizon
  isAboveHorizon: boolean;
}

export function getSunPosition(date: Date = new Date()): SunPosition {
  const pos = SunCalc.getPosition(date, BELFAST_LAT, BELFAST_LNG);
  // SunCalc returns azimuth in radians from south, convert to degrees from north
  const azimuthDeg = (pos.azimuth * 180 / Math.PI + 180) % 360;
  const altitudeDeg = pos.altitude * 180 / Math.PI;
  return {
    azimuth: azimuthDeg,
    altitude: altitudeDeg,
    isAboveHorizon: altitudeDeg > 0,
  };
}

export function getSunTimes(date: Date = new Date()) {
  return SunCalc.getTimes(date, BELFAST_LAT, BELFAST_LNG);
}
