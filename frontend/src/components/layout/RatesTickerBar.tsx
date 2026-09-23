import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { formatQuoteValue } from './ratesApi';
import { RATE_CATALOG } from './ratesCatalog';
import { useRates } from './RatesContext';

/**
 * Kayan kur şeridi — seçili enstrümanlar, soft loop.
 */
export function RatesTickerBar() {
  const { selectedIds, quotes, loading } = useRates();
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const items = selectedIds
    .map((id) => {
      const meta = RATE_CATALOG.find((x) => x.id === id);
      const q = quotes[id];
      if (!meta) return null;
      return { meta, q };
    })
    .filter(Boolean) as {
    meta: (typeof RATE_CATALOG)[number];
    q: (typeof quotes)[string] | undefined;
  }[];

  // Çiftle — kesintisiz kayma
  const loop = [...items, ...items];

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    tweenRef.current?.kill();
    gsap.set(track, { x: 0 });

    const half = track.scrollWidth / 2;
    if (half < 8) return;

    tweenRef.current = gsap.to(track, {
      x: -half,
      duration: Math.max(18, half / 40),
      ease: 'none',
      repeat: -1,
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [items.length, selectedIds.join('|'), Object.keys(quotes).join('|')]);

  if (!items.length) {
    return (
      <div className="flex h-full flex-1 items-center px-3 text-xs text-[var(--panel-muted)]">
        Dişliden en az bir kur seçin
      </div>
    );
  }

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      <div
        ref={trackRef}
        className="flex h-16 w-max items-center gap-6 px-2 will-change-transform"
        aria-live="polite"
      >
        {loop.map((row, i) => {
          const up = (row.q?.changePct ?? 0) > 0.001;
          const down = (row.q?.changePct ?? 0) < -0.001;
          return (
            <div
              key={`${row.meta.id}-${i}`}
              className="flex shrink-0 items-baseline gap-2 whitespace-nowrap"
            >
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
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--panel-header)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--panel-header)] to-transparent" />
    </div>
  );
}
