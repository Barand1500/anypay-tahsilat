import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLiveCustomers } from '../customers/mockCustomers';
import { getDefaultPayType } from '../settings/defaultsStore';
import {
  addLivePaymentRequest,
  panelCompanyAsCustomer,
  type PayRequestType,
} from '../payment-requests/mockPaymentRequests';
import { formatMoneyTr, maskMoneyInput, parseTrMoney } from './mockBanks';
import { InstallmentPaintGrid } from './InstallmentPaintGrid';
import { loadReadyDescriptions } from './mockReadyDescriptions';
import { ReadyDescriptionsModal } from './ReadyDescriptionsModal';

type PayType = '' | 'ch' | 'fatura';
type Currency = '' | 'TRY';

const INSTALLMENTS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Ödeme İsteği Oluştur — müşteri satırından veya panel şirketi adına (Ekle).
 */
export default function PaymentRequestPage({ forPanel = false }: { forPanel?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const payTypeRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const customer = useMemo(() => {
    if (forPanel) return panelCompanyAsCustomer();
    return getLiveCustomers().find((c) => c.id === id) ?? null;
  }, [forPanel, id]);

  const backTo = forPanel ? '/odeme-istekleri' : '/musteriler';
  const backLabel = forPanel ? 'Ödeme İstekleri' : 'Müşteriler';

  const [payType, setPayType] = useState<PayType>(() => getDefaultPayType());
  const [payTypeOpen, setPayTypeOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [commissionIncluded, setCommissionIncluded] = useState(false);
  const [installments, setInstallments] = useState<number[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [readyDescriptions, setReadyDescriptions] = useState(() => loadReadyDescriptions());
  const [readyManageOpen, setReadyManageOpen] = useState(false);

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
  const payTypeLabel =
    payType === 'ch' ? 'C/H BAKİYESİ' : payType === 'fatura' ? 'FATURA' : 'Ödeme Tipi Seçiniz';

  function flash(msg: string) {
    setToast(msg);
  }

  function queryBalance() {
    if (!payType) {
      flash('Önce ödeme tipi seçin');
      return;
    }
    const mock = payType === 'fatura' ? 4250 : 12850.75;
    setBalance(mock);
    flash(`Bakiye sorgulandı: ${formatMoneyTr(mock)} ₺`);
  }

  function selectAllInstallments() {
    setInstallments([...INSTALLMENTS]);
  }

  function clearInstallments() {
    setInstallments([]);
  }

  function execFmt(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }

  function applyReadyDescription(text: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    el.innerHTML = `<p>${text}</p>`;
    // caret sona
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    setErrors((prev) => {
      if (!prev.desc) return prev;
      const next = { ...prev };
      delete next.desc;
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!payType) next.payType = 'Ödeme tipi seçin';
    if (!currency) next.currency = 'Para birimi seçin';
    if (!amount || amount <= 0) next.amount = 'Geçerli tutar girin';
    if (installments.length === 0) next.installments = 'En az bir taksit seçin';
    const desc = editorRef.current?.innerText?.trim() ?? '';
    if (!desc) next.desc = 'Açıklama girin';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || !customer) return;
    setSaving(true);
    const descText = editorRef.current?.innerText?.trim() ?? '';
    const token = Math.random().toString(16).slice(2, 15);
    const typeMap: Record<string, PayRequestType> = {
      ch: 'ch',
      fatura: 'fatura',
    };
    addLivePaymentRequest({
      id: `pr-${Date.now()}`,
      token,
      type: typeMap[payType] ?? 'diger',
      status: 'pending',
      customerId: customer.id,
      customerTitle: customer.title,
      amount,
      commissionIncluded,
      createdAt: new Date().toISOString(),
      paidAt: null,
      branch: 'Merkez',
      userId: 'u4',
      userName: 'Ercan Güzel',
      phone: customer.phone,
      email: customer.email,
      whatsapp: customer.phone,
      description: descText,
    });
    window.setTimeout(() => {
      setSaving(false);
      navigate(backTo, {
        replace: true,
        state: { flash: `Ödeme isteği oluşturuldu — ${customer.title}` },
      });
    }, 420);
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
        <p className="text-[var(--panel-ink)]">Müşteri bulunamadı.</p>
        <Link
          to={backTo}
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
        <Link to={backTo} className="font-medium hover:text-[var(--color-brand-600)]">
          {backLabel}
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">
          Ödeme İsteği Oluştur ({customer.title})
        </span>
      </nav>

      <div data-anim className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--panel-ink)]">
            Ödeme İsteği Oluştur
          </h1>
          <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
            {customer.title} · {customer.code}
            {balance != null ? (
              <span className="ml-2 font-semibold text-[var(--color-brand-600)]">
                Bakiye {formatMoneyTr(balance)} ₺
              </span>
            ) : null}
          </p>
        </div>
        <Link
          to={backTo}
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
          <div className="border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-600)]">
              Ödeme bilgileri
            </h2>
          </div>

          <div className="grid gap-0 lg:grid-cols-2">
            {/* Sol */}
            <div className="flex flex-col gap-4 border-b border-[var(--panel-line)] p-5 lg:border-b-0 lg:border-r sm:p-6">
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
                    <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-orange-500">
                      <CoinsIcon />
                    </span>
                    <input
                      data-km-jump
                      id="req-amount"
                      value={amountText}
                      onChange={(e) => setAmountText(maskMoneyInput(e.target.value))}
                      inputMode="numeric"
                      placeholder=" "
                      className="peer w-full rounded-l-xl bg-transparent py-2.5 pl-10 pr-3.5 pt-5 text-right text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none"
                    />
                    <label
                      htmlFor="req-amount"
                      className={[
                        'input-label-gap pointer-events-none absolute left-9 top-1/2 z-10 origin-left -translate-y-1/2',
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
                              currency === '' ? 'bg-[var(--panel-hover)]' : 'hover:bg-[var(--panel-hover)]',
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
                              currency === 'TRY' ? 'bg-[var(--panel-hover)]' : 'hover:bg-[var(--panel-hover)]',
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
                  <p className="mt-1 text-xs text-rose-500">{errors.amount || errors.currency}</p>
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

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  İzin verilen taksitler
                </p>
                <div
                  className={[
                    'rounded-xl border bg-[var(--panel-surface)] p-3',
                    errors.installments ? 'border-rose-400' : 'border-[var(--panel-line)]',
                  ].join(' ')}
                >
                  {installments.length === 0 ? (
                    <p className="mb-2 text-sm text-[var(--panel-muted)]">Taksitleri seçiniz.</p>
                  ) : (
                    <p className="mb-2 text-sm font-medium text-[var(--panel-ink)]">
                      Seçili: {installments.join(', ')}
                    </p>
                  )}
                  <InstallmentPaintGrid
                    options={INSTALLMENTS}
                    value={installments}
                    onChange={setInstallments}
                    kmJump
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-km-jump
                      onClick={selectAllInstallments}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                    >
                      Tümünü Seç
                    </button>
                    <button
                      type="button"
                      data-km-jump
                      onClick={clearInstallments}
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-400"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
                {errors.installments ? (
                  <p className="mt-1 text-xs text-rose-500">{errors.installments}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  Dosya
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--input-bg)] px-3 py-2.5">
                  <button
                    type="button"
                    data-km-jump
                    onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
                  >
                    Göz at…
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--panel-muted)]">
                    {fileName ?? 'Dosya seçilmedi.'}
                  </span>
                  {fileName ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFileName(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="text-xs font-semibold text-rose-500 hover:underline"
                    >
                      Kaldır
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Sağ — açıklama grubu */}
            <div className="flex min-h-[420px] flex-col p-5 sm:p-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-600)]">
                Açıklama
              </p>
              <div
                className={[
                  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
                  errors.desc ? 'border-rose-400' : 'border-[var(--input-border)]',
                ].join(' ')}
              >
                <div className="flex flex-wrap gap-0.5 border-b border-[var(--panel-line)] bg-[var(--panel-surface)] px-2 py-1.5">
                  <ToolBtn title="Kalın" onClick={() => execFmt('bold')}>
                    <b>B</b>
                  </ToolBtn>
                  <ToolBtn title="İtalik" onClick={() => execFmt('italic')}>
                    <i>I</i>
                  </ToolBtn>
                  <ToolBtn title="Altı çizili" onClick={() => execFmt('underline')}>
                    <span className="underline">U</span>
                  </ToolBtn>
                  <span className="mx-1 w-px self-stretch bg-[var(--panel-line)]" />
                  <ToolBtn title="Liste" onClick={() => execFmt('insertUnorderedList')}>
                    ••
                  </ToolBtn>
                  <ToolBtn title="Numaralı" onClick={() => execFmt('insertOrderedList')}>
                    1.
                  </ToolBtn>
                  <span className="mx-1 w-px self-stretch bg-[var(--panel-line)]" />
                  <ToolBtn title="Sola" onClick={() => execFmt('justifyLeft')}>
                    ≡
                  </ToolBtn>
                  <ToolBtn title="Ortala" onClick={() => execFmt('justifyCenter')}>
                    ≣
                  </ToolBtn>
                  <ToolBtn
                    title="Bağlantı"
                    onClick={() => {
                      const url = window.prompt('Bağlantı URL');
                      if (url) execFmt('createLink', url);
                    }}
                  >
                    ↗
                  </ToolBtn>
                  <ToolBtn title="Biçimi temizle" onClick={() => execFmt('removeFormat')}>
                    ⌫
                  </ToolBtn>
                </div>
                <div
                  ref={editorRef}
                  data-km-jump
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline
                  aria-label="Açıklama"
                  className="min-h-[200px] flex-1 overflow-y-auto bg-[var(--input-bg)] px-3.5 py-3 text-sm leading-relaxed text-[var(--panel-ink)] outline-none empty:before:text-[var(--panel-muted)] empty:before:content-['Ödeme_isteği_açıklamasını_yazın…']"
                />

                <div className="border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/80 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                      Hazır açıklamalar
                    </p>
                    <button
                      type="button"
                      data-km-jump
                      title="Hazır açıklamaları düzenle"
                      aria-label="Hazır açıklamaları düzenle"
                      onClick={() => setReadyManageOpen(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--color-brand-600)]"
                    >
                      <PencilSmIcon />
                    </button>
                  </div>
                  {readyDescriptions.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--panel-line)] px-3 py-4 text-center text-[11px] text-[var(--panel-muted)]">
                      Hazır açıklama yok — kalem ile ekleyin
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {readyDescriptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-km-jump
                          onClick={() => applyReadyDescription(item.text)}
                          className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-left transition hover:border-[var(--color-brand-500)]/45 hover:bg-[var(--brand-soft-bg)]"
                        >
                          <span className="block text-[12px] font-bold text-[var(--color-brand-600)]">
                            {item.title}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[var(--panel-muted)]">
                            {item.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {errors.desc ? <p className="mt-1 text-xs text-rose-500">{errors.desc}</p> : null}
            </div>
          </div>
        </section>

        <div data-anim className="flex justify-center">
          <button
            type="submit"
            data-km-jump
            disabled={saving}
            className="inline-flex min-w-[260px] items-center justify-center rounded-xl bg-[var(--color-brand-600)] px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
          >
            {saving ? 'Oluşturuluyor…' : 'Ödeme İsteği Oluştur'}
          </button>
        </div>
      </form>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}

      {readyManageOpen ? (
        <ReadyDescriptionsModal
          onClose={() => setReadyManageOpen(false)}
          onChange={setReadyDescriptions}
        />
      ) : null}
    </div>
  );
}

function ToolBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
    >
      {children}
    </button>
  );
}

function PencilSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13 6l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
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

function CoinsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 10v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4" stroke="currentColor" strokeWidth="1.6" />
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
