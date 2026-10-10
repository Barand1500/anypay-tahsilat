import { useMemo, type Ref } from 'react';
import { formatMoneyTr, type InstallmentRow } from './mockBanks';
import {
  formatInstallmentPaymentLine,
  formatInstallmentTitle,
  InstallmentCardWatermark,
  installmentPaymentCount,
  NoCommissionRibbon,
} from './installmentDisplay';

type Props = {
  rows: InstallmentRow[];
  selectedN: number | null;
  onSelect: (n: number) => void;
  /** Ana tutar (komisyon hariç hesap için) */
  baseAmount: number;
  commissionIncluded: boolean;
  loading?: boolean;
  ratesError?: boolean;
  /** API boş döndü — sentetik tek çekim vb. */
  emptyRatesHint?: string | null;
  emptyMessage?: string | null;
  /** null = kısıt yok; dizi = yalnızca bunlar (diğerleri hiç gösterilmez) */
  allowedInstallments?: number[] | null;
  validationError?: string;
  /** denser grid (public fullscreen) */
  density?: 'default' | 'dense';
  sectionRef?: Ref<HTMLElement>;
  className?: string;
};

/**
 * Ortak taksit planı — Public / Ödeme Al / Hızlı Ödeme.
 * İzin dışı taksitler listeden çıkarılır (soluk gösterilmez).
 */
export function InstallmentPlanSection({
  rows,
  selectedN,
  onSelect,
  baseAmount,
  commissionIncluded,
  loading = false,
  ratesError = false,
  emptyRatesHint = null,
  emptyMessage = null,
  allowedInstallments = null,
  validationError,
  density = 'default',
  sectionRef,
  className = '',
}: Props) {
  const visibleRows = useMemo(() => {
    if (!allowedInstallments?.length) return rows;
    const allow = new Set(allowedInstallments);
    return rows.filter((r) => allow.has(r.n));
  }, [rows, allowedInstallments]);

  return (
    <section ref={sectionRef} data-anim className={className || undefined}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--panel-ink)]">Taksit Planı</h2>
        <p className="text-xs text-[var(--panel-muted)]">Tutara göre hesaplandı.</p>
      </div>

      {loading ? (
        <p className="mb-3 text-xs text-[var(--panel-muted)]">Taksitler yükleniyor…</p>
      ) : null}
      {!loading && ratesError ? (
        <p className="mb-3 text-xs text-rose-500">
          Taksit fiyatları şu anda alınamadı. Lütfen biraz sonra tekrar deneyin.
        </p>
      ) : null}
      {!loading && !ratesError && emptyRatesHint ? (
        <p className="mb-3 text-xs text-[var(--panel-muted)]">{emptyRatesHint}</p>
      ) : null}
      {!loading && !ratesError && !visibleRows.length && emptyMessage ? (
        <p className="mb-3 text-xs text-[var(--panel-muted)]">{emptyMessage}</p>
      ) : null}

      {!loading && !ratesError && visibleRows.length > 0 ? (
        <div
          className={[
            'grid gap-3',
            density === 'dense'
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
          ].join(' ')}
        >
          {visibleRows.map((rate) => {
            const n = rate.n;
            const active = selectedN === n;
            const chargedTotal = commissionIncluded ? rate.totalAmount : baseAmount;
            const paymentCount = installmentPaymentCount(rate.n, rate.plusN);
            const vadeFarki = Math.max(0, rate.totalAmount - baseAmount);
            const showTotalLine = paymentCount > 1 || rate.plusN > 0;
            return (
              <button
                key={n}
                type="button"
                data-km-jump
                aria-pressed={active}
                onClick={() => onSelect(n)}
                className={[
                  'relative overflow-visible rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]',
                  density === 'dense' ? 'min-h-[148px] max-w-none' : 'min-h-[176px] max-w-[320px]',
                  active
                    ? 'border-[var(--color-brand-500)] bg-[var(--panel-hover)] shadow-md'
                    : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] hover:-translate-y-0.5 hover:border-[var(--color-brand-500)]/50 hover:shadow-md',
                ].join(' ')}
              >
                {rate.commissionPct === 0 ? <NoCommissionRibbon /> : null}
                {rate.plusN > 0 ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[var(--brand-soft-bg)] px-2 py-0.5 text-[9px] font-bold text-[var(--color-brand-700)]">
                    +{rate.plusN} Ek Taksit
                  </span>
                ) : null}
                <InstallmentCardWatermark n={n} plusN={rate.plusN} />
                <p
                  className={[
                    'relative text-right text-sm font-semibold',
                    rate.plusN > 0 ? 'mt-6' : '',
                    active ? 'text-[var(--panel-ink)]' : 'text-[var(--panel-muted)]',
                  ].join(' ')}
                >
                  {formatInstallmentTitle(n, rate.plusN)}
                </p>
                <p className="relative mt-1 text-right text-xl font-bold tabular-nums text-[var(--panel-ink)]">
                  {formatInstallmentPaymentLine(
                    rate,
                    chargedTotal,
                    commissionIncluded,
                    formatMoneyTr,
                  )}
                </p>
                {showTotalLine ? (
                  <p className="relative mt-0.5 text-right text-[10px] font-semibold tabular-nums text-[var(--panel-muted)]">
                    Toplam {formatMoneyTr(chargedTotal)}
                  </p>
                ) : null}
                {paymentCount > 1 && rate.commissionPct > 0 ? (
                  <p className="relative mt-1 text-right text-[10px] font-semibold leading-relaxed text-rose-500">
                    {commissionIncluded
                      ? `Vade farkı %${formatMoneyTr(rate.commissionPct)} - ${formatMoneyTr(vadeFarki)}`
                      : `Vade farkı %${formatMoneyTr(rate.commissionPct)}`}
                  </p>
                ) : null}
              </button>
            );
          })}
          {validationError ? (
            <p className="col-span-full text-xs text-rose-500">{validationError}</p>
          ) : null}
        </div>
      ) : null}

      {!loading && !ratesError && !visibleRows.length && validationError ? (
        <p className="text-xs text-rose-500">{validationError}</p>
      ) : null}
    </section>
  );
}
