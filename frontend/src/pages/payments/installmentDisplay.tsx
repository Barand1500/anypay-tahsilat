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

export function formatVadeFarkiLine(
  commissionPct: number,
  vadeFarki: number,
  commissionIncluded: boolean,
  formatMoney: (n: number) => string,
): string {
  const pct = formatMoney(commissionPct);
  if (commissionIncluded && vadeFarki > 0) {
    return `Vade Farkı %${pct} (${formatMoney(vadeFarki)})`;
  }
  return `Vade Farkı %${pct}`;
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

export function InstallmentCardWatermark({
  n,
  plusN,
  selected = false,
}: {
  n: number;
  plusN?: number;
  selected?: boolean;
}) {
  const extra = Math.max(0, plusN ?? 0);
  const total = installmentPaymentCount(n, extra);
  const num = extra > 0 ? total : n;
  return (
    <span className="pointer-events-none absolute bottom-1 left-3 z-[2] flex flex-col items-start leading-none">
      {selected ? (
        <span className="install-card-selected-pill mb-1 inline-flex h-5 items-center justify-center rounded-full px-2.5 text-[10px] font-semibold leading-none tracking-wide">
          Seçili
        </span>
      ) : null}
      <span className="flex items-end gap-1.5">
        <span className="install-card-watermark-num -mb-2 text-[4.5rem] font-black text-[var(--panel-muted)]/15 sm:text-[5rem]">
          {num}
        </span>
        <span className="install-card-watermark-label mb-2 text-[11px] font-semibold tracking-wide text-[var(--panel-muted)]/25">
          taksit
        </span>
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

type CardBodyProps = {
  rate: InstallmentRow;
  baseAmount: number;
  commissionIncluded: boolean;
  formatMoney: (n: number) => string;
  /** Seçili görünüm (mavi kart) — Seçili rozeti */
  selected?: boolean;
};

/** Grid kartı + Seçili özet ortak gövde */
export function InstallmentPlanCardBody({
  rate,
  baseAmount,
  commissionIncluded,
  formatMoney,
  selected = false,
}: CardBodyProps) {
  const chargedTotal = commissionIncluded ? rate.totalAmount : baseAmount;
  const paymentCount = installmentPaymentCount(rate.n, rate.plusN);
  const vadeFarki = Math.max(0, rate.totalAmount - baseAmount);
  const showTotalLine = paymentCount > 1 || rate.plusN > 0;

  return (
    <>
      {rate.commissionPct === 0 ? <NoCommissionRibbon /> : null}
      {rate.plusN > 0 ? (
        <span
          className={[
            'absolute right-3 top-3 z-20 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1',
            selected
              ? 'bg-white/15 text-white ring-white/30'
              : 'bg-[var(--brand-soft-bg)] text-[var(--color-brand-700)] ring-[var(--color-brand-500)]/25',
          ].join(' ')}
        >
          +{rate.plusN} Ek Taksit
        </span>
      ) : null}
      <InstallmentCardWatermark n={rate.n} plusN={rate.plusN} selected={selected} />
      <p
        className={[
          'install-card-ink relative z-[2] mt-1 text-right text-xl font-bold tabular-nums',
          selected ? '' : 'text-[var(--panel-ink)]',
          rate.plusN > 0 ? 'mt-6' : '',
        ].join(' ')}
      >
        {formatInstallmentPaymentLine(rate, chargedTotal, commissionIncluded, formatMoney)}
      </p>
      {showTotalLine ? (
        <p className="install-card-muted relative z-[2] mt-0.5 text-right text-[12px] font-semibold tabular-nums text-[var(--panel-muted)]">
          Toplam {formatMoney(chargedTotal)}
        </p>
      ) : null}
      {paymentCount > 1 && rate.commissionPct > 0 ? (
        <p className="install-card-vade relative z-[2] mt-1 text-right text-[10px] font-semibold leading-relaxed text-rose-500">
          {formatVadeFarkiLine(rate.commissionPct, vadeFarki, commissionIncluded, formatMoney)}
        </p>
      ) : null}
    </>
  );
}

type SelectedSummaryProps = {
  rate: InstallmentRow;
  baseAmount: number;
  commissionIncluded: boolean;
  formatMoney: (n: number) => string;
  formatPct: (n: number) => string;
};

/** Banka & Taksit — Seçili özet = seçili plan kartının birebir kopyası */
export function SelectedInstallmentSummary({
  rate,
  baseAmount,
  commissionIncluded,
  formatMoney,
}: SelectedSummaryProps) {
  return (
    <div
      className="install-card-selected relative mt-3 min-h-[148px] overflow-hidden rounded-xl border p-4 text-left"
      aria-label="Seçili taksit"
    >
      <InstallmentPlanCardBody
        rate={rate}
        baseAmount={baseAmount}
        commissionIncluded={commissionIncluded}
        formatMoney={formatMoney}
        selected
      />
    </div>
  );
}
