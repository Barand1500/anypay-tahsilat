import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { CurrencySymbolPicker } from './CurrencySymbolPicker';
import {
  DEFAULT_CURRENCY_API_URL,
  RATE_TYPE_OPTIONS,
  type CurrencyDef,
  type CurrencyStatus,
  type RateType,
} from './mockCurrencies';

export type CurrencyFocusField =
  | 'name'
  | 'shortName'
  | 'symbol'
  | 'rateType'
  | 'autoUpdate'
  | 'rate'
  | 'apiUrl'
  | 'status';

type Mode = { type: 'create' } | { type: 'edit'; currency: CurrencyDef };

type Props = {
  mode: Mode;
  onClose: () => void;
  onSave: (c: Omit<CurrencyDef, 'id'> & { id?: string }) => void;
  /** Çift tıklanan sütuna göre odak / yanıp sönme */
  focusField?: CurrencyFocusField | null;
};

function formatRateInput(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function parseRateInput(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function CurrencyModal({ mode, onClose, onSave, focusField = null }: Props) {
  const isEdit = mode.type === 'edit';
  const src = isEdit ? mode.currency : null;

  const [name, setName] = useState(src?.name ?? '');
  const [shortName, setShortName] = useState(src?.shortName ?? '');
  const [symbol, setSymbol] = useState(src?.symbol ?? '');
  const [rateType, setRateType] = useState<RateType | null>(src?.rateType ?? null);
  const [autoUpdate, setAutoUpdate] = useState(src?.autoUpdate ?? false);
  const [rateText, setRateText] = useState(formatRateInput(src?.rate ?? 0));
  const [apiUrl, setApiUrl] = useState(src?.apiUrl ?? DEFAULT_CURRENCY_API_URL);
  const [status, setStatus] = useState<CurrencyStatus>(src?.status ?? 'Aktif');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pulse, setPulse] = useState<CurrencyFocusField | null>(focusField);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const shortNameRef = useRef<HTMLInputElement>(null);
  const symbolRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const apiUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (symbolPickerOpen) {
        setSymbolPickerOpen(false);
        return;
      }
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, symbolPickerOpen]);

  useEffect(() => {
    const field = focusField ?? 'name';
    setPulse(field);
    const t = window.setTimeout(() => {
      if (field === 'name') nameRef.current?.focus();
      else if (field === 'shortName') shortNameRef.current?.focus();
      else if (field === 'symbol') symbolRef.current?.focus();
      else if (field === 'rate') rateRef.current?.focus();
      else if (field === 'apiUrl') apiUrlRef.current?.focus();
    }, 280);
    const clear = window.setTimeout(() => setPulse(null), 1600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [focusField]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Zorunlu';
    if (!shortName.trim()) next.shortName = 'Zorunlu';
    if (!symbol.trim()) next.symbol = 'Zorunlu';
    if (!rateType) next.rateType = 'Kur tipi seçiniz';
    if (!apiUrl.trim()) next.apiUrl = 'Zorunlu';
    const rate = parseRateInput(rateText);
    if (!Number.isFinite(rate) || rate < 0) next.rate = 'Geçersiz kur';
    setErrors(next);
    if (Object.keys(next).length) return;

    onSave({
      id: src?.id,
      name: name.trim(),
      shortName: shortName.trim().toUpperCase(),
      symbol: symbol.trim(),
      rateType: rateType!,
      rate,
      autoUpdate,
      apiUrl: apiUrl.trim(),
      status,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        className="relative z-[1] flex w-full max-w-2xl flex-col items-stretch gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:items-start"
      >
        <CurrencySymbolPicker
          open={symbolPickerOpen}
          value={symbol}
          onSelect={(opt) => {
            setSymbol(opt.symbol);
            setName(opt.name);
            setShortName(opt.code === 'TRY' ? 'TL' : opt.code.slice(0, 8));
            setErrors((prev) => {
              const next = { ...prev };
              delete next.symbol;
              delete next.name;
              delete next.shortName;
              return next;
            });
          }}
          onClose={() => setSymbolPickerOpen(false)}
        />

        <div
          role="dialog"
          aria-modal
          aria-labelledby="currency-modal-title"
          className="flex w-full max-w-2xl shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
            <h2 id="currency-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
              {isEdit ? 'Para Birimi Düzenle' : 'Para Birimi Ekle'}
            </h2>
            <button
              type="button"
              aria-label="Kapat"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            >
              <CloseIcon />
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col">
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={pulse === 'symbol' ? 'field-focus-pulse rounded-xl' : ''}>
                  <TextInput
                    ref={symbolRef}
                    data-km-jump
                    label="Sembol *"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.slice(0, 6))}
                    error={errors.symbol}
                    required
                    endAdornment={
                      <button
                        type="button"
                        data-km-jump
                        aria-label="Sembol seç"
                        title="Sembol seç"
                        onClick={() => setSymbolPickerOpen((v) => !v)}
                        className={[
                          'flex h-8 w-8 items-center justify-center rounded-lg text-base transition',
                          symbolPickerOpen
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--color-brand-600)]'
                            : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                        ].join(' ')}
                      >
                        {symbol.trim() || '☺'}
                      </button>
                    }
                  />
                </div>
                <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
                  <TextInput
                    ref={nameRef}
                    data-km-jump
                    label="Adı *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    required
                  />
                </div>
                <div className={pulse === 'shortName' ? 'field-focus-pulse rounded-xl' : ''}>
                  <TextInput
                    ref={shortNameRef}
                    data-km-jump
                    label="Kısa Adı *"
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 8))}
                    error={errors.shortName}
                    required
                    className="font-mono uppercase tracking-wide"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
                <div className={pulse === 'rateType' ? 'field-focus-pulse rounded-xl' : ''}>
                  <FloatingSearchSelect
                    label="Kur Tipi *"
                    placeholder="Kur tipi seçiniz."
                    options={RATE_TYPE_OPTIONS}
                    value={rateType}
                    onChange={(v) => setRateType((v as RateType) ?? null)}
                    required
                    kmJump
                    pulse={pulse === 'rateType'}
                  />
                </div>

                <label
                  className={[
                    'relative flex h-[3.25rem] w-full cursor-pointer items-center rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 transition hover:border-[color-mix(in_srgb,var(--input-border-focus)_45%,var(--input-border))]',
                    pulse === 'autoUpdate' ? 'field-focus-pulse' : '',
                  ].join(' ')}
                >
                  <span className="input-label-gap is-gapped pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 px-1.5 text-xs font-medium text-[var(--panel-muted)]">
                    Oto Güncelleme
                  </span>
                  <input
                    type="checkbox"
                    data-km-jump
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                    aria-label="Oto güncelleme"
                    className="h-4 w-4 shrink-0 rounded border-[var(--input-border)] accent-[var(--color-brand-600)] focus:ring-0"
                  />
                </label>

                <div className={pulse === 'rate' ? 'field-focus-pulse rounded-xl' : ''}>
                  <TextInput
                    ref={rateRef}
                    data-km-jump
                    label="Kur *"
                    value={rateText}
                    onChange={(e) => setRateText(e.target.value)}
                    error={errors.rate}
                    required
                    disabled={autoUpdate}
                    inputMode="decimal"
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className={pulse === 'apiUrl' ? 'field-focus-pulse rounded-xl' : ''}>
                <TextInput
                  ref={apiUrlRef}
                  data-km-jump
                  label="Api Url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  error={errors.apiUrl}
                  className="font-mono text-[13px]"
                />
              </div>

              <div
                className={[
                  'flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3.5 py-3',
                  pulse === 'status' ? 'field-focus-pulse' : '',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--panel-ink)]">Durum *</p>
                  <p className="text-xs text-[var(--panel-muted)]">
                    {status === 'Aktif' ? 'İşlemlerde kullanılabilir' : 'Listede pasif görünür'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'text-xs font-semibold',
                      status === 'Aktif' ? 'text-emerald-600' : 'text-rose-500',
                    ].join(' ')}
                  >
                    {status}
                  </span>
                  <Toggle
                    on={status === 'Aktif'}
                    onChange={(on) => setStatus(on ? 'Aktif' : 'Pasif')}
                    label="Durum"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
              >
                Kapat
              </button>
              <button
                type="submit"
                data-km-jump
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-km-jump
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={[
        'relative h-8 w-14 shrink-0 rounded-full transition',
        on ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
          on ? 'left-7' : 'left-1',
        ].join(' ')}
      />
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
