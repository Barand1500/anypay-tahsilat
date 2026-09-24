import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

export type ChartRange = '1G' | '1H' | '1A' | '6A' | '1Y';

export type ChartSeriesDef = { id: string; name: string; color: string };

export type ChartPoint = {
  label: string;
  full: string;
  values: Record<string, number>;
};

type Props = {
  title: string;
  subtitle: string;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  series: ChartSeriesDef[];
  points: ChartPoint[];
};

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '1G', label: '1G' },
  { id: '1H', label: '1H' },
  { id: '1A', label: '1A' },
  { id: '6A', label: '6A' },
  { id: '1Y', label: '1Y' },
];

const PAD = { left: 52, right: 20, top: 28, bottom: 56 };

export function ChartPanel({ title, subtitle, range, onRangeChange, series, points }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 440 });
  const [hover, setHover] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    setHover(null);
  }, [points, series]);

  const layout = useMemo(
    () => buildMultiLayout(points, series, size.w, size.h),
    [points, series, size.w, size.h],
  );
  const { paths, max, min, xs, ysBySeries } = layout;

  function changeRange(next: ChartRange) {
    if (next === range || fading) return;
    setFading(true);
    setHover(null);
    window.setTimeout(() => {
      onRangeChange(next);
      setFading(false);
    }, 220);
  }

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (points.length < 2) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotW = size.w - PAD.left - PAD.right;
    const t = Math.min(1, Math.max(0, (x - PAD.left) / plotW));
    setHover(Math.round(t * (points.length - 1)));
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 12));
  const hiX = hover != null ? xs[hover] : null;
  const tipBelow =
    hover != null &&
    series.length > 0 &&
    (ysBySeries[series[0]?.id]?.[hover] ?? PAD.top + 100) < PAD.top + 100;

  return (
    <section className="chart-panel rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--panel-ink)]">{title}</h2>
          <p className="text-sm text-[var(--panel-muted)]">{subtitle}</p>
        </div>
        <div className="relative flex flex-wrap gap-1 rounded-full bg-[var(--panel-surface)] p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => changeRange(r.id)}
              className={[
                'relative z-[1] rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300',
                range === r.id
                  ? 'bg-[var(--color-brand-500)] text-white shadow-[0_0_16px_color-mix(in_srgb,var(--color-brand-500)_45%,transparent)]'
                  : 'text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className={[
          'relative h-[380px] cursor-crosshair overflow-hidden rounded-2xl bg-[var(--chart-bg)] transition-opacity duration-300 sm:h-[440px]',
          fading ? 'opacity-40' : 'opacity-100',
        ].join(' ')}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {points.length === 0 || series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--panel-muted)]">
            Bu aralıkta hareket yok
          </div>
        ) : (
          <>
            <div
              className="pointer-events-none absolute flex flex-col justify-between text-[10px] text-[var(--panel-muted)]"
              style={{ left: 6, top: PAD.top, bottom: PAD.bottom }}
            >
              <span>{fmt(max)}</span>
              <span>{fmt((max + min) / 2)}</span>
              <span>{fmt(min)}</span>
            </div>

            <svg key={animKey} className="absolute inset-0 h-full w-full" width={size.w} height={size.h}>
              {[0.25, 0.5, 0.75].map((t) => {
                const y = PAD.top + t * (size.h - PAD.top - PAD.bottom);
                return (
                  <line
                    key={t}
                    x1={PAD.left}
                    x2={size.w - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="var(--panel-line)"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                );
              })}

              {series.map((s) => (
                <path
                  key={s.id}
                  d={paths[s.id]}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1"
                  className="chart-line-anim"
                  opacity={0.95}
                />
              ))}

              {hiX != null && hover != null ? (
                <>
                  <line
                    x1={hiX}
                    x2={hiX}
                    y1={PAD.top}
                    y2={size.h - PAD.bottom}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="text-[var(--panel-ink)] opacity-30"
                  />
                  {series.map((s) => {
                    const y = ysBySeries[s.id]?.[hover];
                    if (y == null) return null;
                    const v = points[hover].values[s.id] ?? 0;
                    if (v <= 0 && series.every((x) => (points[hover].values[x.id] ?? 0) === 0)) {
                      return null;
                    }
                    return (
                      <circle
                        key={s.id}
                        cx={hiX}
                        cy={y}
                        r={5}
                        fill={s.color}
                        stroke="var(--panel-elevated)"
                        strokeWidth="2"
                      />
                    );
                  })}
                </>
              ) : null}
            </svg>

            {hover != null && hiX != null ? (
              <div
                className="pointer-events-none absolute z-10 min-w-[200px] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 shadow-[var(--panel-shadow)]"
                style={{
                  left: Math.min(Math.max(hiX, 110), size.w - 110),
                  top: tipBelow ? PAD.top + 12 : PAD.top + 8,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="mb-2 text-[11px] font-semibold text-[var(--panel-ink)]">
                  {points[hover].full}
                </div>
                <ul className="space-y-1.5">
                  {series.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 text-[11px]">
                      <span className="flex items-center gap-2 text-[var(--panel-muted)]">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--panel-ink)]">
                        {(points[hover].values[s.id] ?? 0).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div
              className="pointer-events-none absolute bottom-8 flex justify-between text-[10px] text-[var(--panel-muted)]"
              style={{ left: PAD.left, right: PAD.right }}
            >
              {points.map((p, i) => (
                <span key={`${p.label}-${i}`}>{i % labelStep === 0 ? p.label : ''}</span>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {series.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-[10px] text-[var(--panel-muted)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildMultiLayout(points: ChartPoint[], series: ChartSeriesDef[], w: number, h: number) {
  const all = points.flatMap((p) => series.map((s) => p.values[s.id] ?? 0));
  const dataMax = Math.max(...all, 1);
  const min = 0;
  const max = dataMax * 1.08 || 1;
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const xs = points.map((_, i) => PAD.left + (i / Math.max(1, points.length - 1)) * plotW);
  const ysBySeries: Record<string, number[]> = {};
  const paths: Record<string, string> = {};

  for (const s of series) {
    const ys = points.map((p) => {
      const t = ((p.values[s.id] ?? 0) - min) / (max - min || 1);
      return PAD.top + plotH - t * plotH;
    });
    ysBySeries[s.id] = ys;
    if (xs.length === 0) {
      paths[s.id] = '';
      continue;
    }
    let path = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < xs.length; i += 1) {
      const cx = (xs[i - 1] + xs[i]) / 2;
      path += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
    }
    paths[s.id] = path;
  }

  return { paths, max, min, xs, ysBySeries };
}
