'use client';

import { useEffect, useState } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
}

const STATUS_COLOR = (score: number) =>
  score >= 65 ? '#15803d' : score >= 40 ? '#d97706' : '#dc2626';

export default function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0);
  const [progress, setProgress] = useState(0);

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = STATUS_COLOR(score);

  useEffect(() => {
    setDisplayed(0);
    setProgress(0);
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * score));
      setProgress(eased * score);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e1dc" strokeWidth={8}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'none' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-mono font-semibold" style={{ fontSize: size * 0.28, color }}>
          {displayed}
        </span>
        <span className="text-text-muted" style={{ fontSize: size * 0.11, fontFamily: 'var(--font-dm-mono)' }}>
          /100
        </span>
      </div>
    </div>
  );
}
