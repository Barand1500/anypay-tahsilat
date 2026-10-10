import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TextArea } from '../../components/ui/TextArea';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useBinsRevision } from '../../hooks/useBinsRevision';
import { useLoadBins } from '../../hooks/useLoadBins';
import { useEffectiveInstallments } from '../../hooks/useEffectiveInstallments';
import { useErpActive } from '../../hooks/useErpActive';
import { useInitialAmountFocus } from '../../hooks/useInitialAmountFocus';
import { useAgreementRates } from '../../hooks/useAgreementRates';
import { api } from '../../lib/api';
import { maybeStartThreeD, type PaymentCreateResult } from '../../lib/threeDSecure';
import type { Customer, CustomerKind } from '../customers/mockCustomers';
import { normalizePhoneInput } from '../customers/mockCustomers';
import { getDefaultPayType } from '../settings/defaultsStore';
import { CollectionContractModal } from './CollectionContractModal';
import { InstallmentOptionsModal } from './InstallmentOptionsModal';
import { InstallmentPlanSection } from './InstallmentPlanSection';
import {
  formatInstallmentExtraHint,
  formatInstallmentPaymentLine,
  formatInstallmentTitle,
} from './installmentDisplay';
import { PaymentCardFields } from '../../components/payments/PaymentCardFields';
import { buildPricedInstallments, ratesBankQuery } from './pricedInstallments';
import {
  detectBank,
  detectCardSegment,
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyTr, formatMoneyDisplay,
  getCardExpiryError,
  isValidLuhn,
  isValidTurkishIdentityNo,
  maskMoneyInput,
  parseTrMoney,
  type BankInfo,
} from './mockBanks';

type PayType = '' | 'ch' | 'fatura' | 'sabit';

type ContactApi = {
  title: string;
  kind: CustomerKind;
  taxNo: string;
  taxOffice: string;
  identityNo: string;
  address: string;
  email: string;
  phone: string;
};

const DEFAULT_MERCHANT: Customer = {
  id: 'panel-merchant',
  code: '',
  title: 'GÜZEL Teknoloji',
  phone: '',
  email: '',
  taxNo: '',
  taxOffice: '',
  kind: 'tuzel',
  accountType: '',
  parentId: null,
  address: '',
  identityNo: '',
};

/**
 * Hızlı Ödeme — firma adına; 3 kart (ödeme / kart / banka).
 */
export default function QuickPayPage() {
  const { token } = useAuth();
  const erpActive = useErpActive();
  useLoadBins();
  const navigate = useNavigate();
  const { allowed: allowedInstallments } = useEffectiveInstallments(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const payTypeRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const [merchant, setMerchant] = useState<Customer>(DEFAULT_MERCHANT);
  const { currencies, defaultId: defaultCurrencyId } = useActiveCurrencies();

  const [payType, setPayType] = useState<PayType>(() => getDefaultPayType());
  useEffect(() => {
    if (erpActive === false && (payType === 'ch' || payType === 'fatura')) setPayType('sabit');
  }, [erpActive, payType]);
  const [payTypeOpen, setPayTypeOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const captureFirstAmountDigit = useCallback((digit: string) => {
    setAmountText((current) => maskMoneyInput(current + digit));
  }, []);
  useInitialAmountFocus({ inputRef: amountInputRef, enabled: true, onFirstDigit: captureFirstAmountDigit });
  const [currencyId, setCurrencyId] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [commissionIncluded, setCommissionIncluded] = useState(false);
  const [note, setNote] = useState('');

  const [holder, setHolder] = useState('');
  const [tc, setTc] = useState('');
  const [phone, setPhone] = useState('5');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [contractOk, setContractOk] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [pickedInstall, setPickedInstall] = useState<{ n: number; bank: BankInfo } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cardChecked, setCardChecked] = useState(false);
  const [tcChecked, setTcChecked] = useState(false);
  const [expiryChecked, setExpiryChecked] = useState(false);
  const binsRev = useBinsRevision();

  const amount = useMemo(() => parseTrMoney(amountText), [amountText]);
  const cardDigits = digitsOnly(card);
  const bank = useMemo(() => detectBank(cardDigits), [cardDigits, binsRev]);
  const cardSegment = useMemo(
    () => detectCardSegment(cardDigits),
    [cardDigits, binsRev],
  );
  const rateQ = useMemo(() => ratesBankQuery(bank, cardDigits), [bank, cardDigits]);
  const { rows: bankInstallmentRows, loading: ratesLoading } = useAgreementRates({
    amount,
    bankName: rateQ.bankName,
    bankId: rateQ.bankId,
    bin: rateQ.bin,
    segment: cardSegment || 'bireysel',
  });
  const availableBankRows = useMemo(
    () =>
      buildPricedInstallments({
        amount,
        rates: bankInstallmentRows,
        allowedNs: allowedInstallments,
        hideDisallowed: false,
      }),
    [amount, bankInstallmentRows, allowedInstallments],
  );
  const selectedRate = pickedInstall && pickedInstall.bank.id === bank?.id
    ? availableBankRows.find((row) => row.n === pickedInstall.n)
    : null;

  // Tutar / alt limit değişince geçersiz seçimi düşür
  useEffect(() => {
    if (!bank || !pickedInstall) return;
    if (pickedInstall.bank.id !== bank.id) return;
    if (availableBankRows.some((r) => r.n === pickedInstall.n)) return;
    if (availableBankRows[0]) setPickedInstall({ n: availableBankRows[0].n, bank });
    else setPickedInstall(null);
  }, [availableBankRows, bank, pickedInstall]);
  const cardFaulty =
    cardChecked &&
    (cardDigits.length < 15 || cardDigits.length > 16 || !isValidLuhn(cardDigits));
  const tcFaulty = tcChecked && tc.length > 0 && !isValidTurkishIdentityNo(tc);
  const tcOk = tcChecked && isValidTurkishIdentityNo(tc);
  const expiryFaulty =
    expiryChecked && digitsOnly(expiry).length > 0 && getCardExpiryError(expiry) !== null;
  const expiryOk =
    expiryChecked && digitsOnly(expiry).length === 4 && getCardExpiryError(expiry) === null;
  const cvcLen = digitsOnly(cvc).length;
  const cvcFaulty = cvcLen > 0 && cvcLen < 3;
  const cvcOk = cvcLen >= 3;
  const payTypeLabel =
    payType === 'ch' ? 'C/H BAKİYESİ' : payType === 'fatura' ? 'FATURA' : payType === 'sabit' ? 'SABİT TUTAR' : 'Ödeme Tipi Seçiniz';

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.36,
        stagger: 0.05,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<ContactApi>('/api/settings/contact', token);
        if (cancelled) return;
        setMerchant({
          ...DEFAULT_MERCHANT,
          title: data.title?.trim() || DEFAULT_MERCHANT.title,
          kind: data.kind || 'tuzel',
          taxNo: data.taxNo || '',
          taxOffice: data.taxOffice || '',
          identityNo: data.identityNo || '',
          address: data.address || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      } catch {
        /* başlık opsiyonel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!currencyId && defaultCurrencyId) setCurrencyId(defaultCurrencyId);
  }, [currencyId, defaultCurrencyId]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId) ?? null;
  const currencySymbol = selectedCurrency?.symbol || '₺';

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!payTypeRef.current?.contains(t)) setPayTypeOpen(false);
      if (!currencyRef.current?.contains(t)) setCurrencyOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function queryBalance() {
    if (!payType) {
      setToast('Önce ödeme tipi seçin');
      return;
    }
    setToast('ERP bakiye sorgusu henüz bağlı değil');
    setBalance(null);
  }

  function onCardChange(raw: string) {
    setCard(formatCardNumber(raw));
    setPickedInstall(null);
    setCardChecked(false);
    setErrors((prev) => {
      if (!prev.card) return prev;
      const { card: _, ...rest } = prev;
      return rest;
    });
  }

  function onExpiryChange(raw: string) {
    setExpiry(formatExpiryInput(raw));
    setExpiryChecked(false);
    setErrors((prev) => {
      if (!prev.expiry) return prev;
      const { expiry: _, ...rest } = prev;
      return rest;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!payType) next.payType = 'Ödeme tipi seçin';
    if (!currencyId) next.currency = 'Para birimi seçin';
    if (!amount || amount <= 0) next.amount = 'Geçerli tutar girin';
    if (!holder.trim()) next.holder = 'Ad soyad gerekli';
    if (tc && !isValidTurkishIdentityNo(digitsOnly(tc))) next.tc = 'Geçerli bir T.C. kimlik numarası girin';
    if (digitsOnly(phone).length < 10) next.phone = 'Telefon gerekli';
    if (cardDigits.length < 15) next.card = 'Kart numarası eksik';
    else if (!isValidLuhn(cardDigits)) next.card = 'Kart numarası geçersiz';
    const expiryErr = getCardExpiryError(expiry);
    if (expiryErr) next.expiry = expiryErr;
    if (digitsOnly(cvc).length < 3) next.cvc = 'CVC gerekli';
    if (!pickedInstall) next.install = 'Taksit seçin';
    if (!contractOk) next.contract = 'Sözleşmeyi kabul edin';
    setCardChecked(true);
    setTcChecked(true);
    setExpiryChecked(true);
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || !token || !payType) return;
    setSaving(true);
    try {
      const data = await api.post<PaymentCreateResult>(
        '/api/payments',
        {
          musteriId: null,
          payType: payType === 'sabit' ? 'serbest' : payType,
          amount,
          commissionIncluded,
          holder: holder.trim(),
          tc: digitsOnly(tc),
          phone: digitsOnly(phone).slice(0, 10),
          cardDigits,
          expiry: digitsOnly(expiry).slice(0, 4),
          cvc: digitsOnly(cvc),
          installment: pickedInstall?.n ?? 1,
          note: note.trim(),
          parabirimiId: Number(currencyId),
        },
        token,
      );
      if (maybeStartThreeD(data)) return;
      navigate('/hareketler', {
        replace: true,
        state: {
          flash: `Hızlı ödeme kaydedildi — ${data.odemeNo} · ${formatMoneyDisplay(data.amount, currencySymbol)}`,
        },
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Ödeme kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="w-full pb-10">
      <nav data-anim className="mb-3 text-sm text-[var(--panel-ink)]/65">
        <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
          Anasayfa
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">Hızlı Ödeme</span>
      </nav>

      <div data-anim className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide text-[var(--panel-ink)] sm:text-2xl">
            {merchant.title}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--panel-muted)]">Hızlı ödeme</p>
        </div>
        <Link to="/hareketler" className="shrink-0 rounded-xl border border-[var(--panel-line)] px-3.5 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]">
          Vazgeç
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <section data-anim className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="grid lg:grid-cols-3">
          {/* Ödeme */}
          <div className="flex flex-col gap-4 border-b border-[var(--panel-line)] p-5 lg:border-b-0 lg:border-r">
            <SectionHead>Ödeme bilgileri</SectionHead>

            <div className="flex items-stretch gap-2">
              <div ref={payTypeRef} className="relative min-w-0 flex-1">
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setPayTypeOpen((o) => !o)}
                  className={[
                    'flex h-[46px] w-full items-center gap-2.5 rounded-xl border bg-[var(--input-bg)] px-3 text-left transition',
                    payTypeOpen || errors.payType
                      ? 'border-[var(--color-brand-500)]'
                      : 'border-[var(--input-border)]',
                  ].join(' ')}
                >
                  <DocIcon />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide">
                    {payTypeLabel}
                  </span>
                  <ChevronIcon />
                </button>
                {payTypeOpen ? (
                  <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-lg">
                    {(
                      [
                        ...(erpActive ? [['ch', 'C/H BAKİYESİ'], ['fatura', 'FATURA']] as const : []),
                        ['sabit', 'SABİT TUTAR'],
                      ] as const
                    ).map(([val, label]) => (
                      <li key={val}>
                        <button
                          type="button"
                          className="w-full px-3.5 py-2.5 text-left text-sm font-semibold uppercase hover:bg-[var(--panel-hover)]"
                          onClick={() => {
                            setPayType(val);
                            setPayTypeOpen(false);
                            setBalance(null);
                          }}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {erpActive ? <button
                type="button"
                data-km-jump
                onClick={queryBalance}
                className="h-[46px] shrink-0 rounded-xl border border-[var(--color-brand-500)]/50 px-3.5 text-sm font-bold text-[var(--color-brand-600)] transition hover:bg-[var(--color-brand-600)] hover:text-white"
              >
                Sorgula
              </button> : null}
            </div>
            {balance != null ? (
              <p className="text-xs font-semibold text-[var(--color-brand-600)]">
                Bakiye: {formatMoneyDisplay(balance)}
              </p>
            ) : null}

            <div
              className={[
                'flex rounded-xl border bg-[var(--input-bg)] transition',
                errors.amount || errors.currency
                  ? 'border-rose-400'
                  : currencyOpen
                    ? 'border-[var(--input-border-focus)]'
                    : 'border-[var(--input-border)] focus-within:border-[var(--input-border-focus)]',
              ].join(' ')}
            >
              <div className="relative min-w-0 flex-1">
                <input
                  ref={amountInputRef}
                  autoFocus
                  data-km-jump
                  id="quick-pay-amount"
                  value={amountText}
                  onChange={(e) => setAmountText(maskMoneyInput(e.target.value))}
                  inputMode="numeric"
                  placeholder=" "
                  className="peer w-full rounded-l-xl bg-transparent px-3.5 pb-2.5 pt-5 text-right text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none"
                />
                <label
                  htmlFor="quick-pay-amount"
                  className={[
                    'input-label-gap pointer-events-none absolute left-3 top-1/2 z-10 origin-left -translate-y-1/2',
                    'px-1.5 text-sm text-[var(--panel-muted)] transition-all duration-200',
                    'peer-focus:top-0 peer-focus:translate-y-[-50%] peer-focus:text-xs peer-focus:font-medium peer-focus:text-[var(--input-label)]',
                    'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:translate-y-[-50%] peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:peer-focus:text-[var(--input-label)]',
                  ].join(' ')}
                >
                  Tutar
                </label>
              </div>
              <div
                ref={currencyRef}
                className="relative shrink-0 self-stretch border-l border-[var(--panel-line)]"
              >
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setCurrencyOpen((o) => !o)}
                  className="flex h-full min-h-[46px] items-center gap-1.5 rounded-r-xl bg-[var(--panel-surface)] px-3 text-sm font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
                >
                  <span className="min-w-[1.1rem] text-center">{currencySymbol || '—'}</span>
                  <ChevronIcon />
                </button>
                {currencyOpen ? (
                  <ul className="absolute right-0 z-30 mt-1 max-h-56 w-40 overflow-y-auto rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-lg">
                    {currencies.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-[var(--panel-muted)]">Aktif yok</li>
                    ) : (
                      currencies.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className={[
                              'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold',
                              currencyId === c.id
                                ? 'bg-[var(--panel-hover)]'
                                : 'hover:bg-[var(--panel-hover)]',
                            ].join(' ')}
                            onClick={() => {
                              setCurrencyId(c.id);
                              setCurrencyOpen(false);
                            }}
                          >
                            <span>{c.shortName}</span>
                            <span className="text-base">{c.symbol}</span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            </div>
            {errors.amount || errors.currency ? (
              <p className="text-xs text-rose-500">{errors.amount || errors.currency}</p>
            ) : null}

            <label className="flex items-center gap-2.5 text-sm">
              <button
                type="button"
                role="switch"
                aria-checked={commissionIncluded}
                data-km-jump
                onClick={() => setCommissionIncluded((v) => !v)}
                className={[
                  'relative h-6 w-11 shrink-0 rounded-full transition',
                  commissionIncluded ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                    commissionIncluded ? 'translate-x-5' : '',
                  ].join(' ')}
                />
              </button>
              Komisyon Dahil
            </label>

            <TextArea
              data-km-jump
              label="Açıklama"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="min-h-[7.5rem] resize-none"
            />
          </div>

          {/* Kart */}
          <div className="flex flex-col gap-4 border-b border-[var(--panel-line)] p-5 lg:border-b-0 lg:border-r">
            <PaymentCardFields
              heading="Kredi kartı"
              SectionHead={SectionHead}
              holder={holder}
              tc={tc}
              phone={phone}
              card={card}
              expiry={expiry}
              cvc={cvc}
              errors={errors}
              bank={bank}
              tcFaulty={tcFaulty || Boolean(errors.tc)}
              tcOk={tcOk && !errors.tc}
              cardFaulty={cardFaulty}
              cardOk={cardChecked && !cardFaulty && cardDigits.length >= 15}
              expiryOk={expiryOk}
              expiryFaulty={expiryFaulty}
              cvcOk={cvcOk}
              cvcFaulty={cvcFaulty}
              onHolder={setHolder}
              onTc={(v) => {
                setTc(digitsOnly(v).slice(0, 11));
                setTcChecked(false);
                setErrors((prev) => {
                  if (!prev.tc) return prev;
                  const { tc: _, ...rest } = prev;
                  return rest;
                });
              }}
              onTcBlur={() => setTcChecked(true)}
              onPhone={(v) => {
                setPhone(normalizePhoneInput(v));
                setErrors((prev) => {
                  if (!prev.phone) return prev;
                  const { phone: _, ...rest } = prev;
                  return rest;
                });
              }}
              onCard={onCardChange}
              onExpiry={onExpiryChange}
              onCvc={(v) => setCvc(digitsOnly(v).slice(0, 4))}
              onCardBlur={() => setCardChecked(true)}
              onExpiryBlur={() => setExpiryChecked(true)}
            />
          </div>

          {/* Banka */}
          <div className="flex flex-col gap-4 p-5">
            <SectionHead>Banka & taksit</SectionHead>
            <div className="flex min-h-[220px] flex-1 flex-col rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 p-4">
              {bank?.logo ? (
                <div className="mb-4 flex flex-col items-center justify-center py-2">
                  <img src={bank.logo} alt="" title={bank.name} className="h-14 w-auto max-w-[180px] object-contain" />
                </div>
              ) : bank ? (
                <p className="mb-4 flex flex-1 items-center justify-center text-lg font-bold text-[var(--panel-ink)]">{bank.name}</p>
              ) : (
                <p className="mb-4 flex flex-1 items-center justify-center text-center text-sm text-[var(--panel-muted)]">Kart numarasını yazınca banka logosu burada belirir.</p>
              )}
              <button type="button" data-km-jump disabled={!amount || amount <= 0} onClick={() => setInstallOpen(true)} className="mt-auto w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45">
                Taksit Seçenekleri
              </button>
              {pickedInstall && bank ? (
                <div className="mt-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">Seçili</p>
                  <p className="mt-1 text-lg font-bold text-[var(--panel-ink)]">
                    {selectedRate
                      ? formatInstallmentTitle(selectedRate.n, selectedRate.plusN)
                      : pickedInstall.n === 1
                        ? 'Tek çekim'
                        : `${pickedInstall.n} taksit`}
                  </p>
                  {selectedRate && formatInstallmentExtraHint(selectedRate.n, selectedRate.plusN) ? (
                    <p className="text-[10px] font-semibold text-[var(--color-brand-600)]">
                      {formatInstallmentExtraHint(selectedRate.n, selectedRate.plusN)}
                    </p>
                  ) : null}
                  <p className="text-sm tabular-nums text-[var(--panel-muted)]">
                    {selectedRate
                      ? formatInstallmentPaymentLine(
                          selectedRate,
                          selectedRate.totalAmount,
                          true,
                          (v) => formatMoneyDisplay(v),
                        )
                      : pickedInstall.bank.name}
                  </p>
                  {selectedRate ? (
                    selectedRate.commissionPct > 0
                      ? <p className="mt-1 text-[11px] font-semibold text-rose-500">Vade farkı %{formatMoneyTr(selectedRate.commissionPct)}</p>
                      : <p className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Komisyon yok</p>
                  ) : null}
                </div>
              ) : errors.install ? <p className="mt-2 text-xs text-rose-500">{errors.install}</p> : null}
            </div>
          </div>
        </div>
        </section>
          {bank && amount > 0 && cardDigits.length >= 6 ? (
            <InstallmentPlanSection
              rows={availableBankRows}
              selectedN={pickedInstall?.bank.id === bank.id ? pickedInstall.n : null}
              onSelect={(n) => setPickedInstall({ n, bank })}
              baseAmount={amount}
              commissionIncluded
              loading={ratesLoading}
              allowedInstallments={allowedInstallments}
              emptyRatesHint={
                !ratesLoading && bankInstallmentRows.length === 0
                  ? 'Bu kart için taksit oranı bulunamadı; yalnızca tek çekim sunuluyor.'
                  : null
              }
              emptyMessage={
                !ratesLoading && !availableBankRows.length
                  ? 'Bu banka için taksit anlaşması bulunamadı.'
                  : null
              }
            />
          ) : null}

        <div data-anim className="flex flex-col items-center gap-4 pt-2">
          <label className="flex items-start gap-2.5 text-sm text-[var(--panel-ink)]">
            <input
              type="checkbox"
              data-km-jump
              checked={contractOk}
              onChange={(e) => setContractOk(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--panel-line)]"
            />
            <span>
              <button
                type="button"
                className="font-semibold text-[var(--color-brand-600)] hover:underline"
                onClick={() => setContractOpen(true)}
              >
                Tahsilat Sözleşmesi
              </button>
              &apos;ni okudum ve kabul ediyorum.
            </span>
          </label>
          {errors.contract ? <p className="text-xs text-rose-500">{errors.contract}</p> : null}

          <button
            type="submit"
            data-km-jump
            disabled={saving}
            className="rounded-xl bg-[var(--color-brand-600)] px-10 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
          >
            {saving ? 'İşleniyor…' : 'Ödemeyi Tamamla'}
          </button>
        </div>
      </form>

      {contractOpen ? (
        <CollectionContractModal customer={merchant} onClose={() => setContractOpen(false)} />
      ) : null}
      {installOpen ? (
        <InstallmentOptionsModal
          amount={amount}
          preferredBankId={bank?.id}
          allowedInstallments={allowedInstallments}
          onClose={() => setInstallOpen(false)}
          onPick={(b, n) => {
            if (allowedInstallments?.length && !allowedInstallments.includes(n)) {
              setToast('Size atanmadı');
              return;
            }
            setPickedInstall({ n, bank: b });
            setInstallOpen(false);
            setToast(`${b.name} · ${n} taksit seçildi`);
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[10050] -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2.5 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--panel-ink)]">
      {children}
    </h2>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-rose-500" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-60" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

