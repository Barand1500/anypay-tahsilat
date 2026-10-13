import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PaymentCardFields } from '../../components/payments/PaymentCardFields';
import { TextInput } from '../../components/ui/TextInput';
import { LEGAL_DOCS } from '../../components/layout/legalDocs';
import type { LegalDoc } from '../../components/layout/legalDocs';
import { normalizePhoneInput } from '../customers/mockCustomers';
import {
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyDisplay,
  formatMoneyTr,
  maskMoneyInput,
  type BankInfo,
  type InstallmentRow,
} from './mockBanks';
import { InstallmentPlanCardBody, SelectedInstallmentSummary } from './installmentDisplay';
import { PayAttachmentChips } from './PayAttachmentChips';
import type { PayAttachmentFile } from './PayAttachmentPreviewModal';

type Badge = { id?: string; name: string; src: string; heightPx: number };

type Props = {
  logoUrl: string;
  brandLogoHeightPx: number;
  badges: Badge[];
  customerTitle: string;
  typeLabel: string;
  commissionIncluded: boolean;
  currencySymbol: string;
  variableAmount: boolean;
  amountText: string;
  onAmountText: (v: string) => void;
  payableAmount: number;
  fixedAmount: number;
  description: string;
  files?: { name: string; path: string; url: string }[];
  onOpenFile: (f: PayAttachmentFile) => void;
  holder: string;
  tc: string;
  phone: string;
  card: string;
  expiry: string;
  cvc: string;
  errors: Record<string, string>;
  cardBank: BankInfo | null;
  bank: BankInfo | null;
  cardFaulty?: boolean;
  expiryOk?: boolean;
  expiryFaulty?: boolean;
  cvcOk?: boolean;
  cvcFaulty?: boolean;
  onHolder: (v: string) => void;
  onTc: (v: string) => void;
  onPhone: (v: string) => void;
  onCard: (v: string) => void;
  onExpiry: (v: string) => void;
  onCvc: (v: string) => void;
  clearPhoneError: () => void;
  installment: number;
  onInstallment: (n: number) => void;
  pricedInstallments: InstallmentRow[];
  selectedRate: InstallmentRow | null;
  ratesLoading: boolean;
  ratesError: boolean;
  emptyRatesHint: string | null;
  rateBin: string | null;
  onCompare: () => void;
  agree: boolean;
  onAgree: (v: boolean) => void;
  onOpenLegal: (doc: LegalDoc) => void;
  saving: boolean;
  onOpenContracts?: () => void;
};

/**
 * Public /pay — telefon: tutar hero + bottom sheet taksit.
 */
export function PublicPayMobileHero(props: Props) {
  const {
    logoUrl,
    brandLogoHeightPx,
    badges,
    customerTitle,
    typeLabel,
    commissionIncluded,
    currencySymbol,
    variableAmount,
    amountText,
    onAmountText,
    payableAmount,
    fixedAmount,
    description,
    files,
    onOpenFile,
    errors,
    bank,
    selectedRate,
    pricedInstallments,
    installment,
    onInstallment,
    ratesLoading,
    ratesError,
    emptyRatesHint,
    rateBin,
    saving,
  } = props;

  const [sheetOpen, setSheetOpen] = useState(false);
  const displayAmount = variableAmount ? payableAmount : fixedAmount;
  const canPlan = payableAmount > 0 && Boolean(bank && rateBin);

  const peekRows = useMemo(() => {
    if (!pricedInstallments.length) return [];
    const sel = pricedInstallments.find((r) => r.n === installment);
    const rest = pricedInstallments.filter((r) => r.n !== installment).slice(0, 2);
    return sel ? [sel, ...rest] : pricedInstallments.slice(0, 3);
  }, [pricedInstallments, installment]);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  return (
    <div className="flex flex-col gap-4 pb-36 lg:hidden">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(165deg,var(--color-brand-600)_0%,var(--color-brand-700)_55%,color-mix(in_srgb,var(--color-brand-700)_85%,#0f172a)_100%)] text-white shadow-[var(--panel-shadow)]">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <img
            src={logoUrl}
            alt="Firma logosu"
            style={{ height: Math.min(brandLogoHeightPx, 36) }}
            className="w-auto max-w-[140px] object-contain object-left brightness-0 invert"
          />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {badges.slice(0, 4).map((b) => (
              <span
                key={b.id || b.src}
                className="flex h-8 items-center rounded-lg bg-white/95 px-1.5 shadow-sm"
                title={b.name}
              >
                <img
                  src={b.src}
                  alt=""
                  style={{ height: Math.min(b.heightPx, 22) }}
                  className="w-auto max-w-[3.2rem] object-contain"
                  draggable={false}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="px-5 pb-6 pt-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
            {typeLabel}
          </p>
          {variableAmount ? (
            <div className="mx-auto mt-3 max-w-[16rem] rounded-xl bg-white/15 p-2 backdrop-blur-sm">
              <TextInput
                id="public-pay-amount-hero"
                label={`Tutar (${currencySymbol})`}
                value={amountText}
                onChange={(e) => onAmountText(maskMoneyInput(e.target.value))}
                inputMode="decimal"
                autoComplete="off"
                error={errors.amount}
                className="!border-0 !bg-white text-center text-2xl font-bold tabular-nums text-[var(--panel-ink)]"
              />
            </div>
          ) : (
            <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight">
              {formatMoneyDisplay(fixedAmount, currencySymbol)}
            </p>
          )}
          <p className="mt-2 text-sm font-semibold text-white/95">{customerTitle}</p>
          <span className="mt-2.5 inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold text-white ring-1 ring-white/25">
            {commissionIncluded ? 'Komisyon Dahil' : 'Komisyon Hariç'}
          </span>
          {description ? (
            <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-white/75 line-clamp-3">
              {description.replace(/<[^>]+>/g, '').slice(0, 220)}
            </p>
          ) : null}
          {files?.length ? (
            <div className="mt-3 flex justify-center">
              <PayAttachmentChips files={files} onOpen={onOpenFile} dense />
            </div>
          ) : null}
        </div>
      </section>

      {/* Kart */}
      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)]">
        <PaymentCardFields
          heading="Kredi kartı"
          SectionHead={MiniHead}
          holder={props.holder}
          tc={props.tc}
          phone={props.phone}
          card={formatCardNumber(props.card)}
          expiry={props.expiry}
          cvc={props.cvc}
          errors={errors}
          bank={props.cardBank}
          cardFaulty={props.cardFaulty}
          expiryOk={props.expiryOk}
          expiryFaulty={props.expiryFaulty}
          cvcOk={props.cvcOk}
          cvcFaulty={props.cvcFaulty}
          onHolder={props.onHolder}
          onTc={(v) => props.onTc(digitsOnly(v).slice(0, 11))}
          onPhone={(v) => {
            props.onPhone(normalizePhoneInput(v));
            props.clearPhoneError();
          }}
          onCard={(v) => props.onCard(digitsOnly(v).slice(0, 16))}
          onExpiry={(v) => props.onExpiry(formatExpiryInput(v))}
          onCvc={(v) => props.onCvc(digitsOnly(v).slice(0, 4))}
        />
      </section>

      {/* Banka + seçili şerit */}
      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)]">
        <div className="flex items-center gap-3">
          {bank?.logo ? (
            <img src={bank.logo} alt="" className="h-10 w-auto max-w-[120px] object-contain" />
          ) : (
            <p className="text-sm font-semibold text-[var(--panel-muted)]">
              {bank?.name || 'Kart yazınca banka görünür'}
            </p>
          )}
          <button
            type="button"
            disabled={!payableAmount || payableAmount <= 0}
            onClick={props.onCompare}
            className="ml-auto shrink-0 rounded-full bg-amber-500 px-3.5 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:opacity-45"
          >
            Taksit Seçenekleri
          </button>
        </div>

        {selectedRate ? (
          <button
            type="button"
            onClick={() => canPlan && setSheetOpen(true)}
            className="mt-3 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/70 p-3 text-left transition hover:border-[var(--color-brand-500)]/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                Seçili plan
              </p>
              <span className="text-[10px] font-semibold text-[var(--color-brand-600)]">
                Taksit Planı ↑
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-[var(--panel-ink)]">
              {formatInstallmentTitle(selectedRate.n, selectedRate.plusN)}
            </p>
            <p className="text-xs tabular-nums text-[var(--panel-muted)]">
              {formatInstallmentPaymentLine(
                selectedRate,
                commissionIncluded ? selectedRate.totalAmount : payableAmount,
                commissionIncluded,
                (v) => formatMoneyDisplay(v),
              )}
            </p>
          </button>
        ) : canPlan ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mt-3 w-full rounded-xl border border-dashed border-[var(--panel-line)] px-3 py-3 text-center text-sm font-semibold text-[var(--color-brand-600)]"
          >
            Taksit planını seç
          </button>
        ) : null}

        {/* Peek strip */}
        {canPlan && peekRows.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">
                Taksit Planı
              </p>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="text-[10px] font-bold text-[var(--color-brand-600)]"
              >
                Tümünü gör
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {peekRows.map((rate) => (
                <PeekCard
                  key={rate.n}
                  rate={rate}
                  active={installment === rate.n}
                  baseAmount={payableAmount}
                  commissionIncluded={commissionIncluded}
                  onSelect={() => onInstallment(rate.n)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {ratesLoading ? (
          <p className="mt-2 text-xs text-[var(--panel-muted)]">Taksitler hesaplanıyor…</p>
        ) : null}
        {ratesError ? (
          <p className="mt-2 text-xs text-rose-500">Taksit oranları alınamadı.</p>
        ) : null}
        {emptyRatesHint ? (
          <p className="mt-2 text-xs text-[var(--panel-muted)]">{emptyRatesHint}</p>
        ) : null}
        {errors.install ? <p className="mt-2 text-xs text-rose-500">{errors.install}</p> : null}
      </section>

      {/* Sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--panel-elevated)_94%,transparent)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <label className="mb-2 flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-[var(--panel-ink)]">
          <input
            type="checkbox"
            checked={props.agree}
            onChange={(e) => props.onAgree(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--input-border)] accent-[var(--color-brand-600)]"
          />
          <span>
            <button
              type="button"
              onClick={() =>
                props.onOpenLegal(LEGAL_DOCS.find((d) => d.id === 'tahsilat') ?? LEGAL_DOCS[0]!)
              }
              className="font-semibold text-[var(--color-brand-600)] hover:underline"
            >
              Tahsilat Sözleşmesi
            </button>
            'ni okudum ve kabul ediyorum.
          </span>
        </label>
        {errors.agree ? <p className="mb-1.5 text-[10px] text-rose-500">{errors.agree}</p> : null}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[var(--panel-muted)]">Ödenecek</p>
            <p className="truncate text-base font-bold tabular-nums text-[var(--panel-ink)]">
              {Number.isFinite(displayAmount) && displayAmount > 0
                ? formatMoneyDisplay(
                    selectedRate && commissionIncluded ? selectedRate.totalAmount : displayAmount,
                    currencySymbol,
                  )
                : '—'}
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-12 min-w-[9.5rem] shrink-0 rounded-xl bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'İşleniyor…' : 'Ödemeyi Tamamla'}
          </button>
        </div>
      </div>

      {sheetOpen
        ? createPortal(
            <InstallmentBottomSheet
              rows={pricedInstallments}
              selectedN={installment}
              baseAmount={payableAmount}
              commissionIncluded={commissionIncluded}
              onSelect={(n) => {
                onInstallment(n);
                setSheetOpen(false);
              }}
              onClose={() => setSheetOpen(false)}
              selectedRate={selectedRate}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function MiniHead({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--panel-muted)]">
      {children}
    </h2>
  );
}

function PeekCard({
  rate,
  active,
  baseAmount,
  commissionIncluded,
  onSelect,
}: {
  rate: InstallmentRow;
  active: boolean;
  baseAmount: number;
  commissionIncluded: boolean;
  onSelect: () => void;
}) {
  const charged = commissionIncluded ? rate.totalAmount : baseAmount;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'relative w-[9.5rem] shrink-0 overflow-hidden rounded-xl border p-2.5 text-left transition',
        active
          ? 'border-[var(--color-brand-500)] bg-[var(--brand-soft-bg)] shadow-sm'
          : 'border-[var(--panel-line)] bg-[var(--panel-elevated)]',
      ].join(' ')}
    >
      {rate.plusN > 0 ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--brand-soft-bg)] px-1.5 py-0.5 text-[8px] font-bold text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-500)]/20">
          +{rate.plusN} Ek Taksit
        </span>
      ) : null}
      <p className="pr-8 text-[11px] font-bold text-[var(--panel-ink)]">
        {formatInstallmentTitle(rate.n, rate.plusN)}
      </p>
      <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--panel-muted)]">
        {formatInstallmentPaymentLine(rate, charged, commissionIncluded, formatMoneyTr)}
      </p>
    </button>
  );
}

function InstallmentBottomSheet({
  rows,
  selectedN,
  baseAmount,
  commissionIncluded,
  onSelect,
  onClose,
  selectedRate,
}: {
  rows: InstallmentRow[];
  selectedN: number;
  baseAmount: number;
  commissionIncluded: boolean;
  onSelect: (n: number) => void;
  onClose: () => void;
  selectedRate: InstallmentRow | null;
}) {
  return (
    <div className="fixed inset-0 z-[10050] lg:hidden" role="dialog" aria-modal="true" aria-label="Taksit Planı">
      {/* Overlay tıklanınca kapanmaz — Esc / X */}
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_-12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-[var(--panel-line)] px-4 py-3">
          <div>
            <p className="text-sm font-bold text-[var(--panel-ink)]">Taksit Planı</p>
            <p className="text-[11px] text-[var(--panel-muted)]">Tutara göre hesaplandı.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--panel-line)] px-2.5 py-1 text-[11px] font-bold text-[var(--panel-muted)]"
          >
            X Esc
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(78vh - 3.5rem)' }}>
          {selectedRate ? (
            <div className="mb-3">
              <SelectedInstallmentSummary
                rate={selectedRate}
                baseAmount={baseAmount}
                commissionIncluded={commissionIncluded}
                formatMoney={(v) => formatMoneyDisplay(v)}
                formatPct={formatMoneyTr}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            {rows.map((rate) => {
              const active = selectedN === rate.n;
              return (
                <button
                  key={rate.n}
                  type="button"
                  onClick={() => onSelect(rate.n)}
                  className={[
                    'relative min-h-[7.5rem] overflow-visible rounded-xl border p-3 text-left transition',
                    active
                      ? 'install-card-selected'
                      : 'border-[var(--panel-line)] bg-[var(--panel-surface)]',
                  ].join(' ')}
                >
                  <InstallmentPlanCardBody
                    rate={rate}
                    baseAmount={baseAmount}
                    commissionIncluded={commissionIncluded}
                    formatMoney={formatMoneyTr}
                    selected={active}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
