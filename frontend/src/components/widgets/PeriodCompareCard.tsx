import gsap from 'gsap';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { findBankLogo } from '../../pages/payments/mockBanks';

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
  /** Boş alanı doldurmak için (örn. vurgu rengi seçici) — kartı büyütmez */
  footer?: ReactNode;
};

export function PeriodCompareCard({ title, current, previous, changePct, banks, footer }: Props) {
  const up = changePct >= 0;
  const [displayPct, setDisplayPct] = useState(changePct);
  const raf = useRef(0);
  const banksRef = useRef<HTMLUListElement>(null);

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

  useEffect(() => {
    const list = banksRef.current;
    if (!list || banks.length === 0) return;
    const items = list.querySelectorAll('[data-bank-row]');
    if (!items.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    gsap.fromTo(
      items,
      { autoAlpha: 0, x: -6 },
      {
        autoAlpha: 1,
        x: 0,
        duration: 0.32,
        stagger: 0.07,
        ease: 'power2.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, [banks]);

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
        <ul ref={banksRef} className="mt-3 space-y-1.5 border-t border-[var(--panel-line)] pt-3">
          {banks.map((b) => (
            <BankRow key={b.id || b.name} bank={b} />
          ))}
        </ul>
      ) : null}
      {footer ? <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end">{footer}</div> : null}
    </article>
  );
}

function BankRow({ bank }: { bank: PeriodBank }) {
  const src = findBankLogo(bank);
  const [broken, setBroken] = useState(false);

  return (
    <li
      data-bank-row
      className="flex items-center justify-between gap-2 text-xs"
      title={`${bank.name} — ${bank.amount}`}
    >
      <span className="flex min-w-0 items-center">
        {src && !broken ? (
          <span className="flex h-6 w-[4.25rem] shrink-0 items-center justify-start overflow-hidden rounded-md bg-[var(--panel-surface)] px-1.5 ring-1 ring-[var(--panel-line)] transition group-hover:ring-[color-mix(in_srgb,var(--color-brand-500)_25%,var(--panel-line))]">
            <img
              src={src}
              alt={bank.name}
              className="max-h-4 w-auto max-w-full object-contain object-left transition duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setBroken(true)}
            />
          </span>
        ) : (
          <span className="truncate font-semibold text-[var(--panel-ink)]">{bank.name}</span>
        )}
      </span>
      <span className="shrink-0 tabular-nums text-[var(--panel-muted)]">{bank.amount}</span>
    </li>
  );
}
