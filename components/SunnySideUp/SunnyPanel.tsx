'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SunCalc from 'suncalc';
import { BELFAST_VENUES, type CuratedVenue } from '@/lib/solar/venueData';
import VenueCard from './VenueCard';
import type { Venue, SunExposure } from '@/types/Venue';

const BELFAST_LAT = 54.597;
const BELFAST_LNG = -5.930;

interface ScoredVenue extends CuratedVenue {
  score: number;
  exposure: SunExposure;
  sun_altitude: number;
  sun_azimuth: number;
}

function minutesToDate(minutesFromMidnight: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
  return d;
}

function getSunPositionAt(date: Date) {
  const pos = SunCalc.getPosition(date, BELFAST_LAT, BELFAST_LNG);
  const azimuth = (pos.azimuth * 180 / Math.PI + 180 + 360) % 360;
  const altitude = pos.altitude * 180 / Math.PI;
  return { azimuth, altitude };
}

function getSunTimesAt(date: Date) {
  return SunCalc.getTimes(date, BELFAST_LAT, BELFAST_LNG);
}

function scoreVenue(venue: CuratedVenue, azimuth: number, altitude: number): { score: number; exposure: SunExposure } {
  if (altitude < 4) return { score: 0, exposure: 'shade' };

  // Angular difference between sun and venue aspect (0 = sun directly facing)
  let diff = Math.abs(azimuth - venue.aspect_deg);
  if (diff > 180) diff = 360 - diff;

  // Exposure falls off smoothly beyond 75° off-axis
  const azFactor = Math.max(0, Math.cos((diff / 75) * (Math.PI / 2)));
  // Altitude factor: more sun = higher score
  const altFactor = Math.min(1, altitude / 35);
  // Base radiation quality
  const radFactor = Math.min(1, (venue.base_radiation - 1.5) / 2.5);

  const raw = azFactor * 0.60 + altFactor * 0.25 + radFactor * 0.15;
  const score = Math.round(raw * 100);

  const exposure: SunExposure = score >= 55 ? 'full' : score >= 25 ? 'partial' : 'shade';
  return { score, exposure };
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface SunnyPanelProps {
  visible: boolean;
  onVenueSelect: (venue: Venue | null) => void;
  selectedVenueId: string | null;
}

export default function SunnyPanel({ visible, onVenueSelect, selectedVenueId }: SunnyPanelProps) {
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const [sliderMins, setSliderMins] = useState(nowMins);
  const [isLive, setIsLive] = useState(true);

  // Tick live time every minute
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      const m = new Date().getHours() * 60 + new Date().getMinutes();
      setSliderMins(m);
    }, 60_000);
    return () => clearInterval(id);
  }, [isLive]);

  const sliderDate = useMemo(() => minutesToDate(sliderMins), [sliderMins]);
  const { azimuth, altitude } = useMemo(() => getSunPositionAt(sliderDate), [sliderDate]);
  const sunTimes = useMemo(() => getSunTimesAt(sliderDate), [sliderDate]);

  const sunriseMins = sunTimes.sunrise.getHours() * 60 + sunTimes.sunrise.getMinutes();
  const sunsetMins  = sunTimes.sunset.getHours()  * 60 + sunTimes.sunset.getMinutes();
  const isDaylight  = altitude > 0;

  const scored: ScoredVenue[] = useMemo(() =>
    BELFAST_VENUES
      .map((v) => {
        const { score, exposure } = scoreVenue(v, azimuth, altitude);
        return { ...v, score, exposure, sun_altitude: altitude, sun_azimuth: azimuth };
      })
      .sort((a, b) => b.score - a.score),
    [azimuth, altitude]
  );

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderMins(Number(e.target.value));
    setIsLive(false);
  }, []);

  const handleLiveClick = useCallback(() => {
    const m = new Date().getHours() * 60 + new Date().getMinutes();
    setSliderMins(m);
    setIsLive(true);
  }, []);

  const toVenue = (v: ScoredVenue): Venue => ({
    osm_id: v.id,
    name: v.name,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    building_type: v.type,
    aspect_deg: v.aspect_deg,
    mean_radiation_wh_m2: v.base_radiation * 1000,
    sun_score: v.score,
    exposure: v.exposure,
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key="sunny-panel"
          initial={{ x: 440 }}
          animate={{ x: 0 }}
          exit={{ x: 440 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[420px] flex-shrink-0 bg-white border-l border-border-default flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-default">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">Sunny &amp; Social</span>
            <p className="text-[13px] text-text-primary font-medium mt-0.5">
              Where in Belfast is sunny right now?
            </p>
          </div>

          {/* Time slider */}
          <div className="px-6 py-4 border-b border-border-default bg-page/60">
            {/* Time display + live button */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[20px] font-semibold text-text-primary">
                  {formatTime(sliderMins)}
                </span>
                <span className="text-[12px] text-text-muted">Belfast</span>
              </div>
              <button
                onClick={handleLiveClick}
                className={`text-[11px] font-medium px-2.5 py-1 rounded border transition-colors ${
                  isLive
                    ? 'bg-amber-light border-amber/40 text-amber'
                    : 'bg-white border-border-default text-text-muted hover:border-border-strong'
                }`}
              >
                {isLive ? '● Live' : 'Go live'}
              </button>
            </div>

            {/* Slider */}
            <div className="relative">
              <input
                type="range"
                min={0}
                max={1439}
                step={5}
                value={sliderMins}
                onChange={handleSlider}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right,
                    #e2e1dc 0%,
                    #e2e1dc ${((sunriseMins) / 1440) * 100}%,
                    #fcd34d ${((sunriseMins + 30) / 1440) * 100}%,
                    #f97316 ${(((sunriseMins + sunsetMins) / 2) / 1440) * 100}%,
                    #fcd34d ${((sunsetMins - 30) / 1440) * 100}%,
                    #e2e1dc ${((sunsetMins) / 1440) * 100}%,
                    #e2e1dc 100%
                  )`,
                }}
              />
              {/* Sunrise / sunset labels */}
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[10px] text-text-muted">
                  ↑ {formatTime(sunriseMins)}
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  ↓ {formatTime(sunsetMins)}
                </span>
              </div>
            </div>

            {/* Sun position readout */}
            <div className="flex items-center gap-3 mt-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: isDaylight ? '#f59e0b' : '#8a8a84' }}
              />
              <span className="text-[11px] font-mono text-text-muted">
                {isDaylight
                  ? `Sun: ${altitude.toFixed(1)}° altitude · ${azimuth.toFixed(0)}° azimuth`
                  : 'Below horizon'}
              </span>
            </div>
          </div>

          {/* Venue list */}
          <div className="flex-1 overflow-y-auto">
            {!isDaylight ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center gap-2">
                <span className="text-2xl">🌙</span>
                <p className="text-[13px] text-text-primary font-medium">The sun has set over Belfast</p>
                <p className="text-[12px] text-text-muted">Drag the slider to preview any time of day</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-2.5 border-b border-border-default">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">
                    Ranked by current sun exposure
                  </span>
                </div>
                {scored.map((v, i) => (
                  <VenueCard
                    key={v.id}
                    venue={toVenue(v)}
                    rank={i + 1}
                    delay={i * 0.03}
                    onClick={() => onVenueSelect(selectedVenueId === v.id ? null : toVenue(v))}
                    selected={selectedVenueId === v.id}
                  />
                ))}
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
