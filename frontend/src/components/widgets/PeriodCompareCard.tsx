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

export function PeriodCompareCard({
  title,
  current,
  previous,
  changePct,
  banks,
  previousBanks,
  currentBankLabel,
  previousBankLabel,
  footer,
}: Props) {
  const up = changePct >= 0;
  const [displayPct, setDisplayPct] = useState(changePct);
  const raf = useRef(0);
  const many = banks.length > 3 || previousBanks.length > 3;
  const pinKey = `anypay.periodPin.${title}`;
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(pinKey) === '1';
    } catch {
      return false;
    }
  });
  const [hover, setHover] = useState(false);
  const open = many && (pinned || hover);

  useEffect(() => {
    try {
      localStorage.setItem(pinKey, pinned ? '1' : '0');
    } catch {
      /* yoksay */
    }
  }, [pinKey, pinned]);

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
    <article
      className="panel-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))] hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
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
      <div className="relative mt-3 border-t border-[var(--panel-line)] pt-2">
        <div className="relative grid grid-cols-2 gap-2.5">
          <span className="pointer-events-none absolute bottom-1 left-1/2 top-1 w-px bg-[var(--panel-line)]" aria-hidden />
          {[
            { label: previousBankLabel, rows: previousBanks },
            { label: currentBankLabel, rows: banks },
          ].map((column) => (
            <div key={column.label} className="min-w-0">
              <p className="mb-1 truncate text-[10px] font-bold text-[var(--color-brand-700)]">{column.label}</p>
              <ul
                className={`min-w-0 space-y-1.5 overflow-hidden pr-1 transition-[max-height] duration-300 ease-out ${open ? 'max-h-[2400px]' : 'max-h-[4.7rem]'}`}
              >
                {column.rows.length ? (
                  column.rows.map((b) => <BankRow key={b.id || b.name} bank={b} />)
                ) : (
                  <li className="text-[10px] text-[var(--panel-muted)]">İşlem yok</li>
                )}
              </ul>
            </div>
          ))}
        </div>
        {many ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p
              className={`inline-flex items-center gap-1 text-[10px] font-medium text-[var(--panel-muted)] transition-opacity duration-300 ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
            >
              <span className={open ? '' : 'inline-block animate-bounce'}>↓</span>
              devamı var…
            </p>
            <button
              type="button"
              aria-pressed={pinned}
              onClick={() => setPinned((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition duration-300 ${
                pinned
                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                  : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-transform duration-300 ${pinned ? 'scale-110 bg-white' : 'scale-75 bg-[var(--color-brand-500)]'}`}
              />
              {pinned ? 'Sabit' : 'Sabitle'}
            </button>
          </div>
        ) : null}
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

function BankRow({ bank }: { bank: PeriodBank }) {
  const src = (bank.logo || '').trim();
  const [broken, setBroken] = useState(false);

  return (
    <li className="flex min-w-0 items-center justify-between gap-1.5" title={`${bank.name} — ${bank.amount}`}>
      <span className="flex min-w-0 items-center">
        {src && !broken ? (
          <span className="flex h-6 w-14 shrink-0 items-center justify-start overflow-hidden rounded-md bg-[var(--panel-surface)] px-0.5 ring-1 ring-[var(--panel-line)] sm:w-16">
            <img
              src={src}
              alt={bank.name}
              className="max-h-5 w-auto max-w-full object-contain object-left"
              loading="lazy"
              onError={() => setBroken(true)}
            />
          </span>
        ) : (
          <span className="truncate text-[10px] font-semibold text-[var(--panel-ink)]">{bank.name}</span>
        )}
      </span>
      <span className="min-w-0 truncate text-right text-[11px] font-extrabold tabular-nums text-[var(--panel-ink)]">
        {bank.amount}
      </span>
    </li>
  );
}

