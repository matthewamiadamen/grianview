'use client';

import { useEffect, useState } from 'react';
import { getSunPosition, getSunTimes } from '@/lib/solar/sunPosition';

export default function SunClock() {
  const [time, setTime] = useState('');
  const [altitude, setAltitude] = useState(0);
  const [azimuth, setAzimuth] = useState(0);
  const [sunrise, setSunrise] = useState('');
  const [sunset, setSunset] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      const pos = getSunPosition(now);
      setAltitude(Math.round(pos.altitude));
      setAzimuth(Math.round(pos.azimuth));
      const times = getSunTimes(now);
      setSunrise(times.sunrise.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      setSunset(times.sunset.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-border-default bg-amber-light/40">
      <span className="font-mono text-[13px] text-text-primary font-medium">{time}</span>
      <span className="text-[12px] text-text-secondary font-mono">↑{altitude}° /{azimuth}°</span>
      <span className="text-[11px] text-text-muted">
        ☀ {sunrise} → {sunset}
      </span>
    </div>
  );
}
