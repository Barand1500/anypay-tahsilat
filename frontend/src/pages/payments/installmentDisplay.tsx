import type { InstallmentRow } from './mockBanks';

/** Gerçek ödeme dilimi: n + ek taksit */
export function installmentPaymentCount(n: number, plusN = 0): number {
  return Math.max(1, n + Math.max(0, plusN));
}

/** Tablo rozeti: 1+2 (tek renk) */
export function formatInstallmentBadge(n: number, plusN = 0): string {
  const extra = Math.max(0, plusN);
  return extra > 0 ? `${n}+${extra}` : String(n);
}

/** Kart / Seçili başlık — ek taksit varsa toplam (3 taksit) */
export function formatInstallmentTitle(n: number, plusN = 0): string {
  const extra = Math.max(0, plusN);
  if (n === 1 && extra === 0) return 'Tek çekim';
  if (extra > 0) return `${installmentPaymentCount(n, extra)} taksit`;
  return `${n} taksit`;
}

/** Aylık satır: 3 × 1.234,56 (toplam ödeme sayısı) */
export function formatInstallmentPaymentLine(
  row: Pick<InstallmentRow, 'n' | 'plusN' | 'installmentAmount'>,
  chargedTotal: number,
  commissionIncluded: boolean,
  formatMoney: (n: number) => string,
): string {
  const count = installmentPaymentCount(row.n, row.plusN);
  if (count <= 1) return formatMoney(chargedTotal);
  const per = commissionIncluded ? row.installmentAmount : chargedTotal / count;
  return `${count} × ${formatMoney(per)}`;
}

/** Taksit Seçenekleri tablosu — 1+2 tek renk */
export function InstallmentBadge({
  n,
  plusN,
  className = '',
}: {
  n: number;
  plusN?: number;
  className?: string;
}) {
  const extra = Math.max(0, plusN ?? 0);
  if (extra <= 0) {
    return (
      <span className={['font-bold tabular-nums text-[var(--panel-ink)]', className].join(' ')}>
        {n}
      </span>
    );
  }
  return (
    <span
      className={[
        'inline-flex items-baseline justify-end gap-0.5 font-bold tabular-nums text-[var(--panel-ink)]',
        className,
      ].join(' ')}
    >
      <span>{n}</span>
      <span>+{extra}</span>
    </span>
  );
}

export function InstallmentCardWatermark({ n, plusN }: { n: number; plusN?: number }) {
  const extra = Math.max(0, plusN ?? 0);
  const total = installmentPaymentCount(n, extra);
  return (
    <span className="pointer-events-none absolute -bottom-3 left-3 inline-flex items-baseline gap-0.5 leading-none">
      <span className="text-[4.5rem] font-black text-[var(--panel-muted)]/15 sm:text-[5rem]">
        {extra > 0 ? total : n}
      </span>
    </span>
  );
}

/** Taksit kartı — 3D şerit «Komisyon yok» */
export function NoCommissionRibbon() {
  return (
    <span
      className="pointer-events-none absolute -left-2 top-2.5 z-20"
      aria-label="Komisyon yok"
    >
      <svg
        width="112"
        height="34"
        viewBox="0 0 112 34"
        className="overflow-visible drop-shadow-[2px_3px_4px_rgba(0,0,0,0.28)]"
        aria-hidden
      >
        <path d="M8 24 L8 33 L0 24 Z" fill="#9a3412" />
        <path d="M0 0 H92 L112 12 L92 24 H0 Z" fill="#f97316" />
        <text
          x="46"
          y="13.5"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff8f0"
          style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          KOMİSYON YOK
        </text>
      </svg>
    </span>
  );
}

type SelectedSummaryProps = {
  rate: InstallmentRow;
  baseAmount: number;
  commissionIncluded: boolean;
  formatMoney: (n: number) => string;
  formatPct: (n: number) => string;
};

/** Banka & Taksit — Seçili özet (sola hizalı, toplam taksit) */
export function SelectedInstallmentSummary({
  rate,
  baseAmount,
  commissionIncluded,
  formatMoney,
  formatPct,
}: SelectedSummaryProps) {
  const chargedTotal = commissionIncluded ? rate.totalAmount : baseAmount;
  const count = installmentPaymentCount(rate.n, rate.plusN);
  const vadeFarki = Math.max(0, rate.totalAmount - baseAmount);

  return (
    <div className="mt-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
        Seçili
      </p>
      <p className="mt-1 text-lg font-bold text-[var(--panel-ink)]">
        {formatInstallmentTitle(rate.n, rate.plusN)}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--panel-ink)]">
        {formatInstallmentPaymentLine(rate, chargedTotal, commissionIncluded, formatMoney)}
      </p>
      {count > 1 ? (
        <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[var(--panel-muted)]">
          Toplam {formatMoney(chargedTotal)}
        </p>
      ) : null}
      {rate.commissionPct > 0 ? (
        <p className="mt-1.5 text-[11px] font-semibold text-rose-500">
          Vade farkı %{formatPct(rate.commissionPct)}
          {commissionIncluded && vadeFarki > 0 ? ` = ${formatMoney(vadeFarki)}` : ''}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          Komisyon yok
        </p>
      )}
    </div>
  );
}
