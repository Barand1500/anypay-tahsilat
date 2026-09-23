import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

type Range = '1G' | '1H' | '1A' | '6A' | '1Y';

type SeriesDef = { id: string; name: string; color: string };

type Point = {
  label: string;
  full: string;
  values: Record<string, number>;
};

type Props = {
  title: string;
  subtitle: string;
};

const RANGES: { id: Range; label: string }[] = [
  { id: '1G', label: '1G' },
  { id: '1H', label: '1H' },
  { id: '1A', label: '1A' },
  { id: '6A', label: '6A' },
  { id: '1Y', label: '1Y' },
];

const SERIES: SeriesDef[] = [
  { id: 'akbank', name: 'AKBANK T.A.Ş.', color: '#e85d6c' },
  { id: 'garanti', name: 'T. GARANTİ BANKASI A.Ş.', color: '#3dba7a' },
  { id: 'yapikredi', name: 'YAPI VE KREDİ BANKASI A.Ş.', color: '#3b5bdb' },
  { id: 'qnb', name: 'QNB BANK A.Ş.', color: '#5b9cff' },
  { id: 'tosla', name: 'TOSLA', color: '#b08968' },
];

const PAD = { left: 52, right: 20, top: 28, bottom: 56 };

export function ChartPanel({ title, subtitle }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range>('1Y');
  const [size, setSize] = useState({ w: 800, h: 440 });
  const [hover, setHover] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [fading, setFading] = useState(false);

  const points = useMemo(() => buildMultiSeries(range), [range]);

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

  const layout = useMemo(() => buildMultiLayout(points, size.w, size.h), [points, size.w, size.h]);
  const { paths, max, min, xs, ysBySeries } = layout;

  function changeRange(next: Range) {
    if (next === range || fading) return;
    setFading(true);
    setHover(null);
    window.setTimeout(() => {
      setRange(next);
      setAnimKey((k) => k + 1);
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
  const tipBelow = hover != null && (ysBySeries.qnb?.[hover] ?? PAD.top + 100) < PAD.top + 100;

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

          {SERIES.map((s) => (
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
              {SERIES.map((s) => {
                const y = ysBySeries[s.id]?.[hover];
                if (y == null) return null;
                const v = points[hover].values[s.id] ?? 0;
                if (v <= 0 && SERIES.every((x) => (points[hover].values[x.id] ?? 0) === 0)) return null;
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
            <div className="mb-2 text-[11px] font-semibold text-[var(--panel-ink)]">{points[hover].full}</div>
            <ul className="space-y-1.5">
              {SERIES.map((s) => (
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
          {SERIES.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[10px] text-[var(--panel-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildMultiLayout(points: Point[], w: number, h: number) {
  const all = points.flatMap((p) => SERIES.map((s) => p.values[s.id] ?? 0));
  const dataMax = Math.max(...all, 1);
  const min = 0;
  const max = dataMax * 1.08 || 1;
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const xs = points.map((_, i) => PAD.left + (i / Math.max(1, points.length - 1)) * plotW);
  const ysBySeries: Record<string, number[]> = {};
  const paths: Record<string, string> = {};

  for (const s of SERIES) {
    const ys = points.map((p) => {
      const t = ((p.values[s.id] ?? 0) - min) / (max - min || 1);
      return PAD.top + plotH - t * plotH;
    });
    ysBySeries[s.id] = ys;
    let path = `M ${xs[0]} ${ys[0]}`;
    for (let i = 1; i < xs.length; i += 1) {
      const cx = (xs[i - 1] + xs[i]) / 2;
      path += ` C ${cx} ${ys[i - 1]}, ${cx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
    }
    paths[s.id] = path;
  }

  return { paths, max, min, xs, ysBySeries };
}

function buildMultiSeries(range: Range): Point[] {
  const now = new Date(2026, 8, 17, 17, 0, 0);

  const make = (n: number, labelFn: (i: number, d: Date) => { label: string; full: string }, peakAt: number[]) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(now);
      const { label, full } = labelFn(i, d);
      const values: Record<string, number> = {};
      SERIES.forEach((s, si) => {
        const base = wave(i + si * 1.7, n, 0, 40000 + si * 12000);
        const boost = peakAt.includes(i) ? (si === 3 ? 147000 : si === 0 ? 45000 : base * 0.2) : 0;
        const quiet = si === 1 || si === 2 ? 0.08 : 1;
        values[s.id] = Math.round((base * quiet + boost) * 100) / 100;
        if (range === '1Y' && i === 0) values[s.id] = 0;
      });
      return { label, full, values };
    });

  if (range === '1G') {
    return make(
      24,
      (i, d) => {
        d.setHours(d.getHours() - (23 - i), 0, 0, 0);
        return {
          label: `${String(d.getHours()).padStart(2, '0')}:00`,
          full: d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        };
      },
      [14, 18],
    );
  }
  if (range === '1H') {
    return make(
      7,
      (i, d) => {
        d.setDate(d.getDate() - (6 - i));
        return {
          label: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
          full: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
        };
      },
      [3, 5],
    );
  }
  if (range === '1A') {
    return make(
      30,
      (i, d) => {
        d.setDate(d.getDate() - (29 - i));
        return {
          label: String(d.getDate()),
          full: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        };
      },
      [12, 20],
    );
  }
  if (range === '6A') {
    return make(
      6,
      (i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          label: d.toLocaleDateString('tr-TR', { month: 'short' }),
          full: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
        };
      },
      [3, 4],
    );
  }
  return make(
    12,
    (i) => {
      return {
        label: `${String(i + 1).padStart(2, '0')}/2026`,
        full: `${String(i + 1).padStart(2, '0')}/2026`,
      };
    },
    [3, 7],
  );
}

function wave(i: number, n: number, lo: number, hi: number) {
  const t = i / Math.max(1, n - 1);
  const s = 0.35 + 0.4 * Math.sin(t * Math.PI * 1.4) + 0.2 * Math.cos(t * Math.PI * 2.8);
  return lo + (hi - lo) * Math.min(1, Math.max(0, s));
}
