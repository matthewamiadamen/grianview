'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SunClock from './SunClock';
import VenueCard from './VenueCard';
import type { Venue } from '@/types/Venue';

interface SunnyData {
  venues: Venue[];
  is_daylight: boolean;
  sunrise: string;
  sunset: string;
}

interface SunnyPanelProps {
  visible: boolean;
  onVenueSelect: (venue: Venue | null) => void;
  selectedVenueId: string | null;
}

export default function SunnyPanel({ visible, onVenueSelect, selectedVenueId }: SunnyPanelProps) {
  const [data, setData] = useState<SunnyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetch('/api/sunnynow')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key="sunny-panel"
          initial={{ x: 340 }}
          animate={{ x: 0 }}
          exit={{ x: 340 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[420px] flex-shrink-0 bg-white border-l border-border-default flex flex-col overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border-default">
            <span className="text-[11px] uppercase tracking-[0.5px] text-text-muted">Sunny &amp; Social</span>
            <p className="text-[13px] text-text-primary mt-0.5 font-medium">Where's sunny in Belfast right now?</p>
          </div>

          <SunClock />

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-32 text-[13px] text-text-muted">Loading…</div>
            )}

            {!loading && data && !data.is_daylight && (
              <div className="px-5 py-8 text-center">
                <p className="text-[22px] mb-2">🌙</p>
                <p className="text-[13px] text-text-primary font-medium mb-1">The sun has set over Belfast</p>
                <p className="text-[12px] text-text-muted">
                  Check back tomorrow, or use the time slider to preview tomorrow morning.
                </p>
                <p className="font-mono text-[12px] text-text-muted mt-3">
                  Sunrise: {new Date(data.sunrise).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}

            {!loading && data && data.is_daylight && data.venues.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-[13px] text-text-muted">No venue data available in the current dataset.</p>
              </div>
            )}

            {!loading && data && data.is_daylight && data.venues.map((venue, i) => (
              <VenueCard
                key={venue.osm_id}
                venue={venue}
                rank={i + 1}
                delay={i * 0.05}
                onClick={() => onVenueSelect(selectedVenueId === venue.osm_id ? null : venue)}
                selected={selectedVenueId === venue.osm_id}
              />
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
