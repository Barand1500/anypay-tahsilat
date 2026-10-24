import { useEffect, useRef, useState, type ReactNode } from 'react';

export type PeriodBank = {
  /** API / mock id (akbank, qnb…) */
  id?: string;
  /** Erişilebilirlik + logo eşlemesi yedek */
  name: string;
  amount: string;
  /** Doğrudan URL gelirse onu kullan */
  logo?: string;
};

type Props = {
  title: string;
  current: string;
  previous: string;
  changePct: number;
  banks: PeriodBank[];
  previousBanks: PeriodBank[];
  currentBankLabel: string;
  previousBankLabel: string;
  /** Boş alanı doldurmak için (örn. vurgu rengi seçici) — kartı büyütmez */
  footer?: ReactNode;
};

export function PeriodCompareCard({ title, current, previous, changePct, footer }: Props) {
  const up = changePct >= 0;
  const [displayPct, setDisplayPct] = useState(changePct);
  const raf = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplayPct(changePct);
      return;
    }
    const from = 0;
    const to = changePct;
    const start = performance.now();
    const dur = 700;
    cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [changePct]);

  return (
    <article className="panel-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))] hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]">
      <TrendArrow up={up} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--panel-muted)] transition group-hover:text-[var(--panel-ink)]">
          {title}
        </h3>
        <span
          className={`rounded-lg border border-slate-950/70 px-2 py-0.5 text-xs font-semibold tabular-nums transition group-hover:scale-105 dark:border-slate-100/70 ${up ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}
        >
          {Math.abs(displayPct).toFixed(2)}%
        </span>
      </div>
      <p className="mt-2 text-[1.85rem] font-extrabold leading-tight tabular-nums text-[var(--panel-ink)]">
        {current}
      </p>
      <p className="mt-1 text-sm text-[var(--panel-muted)]">Önceki: <strong className="text-base font-extrabold tabular-nums text-[var(--panel-ink)]">{previous}</strong></p>
      {footer ? (
        <div className="mt-auto flex min-h-0 flex-col justify-end pt-3">{footer}</div>
      ) : null}
    </article>
  );
}

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none absolute right-1 top-11 h-20 w-20 opacity-20 ${up ? 'text-emerald-600' : 'text-rose-600'}`}
    >
      <path
        d={up ? 'M3 18 9 12l4 3 8-9M15 6h6v6' : 'M3 6l6 6 4-3 8 9m-6 0h6v-6'}
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

