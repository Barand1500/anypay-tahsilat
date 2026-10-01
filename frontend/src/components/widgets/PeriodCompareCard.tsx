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
  previousBanks: PeriodBank[];
  currentBankLabel: string;
  previousBankLabel: string;
  /** Boş alanı doldurmak için (örn. vurgu rengi seçici) — kartı büyütmez */
  footer?: ReactNode;
};

export function PeriodCompareCard({ title, current, previous, changePct, banks, previousBanks, currentBankLabel, previousBankLabel, footer }: Props) {
  const up = changePct >= 0;
  const [displayPct, setDisplayPct] = useState(changePct);
  const raf = useRef(0);
  const banksRef = useRef<HTMLDivElement>(null);

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
    if (!list || (banks.length === 0 && previousBanks.length === 0)) return;
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
  }, [banks, previousBanks]);

  return (
    <article className="panel-card group relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))] hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]">
      <TrendArrow up={up} />
      <div className="relative z-10 flex items-start justify-between gap-2">
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
      <p className="mt-2 text-[1.7rem] font-extrabold leading-tight tabular-nums text-[var(--panel-ink)]">
        {current}
      </p>
      <p className="mt-1 text-sm text-[var(--panel-muted)]">Önceki: <strong className="font-bold tabular-nums text-[var(--panel-ink)]">{previous}</strong></p>
      <div ref={banksRef} className="mt-3 border-t border-[var(--panel-line)] pt-2">
        <p className="mb-1 text-[10px] font-semibold text-[var(--panel-muted)]">En çok tahsilat yapılan bankalar</p>
        <div className="relative grid grid-cols-2 gap-2.5">
          <span className="pointer-events-none absolute bottom-1 left-1/2 top-1 w-px bg-[var(--panel-line)]" aria-hidden />
          {[
            { label: currentBankLabel, rows: banks },
            { label: previousBankLabel, rows: previousBanks },
          ].map((column) => (
            <div key={column.label} className="min-w-0">
              <p className="mb-1 truncate text-[10px] font-bold text-[var(--color-brand-700)]">{column.label}</p>
              <ul className="max-h-[90px] min-w-0 space-y-1.5 overflow-y-auto pr-1">
                {column.rows.length ? column.rows.map((b) => <BankRow key={b.id || b.name} bank={b} />) : (
                  <li className="text-[10px] text-[var(--panel-muted)]">İşlem yok</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
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
      className={`pointer-events-none absolute right-1 top-1 h-20 w-20 opacity-20 ${up ? 'text-emerald-600' : 'text-rose-600'}`}
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

function BankRow({ bank }: { bank: PeriodBank }) {
  const src = findBankLogo(bank);
  const [broken, setBroken] = useState(false);

  return (
    <li
      data-bank-row
      className="flex min-w-0 items-center justify-between gap-1 text-[10px]"
      title={`${bank.name} — ${bank.amount}`}
    >
      <span className="flex min-w-0 items-center">
        {src && !broken ? (
          <span className="flex h-6 w-12 shrink-0 items-center justify-start overflow-hidden rounded-md bg-[var(--panel-surface)] px-1 ring-1 ring-[var(--panel-line)] transition group-hover:ring-[color-mix(in_srgb,var(--color-brand-500)_25%,var(--panel-line))] xl:w-16">
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
      <span className="min-w-0 truncate text-right text-[10px] font-semibold tabular-nums text-[var(--panel-ink)] xl:text-[11px]">{bank.amount}</span>
    </li>
  );
}
