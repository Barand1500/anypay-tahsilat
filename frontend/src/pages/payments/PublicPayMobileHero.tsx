import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PaymentCardFields } from '../../components/payments/PaymentCardFields';
import { LEGAL_DOCS } from '../../components/layout/legalDocs';
import type { LegalDoc } from '../../components/layout/legalDocs';
import { normalizePhoneInput } from '../customers/mockCustomers';
import {
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyDisplay,
  maskMoneyInput,
  type BankInfo,
  type InstallmentRow,
} from './mockBanks';
import { InstallmentPlanSection } from './InstallmentPlanSection';
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
};

/**
 * Public /pay — telefon: tutar hero + kutulu taksit planı.
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

  const [legalSheetOpen, setLegalSheetOpen] = useState(false);
  const displayAmount = variableAmount ? payableAmount : fixedAmount;
  const canPlan = payableAmount > 0 && Boolean(bank && rateBin);
  const plainDescription = description
    ? description.replace(/<[^>]+>/g, '').slice(0, 220)
    : '';

  useEffect(() => {
    if (!legalSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLegalSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [legalSheetOpen]);

  return (
    <div className="flex flex-col gap-4 pb-36 lg:hidden">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(165deg,var(--color-brand-600)_0%,var(--color-brand-700)_55%,color-mix(in_srgb,var(--color-brand-700)_85%,#0f172a)_100%)] text-white shadow-[var(--panel-shadow)]">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <img
            src={logoUrl}
            alt="Firma logosu"
            style={{ height: Math.min(brandLogoHeightPx, 36) }}
            className="w-auto max-w-[120px] shrink-0 object-contain object-left brightness-0 invert"
          />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
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
                  className="w-auto max-w-[2.75rem] object-contain"
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
            <div className="mx-auto mt-3 w-full max-w-[16rem]">
              <label
                htmlFor="public-pay-amount-hero"
                className="mb-1.5 block text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/70"
              >
                Tutar ({currencySymbol})
              </label>
              <div className="rounded-xl bg-white/15 p-2 backdrop-blur-sm">
                <input
                  id="public-pay-amount-hero"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amountText}
                  onChange={(e) => onAmountText(maskMoneyInput(e.target.value))}
                  placeholder="0,00"
                  aria-invalid={Boolean(errors.amount)}
                  className={[
                    'h-14 w-full rounded-xl border-0 bg-white px-3 text-center text-2xl font-bold tabular-nums text-[var(--panel-ink)] outline-none',
                    'placeholder:font-semibold placeholder:text-[var(--panel-muted)]/50',
                    errors.amount ? 'ring-2 ring-red-400' : '',
                  ].join(' ')}
                />
              </div>
              {errors.amount ? (
                <p className="mt-1.5 text-center text-xs font-medium text-red-200">{errors.amount}</p>
              ) : null}
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
          {plainDescription ? (
            <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-white/75 line-clamp-3">
              {plainDescription}
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

      {/* Banka + kutulu taksit planı */}
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
            className="ml-auto shrink-0 rounded-full bg-orange-500 px-3.5 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-orange-400 disabled:opacity-45"
          >
            Taksit Seçenekleri
          </button>
        </div>

        {canPlan ? (
          <InstallmentPlanSection
            className="mt-4"
            rows={pricedInstallments}
            selectedN={installment}
            onSelect={onInstallment}
            baseAmount={payableAmount}
            commissionIncluded={commissionIncluded}
            loading={ratesLoading}
            ratesError={ratesError}
            emptyRatesHint={emptyRatesHint}
            validationError={errors.install}
            density="dense"
          />
        ) : (
          <>
            {ratesLoading ? (
              <p className="mt-3 text-xs text-[var(--panel-muted)]">Taksitler hesaplanıyor…</p>
            ) : null}
            {ratesError ? (
              <p className="mt-3 text-xs text-rose-500">Taksit oranları alınamadı.</p>
            ) : null}
            {emptyRatesHint ? (
              <p className="mt-3 text-xs text-[var(--panel-muted)]">{emptyRatesHint}</p>
            ) : null}
            {errors.install ? <p className="mt-3 text-xs text-rose-500">{errors.install}</p> : null}
          </>
        )}
      </section>

      {/* Sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--panel-elevated)_94%,transparent)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLegalSheetOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--color-brand-600)] transition hover:bg-[var(--panel-hover)]"
            aria-label="Sözleşmeler"
            title="Sözleşmeler"
          >
            <LegalDocIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[var(--panel-muted)]">Ödenecek tutar</p>
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
        <label className="mt-2.5 flex cursor-pointer items-start justify-center gap-2 text-center text-[11px] leading-snug text-[var(--panel-ink)]">
          <input
            type="checkbox"
            checked={props.agree}
            onChange={(e) => props.onAgree(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--input-border)] accent-[var(--color-brand-600)]"
          />
          <span className="text-left">
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
        {errors.agree ? <p className="mt-1 text-[10px] text-rose-500">{errors.agree}</p> : null}
      </div>

      {legalSheetOpen
        ? createPortal(
            <LegalDocsBottomSheet
              onClose={() => setLegalSheetOpen(false)}
              onOpenDoc={(doc) => {
                setLegalSheetOpen(false);
                props.onOpenLegal(doc);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function LegalDocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Mobil — Sözleşmeler listesi */
function LegalDocsBottomSheet({
  onClose,
  onOpenDoc,
}: {
  onClose: () => void;
  onOpenDoc: (doc: LegalDoc) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10050] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Sözleşmeler"
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_-12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-600)]">
              Yasal
            </p>
            <p className="text-sm font-bold text-[var(--panel-ink)]">Sözleşmeler</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--panel-line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">X</span>
            ESC
          </button>
        </div>
        <ul
          className="overflow-y-auto py-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ maxHeight: 'calc(78vh - 3.5rem)' }}
        >
          {LEGAL_DOCS.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onOpenDoc(doc)}
                className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition active:bg-[var(--panel-hover)]"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--panel-surface)] text-[var(--panel-muted)]">
                  <LegalDocIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug text-[var(--panel-ink)]">
                    {doc.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--panel-muted)]">
                    {doc.subtitle}
                  </span>
                </span>
                <span className="mt-1 text-[var(--panel-muted)]" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
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
