'use client';

import { motion } from 'framer-motion';
import type { Venue } from '@/types/Venue';

const EXPOSURE_COLORS: Record<string, string> = {
  full: '#d97706',
  partial: '#92400e',
  shade: '#8a8a84',
};

const EXPOSURE_LABELS: Record<string, string> = {
  full: 'Full Sun',
  partial: 'Partial Sun',
  shade: 'In Shade',
};

interface VenueCardProps {
  venue: Venue;
  rank: number;
  delay: number;
  onClick: () => void;
  selected: boolean;
}

export default function VenueCard({ venue, rank, delay, onClick, selected }: VenueCardProps) {
  const dotColor = EXPOSURE_COLORS[venue.exposure];
  const label = EXPOSURE_LABELS[venue.exposure];

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.15 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3 border-b border-border-default text-left transition-colors ${selected ? 'bg-amber-light/50' : 'hover:bg-page'}`}
    >
      <span className="font-mono text-[12px] text-text-muted w-4 flex-shrink-0">{rank}</span>
      <motion.div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.05 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-text-primary font-medium truncate">{venue.name}</p>
        {venue.address && (
          <p className="text-[12px] text-text-muted truncate">{venue.address}</p>
        )}
        <span
          className="inline-block text-[11px] font-medium mt-0.5 px-1.5 py-0.5 rounded"
          style={{ color: dotColor, backgroundColor: `${dotColor}18` }}
        >
          {label}
        </span>
      </div>
      <span className="font-mono text-[12px] text-text-secondary flex-shrink-0">
        {venue.sun_score}
      </span>
    </motion.button>
  );
}
