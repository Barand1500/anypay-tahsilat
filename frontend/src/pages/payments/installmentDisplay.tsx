import type { InstallmentRow } from './mockBanks';

/** Gerçek ödeme dilimi: n + ek taksit */
export function installmentPaymentCount(n: number, plusN = 0): number {
  return Math.max(1, n + Math.max(0, plusN));
}

/** Tablo / rozet: 6+2 */
export function formatInstallmentBadge(n: number, plusN = 0): string {
  const extra = Math.max(0, plusN);
  return extra > 0 ? `${n}+${extra}` : String(n);
}

/** Kart başlığı */
export function formatInstallmentTitle(n: number, plusN = 0): string {
  const extra = Math.max(0, plusN);
  if (n === 1 && extra === 0) return 'Tek çekim';
  if (extra > 0) return `${formatInstallmentBadge(n, extra)} taksit`;
  return `${n} taksit`;
}

/** Aylık satır: 6+2 × 1.234,56 */
export function formatInstallmentPaymentLine(
  row: Pick<InstallmentRow, 'n' | 'plusN' | 'installmentAmount'>,
  chargedTotal: number,
  commissionIncluded: boolean,
  formatMoney: (n: number) => string,
): string {
  const count = installmentPaymentCount(row.n, row.plusN);
  if (count <= 1) return formatMoney(chargedTotal);
  const per = commissionIncluded ? row.installmentAmount : chargedTotal / count;
  return `${formatInstallmentBadge(row.n, row.plusN)} × ${formatMoney(per)}`;
}

/** Taksit Seçenekleri — ek taksit alt satır */
export function formatInstallmentExtraHint(n: number, plusN = 0): string | null {
  const extra = Math.max(0, plusN);
  if (extra <= 0) return null;
  const total = installmentPaymentCount(n, extra);
  return `${total} ödeme (${n}+${extra})`;
}

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
        'inline-flex items-baseline justify-end gap-0.5 tabular-nums',
        className,
      ].join(' ')}
    >
      <span className="font-bold text-[var(--panel-ink)]">{n}</span>
      <span className="text-[11px] font-extrabold text-[var(--color-brand-600)]">+{extra}</span>
    </span>
  );
}

export function InstallmentCardWatermark({ n, plusN }: { n: number; plusN?: number }) {
  const extra = Math.max(0, plusN ?? 0);
  return (
    <span className="pointer-events-none absolute -bottom-3 left-3 inline-flex items-baseline gap-0.5 leading-none">
      <span className="text-[4.5rem] font-black text-[var(--panel-muted)]/15 sm:text-[5rem]">{n}</span>
      {extra > 0 ? (
        <span className="pb-3 text-2xl font-black text-[var(--color-brand-500)]/35 sm:text-3xl">
          +{extra}
        </span>
      ) : null}
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
