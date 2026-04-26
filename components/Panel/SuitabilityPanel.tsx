'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreGauge from './ScoreGauge';
import DataRow from './DataRow';
import type { SuitabilityResult } from '@/types/SuitabilityResult';

interface SuitabilityPanelProps {
  osmId: string | null;
  onClose: () => void;
  onGeometry: (data: { osm_id: string; lat: number; lng: number; polygon: GeoJSON.Polygon | null; radiation: number } | null) => void;
  onResult?: (osmId: string, label: string, score: number, status: string) => void;
}

type ApiResult = SuitabilityResult & {
  geometry: GeoJSON.Polygon | null;
  centroid: { lat: number; lng: number } | null;
};

const STATUS_COLORS = {
  'SUITABLE':            { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  'MODERATELY SUITABLE': { bg: '#fef3c7', border: '#fcd34d', text: '#d97706' },
  'NOT SUITABLE':        { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626' },
};

const CONFIDENCE_COLORS = {
  HIGH:   { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  MEDIUM: { bg: '#fef3c7', border: '#fcd34d', text: '#d97706' },
  LOW:    { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626' },
};

export default function SuitabilityPanel({ osmId, onClose, onGeometry, onResult }: SuitabilityPanelProps) {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!osmId) { setResult(null); onGeometry(null); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/building/${osmId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: ApiResult) => {
        setResult(data);
        setLoading(false);
        if (data.centroid) {
          onGeometry({
            osm_id: osmId,
            lat: data.centroid.lat,
            lng: data.centroid.lng,
            polygon: data.geometry,
            radiation: data.building.mean_radiation,
          });
        }
        const label = data.building.name ?? data.building.address ?? osmId;
        onResult?.(osmId, label.split(',')[0], data.score, data.status);
      })
      .catch(() => { setError('Could not load building data.'); setLoading(false); });
  }, [osmId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {osmId && (
        <motion.aside
          key="panel"
          initial={{ x: 440 }}
          animate={{ x: 0 }}
          exit={{ x: 440 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[420px] flex-shrink-0 bg-white border-l border-border-default flex flex-col overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">Solar Suitability Report</span>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[13px] text-text-muted">
              <div className="w-5 h-5 border-2 border-border-default border-t-text-muted rounded-full animate-spin" />
              Fetching building data…
            </div>
          )}
          {error && (
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <p className="text-[13px] text-[#dc2626]">{error}</p>
            </div>
          )}
          {!loading && !error && !result && (
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <p className="text-[13px] text-text-muted">No data found for this building.</p>
            </div>
          )}

          {result && (
            <div className="flex flex-col">
              {/* Status banner */}
              {(() => {
                const c = STATUS_COLORS[result.status] ?? STATUS_COLORS['NOT SUITABLE'];
                return (
                  <div
                    className="mx-6 mt-5 mb-4 px-5 py-3.5 rounded-[6px] border flex items-center justify-between gap-4"
                    style={{ background: c.bg, borderColor: c.border }}
                  >
                    <span className="text-[11px] uppercase tracking-[0.5px] font-semibold" style={{ color: c.text }}>
                      {result.status}
                    </span>
                    <ScoreGauge score={result.score} />
                  </div>
                );
              })()}

              {/* Confidence + data period */}
              <div className="px-6 mb-4 flex items-center gap-2 flex-wrap">
                {(() => {
                  const c = CONFIDENCE_COLORS[result.confidence];
                  return (
                    <span
                      className="text-[11px] uppercase tracking-[0.5px] px-2 py-0.5 rounded border"
                      style={{ background: c.bg, borderColor: c.border, color: c.text }}
                    >
                      {result.confidence} confidence
                    </span>
                  );
                })()}
                <span className="text-[11px] px-2 py-0.5 rounded border border-border-default bg-page text-text-muted font-mono">
                  Captured this week · Belfast LiDAR
                </span>
              </div>

              {/* Address */}
              <div className="px-6 mb-4">
                {result.building.name && (
                  <p className="text-[14px] text-text-primary font-semibold">{result.building.name}</p>
                )}
                {result.building.address && (
                  <p className="text-[13px] text-text-secondary">{result.building.address}</p>
                )}
                <p className="text-[11px] font-mono text-text-muted mt-0.5">OSM {result.building.osm_id}</p>
              </div>

              {/* Today's radiation */}
              <div className="border-t border-border-default">
                <div className="px-6 py-2.5">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">Today's radiation data</span>
                </div>
                <DataRow label="Mean radiation"        value={`${result.building.mean_radiation.toFixed(2)} kWh/m²/day`} />
                <DataRow label="Usable solar (roof)"   value={`${result.building.usable_sr.toFixed(1)} kWh`} />
                <DataRow label="Est. generation today" value={`${(result.building.elec_prod / 2).toFixed(2)} kWh`} />
                <DataRow label="Roof footprint"        value={`${result.building.roof_area_m2.toFixed(0)} m²`} />
                {result.flags.building_type && (
                  <DataRow label="Building type" value={result.flags.building_type} mono={false} />
                )}
              </div>

              {/* Estimated annual potential */}
              <div className="border-t border-border-default mt-2">
                <div className="px-6 py-2.5">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">Estimated annual potential</span>
                </div>
                <div className="grid grid-cols-2 gap-3 px-6 pb-5">
                  {[
                    { label: 'Annual generation', value: `${result.estimated.annual_kwh.toLocaleString()} kWh` },
                    { label: 'Annual saving',     value: `£${result.estimated.annual_saving_gbp.toLocaleString()}` },
                    { label: 'Payback period',    value: `${result.estimated.payback_years} yrs` },
                    { label: 'CO₂ offset',        value: `${result.estimated.co2_offset_kg_year.toLocaleString()} kg/yr` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-page border border-border-default rounded-[6px] px-4 py-3">
                      <p className="text-[11px] text-text-muted uppercase tracking-[0.5px] mb-1.5">{label}</p>
                      <p className="font-mono text-[16px] text-text-primary font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="border-t border-border-default px-6 py-5">
                <div
                  className="bg-page border border-border-default rounded-[4px] px-5 py-4"
                  style={{ borderLeftWidth: '3px', borderLeftColor: '#d97706' }}
                >
                  <p className="text-[13px] text-text-primary leading-[1.65]">{result.recommendation}</p>
                </div>
              </div>

              {/* Heritage flags */}
              {(result.flags.heritage || result.flags.planning_restricted) && (
                <div className="border-t border-border-default px-6 py-4">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted block mb-2">Flags</span>
                  {result.flags.heritage && (
                    <div className="text-[12px] text-[#dc2626] bg-[#fee2e2] border border-red-200 rounded px-3 py-2 mb-2">
                      ⚠ Listed building / conservation area
                    </div>
                  )}
                  {result.flags.planning_restricted && (
                    <div className="text-[12px] text-[#dc2626] bg-[#fee2e2] border border-red-200 rounded px-3 py-2">
                      ⚠ Planning restrictions may apply
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
