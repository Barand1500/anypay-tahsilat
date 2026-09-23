import { useEffect, useRef, useState } from 'react';

type Tone = 'blue' | 'green' | 'red' | 'orange';

type Props = {
  title: string;
  value: string;
  meta: string;
  tone: Tone;
};

const TONE: Record<Tone, string> = {
  blue: 'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--color-brand-600)]',
  green: 'bg-emerald-500/15 text-emerald-600',
  red: 'bg-rose-500/15 text-rose-600',
  orange: 'bg-orange-500/15 text-orange-600',
};

export function StatCard({ title, value, meta, tone }: Props) {
  const [hovered, setHovered] = useState(false);
  const [display, setDisplay] = useState(value);
  const raf = useRef(0);

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  function onEnter() {
    setHovered(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parsed = parseTrNumber(value);
    if (reduced || parsed == null) return;

    const { num, suffix } = parsed;
    const from = num * 0.72;
    const start = performance.now();
    const dur = 520;
    cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (num - from) * eased;
      setDisplay(formatLike(value, v) + suffix);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function onLeave() {
    setHovered(false);
    cancelAnimationFrame(raf.current);
    setDisplay(value);
  }

  return (
    <article
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="panel-card group relative flex h-full min-h-[120px] flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] transition duration-300 hover:-translate-y-1.5 hover:border-[color-mix(in_srgb,var(--color-brand-500)_40%,var(--panel-line))] hover:shadow-[0_18px_44px_color-mix(in_srgb,var(--color-brand-500)_20%,transparent)]"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
        style={{ background: 'var(--color-brand-500)' }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--panel-muted)] transition group-hover:text-[var(--panel-ink)]">
            {title}
          </h3>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight text-[var(--panel-ink)] transition duration-300 ${hovered ? 'scale-[1.03]' : ''}`}
            style={{ transformOrigin: 'left center' }}
          >
            {display}
          </p>
          <p className="mt-1 text-xs text-[var(--panel-muted)] transition group-hover:translate-x-0.5">
            {meta}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110 group-hover:rotate-6 ${TONE[tone]}`}
        >
          <Dot />
        </span>
      </div>
    </article>
  );
}

function Dot() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function parseTrNumber(raw: string): { num: number; suffix: string } | null {
  const m = raw.match(/^([\d.]+(?:,\d+)?)\s*(.*)$/);
  if (!m) return null;
  const num = Number(m[1].replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(num)) return null;
  return { num, suffix: m[2] ? ` ${m[2]}` : '' };
}

function formatLike(original: string, n: number): string {
  const hasDecimal = original.includes(',');
  if (hasDecimal) {
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString('tr-TR');
}
