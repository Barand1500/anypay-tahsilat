import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { PaymentCardFields } from '../../components/payments/PaymentCardFields';
import { PAYMENT_BADGES } from '../../components/layout/Footer';
import { LegalDocModal } from '../../components/layout/LegalDocModal';
import type { LegalDoc } from '../../components/layout/legalDocs';
import { TextInput } from '../../components/ui/TextInput';
import { useBrand } from '../../brand/BrandContext';
import { useBinsRevision } from '../../hooks/useBinsRevision';
import { useLoadBins } from '../../hooks/useLoadBins';
import { api } from '../../lib/api';
import { maybeStartThreeD, type PaymentCreateResult } from '../../lib/threeDSecure';
import { normalizePhoneInput } from '../customers/mockCustomers';
import { LEGAL_DOCS } from '../../components/layout/legalDocs';
import {
  detectBank,
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyDisplay,
  maskMoneyInput,
  parseTrMoney,
  getCardExpiryError,
  isValidLuhn,
} from './mockBanks';

type PublicPayView = {
  token: string;
  type: 'ch' | 'fatura' | 'sabit' | 'serbest' | 'taksit' | 'diger';
  status: 'pending' | 'paid';
  customerTitle: string;
  amount: number;
  commissionIncluded: boolean;
  description: string;
  installments: number[];
  merchantTitle: string;
  paidAt: string | null;
  files?: { name: string; path: string; url: string }[];
  currencyId?: string;
  currencySymbol?: string;
  currencyShortName?: string;
};

/**
 * Public ödeme linki — /pay/:token (auth yok).
 */
export default function PublicPayPage() {
  const { token: payToken } = useParams();
  const { logoUrl } = useBrand();
  const rootRef = useRef<HTMLDivElement>(null);
  useLoadBins();
  const binsRev = useBinsRevision();

  const [view, setView] = useState<PublicPayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [holder, setHolder] = useState('');
  const [tc, setTc] = useState('');
  const [phone, setPhone] = useState('5');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [installment, setInstallment] = useState(1);
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDoc | null>(null);
  const [amountText, setAmountText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ odemeNo: string; amount: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!payToken) {
      setLoadError('Geçersiz link');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<PublicPayView>(`/api/pay/${encodeURIComponent(payToken)}`);
        if (cancelled) return;
        setView(data);
        const opts = data.installments.length ? data.installments : [1];
        setInstallment(opts[0]!);
        setHolder(data.customerTitle !== '—' ? data.customerTitle : '');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Ödeme isteği yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payToken]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || loading) return;
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
  }, [loading, view?.token, done]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const installmentOpts = useMemo(() => {
    if (!view?.installments.length) return [1];
    return view.installments;
  }, [view]);
  const variableAmount = view?.type === 'serbest' && view.amount <= 0;
  const payableAmount = variableAmount ? parseTrMoney(amountText) : view?.amount ?? 0;

  const cardDigits = digitsOnly(card);
  const bank = useMemo(() => detectBank(cardDigits), [cardDigits, binsRev]);
  const cardFaulty =
    cardDigits.length > 0 &&
    (cardDigits.length < 15 || cardDigits.length > 16 || !isValidLuhn(cardDigits));
  const expiryErr = getCardExpiryError(expiry);
  const expiryOk = !expiryErr && digitsOnly(expiry).length === 4;
  const expiryFaulty = digitsOnly(expiry).length === 4 && Boolean(expiryErr);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (variableAmount && (!Number.isFinite(payableAmount) || payableAmount <= 0 || payableAmount > 999999999.99)) next.amount = 'Geçerli bir tutar girin';
    if (!holder.trim()) next.holder = 'Ad soyad gerekli';
    if (digitsOnly(tc).length && digitsOnly(tc).length !== 11) next.tc = '11 haneli T.C. girin';
    if (digitsOnly(phone).length < 10) next.phone = 'Telefon gerekli';
    const cardDigits = digitsOnly(card);
    if (cardDigits.length < 15 || !isValidLuhn(cardDigits)) next.card = 'Kart numarası geçersiz';
    const expErr = getCardExpiryError(expiry);
    if (expErr) next.expiry = expErr;
    if (digitsOnly(cvc).length < 3) next.cvc = 'CVC';
    if (!installmentOpts.includes(installment)) next.install = 'Taksit seçin';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payToken || !view || view.status === 'paid' || !validate()) return;
    setSaving(true);
    try {
      const data = await api.post<PaymentCreateResult>(
        `/api/pay/${encodeURIComponent(payToken)}`,
        {
          holder: holder.trim(),
          tc: digitsOnly(tc) || undefined,
          phone: digitsOnly(phone).slice(0, 10),
          cardDigits: digitsOnly(card),
          expiry: digitsOnly(expiry).slice(0, 4),
          cvc: digitsOnly(cvc),
          installment,
          ...(variableAmount ? { amount: payableAmount } : {}),
          note: view.description,
        },
      );
      if (maybeStartThreeD(data)) return;
      setDone(data);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Ödeme alınamadı');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--panel-bg)] text-sm text-[var(--panel-muted)]">
        Yükleniyor…
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--panel-bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center shadow-[var(--panel-shadow)]">
          <p className="text-lg font-bold text-[var(--panel-ink)]">Ödeme linki geçersiz</p>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">{loadError || 'Kayıt bulunamadı.'}</p>
        </div>
      </div>
    );
  }

  const alreadyPaid = view.status === 'paid' || !!done;
  const paymentTypeLabel: Record<PublicPayView['type'], string> = {
    ch: 'Cari hesap tahsilatı',
    fatura: 'Fatura ödemesi',
    sabit: 'Sabit tutar',
    serbest: 'Serbest tutar',
    taksit: 'Taksitli ödeme',
    diger: 'Ödeme talebi',
  };

  return (
    <div
      ref={rootRef}
      className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--brand-soft-bg),var(--panel-bg)_52%)]"
    >
      <main className="w-full flex-1 px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <header data-anim className="mb-5 flex flex-wrap items-center gap-4 border-b border-[var(--panel-line)]/70 pb-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex shrink-0 items-center gap-2.5 rounded-lg border border-white/10 bg-[var(--color-brand-700)] px-3 py-2 text-white">
                <img src={logoUrl} alt="Firma logosu" className="h-7 w-auto max-w-[140px] object-contain" />
                <span className="border-l border-white/25 pl-2.5 text-xs font-black tracking-[0.12em]">IQ POS</span>
              </div>
              <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-[var(--panel-ink)] sm:text-lg">{view.merchantTitle}</h1>
            </div>
          </header>

          {alreadyPaid ? (
            <section data-anim className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/25 bg-[var(--panel-elevated)] p-8 text-center shadow-[var(--panel-shadow)] sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckIcon /></div>
              <p className="mt-4 text-xl font-bold text-[var(--panel-ink)]">Ödeme alındı</p>
              <p className="mt-1 text-sm text-[var(--panel-muted)]">
                {done
                  ? `${done.odemeNo} · ${formatMoneyDisplay(done.amount, view.currencySymbol || '₺')}`
                  : 'Bu link daha önce kullanıldı.'}
              </p>
            </section>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
              <section data-anim className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
                <div className="grid lg:grid-cols-2 xl:grid-cols-[0.95fr_1.1fr_0.95fr]">
                  <div className="flex min-w-0 flex-col gap-3.5 border-b border-[var(--panel-line)] p-4 sm:p-5 xl:border-b-0 xl:border-r">
                    <SectionHead>Ödeme bilgileri</SectionHead>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--panel-ink)]">{view.customerTitle}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--panel-muted)]">{paymentTypeLabel[view.type]}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-[var(--brand-soft-bg)] px-2 py-1 text-[10px] font-bold text-[var(--color-brand-700)]">
                        {view.commissionIncluded ? 'Komisyon dahil' : 'Komisyon hariç'}
                      </span>
                    </div>

                    <div className="border-y border-[var(--panel-line)]/70 py-3">
                      {variableAmount ? (
                        <TextInput
                          id="public-pay-amount"
                          label={`Ödenecek tutar (${view.currencySymbol || '₺'})`}
                          value={amountText}
                          onChange={(e) => setAmountText(maskMoneyInput(e.target.value))}
                          inputMode="decimal"
                          autoComplete="off"
                          error={errors.amount}
                          className="text-right text-lg font-bold tabular-nums"
                        />
                      ) : (
                        <>
                          <p className="text-[11px] font-medium text-[var(--panel-muted)]">Ödenecek tutar</p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[var(--color-brand-600)]">
                            {formatMoneyDisplay(view.amount, view.currencySymbol || '₺')}
                          </p>
                        </>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-[var(--panel-ink)]">
                        {view.commissionIncluded ? 'Komisyon ödeme tutarına eklenir.' : 'Komisyon ödeme tutarına eklenmez.'}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--panel-muted)]">
                        {view.commissionIncluded
                          ? 'Seçilen taksite ait banka komisyonu ödeme sırasında hesaplanır.'
                          : 'Kartınızdan ödeme isteğinde görünen tutar tahsil edilir.'}
                      </p>
                    </div>

                    {view.description ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">Açıklama</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--panel-ink)]">
                          {view.description.replace(/<[^>]+>/g, '').slice(0, 1200)}
                        </p>
                      </div>
                    ) : null}

                    {view.files?.length ? (
                      <div className="border-t border-[var(--panel-line)]/70 pt-3">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">Ödeme belgeleri</p>
                        <ul className="space-y-1.5">
                          {view.files.map((f) => (
                            <li key={f.path || f.url}>
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--color-brand-600)]">
                                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                <span className="shrink-0 text-[10px] font-bold text-[var(--color-brand-600)]">Görüntüle</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-col gap-3.5 border-b border-[var(--panel-line)] p-4 sm:p-5 lg:border-b-0 lg:border-r xl:border-b-0">
                    <PaymentCardFields
                      heading="Kredi kartı"
                      SectionHead={SectionHead}
                      holder={holder}
                      tc={tc}
                      phone={phone}
                      card={formatCardNumber(card)}
                      expiry={expiry}
                      cvc={cvc}
                      errors={errors}
                      bank={bank}
                      cardFaulty={cardFaulty}
                      expiryOk={expiryOk}
                      expiryFaulty={expiryFaulty}
                      onHolder={setHolder}
                      onTc={(v) => setTc(digitsOnly(v).slice(0, 11))}
                      onPhone={(v) => {
                        setPhone(normalizePhoneInput(v));
                        setErrors((prev) => {
                          if (!prev.phone) return prev;
                          const { phone: _, ...rest } = prev;
                          return rest;
                        });
                      }}
                      onCard={(v) => setCard(digitsOnly(v).slice(0, 16))}
                      onExpiry={(v) => setExpiry(formatExpiryInput(v))}
                      onCvc={(v) => setCvc(digitsOnly(v).slice(0, 4))}
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5 lg:col-span-2 xl:col-span-1">
                    <SectionHead>Banka ve taksit</SectionHead>
                    <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-5">
                      {bank?.logo ? (
                        <img src={bank.logo} alt={bank.name} title={bank.name} className="max-h-14 max-w-[190px] object-contain" />
                      ) : bank ? (
                        <p className="text-lg font-bold text-[var(--panel-ink)]">{bank.name}</p>
                      ) : (
                        <p className="max-w-xs text-center text-xs leading-relaxed text-[var(--panel-muted)]">Kart numarasını girdiğinizde banka bilgisi burada görünür.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold text-[var(--panel-ink)]">Taksit seçenekleri</p>
                      {!payableAmount ? (
                        <p className="text-xs leading-relaxed text-[var(--panel-muted)]">Taksitleri görüntülemek için önce ödenecek tutarı girin.</p>
                      ) : !bank ? (
                        <p className="text-xs leading-relaxed text-[var(--panel-muted)]">Taksit seçeneklerini görmek için kart numaranızı girin; banka tanımlandığında seçenekler açılır.</p>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-expanded={installmentsOpen}
                            onClick={() => setInstallmentsOpen((open) => !open)}
                            className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg bg-amber-500 px-3 py-2 text-left text-xs font-bold text-white transition hover:bg-amber-400"
                          >
                            <span>{installmentsOpen ? 'Taksit seçeneklerini gizle' : 'Taksit seçeneklerini görüntüle'}</span>
                            <ChevronIcon open={installmentsOpen} />
                          </button>
                          {installmentsOpen ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                              {installmentOpts.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  aria-pressed={installment === n}
                                  onClick={() => setInstallment(n)}
                                  className={[
                                    'flex min-h-[62px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition',
                                    installment === n
                                      ? 'border-[var(--color-brand-500)] bg-[var(--brand-soft-bg)] text-[var(--color-brand-700)] shadow-sm'
                                      : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]/50 hover:bg-[var(--panel-hover)]',
                                  ].join(' ')}
                                >
                                  <span className={[
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums',
                                    installment === n ? 'bg-[var(--color-brand-600)] text-white' : 'bg-[var(--panel-surface)] text-[var(--panel-muted)]',
                                  ].join(' ')}>{n === 1 ? '1×' : n}</span>
                                  <span className="min-w-0">
                                    <span className="block text-xs font-bold">{n === 1 ? 'Tek çekim' : `${n} taksit`}</span>
                                    <span className="mt-0.5 block text-[10px] text-[var(--panel-muted)]">{n === 1 ? 'Peşin ödeme' : 'Eşit taksit'}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {errors.install ? <p className="mt-2 text-xs text-rose-500">{errors.install}</p> : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section data-anim className="flex flex-col items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-3.5 sm:flex-row sm:px-5">
                <p className="text-center text-[11px] text-[var(--panel-muted)] sm:text-left">
                  Banka 3D Secure doğrulamasına yönlendirileceksiniz.
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-7 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)] disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-52"
                >
                  {saving ? 'İşleniyor…' : `Ödemeyi tamamla · ${formatMoneyDisplay(payableAmount, view.currencySymbol || '₺')}`}
                </button>
              </section>
            </form>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-[var(--panel-line)] bg-[var(--panel-elevated)]/90 px-4 py-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-3.5">
          <div
            className="flex flex-wrap items-center justify-center gap-3"
            aria-label="Kabul edilen ödeme yöntemleri"
          >
            {PAYMENT_BADGES.map((badge) => (
              <span
                key={badge.src}
                title={badge.alt}
                className="flex h-9 items-center justify-center rounded-lg border border-[var(--panel-line)] bg-white px-2.5"
              >
                <img
                  src={badge.src}
                  alt={badge.alt}
                  className={`object-contain ${badge.className}`}
                  draggable={false}
                />
              </span>
            ))}
          </div>

          <div className="w-full">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--panel-muted)]">
              Sözleşmeler ve bilgilendirme
            </p>
            <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {LEGAL_DOCS.map((doc) => (
                <li
                  key={doc.id}
                  className="min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => setActiveLegalDoc(doc)}
                    className="flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/50 hover:bg-[var(--brand-soft-bg)] hover:text-[var(--color-brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]"
                  >
                    {doc.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      {activeLegalDoc ? (
        <LegalDocModal
          doc={activeLegalDoc}
          publicView
          onClose={() => setActiveLegalDoc(null)}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">
      {children}
    </h2>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={['shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
