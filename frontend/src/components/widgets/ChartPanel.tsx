import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

export type ChartRange = '1G' | '1H' | '1A' | '6A' | '1Y';
export type ChartSeriesDef = { id: string; name: string; color: string };
export type ChartPoint = {
  label: string;
  full: string;
  values: Record<string, number>;
  total: number;
  count: number;
};

type Props = {
  title: string;
  subtitle: string;
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  series: ChartSeriesDef[];
  points: ChartPoint[];
  loading?: boolean;
};

const RANGES: { id: ChartRange; label: string; title: string }[] = [
  { id: '1G', label: 'Gün', title: '06.00–24.00' },
  { id: '1H', label: 'Hafta', title: 'Pazartesi–Pazar' },
  { id: '1A', label: 'Ay', title: 'Seçili ayın günleri' },
  { id: '6A', label: '6 Ay', title: 'Üç ay önce, seçili ay ve iki ay sonra' },
  { id: '1Y', label: 'Yıl', title: 'Ocak–Aralık' },
];

const PAD = { left: 62, right: 18, top: 22, bottom: 43 };

function money(value: number) {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function axisMoney(value: number) {
  return new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function axisMax(value: number) {
  if (value <= 0) return 1;
  const order = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * order >= value) ?? 10;
  return step * order;
}

export function ChartPanel({ title, subtitle, range, onRangeChange, series, points, loading = false }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 320 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setHover(null), [points]);

  const chart = useMemo(() => {
    const totals = points.map((point) => point.total ?? Object.values(point.values).reduce((sum, value) => sum + value, 0));
    const total = totals.reduce((sum, value) => sum + value, 0);
    const count = points.reduce((sum, point) => sum + (point.count ?? 0), 0);
    const peakIndex = totals.reduce((best, value, index) => value > (totals[best] ?? 0) ? index : best, 0);
    const max = axisMax(Math.max(...totals, 0));
    const width = Math.max(1, size.width - PAD.left - PAD.right);
    const height = Math.max(1, size.height - PAD.top - PAD.bottom);
    const step = width / Math.max(points.length, 1);
    return { totals, total, count, peakIndex, max, width, height, step };
  }, [points, size]);

  const peak = points[chart.peakIndex];
  const active = hover == null ? null : points[hover];
  const activeX = hover == null ? 0 : PAD.left + chart.step * (hover + 0.5);
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(chart.width / 68))));
  const linePoints = chart.totals.map((value, index) => ({
    x: PAD.left + chart.step * (index + 0.5),
    y: PAD.top + chart.height * (1 - value / chart.max),
  }));
  const linePath = linePoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = linePoints.length
    ? `${linePath} L ${linePoints[linePoints.length - 1].x} ${PAD.top + chart.height} L ${linePoints[0].x} ${PAD.top + chart.height} Z`
    : '';

  function onPlotMove(event: MouseEvent<HTMLDivElement>) {
    if (!points.length) return;
    const bounds = plotRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = event.clientX - bounds.left;
    if (x < PAD.left || x > size.width - PAD.right) {
      setHover(null);
      return;
    }
    setHover(Math.max(0, Math.min(points.length - 1, Math.floor((x - PAD.left) / chart.step))));
  }

  const bankBreakdown = active
    ? series.map((bank) => ({ ...bank, amount: active.values[bank.id] ?? 0 }))
      .filter((bank) => bank.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    : [];
  const otherAmount = active ? Math.max(0, active.total - bankBreakdown.reduce((sum, bank) => sum + bank.amount, 0)) : 0;

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--panel-line)] px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">Tahsilat akışı</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--panel-ink)]">{title}</h2>
          <p className="text-xs text-[var(--panel-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full border border-[var(--panel-line)] bg-[var(--panel-surface)] p-1" aria-label="Grafik aralığı">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.title}
              aria-pressed={range === item.id}
              onClick={() => onRangeChange(item.id)}
              className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${range === item.id ? 'bg-[var(--color-brand-600)] text-white shadow-sm' : 'text-[var(--panel-muted)] hover:bg-[var(--panel-elevated)] hover:text-[var(--panel-ink)]'}`}
            >
              <span className="mr-1 opacity-75">{item.id}</span>{item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 px-4 pb-2 pt-5 sm:px-6">
        <div className="min-w-0 sm:mr-auto">
          <p className="text-xs font-medium text-[var(--panel-muted)]">Toplam tahsilat</p>
          <p className="mt-1 truncate text-3xl font-bold tracking-tight tabular-nums text-[var(--panel-ink)] sm:text-4xl" title={money(chart.total)}>{money(chart.total)}</p>
        </div>
        <div className="border-l-2 border-[var(--color-brand-500)] pl-3">
          <p className="text-xs text-[var(--panel-muted)]">Başarılı işlem</p>
          <p className="text-lg font-bold tabular-nums text-[var(--panel-ink)]">{chart.count.toLocaleString('tr-TR')}</p>
        </div>
        <div className="min-w-0 border-l-2 border-[var(--panel-line)] pl-3">
          <p className="text-xs text-[var(--panel-muted)]">En yüksek dönem</p>
          <p className="max-w-48 truncate text-lg font-bold tabular-nums text-[var(--panel-ink)]" title={peak?.full}>
            {chart.total > 0 && peak ? `${peak.label} · ${money(chart.totals[chart.peakIndex])}` : '—'}
          </p>
        </div>
      </div>

      <div
        ref={plotRef}
        className={`relative mx-2 mb-4 mt-3 h-[280px] overflow-hidden rounded-xl bg-[var(--chart-bg)] transition-opacity sm:mx-4 sm:h-[320px] ${loading ? 'opacity-50' : 'opacity-100'}`}
        onMouseMove={onPlotMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`${title}: seçili aralıkta ${money(chart.total)} ve ${chart.count} başarılı işlem`}>
          <defs>
            <linearGradient id="overview-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((index) => {
            const y = PAD.top + (chart.height * index) / 4;
            return (
              <g key={index}>
                <line x1={PAD.left} x2={size.width - PAD.right} y1={y} y2={y} stroke="var(--panel-line)" strokeDasharray={index === 4 ? undefined : '4 5'} />
                <text x={PAD.left - 10} y={y + 4} textAnchor="end" fill="var(--panel-muted)" fontSize="10">{axisMoney(chart.max * (1 - index / 4))}</text>
              </g>
            );
          })}
          {areaPath ? <path d={areaPath} fill="url(#overview-area-gradient)" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="var(--color-brand-600)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((point, index) => {
            const center = PAD.left + chart.step * (index + 0.5);
            const labelX = range === '1G'
              ? index === points.length - 1 ? PAD.left + chart.width : PAD.left + chart.step * index
              : center;
            const selected = hover === index;
            return (
              <g key={`${point.full}-${index}`}>
                {selected ? <line x1={center} x2={center} y1={PAD.top} y2={PAD.top + chart.height} stroke="var(--color-brand-500)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" /> : null}
                {(selected || points.length <= 14) && chart.totals[index] > 0 ? <circle cx={center} cy={linePoints[index].y} r={selected ? 6 : 3} fill="var(--color-brand-600)" stroke="var(--panel-elevated)" strokeWidth={selected ? 3 : 1.5} /> : null}
                {(index === points.length - 1 || (index % labelStep === 0 && index < points.length - labelStep)) ? (
                  <text x={labelX} y={size.height - 15} textAnchor={range === '1G' && index === points.length - 1 ? 'end' : range === '1G' && index === 0 ? 'start' : 'middle'} fill="var(--panel-muted)" fontSize="11">
                    {range === '1G' && index === points.length - 1 ? '24:00' : point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {!loading && chart.total === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2 text-sm text-[var(--panel-muted)] shadow-sm">Bu aralıkta başarılı tahsilat yok</span>
          </div>
        ) : null}
        {loading ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-[var(--panel-ink)]">Grafik yükleniyor…</div> : null}

        {!loading && active && chart.total > 0 ? (
          <div
            className="pointer-events-none absolute top-3 z-10 w-56 max-w-[calc(100%-16px)] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 shadow-[var(--panel-shadow)]"
            style={{ left: Math.max(120, Math.min(activeX, size.width - 120)), transform: 'translateX(-50%)' }}
          >
            <p className="text-xs font-bold text-[var(--panel-ink)]">{active.full}</p>
            <p className="mt-1 text-base font-bold tabular-nums text-[var(--color-brand-700)]">{money(active.total)}</p>
            <p className="text-[11px] text-[var(--panel-muted)]">{active.count} başarılı işlem</p>
            {bankBreakdown.length || otherAmount > 0 ? (
              <div className="mt-2 space-y-1 border-t border-[var(--panel-line)] pt-2">
                {bankBreakdown.map((bank) => (
                  <div key={bank.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-[var(--panel-muted)]">{bank.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--panel-ink)]">{money(bank.amount)}</span>
                  </div>
                ))}
                {otherAmount > 0.01 ? <div className="flex justify-between gap-2 text-[11px]"><span className="text-[var(--panel-muted)]">Diğer</span><span className="font-semibold tabular-nums text-[var(--panel-ink)]">{money(otherAmount)}</span></div> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
