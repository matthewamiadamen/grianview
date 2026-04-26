'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchResult {
  osm_id: string;
  label: string;
  sublabel?: string;
  matched_osm_id: string;
  count?: number;
}

interface AddressSearchProps {
  onSelect: (result: { osm_id: string }) => void;
  onSunnyToggle: () => void;
  sunnyActive: boolean;
}

export default function AddressSearch({ onSelect, onSunnyToggle, sunnyActive }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.length < 2) { setResults([]); setOpen(false); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data: SearchResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
        setActiveIdx(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    search(value);
  };

  const handleSelect = (r: SearchResult) => {
    setQuery(r.label.split(' — ')[0]);
    setOpen(false);
    setActiveIdx(-1);
    onSelect({ osm_id: r.matched_osm_id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(results[activeIdx]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  const handleCheckClick = () => {
    if (results.length > 0) handleSelect(results[0]);
    else if (query.length >= 2) search(query);
  };

  // Highlight matched portion of label
  const highlight = (text: string, q: string) => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1 || q.length < 2) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <span className="font-semibold text-text-primary">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </span>
    );
  };

  return (
    <div className="h-16 flex items-center px-4 gap-3 border-b border-border-default bg-white flex-shrink-0" ref={containerRef}>
      <div className="flex-1 relative">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Type a Belfast street, address or building…"
            className="w-full pl-9 pr-8 py-2 text-[13px] bg-page border border-border-default rounded-[4px] text-text-primary placeholder-text-muted focus:outline-none focus:border-border-strong transition-colors"
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
          )}
          {!loading && query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-sm leading-none"
            >
              ×
            </button>
          )}
        </div>

        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-default rounded-[4px] shadow-lg z-50 overflow-hidden">
            {results.map((r, i) => (
              <button
                key={r.osm_id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className={`w-full text-left px-4 py-2.5 border-b border-border-default last:border-b-0 transition-colors flex items-center justify-between gap-3 ${
                  i === activeIdx ? 'bg-page' : 'hover:bg-page'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-text-secondary truncate">
                    {highlight(r.label, query)}
                  </p>
                  {r.sublabel && (
                    <p className="text-[11px] text-text-muted mt-0.5">{r.sublabel}</p>
                  )}
                </div>
                <span className="text-[10px] font-mono text-text-muted flex-shrink-0 bg-page border border-border-default rounded px-1.5 py-0.5">
                  in dataset
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleCheckClick}
        className="px-5 py-2 text-[13px] font-medium bg-text-primary text-white rounded-[4px] hover:bg-black transition-colors flex-shrink-0"
      >
        Check
      </button>

      <button
        onClick={onSunnyToggle}
        className={`px-4 py-2 text-[13px] font-medium rounded-[4px] border flex-shrink-0 transition-colors ${
          sunnyActive
            ? 'bg-amber text-white border-amber'
            : 'bg-amber-light text-amber border-amber/40 hover:border-amber'
        }`}
      >
        ☀ Sunny &amp; Social
      </button>
    </div>
  );
}
