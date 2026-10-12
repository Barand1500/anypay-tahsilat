import type { ReactNode } from 'react';
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
import { InstallmentPlanSection } from './InstallmentPlanSection';
import { SelectedInstallmentSummary } from './installmentDisplay';
import { PayAttachmentChips } from './PayAttachmentChips';
import type { PayAttachmentFile } from './PayAttachmentPreviewModal';

const STEPS = [
  { id: 0, label: 'Bilgi' },
  { id: 1, label: 'Kart' },
  { id: 2, label: 'Taksit' },
] as const;

type Props = {
  step: 0 | 1 | 2;
  onStep: (s: 0 | 1 | 2) => void;
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
  onValidateStep: (step: 0 | 1 | 2) => boolean;
};

/**
 * Public /pay — yalnızca telefon (< lg). 3 adım: Bilgi → Kart → Taksit.
 */
export function PublicPayMobileWizard(props: Props) {
  const {
    step,
    onStep,
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
    saving,
  } = props;

  function goNext() {
    if (!props.onValidateStep(step)) return;
    if (step < 2) onStep((step + 1) as 0 | 1 | 2);
  }

  function goBack() {
    if (step > 0) onStep((step - 1) as 0 | 1 | 2);
  }

  return (
    <div className="flex flex-col gap-4 pb-28 lg:hidden">
      <nav aria-label="Ödeme adımları" className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-3 shadow-[var(--panel-shadow)]">
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={s.id > step}
                  onClick={() => {
                    if (s.id < step) onStep(s.id);
                  }}
                  className={[
                    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition',
                    active ? 'bg-[var(--brand-soft-bg)]' : '',
                    s.id > step ? 'opacity-45' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                      active || done
                        ? 'bg-[var(--color-brand-600)] text-white'
                        : 'bg-[var(--panel-surface)] text-[var(--panel-muted)] ring-1 ring-[var(--panel-line)]',
                    ].join(' ')}
                  >
                    {done ? '✓' : s.id + 1}
                  </span>
                  <span
                    className={[
                      'truncate text-[10px] font-bold uppercase tracking-wide',
                      active ? 'text-[var(--color-brand-700)]' : 'text-[var(--panel-muted)]',
                    ].join(' ')}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 ? (
                  <span
                    className={[
                      'mb-4 h-0.5 w-3 shrink-0 rounded-full sm:w-5',
                      step > s.id ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--panel-line)]',
                    ].join(' ')}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--panel-line)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand-600)] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </nav>

      {step === 0 ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
          <div className="h-1 bg-[linear-gradient(90deg,var(--color-brand-500),var(--color-brand-600)_55%,transparent)]" aria-hidden />
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold tracking-tight text-[var(--panel-ink)]">
                  {customerTitle}
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-[var(--panel-muted)]">{typeLabel}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--brand-soft-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-brand-700)]">
                {commissionIncluded ? 'Komisyon Dahil' : 'Komisyon Hariç'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--panel-line)]/70 bg-[var(--panel-surface)]/50 px-3.5 py-3">
              {variableAmount ? (
                <TextInput
                  id="public-pay-amount-mobile"
                  label={`Ödenecek Tutar (${currencySymbol})`}
                  value={amountText}
                  onChange={(e) => onAmountText(maskMoneyInput(e.target.value))}
                  inputMode="decimal"
                  autoComplete="off"
                  error={errors.amount}
                  className="text-right text-xl font-bold tabular-nums"
                />
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-muted)]">
                    Ödenecek Tutar
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--color-brand-600)]">
                    {formatMoneyDisplay(fixedAmount, currencySymbol)}
                  </p>
                </>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[var(--panel-ink)]">
                {commissionIncluded
                  ? 'Komisyon ödeme tutarına eklenir.'
                  : 'Komisyon ödeme tutarına eklenmez.'}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--panel-muted)]">
                {commissionIncluded
                  ? 'Seçilen taksite ait banka komisyonu ödeme sırasında hesaplanır.'
                  : 'Kartınızdan ödeme isteğinde görünen tutar tahsil edilir.'}
              </p>
            </div>

            {description || files?.length ? (
              <div className="border-t border-[var(--panel-line)] pt-3">
                {description ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">
                      Açıklama
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[var(--panel-ink)]">
                      {description.replace(/<[^>]+>/g, '').slice(0, 1200)}
                    </p>
                  </>
                ) : null}
                {files?.length ? (
                  <div className={description ? 'mt-2.5' : ''}>
                    <PayAttachmentChips files={files} onOpen={onOpenFile} dense />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
              Adım 2 · Kart
            </p>
            <p className="text-[11px] font-semibold tabular-nums text-[var(--panel-muted)]">
              {formatMoneyDisplay(
                variableAmount ? payableAmount : fixedAmount,
                currencySymbol,
              )}{' '}
              · {typeLabel}
            </p>
          </div>
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
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
            <MiniHead>Banka & taksit</MiniHead>
            <div className="mt-3 flex min-h-[160px] flex-col rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 p-4">
              {bank?.logo ? (
                <div className="mb-3 flex justify-center py-1">
                  <img
                    src={bank.logo}
                    alt={bank.name}
                    className="h-12 w-auto max-w-[160px] object-contain"
                  />
                </div>
              ) : bank?.name ? (
                <p className="mb-3 text-center text-base font-bold text-[var(--panel-ink)]">{bank.name}</p>
              ) : (
                <p className="mb-3 flex flex-1 items-center justify-center text-center text-sm text-[var(--panel-muted)]">
                  Kart numarasını yazınca banka logosu burada belirir.
                </p>
              )}
              <button
                type="button"
                disabled={!payableAmount || payableAmount <= 0}
                onClick={props.onCompare}
                className="mt-auto w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Taksit Seçenekleri
              </button>
              {selectedRate ? (
                <SelectedInstallmentSummary
                  rate={selectedRate}
                  baseAmount={payableAmount}
                  commissionIncluded={commissionIncluded}
                  formatMoney={(v) => formatMoneyDisplay(v)}
                  formatPct={formatMoneyTr}
                />
              ) : null}
            </div>
          </section>

          {payableAmount > 0 && bank && props.rateBin ? (
            <InstallmentPlanSection
              rows={props.pricedInstallments}
              selectedN={props.installment}
              onSelect={props.onInstallment}
              baseAmount={payableAmount}
              commissionIncluded={commissionIncluded}
              loading={props.ratesLoading}
              ratesError={props.ratesError}
              emptyRatesHint={props.emptyRatesHint}
              density="dense"
              validationError={errors.install}
            />
          ) : null}

          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-3.5 text-sm text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
            <input
              type="checkbox"
              checked={props.agree}
              onChange={(e) => props.onAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--input-border)] accent-[var(--color-brand-600)]"
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
          {errors.agree ? <p className="text-xs text-rose-500">{errors.agree}</p> : null}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--panel-elevated)_92%,transparent)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="h-12 flex-1 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-sm font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              Geri
            </button>
          ) : null}
          {step < 2 ? (
            <button
              type="button"
              onClick={goNext}
              className="h-12 flex-[1.4] rounded-xl bg-[var(--color-brand-600)] text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
            >
              Devam
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="h-12 flex-[1.4] rounded-xl bg-[var(--color-brand-600)] text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'İşleniyor…' : 'Ödemeyi Tamamla'}
            </button>
          )}
        </div>
      </div>
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
