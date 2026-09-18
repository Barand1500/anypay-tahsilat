import { useEffect, useRef, useState, type ReactNode } from 'react';

type Bank = { name: string; amount: string };

type Props = {
  title: string;
  current: string;
  previous: string;
  changePct: number;
  banks: Bank[];
  /** Boş alanı doldurmak için (örn. vurgu rengi seçici) — kartı büyütmez */
  footer?: ReactNode;
};

export function PeriodCompareCard({ title, current, previous, changePct, banks, footer }: Props) {
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
    <article className="panel-card group flex h-full min-h-[168px] flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))] hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--panel-muted)] transition group-hover:text-[var(--panel-ink)]">
          {title}
        </h3>
        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition group-hover:scale-105 ${up ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}
        >
          {up ? '+' : ''}
          {displayPct.toFixed(2)}%
        </span>
      </div>
      <p className="mt-3 text-xl font-bold text-[var(--panel-ink)] transition group-hover:tracking-wide">
        {current}
      </p>
      <p className="mt-1 text-xs text-[var(--panel-muted)]">Önceki: {previous}</p>
      {banks.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-[var(--panel-line)] pt-3">
          {banks.map((b) => (
            <li key={b.name} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--panel-ink)]">{b.name}</span>
              <span className="text-[var(--panel-muted)]">{b.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end">{footer}</div> : null}
    </article>
  );
}
