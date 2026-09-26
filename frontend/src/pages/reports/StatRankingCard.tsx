import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SearchableCombobox } from '../../components/ui/SearchableCombobox';
import { formatMoneyDisplay, type StatRankItem } from './statisticsTypes';

gsap.registerPlugin(useGSAP);

export type ChartViewMode = 'donut' | 'pie' | 'columns';

export const CHART_VIEW_OPTIONS = [
  { value: 'donut', label: 'Pasta (halka)' },
  { value: 'pie', label: 'Pasta (dolu)' },
  { value: 'columns', label: 'Sütun grafik' },
];

type Props = {
  title: string;
  subtitle?: string;
  items: StatRankItem[];
  showLogo?: boolean;
  /** Taşıma modunda sadece başlık satırı */
  collapsed?: boolean;
  /** Sürükleniyor */
  dragging?: boolean;
  onDragHandleDown?: (e: ReactPointerEvent) => void;
};

/**
 * Sıralı liste + görünüm seçmeli grafik alanı.
 */
export function StatRankingCard({
  title,
  subtitle,
  items,
  showLogo,
  collapsed,
  dragging,
  onDragHandleDown,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [view, setView] = useState<ChartViewMode>('donut');
  const total = useMemo(() => items.reduce((s, x) => s + x.amount, 0) || 1, [items]);
  const max = useMemo(() => Math.max(...items.map((x) => x.amount), 1), [items]);

  const arcs = useMemo(() => buildArcs(items, total, view === 'pie' ? 0 : 48), [items, total, view]);

  useGSAP(
    () => {
      if (collapsed) return;
      const rows = rootRef.current?.querySelectorAll('[data-rank-row]');
      const bars = rootRef.current?.querySelectorAll('[data-rank-bar]');
      if (rows?.length) {
        gsap.fromTo(
          rows,
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, stagger: 0.04, duration: 0.32, ease: 'power2.out', clearProps: 'transform' },
        );
      }
      if (bars?.length) {
        gsap.fromTo(
          bars,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: 'left center',
            stagger: 0.04,
            duration: 0.45,
            ease: 'power2.out',
          },
        );
      }
    },
    { scope: rootRef, dependencies: [items, collapsed], revertOnUpdate: true },
  );

  useEffect(() => {
    if (collapsed || !chartRef.current) return;
    const el = chartRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    if (view === 'donut' || view === 'pie') {
      const slices = el.querySelectorAll('[data-chart-slice]');
      gsap.fromTo(
        slices,
        { scale: 0.55, opacity: 0, transformOrigin: '140px 140px' },
        {
          scale: 1,
          opacity: 1,
          stagger: 0.035,
          duration: 0.55,
          ease: 'back.out(1.5)',
          clearProps: 'transform',
        },
      );
    } else if (view === 'columns') {
      const bars = el.querySelectorAll<SVGRectElement>('[data-chart-bar]');
      bars.forEach((bar, i) => {
        const h = Number(bar.getAttribute('data-h') || 0);
        const baseY = Number(bar.getAttribute('data-base-y') || 0);
        gsap.fromTo(
          bar,
          { attr: { height: 0, y: baseY }, opacity: 0.4 },
          {
            attr: { height: h, y: baseY - h },
            opacity: 1,
            duration: 0.5,
            delay: i * 0.04,
            ease: 'power3.out',
          },
        );
      });
    }
  }, [view, items, collapsed]);

  return (
    <section
      ref={rootRef}
      className={[
        'rounded-2xl border bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] transition-[box-shadow,border-color,opacity] duration-200 select-none',
        dragging
          ? 'border-[var(--color-brand-500)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] opacity-95'
          : 'border-[var(--panel-line)]',
        collapsed ? 'overflow-hidden' : '',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-3 py-3 sm:px-4 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Sırayı değiştir — basılı tutup sürükle"
            title="Basılı tutup sürükleyerek sırayı değiştir"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragHandleDown?.(e);
            }}
            className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] active:cursor-grabbing select-none"
          >
            <GripIcon />
          </button>
          <div className="min-w-0 pointer-events-none">
            <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--panel-ink)]">
              {title}
            </h2>
            {!collapsed && subtitle ? (
              <p className="mt-0.5 truncate text-xs text-[var(--panel-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-right text-xs text-[var(--panel-muted)]">
          Toplam{' '}
          <span className="font-bold tabular-nums text-[var(--panel-ink)]">
            {formatMoneyDisplay(total)}
          </span>
        </p>
      </header>

      {!collapsed ? (
        <div className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-5 lg:p-5">
          {/* Sol: sıralı liste — her zaman görünür */}
          <div className="min-w-0">
            <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              <span className="w-6 text-center">#</span>
              <span>Ünvan</span>
              <span className="text-right">Toplam tutar</span>
            </div>
            <ul className="space-y-1">
              {items.map((item, i) => {
                const active = hoverId === item.id;
                const dim = hoverId != null && !active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-rank-row
                      onMouseEnter={() => setHoverId(item.id)}
                      onMouseLeave={() => setHoverId(null)}
                      className={[
                        'group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-1.5 py-2 text-left transition',
                        active
                          ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-surface))]'
                          : 'hover:bg-[var(--panel-hover)]',
                        dim ? 'opacity-45' : 'opacity-100',
                      ].join(' ')}
                    >
                      <RankBadge n={i + 1} color={item.color} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          {showLogo && item.logo ? (
                            <img
                              src={item.logo}
                              alt=""
                              className="h-9 w-14 shrink-0 rounded-md object-contain bg-white/90 p-1 dark:bg-white/10"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p
                              className={[
                                'truncate font-semibold text-[var(--panel-ink)]',
                                showLogo ? 'text-[11px] leading-snug' : 'text-[13px]',
                              ].join(' ')}
                            >
                              {item.label}
                            </p>
                            {item.meta ? (
                              <p className="truncate text-[11px] tabular-nums text-[var(--panel-muted)]">
                                {item.meta}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--panel-surface)]">
                          <div
                            data-rank-bar
                            className="h-full rounded-full"
                            style={{
                              width: `${(item.amount / max) * 100}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 pl-2 text-right text-[13px] font-bold tabular-nums text-[var(--panel-ink)]">
                        {formatMoneyDisplay(item.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Sağ: görünüm seçimli grafik kutusu */}
          <div
            ref={chartRef}
            className="flex min-h-[320px] flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/40 p-3 sm:p-4"
          >
            <div className="mb-2 flex justify-end">
              <div className="w-full max-w-[200px]">
                <SearchableCombobox
                  label="Görünüm"
                  options={CHART_VIEW_OPTIONS}
                  value={view}
                  onChange={(v) => setView((v as ChartViewMode) || 'donut')}
                  placeholder="Görünüm…"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center">
              {view === 'donut' || view === 'pie' ? (
                <DonutView
                  arcs={arcs}
                  items={items}
                  hoverId={hoverId}
                  setHoverId={setHoverId}
                  hole={view === 'donut'}
                />
              ) : null}
              {view === 'columns' ? (
                <ColumnChartView items={items} max={max} hoverId={hoverId} setHoverId={setHoverId} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type Arc = StatRankItem & {
  d: string;
  pct: number;
  lx: number;
  ly: number;
  showLabel: boolean;
};

function buildArcs(items: StatRankItem[], total: number, inner: number): Arc[] {
  const cx = 140;
  const cy = 140;
  const r = 118;
  let angle = -Math.PI / 2;
  return items.map((slice) => {
    const sweep = (slice.amount / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + Math.max(sweep, 0.001);
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const xi0 = cx + inner * Math.cos(a1);
    const yi0 = cy + inner * Math.sin(a1);
    const xi1 = cx + inner * Math.cos(a0);
    const yi1 = cy + inner * Math.sin(a0);
    const mid = a0 + sweep / 2;
    const labelR = inner > 0 ? (r + inner) / 2 : r * 0.62;
    const lx = cx + labelR * Math.cos(mid);
    const ly = cy + labelR * Math.sin(mid);
    const d =
      inner > 0
        ? [
            `M ${x0} ${y0}`,
            `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
            `L ${xi0} ${yi0}`,
            `A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1}`,
            'Z',
          ].join(' ')
        : [
            `M ${cx} ${cy}`,
            `L ${x0} ${y0}`,
            `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
            'Z',
          ].join(' ');
    const pct = Math.round((slice.amount / total) * 100);
    return { ...slice, d, pct, lx, ly, showLabel: pct >= 4 };
  });
}

function DonutView({
  arcs,
  items,
  hoverId,
  setHoverId,
  hole,
}: {
  arcs: Arc[];
  items: StatRankItem[];
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  hole: boolean;
}) {
  return (
    <>
      <svg width="280" height="280" viewBox="0 0 280 280" className="shrink-0" aria-hidden>
        {arcs.map((a) => {
          const active = hoverId === a.id;
          const dim = hoverId != null && !active;
          return (
            <g key={a.id}>
              <path
                data-chart-slice
                d={a.d}
                fill={a.color}
                className="cursor-pointer transition-[opacity,filter] duration-200"
                style={{
                  opacity: dim ? 0.28 : 1,
                  filter: active ? 'brightness(1.08)' : undefined,
                }}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>
                  {a.label}: {formatMoneyDisplay(a.amount)} ({a.pct}%)
                </title>
              </path>
              {a.showLabel ? (
                <text
                  x={a.lx}
                  y={a.ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none fill-white font-bold"
                  style={{ fontSize: 13, opacity: dim ? 0.35 : 1 }}
                >
                  {a.pct}%
                </text>
              ) : null}
            </g>
          );
        })}
        {hole ? (
          <>
            <circle cx="140" cy="140" r="44" fill="var(--panel-elevated)" />
            <text
              x="140"
              y="134"
              textAnchor="middle"
              className="fill-[var(--panel-muted)]"
              style={{ fontSize: 11 }}
            >
              Dilim
            </text>
            <text
              x="140"
              y="154"
              textAnchor="middle"
              className="fill-[var(--panel-ink)] font-bold"
              style={{ fontSize: 20, fontWeight: 700 }}
            >
              {items.length}
            </text>
          </>
        ) : null}
      </svg>
      <ul className="mt-2 flex max-w-full flex-wrap justify-center gap-x-3 gap-y-1.5">
        {items.slice(0, 6).map((a) => (
          <li key={a.id} className="flex max-w-[140px] items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
            <span className="truncate text-[var(--panel-muted)]">{a.label}</span>
          </li>
        ))}
        {items.length > 6 ? (
          <li className="text-[11px] text-[var(--panel-muted)]">+{items.length - 6}</li>
        ) : null}
      </ul>
    </>
  );
}

function ColumnChartView({
  items,
  max,
  hoverId,
  setHoverId,
}: {
  items: StatRankItem[];
  max: number;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
}) {
  const W = 340;
  const H = 268;
  const padL = 40;
  const padR = 10;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);
  const gap = 5;
  const barW = Math.max(10, (plotW - gap * (items.length + 1)) / items.length);
  const baseY = padT + plotH;

  function fmtShort(n: number) {
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  }

  return (
    <div className="w-full self-stretch select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-[360px]" role="img">
        {ticks.map((t) => {
          const y = padT + plotH - (t / niceMax) * plotH;
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="var(--panel-line)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '3 4'}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--panel-muted)]"
                style={{ fontSize: 9 }}
              >
                {fmtShort(t)}
              </text>
            </g>
          );
        })}

        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={baseY}
          stroke="var(--panel-line)"
          strokeWidth={1.5}
        />
        <line
          x1={padL}
          y1={baseY}
          x2={W - padR}
          y2={baseY}
          stroke="var(--panel-line)"
          strokeWidth={1.5}
        />

        {items.map((item, i) => {
          const h = Math.max((item.amount / niceMax) * plotH, 2);
          const x = padL + gap + i * (barW + gap);
          const active = hoverId === item.id;
          const dim = hoverId != null && !active;
          return (
            <g
              key={item.id}
              onMouseEnter={() => setHoverId(item.id)}
              onMouseLeave={() => setHoverId(null)}
              className="cursor-pointer"
              opacity={dim ? 0.35 : 1}
            >
              <rect
                data-chart-bar
                data-h={h}
                data-base-y={baseY}
                x={x}
                y={baseY - h}
                width={barW}
                height={h}
                rx={4}
                fill={item.color}
              >
                <title>
                  {item.label}: {formatMoneyDisplay(item.amount)}
                </title>
              </rect>
              <text
                x={x + barW / 2}
                y={baseY + 14}
                textAnchor="middle"
                className="fill-[var(--panel-muted)]"
                style={{ fontSize: 9, fontWeight: 700 }}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverId ? (
        <p className="mt-1 truncate text-center text-[11px] text-[var(--panel-muted)]">
          {items.find((x) => x.id === hoverId)?.label} —{' '}
          <span className="font-semibold tabular-nums text-[var(--panel-ink)]">
            {formatMoneyDisplay(items.find((x) => x.id === hoverId)?.amount ?? 0)}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-center text-[11px] text-[var(--panel-muted)]">
          Sütuna gelince detay görünür
        </p>
      )}
    </div>
  );
}

function RankBadge({ n, color }: { n: number; color: string }) {
  if (n <= 3) {
    const tones = ['#d97706', '#94a3b8', '#b45309'];
    return (
      <span
        className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm"
        style={{ background: tones[n - 1] }}
      >
        {n}
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      {n}
    </span>
  );
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}
