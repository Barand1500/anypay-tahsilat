import gsap from 'gsap';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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
import { getCustomerContractVars } from '../definitions/mockContracts';
import {
  DEFAULT_PAYMENT_PAGE,
  type PaymentPageSettings,
} from '../settings/paymentPageTypes';
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
  isValidTurkishIdentityNo,
  formatMoneyTr,
  type InstallmentRow,
} from './mockBanks';
import { InstallmentOptionsModal } from './InstallmentOptionsModal';
import { InstallmentPlanSection } from './InstallmentPlanSection';
import {
  formatInstallmentExtraHint,
  formatInstallmentPaymentLine,
  formatInstallmentTitle,
} from './installmentDisplay';

type PublicPayView = {
  token: string;
  type: 'ch' | 'fatura' | 'sabit' | 'serbest' | 'taksit' | 'diger';
  status: 'pending' | 'paid';
  customerTitle: string;
  customerCode?: string;
  customerTaxNo?: string;
  customerTaxOffice?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
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
  posBankName?: string | null;
  posBankLogo?: string | null;
  posName?: string | null;
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [installmentRates, setInstallmentRates] = useState<InstallmentRow[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDoc | null>(null);
  const [agree, setAgree] = useState(false);
  const planRef = useRef<HTMLElement>(null);
  const [amountText, setAmountText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ odemeNo: string; amount: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pageSettings, setPageSettings] = useState<PaymentPageSettings>(() => ({
    layout: DEFAULT_PAYMENT_PAGE.layout,
    brandLogoHeightPx: DEFAULT_PAYMENT_PAGE.brandLogoHeightPx,
    badges: DEFAULT_PAYMENT_PAGE.badges
      .filter((b) => b.active)
      .map((b) => ({ ...b })),
  }));
  const [pageSettingsReady, setPageSettingsReady] = useState(false);

  const contractCustomerVars = useMemo(
    () =>
      view
        ? getCustomerContractVars({
            code: view.customerCode || '',
            title: view.customerTitle !== '—' ? view.customerTitle : '',
            taxNo: view.customerTaxNo || '',
            taxOffice: view.customerTaxOffice || '',
            address: view.customerAddress || '',
            phone: view.customerPhone || '',
            email: view.customerEmail || '',
          })
        : undefined,
    [view],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<PaymentPageSettings>('/api/settings/payment-page/public');
        if (cancelled || !data) return;
        setPageSettings({
          layout: data.layout === 'fullscreen' ? 'fullscreen' : 'compact',
          brandLogoHeightPx: data.brandLogoHeightPx || 40,
          badges: Array.isArray(data.badges) ? data.badges.map((b) => ({ ...b })) : [],
        });
      } catch {
        /* varsayılan rozetler kalsın */
      } finally {
        if (!cancelled) setPageSettingsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const rateBin = cardDigits.length >= 8 ? cardDigits.slice(0, 8) : cardDigits.length >= 6 ? cardDigits.slice(0, 6) : '';
  const cardFaulty =
    cardDigits.length > 0 &&
    (cardDigits.length < 15 || cardDigits.length > 16 || !isValidLuhn(cardDigits));
  const expiryErr = getCardExpiryError(expiry);
  const expiryOk = !expiryErr && digitsOnly(expiry).length === 4;
  const expiryFaulty = digitsOnly(expiry).length === 4 && Boolean(expiryErr);
  const cvcLen = digitsOnly(cvc).length;
  const cvcOk = cvcLen >= 3;
  const cvcFaulty = cvcLen > 0 && cvcLen < 3;

  useEffect(() => {
    let cancelled = false;
    if (!payToken || !view || view.status !== 'pending' || !bank || !rateBin || payableAmount <= 0) {
      setInstallmentRates([]);
      setRatesLoading(false);
      setRatesError(false);
      return;
    }

    setInstallmentRates([]);
    setRatesLoading(true);
    setRatesError(false);
    const query = new URLSearchParams({ bin: rateBin, amount: String(payableAmount) });
    if (bank.id && /^\d+$/.test(bank.id)) query.set('bankId', bank.id);
    const bankLabel = (bank.fullName || bank.name || '').trim();
    if (bankLabel) query.set('bankName', bankLabel);
    const timer = window.setTimeout(() => {
      void api.get<InstallmentRow[]>(`/api/pay/${encodeURIComponent(payToken)}/installments?${query.toString()}`)
        .then((rows) => { if (!cancelled) setInstallmentRates(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (!cancelled) { setInstallmentRates([]); setRatesError(true); } })
        .finally(() => { if (!cancelled) setRatesLoading(false); });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [payToken, view?.status, bank?.id, bank?.name, bank?.fullName, rateBin, payableAmount]);

  /**
   * Referans mantık: izin verilen ∩ banka anlaşma satırları.
   * Anlaşmada olmayan taksiti %0 uydurma.
   * Oran yoksa ve 1 izinliyse yalnızca tek çekim.
   */
  const pricedInstallments = useMemo(() => {
    const allowed = new Set(installmentOpts);
    const fromBank = installmentRates
      .filter((rate) => allowed.has(rate.n))
      .slice()
      .sort((a, b) => a.n - b.n);
    if (fromBank.length) return fromBank;
    if (allowed.has(1) && payableAmount > 0) {
      return [
        {
          n: 1,
          plusN: 0,
          commissionPct: 0,
          installmentAmount: payableAmount,
          totalAmount: payableAmount,
          minLimit: 0,
        },
      ];
    }
    return [];
  }, [installmentOpts, installmentRates, payableAmount]);

  const selectedRate = useMemo(
    () => pricedInstallments.find((r) => r.n === installment) ?? null,
    [pricedInstallments, installment],
  );

  useEffect(() => {
    if (!pricedInstallments.length) return;
    if (pricedInstallments.some((r) => r.n === installment)) return;
    setInstallment(pricedInstallments[0]!.n);
  }, [pricedInstallments, installment]);


  function validate(): boolean {
    const next: Record<string, string> = {};
    if (variableAmount && (!Number.isFinite(payableAmount) || payableAmount <= 0 || payableAmount > 999999999.99)) next.amount = 'Geçerli bir tutar girin';
    if (!holder.trim()) next.holder = 'Ad soyad gerekli';
    if (digitsOnly(tc).length && !isValidTurkishIdentityNo(digitsOnly(tc))) next.tc = 'Geçerli bir T.C. kimlik numarası girin';
    if (digitsOnly(phone).length < 10) next.phone = 'Telefon gerekli';
    const cardDigits = digitsOnly(card);
    if (cardDigits.length < 15 || !isValidLuhn(cardDigits)) next.card = 'Kart numarası geçersiz';
    const expErr = getCardExpiryError(expiry);
    if (expErr) next.expiry = expErr;
    if (digitsOnly(cvc).length < 3) next.cvc = 'CVC';
    if (!pricedInstallments.some((r) => r.n === installment)) next.install = 'Taksit seçin';
    if (!agree) next.agree = 'Sözleşmeyi kabul edin';
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
  const isFullscreen = pageSettings.layout === 'fullscreen';
  const headerBadges = (
    pageSettingsReady || pageSettings.badges.length
      ? pageSettings.badges
      : PAYMENT_BADGES.map((b, i) => ({
          id: `fallback-${i}`,
          name: b.alt,
          src: b.src,
          heightPx: 28,
          active: true,
          sortOrder: i,
        }))
  )
    .filter((b) => b.active !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const paymentTypeLabel: Record<PublicPayView['type'], string> = {
    ch: 'Cari hesap tahsilatı',
    fatura: 'Fatura ödemesi',
    sabit: 'Sabit tutar',
    serbest: 'Serbest tutar',
    taksit: 'Taksitli ödeme',
    diger: 'Ödeme talebi',
  };

  const headerBadgesRow = (
    <div
      className="flex flex-wrap items-center justify-end gap-2"
      aria-label="Kabul edilen ödeme yöntemleri"
    >
      {headerBadges.map((badge) => (
        <span
          key={badge.id || badge.src}
          title={badge.name}
          className={[
            'group flex items-center justify-center rounded-xl border border-[var(--panel-line)] bg-white px-2.5 shadow-sm transition-transform duration-200 ease-out hover:z-10 hover:scale-110 hover:shadow-md',
            isFullscreen ? 'h-11' : 'h-10',
          ].join(' ')}
        >
          <img
            src={badge.src}
            alt={badge.name}
            style={{ height: badge.heightPx }}
            className="w-auto max-w-[6.5rem] object-contain transition-transform duration-200 group-hover:scale-105"
            draggable={false}
          />
        </span>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={[
        'flex min-h-screen',
        isFullscreen
          ? 'flex-col bg-[var(--panel-bg)] lg:flex-row'
          : 'flex-col bg-[radial-gradient(ellipse_at_top,_var(--brand-soft-bg),var(--panel-bg)_52%)]',
      ].join(' ')}
    >
      {isFullscreen ? (
        <aside
          data-anim
          className="relative flex min-h-[200px] flex-col overflow-visible bg-[linear-gradient(165deg,var(--color-brand-600)_0%,var(--color-brand-700)_48%,color-mix(in_srgb,var(--color-brand-700)_88%,#0f172a)_100%)] px-6 py-7 text-white sm:px-8 lg:sticky lg:top-0 lg:h-screen lg:w-[min(38vw,26rem)] lg:shrink-0 lg:px-9 lg:py-10 xl:w-[min(36vw,28rem)]"
        >
          <div
            className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-20 bottom-24 h-72 w-72 rounded-full bg-white/5 blur-3xl"
            aria-hidden
          />
          <img
            src={logoUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-28 w-[min(88%,18rem)] opacity-[0.12] brightness-0 invert"
          />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            <img
              src={logoUrl}
              alt="Firma logosu"
              style={{ height: pageSettings.brandLogoHeightPx }}
              className="w-auto max-w-[220px] object-contain object-left brightness-0 invert"
            />
            <div className="mt-7 max-w-sm">
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-[2.35rem]">
                Güvenli ödeme
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-white/80">
                Kart bilgileriniz şifreli kanal üzerinden iletilir. Ödemenizi sakin ve güvenle tamamlayın.
              </p>
            </div>

            <nav
              aria-label="Sözleşmeler"
              className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1 lg:mt-10"
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                Sözleşmeler
              </p>
              <ol className="border-t border-white/15">
                {LEGAL_DOCS.map((doc, i) => (
                  <li key={doc.id} className="border-b border-white/15">
                    <button
                      type="button"
                      onClick={() => setActiveLegalDoc(doc)}
                      className="group flex w-full items-baseline gap-3 py-3 text-left transition hover:bg-white/[0.06]"
                    >
                      <span className="w-7 shrink-0 font-mono text-[11px] tabular-nums text-white/45 group-hover:text-white/70">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug text-white/95 group-hover:text-white">
                          {doc.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                          {doc.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="relative z-20 mt-6 flex flex-wrap gap-2.5 overflow-visible lg:mt-8">
              {headerBadges.map((badge) => (
                <HeroPaymentBadge
                  key={`hero-${badge.id || badge.src}`}
                  name={badge.name}
                  src={badge.src}
                  heightPx={badge.heightPx}
                />
              ))}
            </div>
          </div>
        </aside>
      ) : null}

      <div className={isFullscreen ? 'flex min-w-0 flex-1 flex-col' : 'contents'}>
      <main
        className={[
          'w-full flex-1',
          isFullscreen
            ? 'px-4 py-5 sm:px-6 lg:px-8 lg:py-6 xl:px-10'
            : 'px-4 py-4 sm:px-5 lg:px-6 lg:py-5',
        ].join(' ')}
      >
        <div
          className={[
            'mx-auto w-full',
            isFullscreen ? 'max-w-[1100px]' : 'max-w-[1400px]',
          ].join(' ')}
        >
          {!isFullscreen ? (
            <header data-anim className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-3">
              <img
                src={logoUrl}
                alt="Firma logosu"
                style={{ height: pageSettings.brandLogoHeightPx }}
                className="w-auto max-w-[180px] object-contain object-left sm:max-w-[200px]"
              />
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
                {headerBadgesRow}
                <PublicLegalMenu onOpenDoc={(doc) => setActiveLegalDoc(doc)} />
              </div>
            </header>
          ) : null}

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
            <form
              onSubmit={(e) => void onSubmit(e)}
              className={isFullscreen ? 'space-y-5' : 'space-y-4'}
            >
              {isFullscreen ? (
                <section
                  data-anim
                  className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
                >
                  <div className="h-1 bg-[linear-gradient(90deg,var(--color-brand-500),var(--color-brand-600)_55%,transparent)]" aria-hidden />
                  <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-muted)]">
                        Ödenecek tutar
                      </p>
                      {variableAmount ? (
                        <div className="mt-2 max-w-xs">
                          <TextInput
                            id="public-pay-amount"
                            label={`Tutar (${view.currencySymbol || '₺'})`}
                            value={amountText}
                            onChange={(e) => setAmountText(maskMoneyInput(e.target.value))}
                            inputMode="decimal"
                            autoComplete="off"
                            error={errors.amount}
                            className="text-right text-lg font-bold tabular-nums"
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-[var(--color-brand-600)] sm:text-4xl">
                          {formatMoneyDisplay(view.amount, view.currencySymbol || '₺')}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[var(--panel-muted)]">
                        {view.commissionIncluded
                          ? 'Komisyon ödeme tutarına eklenir.'
                          : 'Komisyon ödeme tutarına eklenmez.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 self-center sm:self-end">
                      <p className="max-w-[16rem] text-right text-base font-extrabold tracking-tight text-[var(--panel-ink)] sm:text-lg">
                        {view.customerTitle}
                      </p>
                      <p className="text-[12px] font-semibold text-[var(--panel-muted)]">
                        {paymentTypeLabel[view.type]}
                      </p>
                      <span className="mt-0.5 rounded-full bg-[var(--brand-soft-bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-brand-700)]">
                        {view.commissionIncluded ? 'Komisyon dahil' : 'Komisyon hariç'}
                      </span>
                    </div>
                  </div>
                  {view.description || view.files?.length ? (
                    <div className="border-t border-[var(--panel-line)] px-5 py-4 sm:px-6">
                      {view.description ? (
                        <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[var(--panel-ink)]">
                          {view.description.replace(/<[^>]+>/g, '').slice(0, 1200)}
                        </p>
                      ) : null}
                      {view.files?.length ? (
                        <ul className={['flex flex-wrap gap-2', view.description ? 'mt-3' : ''].join(' ')}>
                          {view.files.map((f) => (
                            <li key={f.path || f.url} className="min-w-0">
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.name}
                                className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/45 hover:bg-[var(--brand-soft-bg)]"
                              >
                                <FileGlyph />
                                <span className="min-w-0 truncate">{f.name}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section
                data-anim
                className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
              >
                <div
                  className={[
                    'grid',
                    isFullscreen ? 'lg:grid-cols-2' : 'lg:grid-cols-3',
                  ].join(' ')}
                >
                  {!isFullscreen ? (
                  <div className="flex min-w-0 flex-col gap-4 border-b border-[var(--panel-line)] p-5 lg:border-b-0 lg:border-r">
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

                    {view.description || view.files?.length ? (
                      <div>
                        {view.description ? (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">
                              Açıklama
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--panel-ink)]">
                              {view.description.replace(/<[^>]+>/g, '').slice(0, 1200)}
                            </p>
                          </>
                        ) : null}
                        {view.files?.length ? (
                          <div className={view.description ? 'mt-2.5' : ''}>
                            {!view.description ? (
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--panel-muted)]">
                                Belgeler
                              </p>
                            ) : null}
                            <ul className="flex flex-wrap gap-2">
                              {view.files.map((f) => (
                                <li key={f.path || f.url} className="min-w-0">
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={f.name}
                                    className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/45 hover:bg-[var(--brand-soft-bg)] hover:text-[var(--color-brand-700)]"
                                  >
                                    <FileGlyph />
                                    <span className="min-w-0 truncate">{f.name}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  ) : null}

                  <div
                    className={[
                      'flex min-w-0 flex-col gap-4 border-b border-[var(--panel-line)] lg:border-b-0 lg:border-r',
                      isFullscreen ? 'p-5 sm:p-6' : 'p-5',
                    ].join(' ')}
                  >
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
                      cvcOk={cvcOk}
                      cvcFaulty={cvcFaulty}
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

                  <div
                    className={[
                      'flex min-w-0 flex-col gap-4',
                      isFullscreen ? 'p-5 sm:p-6' : 'p-5',
                    ].join(' ')}
                  >
                    <SectionHead>Banka & taksit</SectionHead>
                    <div
                      className={[
                        'flex flex-1 flex-col rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60',
                        isFullscreen ? 'min-h-[240px] p-5' : 'min-h-[220px] p-4',
                      ].join(' ')}
                    >
                      {view.posBankLogo ? (
                        <div className="mb-4 flex flex-col items-center justify-center py-2">
                          <img
                            src={view.posBankLogo}
                            alt={view.posBankName || view.posName || 'Sanal POS'}
                            title={view.posName || view.posBankName || undefined}
                            className="h-14 w-auto max-w-[180px] object-contain"
                          />
                        </div>
                      ) : view.posBankName ? (
                        <p className="mb-4 flex flex-1 items-center justify-center text-center text-lg font-bold text-[var(--panel-ink)]">
                          {view.posBankName}
                        </p>
                      ) : (
                        <p className="mb-4 flex flex-1 items-center justify-center text-center text-sm text-[var(--panel-muted)]">
                          Varsayılan Sanal POS tanımlı değil.
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={!payableAmount || payableAmount <= 0}
                        onClick={() => setCompareOpen(true)}
                        className="mt-auto w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Taksit Seçenekleri
                      </button>

                      {selectedRate ? (
                        <div className="mt-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 text-center">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                            Seçili
                          </p>
                          <p className="mt-1 text-lg font-bold text-[var(--panel-ink)]">
                            {formatInstallmentTitle(selectedRate.n, selectedRate.plusN)}
                          </p>
                          {formatInstallmentExtraHint(selectedRate.n, selectedRate.plusN) ? (
                            <p className="text-[10px] font-semibold text-[var(--color-brand-600)]">
                              {formatInstallmentExtraHint(selectedRate.n, selectedRate.plusN)}
                            </p>
                          ) : null}
                          <p className="text-sm tabular-nums text-[var(--panel-muted)]">
                            {formatInstallmentPaymentLine(
                              selectedRate,
                              view.commissionIncluded ? selectedRate.totalAmount : payableAmount,
                              view.commissionIncluded,
                              (v) => formatMoneyDisplay(v),
                            )}
                          </p>
                          {selectedRate.commissionPct > 0 ? (
                            <p className="mt-1 text-[11px] font-semibold text-rose-500">
                              Vade farkı %{formatMoneyTr(selectedRate.commissionPct)}
                              {view.commissionIncluded
                                ? ` = ${formatMoneyDisplay(
                                    Math.max(0, selectedRate.totalAmount - payableAmount),
                                  )}`
                                : ''}
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

              {payableAmount > 0 && bank && rateBin ? (
                <InstallmentPlanSection
                  sectionRef={planRef}
                  rows={pricedInstallments}
                  selectedN={installment}
                  onSelect={setInstallment}
                  baseAmount={payableAmount}
                  commissionIncluded={view.commissionIncluded}
                  loading={ratesLoading}
                  ratesError={ratesError}
                  emptyRatesHint={
                    !ratesLoading && !ratesError && installmentRates.length === 0
                      ? 'Bu kart için taksit oranı bulunamadı; yalnızca tek çekim sunuluyor.'
                      : null
                  }
                  density={isFullscreen ? 'dense' : 'default'}
                  validationError={errors.install}
                />
              ) : null}

              <section data-anim className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-5">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--panel-ink)]">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[var(--input-border)] accent-[var(--color-brand-600)]" />
                  <span><button type="button" onClick={() => setActiveLegalDoc(LEGAL_DOCS.find((doc) => doc.id === 'tahsilat') ?? null)} className="font-semibold text-[var(--color-brand-600)] hover:underline">Tahsilat Sözleşmesi</button>'ni okudum ve kabul ediyorum.</span>
                </label>
                {errors.agree ? <p className="text-xs text-rose-500">{errors.agree}</p> : null}
                <button
                  type="submit"
                  disabled={saving}
                  className={[
                    'flex h-12 items-center justify-center rounded-xl bg-[var(--color-brand-600)] px-8 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:cursor-wait disabled:opacity-60',
                    isFullscreen ? 'w-full max-w-sm sm:w-auto sm:min-w-[220px]' : 'w-full max-w-[220px]',
                  ].join(' ')}
                >
                  {saving ? 'İşleniyor…' : 'Ödemeyi Tamamla'}
                </button>
              </section>
            </form>
          )}
        </div>
      </main>
      </div>

      {compareOpen && payableAmount > 0 && payToken ? (
        <InstallmentOptionsModal
          amount={payableAmount}
          preferredBankId={bank?.id}
          allowedInstallments={installmentOpts}
          publicToken={payToken}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      {activeLegalDoc ? (
        <LegalDocModal
          doc={activeLegalDoc}
          publicView
          customerVars={contractCustomerVars}
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

/** Sol panel alt logolar — ödeme sayfası ayarlarındaki yükseklik + hover büyütme */
function HeroPaymentBadge({
  name,
  src,
  heightPx,
}: {
  name: string;
  src: string;
  heightPx: number;
}) {
  const [hover, setHover] = useState(false);
  const imgH = Math.min(Math.max(heightPx || 28, 16), 56);
  const boxH = Math.max(40, imgH + 16);

  return (
    <span
      className="relative flex items-center overflow-visible rounded-xl bg-white px-3.5 shadow-md"
      style={{ height: boxH }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img
        src={src}
        alt={name}
        style={{ height: imgH }}
        className={[
          'w-auto max-w-[6.5rem] object-contain transition-opacity',
          hover ? 'opacity-30' : 'opacity-95',
        ].join(' ')}
        draggable={false}
      />
      <AnimatePresence>
        {hover ? (
          <motion.div
            key="badge-pop"
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/80 bg-white p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
            initial={{ height: 0, opacity: 0, scale: 0.3 }}
            animate={{ height: 'auto', opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.3 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
          >
            <img
              src={src}
              alt={name}
              className="h-28 w-auto max-w-[11rem] object-contain"
              draggable={false}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

const LEGAL_PANEL_W = 280;

/** Üst bar — footer Sözleşmeler menüsü gibi; aşağı açılır */
function PublicLegalMenu({ onOpenDoc }: { onOpenDoc: (doc: LegalDoc) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function updatePos() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - LEGAL_PANEL_W - 8);
    setPos({ top: r.bottom + 10, left: Math.max(8, left) });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      updatePos();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll('[data-menu-item]'));
    gsap.set(panel, { transformOrigin: 'top left' });
    gsap.set(items, { autoAlpha: 0, y: -6 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      panel,
      { autoAlpha: 0, y: -10, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.3 },
    ).to(items, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.03 }, '-=0.12');
    return () => {
      tl.kill();
    };
  }, [open]);

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[10050] w-[280px] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="border-b border-[var(--panel-line)] px-4 py-3" data-menu-item>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-600)]">
                Yasal
              </p>
              <p className="text-sm font-bold text-[var(--panel-ink)]">Sözleşmeler</p>
            </div>
            <ul className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    role="menuitem"
                    data-menu-item
                    onClick={() => {
                      setOpen(false);
                      onOpenDoc(doc);
                    }}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-[var(--panel-hover)]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--panel-surface)] text-[var(--panel-muted)]">
                      <DocSmIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug text-[var(--panel-ink)]">
                        {doc.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--panel-muted)]">
                        {doc.subtitle}
                      </span>
                    </span>
                    <span className="mt-1 text-[var(--panel-muted)]">
                      <ChevronRightIcon />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition',
          open
            ? 'border-[var(--color-brand-500)]/45 bg-[var(--brand-soft-bg)] text-[var(--color-brand-700)]'
            : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]/40 hover:text-[var(--color-brand-600)]',
        ].join(' ')}
      >
        <DocSmIcon />
        Sözleşmeler
        <span className={['transition', open ? 'rotate-180' : ''].join(' ')}>
          <ChevronDownIcon />
        </span>
      </button>
      {panel}
    </>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[var(--color-brand-600)]">
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DocSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
