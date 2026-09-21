import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TextArea } from '../../components/ui/TextArea';
import { TextInput } from '../../components/ui/TextInput';
import { formatPhoneLive, getLiveCustomers, normalizePhoneInput } from '../customers/mockCustomers';
import { CollectionContractModal } from './CollectionContractModal';
import { InstallmentOptionsModal } from './InstallmentOptionsModal';
import {
  buildInstallments,
  detectBank,
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyTr,
  getCardExpiryError,
  isValidLuhn,
} from './mockBanks';

type PayType = '' | 'ch' | 'fatura';
type Currency = '' | 'TRY';

/**
 * Ödeme Al — ortak inputlar; taksit yalnızca modal / seçili özet.
 */
export default function PaymentCollectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const payTypeRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  const customer = useMemo(
    () => getLiveCustomers().find((c) => c.id === id) ?? null,
    [id],
  );

  const [payType, setPayType] = useState<PayType>('ch');
  const [payTypeOpen, setPayTypeOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('1000,00');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [commissionIncluded, setCommissionIncluded] = useState(false);
  const [note, setNote] = useState('');

  const [holder, setHolder] = useState('');
  const [tc, setTc] = useState('');
  const [phone, setPhone] = useState('5');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [installment, setInstallment] = useState(1);
  const [agree, setAgree] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Yazma bitince (blur / submit) rozet kontrolü */
  const [cardChecked, setCardChecked] = useState(false);
  const [expiryChecked, setExpiryChecked] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setHolder(customer.title);
    setPhone(customer.phone || '5');
    if (customer.kind === 'gercek' && customer.identityNo) setTc(customer.identityNo);
  }, [customer]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, [customer?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!payTypeRef.current?.contains(t)) setPayTypeOpen(false);
      if (!currencyRef.current?.contains(t)) setCurrencyOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const amount = useMemo(() => parseTrMoney(amountText), [amountText]);
  const cardDigits = digitsOnly(card);
  const bank = useMemo(() => detectBank(cardDigits), [cardDigits]);

  const cardFaulty =
    cardChecked &&
    cardDigits.length > 0 &&
    (cardDigits.length < 15 || cardDigits.length > 16 || !isValidLuhn(cardDigits));
  const expiryFaulty =
    expiryChecked && digitsOnly(expiry).length > 0 && getCardExpiryError(expiry) !== null;
  const selected = useMemo(() => {
    if (!amount || amount <= 0) return null;
    const rows = buildInstallments(amount, 'bireysel', bank?.id);
    return rows.find((r) => r.n === installment) ?? rows[0] ?? null;
  }, [amount, bank?.id, installment]);

  function flash(msg: string) {
    setToast(msg);
  }

  function queryBalance() {
    if (!payType) {
      flash('Önce ödeme tipi seçin');
      return;
    }
    const mock = payType === 'fatura' ? 4250.0 : 12850.75;
    setBalance(mock);
    setAmountText(formatMoneyTr(mock));
    setErrors((prev) => {
      if (!prev.amount) return prev;
      const { amount: _, ...rest } = prev;
      return rest;
    });
  }

  function onCardChange(raw: string) {
    setCard(formatCardNumber(raw));
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
    if (!currency) next.currency = 'Para birimi seçin';
    if (!amount || amount <= 0) next.amount = 'Geçerli tutar girin';
    if (!holder.trim()) next.holder = 'Ad soyad gerekli';
    if (tc && tc.length !== 11) next.tc = 'TC 11 hane olmalı';
    if (digitsOnly(phone).length < 10) next.phone = 'Telefon gerekli';
    if (cardDigits.length < 15) next.card = 'Kart numarası eksik';
    else if (!isValidLuhn(cardDigits)) next.card = 'Kart numarası geçersiz';
    const expiryErr = getCardExpiryError(expiry);
    if (expiryErr) next.expiry = expiryErr;
    if (cvc.length < 3) next.cvc = 'CVC gerekli';
    if (!agree) next.agree = 'Sözleşmeyi kabul edin';
    setCardChecked(true);
    setExpiryChecked(true);
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      flash('Ödeme alındı (mock) — POS bağlantısı sonraki adımda');
      window.setTimeout(() => navigate('/musteriler'), 900);
    }, 500);
  }

  const payTypeLabel =
    payType === 'ch' ? 'C/H BAKİYESİ' : payType === 'fatura' ? 'FATURA' : 'Ödeme Tipi Seçiniz';

  if (!customer) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
        <p className="text-[var(--panel-ink)]">Müşteri bulunamadı.</p>
        <Link
          to="/musteriler"
          className="mt-3 inline-block text-sm font-semibold text-[var(--color-brand-600)]"
        >
          Listeye dön
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-full pb-10">
      <nav data-anim className="mb-3 text-sm text-[var(--panel-ink)]/65">
        <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
          Anasayfa
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link to="/musteriler" className="font-medium hover:text-[var(--color-brand-600)]">
          Müşteriler
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">Ödeme Al</span>
      </nav>

      <div data-anim className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--panel-ink)]">
            {customer.title}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
            {customer.code} · Ödeme al
            {balance != null ? (
              <span className="ml-2 font-semibold text-[var(--color-brand-600)]">
                Bakiye {formatMoneyTr(balance)} ₺
              </span>
            ) : null}
          </p>
        </div>
        <Link
          to="/musteriler"
          className="rounded-xl border border-[var(--panel-line)] px-3.5 py-2 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
        >
          Vazgeç
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
        >
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
                        : 'border-[var(--input-border)] hover:border-[var(--input-border-focus)]',
                    ].join(' ')}
                  >
                    <DocIcon />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-[var(--panel-ink)]">
                      {payTypeLabel}
                    </span>
                    <ChevronIcon />
                  </button>
                  {payTypeOpen ? (
                    <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                      {(
                        [
                          ['', 'Ödeme Tipi Seçiniz'],
                          ['ch', 'C/H BAKİYESİ'],
                          ['fatura', 'FATURA'],
                        ] as const
                      ).map(([val, label]) => (
                        <li key={label}>
                          <button
                            type="button"
                            className={[
                              'w-full px-3.5 py-2.5 text-left text-sm font-semibold uppercase tracking-wide transition',
                              payType === val
                                ? 'bg-[var(--panel-hover)] text-[var(--panel-ink)]'
                                : 'text-[var(--panel-ink)]/80 hover:bg-[var(--panel-hover)]',
                            ].join(' ')}
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
                  {errors.payType ? (
                    <p className="mt-1 text-xs text-rose-500">{errors.payType}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-km-jump
                  onClick={queryBalance}
                  className="h-[46px] shrink-0 rounded-xl border border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)] px-3.5 text-sm font-bold text-[var(--color-brand-600)] transition hover:bg-[var(--color-brand-600)] hover:text-white"
                >
                  Sorgula
                </button>
              </div>

              {/* Tutar + para birimi iç içe */}
              <div>
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
                      data-km-jump
                      id="pay-amount"
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      inputMode="decimal"
                      placeholder=" "
                      className="peer w-full rounded-l-xl bg-transparent px-3.5 pb-2.5 pt-5 text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none"
                    />
                    <label
                      htmlFor="pay-amount"
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
                      <span className="min-w-[1.1rem] text-center">
                        {currency === 'TRY' ? '₺' : '—'}
                      </span>
                      <ChevronIcon />
                    </button>
                    {currencyOpen ? (
                      <ul className="absolute right-0 z-30 mt-1 w-28 overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                        <li>
                          <button
                            type="button"
                            className={[
                              'w-full px-3 py-2 text-left text-sm font-semibold',
                              currency === ''
                                ? 'bg-[var(--panel-hover)]'
                                : 'hover:bg-[var(--panel-hover)]',
                            ].join(' ')}
                            onClick={() => {
                              setCurrency('');
                              setCurrencyOpen(false);
                            }}
                          >
                            Seçiniz
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className={[
                              'w-full px-3 py-2 text-left text-lg font-bold',
                              currency === 'TRY'
                                ? 'bg-[var(--panel-hover)]'
                                : 'hover:bg-[var(--panel-hover)]',
                            ].join(' ')}
                            onClick={() => {
                              setCurrency('TRY');
                              setCurrencyOpen(false);
                            }}
                          >
                            ₺
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                </div>
                {errors.amount || errors.currency ? (
                  <p className="mt-1 text-xs text-rose-500">
                    {errors.amount || errors.currency}
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[var(--panel-ink)]">
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
                Komisyon dahil
              </label>

              <TextArea
                data-km-jump
                label="Açıklama"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="min-h-[7.5rem]"
              />
            </div>

            {/* Kart */}
            <div className="flex flex-col gap-4 border-b border-[var(--panel-line)] p-5 lg:border-b-0 lg:border-r">
              <SectionHead>Kredi kartı</SectionHead>
              <TextInput
                data-km-jump
                label="Ad Soyad"
                value={holder}
                error={errors.holder}
                onChange={(e) => setHolder(e.target.value)}
              />
              <TextInput
                data-km-jump
                label="T.C. Kimlik No"
                value={tc}
                error={errors.tc}
                onChange={(e) => setTc(digitsOnly(e.target.value).slice(0, 11))}
                inputMode="numeric"
                className="font-mono tabular-nums"
              />
              <TextInput
                data-km-jump
                label="Telefon No"
                value={formatPhoneLive(phone)}
                error={errors.phone}
                onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                inputMode="tel"
                className="font-mono tabular-nums"
              />
              <div>
                <TextInput
                  data-km-jump
                  label="Kart No"
                  value={card}
                  error={errors.card}
                  onChange={(e) => onCardChange(e.target.value)}
                  onBlur={() => setCardChecked(true)}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  className="!pr-[7rem] font-mono tabular-nums"
                  endAdornment={
                    cardFaulty ? (
                      <FaultBadge />
                    ) : bank ? (
                      <img
                        src={bank.logo}
                        alt=""
                        title={bank.name}
                        className="h-7 w-auto max-w-[80px] object-contain"
                      />
                    ) : (
                      <span className="rounded-md bg-[var(--panel-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--panel-muted)]">
                        BIN
                      </span>
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  data-km-jump
                  label="Son kullanım"
                  value={expiry}
                  error={errors.expiry}
                  onChange={(e) => onExpiryChange(e.target.value)}
                  onBlur={() => setExpiryChecked(true)}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  className="!pr-16 font-mono tabular-nums"
                  endAdornment={expiryFaulty ? <FaultBadge /> : null}
                />
                <TextInput
                  data-km-jump
                  label="CVC"
                  value={cvc}
                  error={errors.cvc}
                  onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                  inputMode="numeric"
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Banka */}
            <div className="flex flex-col gap-4 p-5">
              <SectionHead>Banka & taksit</SectionHead>
              <div className="flex min-h-[220px] flex-1 flex-col rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 p-4">
                {bank ? (
                  <div className="mb-4 flex flex-col items-center justify-center py-2">
                    <img
                      src={bank.logo}
                      alt=""
                      title={bank.name}
                      className="h-14 w-auto max-w-[180px] object-contain"
                    />
                  </div>
                ) : (
                  <p className="mb-4 flex flex-1 items-center justify-center text-center text-sm text-[var(--panel-muted)]">
                    Kart numarasını yazınca banka logosu burada belirir.
                  </p>
                )}

                <button
                  type="button"
                  data-km-jump
                  disabled={!amount || amount <= 0}
                  onClick={() => setCompareOpen(true)}
                  className="mt-auto w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Taksit Seçenekleri
                </button>

                {selected && bank ? (
                  <div className="mt-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                      Seçili
                    </p>
                    <p className="mt-1 text-lg font-bold text-[var(--panel-ink)]">
                      {selected.n === 1 ? 'Tek çekim' : `${selected.n} taksit`}
                    </p>
                    <p className="text-sm tabular-nums text-[var(--panel-muted)]">
                      {selected.n > 1
                        ? `${selected.n} × ${formatMoneyTr(selected.installmentAmount)} ₺`
                        : `${formatMoneyTr(selected.totalAmount)} ₺`}
                    </p>
                    {selected.commissionPct > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-rose-500">
                        Vade farkı %{formatMoneyTr(selected.commissionPct)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Komisyon yok
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Taksit ızgarası — yalnızca banka algılanınca */}
        {bank && amount > 0 ? (
          <section data-anim>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[var(--panel-ink)]">Taksit planı</h2>
              <p className="text-xs text-[var(--panel-muted)]">Tutara göre hesaplandı</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {buildInstallments(amount, 'bireysel', bank.id).map((r) => {
                const active = installment === r.n;
                return (
                  <button
                    key={r.n}
                    type="button"
                    data-km-jump
                    onClick={() => setInstallment(r.n)}
                    className={[
                      'relative overflow-hidden rounded-xl border px-3 py-3.5 text-left transition',
                      active
                        ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-600)] text-white shadow-md'
                        : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] hover:border-[var(--color-brand-500)]/40 hover:bg-[var(--panel-hover)]',
                    ].join(' ')}
                  >
                    {r.commissionPct === 0 ? (
                      <span
                        className={[
                          'absolute left-0 top-0 rounded-br-lg px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          active ? 'bg-white/20 text-white' : 'bg-amber-500 text-white',
                        ].join(' ')}
                      >
                        Komisyon yok
                      </span>
                    ) : null}
                    <span
                      className={[
                        'pointer-events-none absolute -right-1 -bottom-2 text-[3.2rem] font-black leading-none opacity-[0.08]',
                        active ? 'text-white' : 'text-[var(--panel-ink)]',
                      ].join(' ')}
                    >
                      {r.n}
                    </span>
                    <p
                      className={[
                        'relative text-[11px] font-semibold',
                        active ? 'text-white/80' : 'text-[var(--panel-muted)]',
                      ].join(' ')}
                    >
                      {r.n === 1 ? 'Tek çekim' : `${r.n} taksit`}
                    </p>
                    <p
                      className={[
                        'relative mt-1 text-sm font-bold tabular-nums',
                        active ? 'text-white' : 'text-[var(--panel-ink)]',
                      ].join(' ')}
                    >
                      {r.n === 1
                        ? formatMoneyTr(r.totalAmount)
                        : `${r.n} × ${formatMoneyTr(r.installmentAmount)}`}
                    </p>
                    {r.n > 1 ? (
                      <p
                        className={[
                          'relative mt-0.5 text-[10px] font-semibold tabular-nums',
                          active ? 'text-rose-200' : 'text-rose-500',
                        ].join(' ')}
                      >
                        Toplam {formatMoneyTr(r.totalAmount)}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div
          data-anim
          className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-5 shadow-[var(--panel-shadow)]"
        >
          <label className="flex max-w-xl cursor-pointer items-start gap-2.5 text-sm text-[var(--panel-ink)]">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--panel-line)] accent-[var(--color-brand-600)]"
            />
            <span>
              <button
                type="button"
                className="font-semibold text-[var(--color-brand-600)] underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  setContractOpen(true);
                }}
              >
                Tahsilat Sözleşmesi
              </button>
              &apos;ni okudum ve kabul ediyorum.
            </span>
          </label>
          {errors.agree ? <p className="text-xs text-rose-500">{errors.agree}</p> : null}

          <button
            type="submit"
            data-km-jump
            disabled={saving}
            className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-[var(--color-brand-600)] px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
          >
            {saving ? 'İşleniyor…' : 'Ödemeyi Tamamla'}
          </button>
        </div>
      </form>

      {compareOpen ? (
        <InstallmentOptionsModal
          amount={amount}
          preferredBankId={bank?.id}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      {contractOpen ? (
        <CollectionContractModal customer={customer} onClose={() => setContractOpen(false)} />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function FaultBadge() {
  return (
    <span className="rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rose-600">
      Hatalı
    </span>
  );
}

function SectionHead({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--panel-muted)]">
      {children}
    </h2>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-orange-500">
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--panel-muted)]">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function parseTrMoney(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
