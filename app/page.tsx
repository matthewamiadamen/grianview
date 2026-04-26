'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AddressSearch from '@/components/Search/AddressSearch';
import SuitabilityPanel from '@/components/Panel/SuitabilityPanel';
import SunnyPanel from '@/components/SunnySideUp/SunnyPanel';
import type { Venue } from '@/types/Venue';

const BelfastMap = dynamic(() => import('@/components/Map/BelfastMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-page">
      <p className="text-[13px] text-text-muted">Loading map…</p>
    </div>
  ),
});

interface SelectedBuilding {
  osm_id: string;
  lat: number;
  lng: number;
  polygon: GeoJSON.Polygon | null;
  radiation: number;
}

interface RecentEntry {
  osm_id: string;
  label: string;
  score: number;
  status: string;
}

// Pre-loaded demo buildings pulled straight from the CSV
const DEMO_BUILDINGS = [
  { osm_id: '1178623528', label: '22 Ormeau Embankment',  note: '3.53 kWh — top 1% · SE open aspect' },
  { osm_id: '1207967061', label: '88 Belmont Avenue',     note: '3.08 kWh — SE · unobstructed' },
  { osm_id: '1250759890', label: '16 Coolfin Street',     note: '0.54 kWh — bottom 1% · heavy shade' },
  { osm_id: '1321487174', label: 'Rutherglen Street',     note: '1.49 kWh — NW · Black Mtn shadow' },
  { osm_id: '1321487216', label: 'Glencairn Crescent',    note: '1.60 kWh — NW centre · hill shadow' },
];

const STATUS_DOT: Record<string, string> = {
  'SUITABLE': '#15803d',
  'MODERATELY SUITABLE': '#d97706',
  'NOT SUITABLE': '#dc2626',
};

const STATUS_SHORT: Record<string, string> = {
  'SUITABLE': 'Suitable',
  'MODERATELY SUITABLE': 'Moderate',
  'NOT SUITABLE': 'Not Suitable',
};

export default function Home() {
  const [selectedOsmId, setSelectedOsmId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuilding | null>(null);
  const [sunnyMode, setSunnyMode] = useState(false);
  const [sunnyVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    if (!selectedOsmId) setSelectedBuilding(null);
  }, [selectedOsmId]);

  const handleAddressSelect = (result: { osm_id: string }) => {
    setSunnyMode(false);
    setSelectedVenue(null);
    setSelectedOsmId(result.osm_id);
  };


  const handleGeometry = (data: SelectedBuilding | null) => {
    setSelectedBuilding(data);
  };

  const handleResult = (osmId: string, label: string, score: number, status: string) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.osm_id !== osmId);
      return [{ osm_id: osmId, label, score, status }, ...filtered].slice(0, 8);
    });
  };

  const handleVenueSelect = (venue: Venue | null) => {
    setSelectedVenue(venue);
    if (venue) setSelectedOsmId(null);
  };

  const handleSunnyToggle = () => {
    setSunnyMode((v) => !v);
    if (!sunnyMode) { setSelectedOsmId(null); setSelectedBuilding(null); }
  };

  const selectBuilding = (id: string) => {
    setSunnyMode(false);
    setSelectedVenue(null);
    setSelectedOsmId(id);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-page">
      {/* Nav */}
      <nav className="h-[52px] flex items-center px-6 border-b border-border-default bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-amber flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.3px] text-text-primary">GrianView</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[13px] text-text-muted">Belfast Solar Intelligence</span>
        </div>
        <span className="text-[12px] font-mono text-text-muted">54.597°N 5.930°W</span>
      </nav>

      {/* Search bar */}
      <AddressSearch
        onSelect={handleAddressSelect}
        onSunnyToggle={handleSunnyToggle}
        sunnyActive={sunnyMode}
      />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-[260px] flex-shrink-0 bg-white border-r border-border-default flex flex-col overflow-y-auto">
          {/* Demo properties */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted mb-3">Previously Selected</p>
            <div className="flex flex-col gap-1.5">
              {DEMO_BUILDINGS.map((b) => (
                <button
                  key={b.osm_id}
                  onClick={() => selectBuilding(b.osm_id)}
                  className={`w-full text-left px-3 py-2 rounded-[4px] border transition-colors ${
                    selectedOsmId === b.osm_id
                      ? 'bg-page border-border-strong'
                      : 'border-border-default hover:border-border-strong'
                  }`}
                >
                  <p className="text-[12px] font-medium text-text-primary">{b.label}</p>
                  {'note' in b && <p className="text-[11px] text-text-muted mt-0.5">{b.note}</p>}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-5 my-3 border-t border-border-default" />

          {/* Recently searched */}
          <div className="px-5 pb-2">
            <p className="text-[11px] uppercase tracking-[0.5px] text-text-muted mb-3">Recently Searched</p>
          </div>

          {recents.length === 0 ? (
            <div className="px-5 pb-4">
              <p className="text-[11px] text-text-muted leading-relaxed">
                Buildings you search will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col px-2 pb-4 gap-1">
              <AnimatePresence initial={false}>
                {recents.map((r) => (
                  <motion.button
                    key={r.osm_id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => selectBuilding(r.osm_id)}
                    className={`w-full text-left px-3 py-2.5 rounded-[4px] border transition-colors ${
                      selectedOsmId === r.osm_id
                        ? 'bg-page border-border-strong'
                        : 'border-transparent hover:border-border-default hover:bg-page'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] text-text-primary font-medium truncate">{r.label}</p>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          color: STATUS_DOT[r.status],
                          backgroundColor: STATUS_DOT[r.status] + '18',
                        }}
                      >
                        {STATUS_SHORT[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-text-muted mt-0.5">{r.score}/100</p>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Live data badge */}
          <div className="mt-auto px-5 pb-5">
            <div className="bg-page border border-border-default rounded-[6px] px-3 py-3">
              <p className="text-[11px] font-semibold text-text-primary mb-1">Live solar data</p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Captured from Belfast's LiDAR survey. 52,872 buildings indexed.
              </p>
            </div>
          </div>
        </div>

        {/* Map */}
        <BelfastMap
          selectedBuilding={selectedBuilding}
          sunnyVenues={sunnyVenues}
          selectedVenue={selectedVenue}
          sunnyMode={sunnyMode}
          onBuildingClick={(id) => { setSunnyMode(false); setSelectedVenue(null); setSelectedOsmId(id); }}
        />

        {/* Right panel */}
        {!sunnyMode && (
          <SuitabilityPanel
            osmId={selectedOsmId}
            onClose={() => { setSelectedOsmId(null); setSelectedBuilding(null); }}
            onGeometry={handleGeometry}
            onResult={handleResult}
          />
        )}

        <SunnyPanel
          visible={sunnyMode}
          onVenueSelect={handleVenueSelect}
          selectedVenueId={selectedVenue?.osm_id ?? null}
        />
      </div>
    </div>
  );
}
