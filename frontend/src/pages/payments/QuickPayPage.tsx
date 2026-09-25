import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { TextArea } from '../../components/ui/TextArea';
import { TextInput } from '../../components/ui/TextInput';
import { useActiveCurrencies } from '../../hooks/useActiveCurrencies';
import { useEffectiveInstallments } from '../../hooks/useEffectiveInstallments';
import { api } from '../../lib/api';
import type { Customer, CustomerKind } from '../customers/mockCustomers';
import { getDefaultPayType } from '../settings/defaultsStore';
import { CollectionContractModal } from './CollectionContractModal';
import { InstallmentOptionsModal } from './InstallmentOptionsModal';
import {
  detectBank,
  digitsOnly,
  formatCardNumber,
  formatMoneyTr,
  type BankInfo,
} from './mockBanks';

type PayType = '' | 'ch' | 'fatura';

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
  const navigate = useNavigate();
  const { allowed: allowedInstallments } = useEffectiveInstallments(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const payTypeRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const [merchant, setMerchant] = useState<Customer>(DEFAULT_MERCHANT);
  const { currencies, defaultId: defaultCurrencyId } = useActiveCurrencies();

  const [payType, setPayType] = useState<PayType>(() => getDefaultPayType());
  const [payTypeOpen, setPayTypeOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
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

  const amount = useMemo(() => parseTrMoney(amountText), [amountText]);
  const bank = useMemo(() => detectBank(digitsOnly(card)), [card]);
  const payTypeLabel =
    payType === 'ch' ? 'C/H BAKİYESİ' : payType === 'fatura' ? 'FATURA' : 'Ödeme Tipi Seçiniz';

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

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!payType) next.payType = 'Ödeme tipi seçin';
    if (!currencyId) next.currency = 'Para birimi seçin';
    if (!amount || amount <= 0) next.amount = 'Geçerli tutar girin';
    if (!holder.trim()) next.holder = 'Ad soyad gerekli';
    if (digitsOnly(tc).length !== 11) next.tc = '11 haneli T.C. girin';
    if (digitsOnly(phone).length < 10) next.phone = 'Telefon gerekli';
    if (digitsOnly(card).length < 15) next.card = 'Kart numarası eksik';
    if (!/^\d{2}\/\d{2}$/.test(expiry)) next.expiry = 'AA/YY';
    if (digitsOnly(cvc).length < 3) next.cvc = 'CVC';
    if (!pickedInstall) next.install = 'Taksit seçin';
    if (!contractOk) next.contract = 'Sözleşmeyi kabul edin';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || !token || !payType) return;
    setSaving(true);
    try {
      const data = await api.post<{ odemeNo: string; amount: number }>(
        '/api/payments',
        {
          musteriId: null,
          payType,
          amount,
          commissionIncluded,
          holder: holder.trim(),
          tc: digitsOnly(tc),
          phone: digitsOnly(phone).slice(0, 10),
          cardDigits: digitsOnly(card),
          installment: pickedInstall?.n ?? 1,
          note: note.trim(),
          parabirimiId: Number(currencyId),
        },
        token,
      );
      navigate('/hareketler', {
        replace: true,
        state: {
          flash: `Hızlı ödeme kaydedildi — ${data.odemeNo} · ${formatMoneyTr(data.amount)} ${currencySymbol}`,
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

      <h1
        data-anim
        className="mb-5 text-center text-base font-bold uppercase tracking-wide text-[var(--panel-ink)] sm:text-lg"
      >
        {merchant.title}
      </h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <div data-anim className="grid gap-4 lg:grid-cols-3">
          {/* Ödeme */}
          <section className="flex flex-col gap-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
            <SectionHead>Ödeme Bilgileri</SectionHead>

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
                        ['ch', 'C/H BAKİYESİ'],
                        ['fatura', 'FATURA'],
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
              <button
                type="button"
                data-km-jump
                onClick={queryBalance}
                className="h-[46px] shrink-0 rounded-xl border border-[var(--color-brand-500)]/50 px-3.5 text-sm font-bold text-[var(--color-brand-600)] transition hover:bg-[var(--color-brand-600)] hover:text-white"
              >
                Sorgula
              </button>
            </div>
            {balance != null ? (
              <p className="text-xs font-semibold text-[var(--color-brand-600)]">
                Bakiye: {formatMoneyTr(balance)} ₺
              </p>
            ) : null}

            <div
              className={[
                'flex rounded-xl border bg-[var(--input-bg)]',
                errors.amount ? 'border-rose-400' : 'border-[var(--input-border)] focus-within:border-[var(--input-border-focus)]',
              ].join(' ')}
            >
              <div className="relative flex min-w-0 flex-1 items-center gap-2 pl-3">
                <CoinsIcon />
                <input
                  data-km-jump
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  inputMode="decimal"
                  placeholder="Tutar"
                  className="w-full bg-transparent py-3 pr-2 text-sm font-semibold tabular-nums outline-none"
                />
              </div>
              <div ref={currencyRef} className="relative shrink-0 border-l border-[var(--panel-line)]">
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setCurrencyOpen((o) => !o)}
                  className="flex h-full min-h-[46px] items-center gap-1 px-3 text-sm font-bold"
                >
                  {currencySymbol || '—'}
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
            {errors.amount ? <p className="text-xs text-rose-500">{errors.amount}</p> : null}

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
              className="min-h-[7.5rem]"
            />
          </section>

          {/* Kart */}
          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
            <SectionHead>Kredi Kartı Bilgileri</SectionHead>
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
              inputMode="numeric"
              onChange={(e) => setTc(digitsOnly(e.target.value).slice(0, 11))}
            />
            <TextInput
              data-km-jump
              label="Telefon No"
              value={phone}
              error={errors.phone}
              inputMode="tel"
              onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 10))}
            />
            <TextInput
              data-km-jump
              label="Kart No"
              value={formatCardNumber(card)}
              error={errors.card}
              inputMode="numeric"
              onChange={(e) => setCard(digitsOnly(e.target.value).slice(0, 16))}
            />
            {bank ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--panel-surface)] px-2.5 py-1.5">
                <img src={bank.logo} alt="" className="h-6 w-auto object-contain" />
                <span className="text-xs font-semibold text-[var(--panel-ink)]">{bank.name}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                data-km-jump
                label="Son Kullanım"
                value={expiry}
                error={errors.expiry}
                inputMode="numeric"
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              />
              <TextInput
                data-km-jump
                label="CVC"
                value={cvc}
                error={errors.cvc}
                inputMode="numeric"
                onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
              />
            </div>
          </section>

          {/* Banka */}
          <section className="flex flex-col gap-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
            <SectionHead>Banka Bilgileri</SectionHead>
            <button
              type="button"
              data-km-jump
              onClick={() => {
                if (!amount || amount <= 0) {
                  setToast('Önce tutar girin');
                  return;
                }
                setInstallOpen(true);
              }}
              className="w-full rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Taksit Seçenekleri
            </button>
            {pickedInstall ? (
              <p className="text-sm text-[var(--panel-ink)]">
                <span className="font-semibold">{pickedInstall.n} taksit</span>
                <span className="text-[var(--panel-muted)]"> · {pickedInstall.bank.name}</span>
              </p>
            ) : errors.install ? (
              <p className="text-xs text-rose-500">{errors.install}</p>
            ) : (
              <p className="text-sm text-[var(--panel-muted)]">Taksit seçmek için butona tıklayın.</p>
            )}
          </section>
        </div>

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
          amount={amount > 0 ? amount : 1000}
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

function parseTrMoney(raw: string) {
  const n = Number(raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatExpiry(raw: string) {
  const d = digitsOnly(raw).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-rose-500" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-rose-500" aria-hidden>
      <ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" stroke="currentColor" strokeWidth="1.6" />
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
