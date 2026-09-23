import gsap from 'gsap';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatQuoteValue } from './ratesApi';
import { RATE_CATALOG } from './ratesCatalog';
import { useRates } from './RatesContext';

/**
 * Kayan kur şeridi — viewport’u dolduracak kadar kopya + soft sonsuz loop.
 */
export function RatesTickerBar() {
  const { selectedIds, quotes, loading } = useRates();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const [copies, setCopies] = useState(2);

  const items = useMemo(
    () =>
      selectedIds
        .map((id) => {
          const meta = RATE_CATALOG.find((x) => x.id === id);
          const q = quotes[id];
          if (!meta) return null;
          return { meta, q };
        })
        .filter(Boolean) as {
        meta: (typeof RATE_CATALOG)[number];
        q: (typeof quotes)[string] | undefined;
      }[],
    [selectedIds, quotes],
  );

  const loop = useMemo(
    () => Array.from({ length: copies }, () => items).flat(),
    [copies, items],
  );

  // Tek set genişliği ölç → viewport’u ≥2× dolduracak kopya sayısı
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure || items.length === 0) return;

    const calc = () => {
      const setW = measure.scrollWidth;
      const vw = viewport.clientWidth;
      if (setW < 8 || vw < 8) return;
      // En az 2 kopya; sağda boşluk kalmasın diye 2 viewport genişliği
      const need = Math.max(2, Math.ceil((vw * 2) / setW) + 1);
      setCopies((c) => (c === need ? c : need));
    };

    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [items]);

  // Sonsuz kaydırma — bir set genişliği kadar, repeat -1
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    tweenRef.current?.kill();
    gsap.set(track, { x: 0 });

    const setWidth = track.scrollWidth / copies;
    if (!Number.isFinite(setWidth) || setWidth < 8) return;

    tweenRef.current = gsap.to(track, {
      x: -setWidth,
      duration: Math.max(22, setWidth / 38),
      ease: 'none',
      repeat: -1,
    });

    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [items, copies]);

  if (!items.length) {
    return (
      <div className="flex h-full flex-1 items-center px-3 text-xs text-[var(--panel-muted)]">
        Dişliden en az bir kur seçin
      </div>
    );
  }

  return (
    <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden">
      {/* Görünmez ölçü — tek set genişliği */}
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute left-0 top-0 flex h-16 w-max items-center gap-6 px-2"
        aria-hidden
      >
        {items.map((row) => (
          <TickerChip key={`m-${row.meta.id}`} row={row} loading={loading} />
        ))}
      </div>

      <div
        ref={trackRef}
        className="flex h-16 w-max items-center gap-6 px-2 will-change-transform"
        aria-live="polite"
      >
        {loop.map((row, i) => (
          <TickerChip key={`${row.meta.id}-${i}`} row={row} loading={loading} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--panel-header)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--panel-header)] to-transparent" />
    </div>
  );
}

function TickerChip({
  row,
  loading,
}: {
  row: {
    meta: (typeof RATE_CATALOG)[number];
    q: { value: number; changePct: number | null } | undefined;
  };
  loading: boolean;
}) {
  const up = (row.q?.changePct ?? 0) > 0.001;
  const down = (row.q?.changePct ?? 0) < -0.001;
  return (
    <div className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-600)]">
        {row.meta.short}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-[var(--panel-ink)]">
        {row.q
          ? `${formatQuoteValue(row.q.value, row.meta.unit)} ${row.meta.unit}`
          : loading
            ? '…'
            : '—'}
      </span>
      {row.q?.changePct != null ? (
        <span
          className={[
            'text-[10px] font-bold tabular-nums',
            up ? 'text-emerald-600' : down ? 'text-rose-500' : 'text-[var(--panel-muted)]',
          ].join(' ')}
        >
          {up ? '▲' : down ? '▼' : '•'}{' '}
          {Math.abs(row.q.changePct).toLocaleString('tr-TR', {
            maximumFractionDigits: 2,
          })}
          %
        </span>
      ) : null}
      <span className="text-[var(--panel-line)]">|</span>
    </div>
  );
}
