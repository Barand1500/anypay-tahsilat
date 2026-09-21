import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useMemo, useRef, useState } from 'react';
import { formatMoneyTr, type StatRankItem } from './mockStatistics';

gsap.registerPlugin(useGSAP);

type Props = {
  title: string;
  subtitle?: string;
  items: StatRankItem[];
  /** Banka satırlarında logo göster */
  showLogo?: boolean;
};

/**
 * Sıralı liste + animasyonlu donut — satır / dilim hover senkron.
 */
export function StatRankingCard({ title, subtitle, items, showLogo }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const total = useMemo(() => items.reduce((s, x) => s + x.amount, 0) || 1, [items]);
  const max = useMemo(() => Math.max(...items.map((x) => x.amount), 1), [items]);

  const arcs = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const r = 72;
    const inner = 44;
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
      const lx = cx + ((r + inner) / 2) * Math.cos(mid);
      const ly = cy + ((r + inner) / 2) * Math.sin(mid);
      const d = [
        `M ${x0} ${y0}`,
        `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
        `L ${xi0} ${yi0}`,
        `A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1}`,
        'Z',
      ].join(' ');
      const pct = Math.round((slice.amount / total) * 100);
      return { ...slice, d, pct, lx, ly, showLabel: pct >= 5 };
    });
  }, [items, total]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(root, { autoAlpha: 0, y: 18, duration: 0.45 })
        .from(
          root.querySelectorAll('[data-rank-row]'),
          { autoAlpha: 0, x: -12, stagger: 0.045, duration: 0.35 },
          '-=0.2',
        )
        .from(
          root.querySelectorAll('[data-rank-bar]'),
          { scaleX: 0, transformOrigin: 'left center', stagger: 0.045, duration: 0.55, ease: 'power2.out' },
          '-=0.55',
        )
        .from(
          root.querySelectorAll('[data-donut-slice]'),
          { scale: 0.6, transformOrigin: '100px 100px', stagger: 0.04, duration: 0.5, ease: 'back.out(1.4)' },
          '-=0.45',
        );
    },
    { scope: rootRef, dependencies: [items], revertOnUpdate: true },
  );

  return (
    <section
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
    >
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--panel-ink)]">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{subtitle}</p> : null}
        </div>
        <p className="text-right text-xs text-[var(--panel-muted)]">
          Toplam{' '}
          <span className="font-bold tabular-nums text-[var(--panel-ink)]">
            {formatMoneyTr(total)} ₺
          </span>
        </p>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)] lg:gap-6 lg:p-5">
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
                    onFocus={() => setHoverId(item.id)}
                    onBlur={() => setHoverId(null)}
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
                      <div className="flex items-center gap-2">
                        {showLogo && item.logo ? (
                          <img
                            src={item.logo}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-md object-contain bg-white/80 p-0.5 dark:bg-white/10"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--panel-ink)]">
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
                      {formatMoneyTr(item.amount)} ₺
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-3 py-4">
          <svg width="200" height="200" viewBox="0 0 200 200" className="shrink-0" aria-hidden>
            {arcs.map((a) => {
              const active = hoverId === a.id;
              const dim = hoverId != null && !active;
              return (
                <g key={a.id}>
                  <path
                    data-donut-slice
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
                      {a.label}: {formatMoneyTr(a.amount)} ₺ ({a.pct}%)
                    </title>
                  </path>
                  {a.showLabel ? (
                    <text
                      x={a.lx}
                      y={a.ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none fill-white font-bold"
                      style={{ fontSize: 11, opacity: dim ? 0.35 : 1 }}
                    >
                      {a.pct}%
                    </text>
                  ) : null}
                </g>
              );
            })}
            <circle cx="100" cy="100" r="38" fill="var(--panel-elevated)" />
            <text
              x="100"
              y="94"
              textAnchor="middle"
              className="fill-[var(--panel-muted)]"
              style={{ fontSize: 10 }}
            >
              Dilim
            </text>
            <text
              x="100"
              y="112"
              textAnchor="middle"
              className="fill-[var(--panel-ink)] font-bold"
              style={{ fontSize: 16, fontWeight: 700 }}
            >
              {items.length}
            </text>
          </svg>

          <ul className="flex max-w-full flex-wrap justify-center gap-x-3 gap-y-1.5">
            {items.slice(0, 6).map((a) => (
              <li key={a.id} className="flex max-w-[140px] items-center gap-1.5 text-[11px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: a.color }}
                />
                <span className="truncate text-[var(--panel-muted)]">{a.label}</span>
              </li>
            ))}
            {items.length > 6 ? (
              <li className="text-[11px] text-[var(--panel-muted)]">+{items.length - 6}</li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
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
