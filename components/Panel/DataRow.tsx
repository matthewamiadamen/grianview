'use client';

interface DataRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  color?: string;
}

export default function DataRow({ label, value, mono = true, color }: DataRowProps) {
  return (
    <div className="flex items-center justify-between px-5 py-[9px] border-b border-border-default last:border-b-0">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span
        className={`text-[12px] text-text-primary ${mono ? 'font-mono' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
