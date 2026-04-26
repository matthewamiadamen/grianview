'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ScoreGaugeProps {
  score: number;
}

export default function ScoreGauge({ score }: ScoreGaugeProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    setDisplayed(0);
    const start = performance.now();
    const duration = 600;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplayed(Math.round(t * score));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const color = score >= 65 ? '#15803d' : score >= 40 ? '#d97706' : '#dc2626';

  return (
    <div className="flex items-center gap-3">
      <motion.span
        className="font-mono text-[22px] font-semibold"
        style={{ color }}
        key={score}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {displayed}
      </motion.span>
      <span className="text-[13px] text-text-muted">/100</span>
      <div className="flex-1 h-1.5 bg-border-default rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
