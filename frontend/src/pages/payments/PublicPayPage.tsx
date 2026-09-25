import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { formatPhoneLive, normalizePhoneInput } from '../customers/mockCustomers';
import {
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  formatMoneyTr,
  getCardExpiryError,
  isValidLuhn,
} from '../payments/mockBanks';

type PublicPayView = {
  token: string;
  type: 'ch' | 'fatura' | 'diger';
  status: 'pending' | 'paid';
  customerTitle: string;
  amount: number;
  commissionIncluded: boolean;
  description: string;
  installments: number[];
  merchantTitle: string;
  paidAt: string | null;
};

/**
 * Public ödeme linki — /pay/:token (auth yok).
 */
export default function PublicPayPage() {
  const { token: payToken } = useParams();
  const rootRef = useRef<HTMLDivElement>(null);

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

  function validate(): boolean {
    const next: Record<string, string> = {};
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
      const data = await api.post<{ odemeNo: string; amount: number }>(
        `/api/pay/${encodeURIComponent(payToken)}`,
        {
          holder: holder.trim(),
          tc: digitsOnly(tc) || undefined,
          phone: digitsOnly(phone).slice(0, 10),
          cardDigits: digitsOnly(card),
          installment,
          note: view.description,
        },
      );
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

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--brand-soft-bg),_var(--panel-bg)_55%)] px-4 py-10"
    >
      <div className="mx-auto w-full max-w-lg">
        <header data-anim className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
            Güzel Teknoloji
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--panel-ink)] sm:text-2xl">
            {view.merchantTitle}
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">Güvenli ödeme</p>
        </header>

        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6"
        >
          <div className="mb-5 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-3.5">
            <p className="text-sm font-semibold text-[var(--panel-ink)]">{view.customerTitle}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-brand-600)]">
              {formatMoneyTr(view.amount)} ₺
            </p>
            <p className="mt-1 text-xs text-[var(--panel-muted)]">
              {view.commissionIncluded ? 'Komisyon dahil' : 'Komisyon hariç'}
              {view.description ? ` · ${view.description.slice(0, 120)}` : ''}
            </p>
          </div>

          {alreadyPaid ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 text-center">
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Ödeme alındı</p>
              <p className="mt-1 text-sm text-[var(--panel-muted)]">
                {done
                  ? `${done.odemeNo} · ${formatMoneyTr(done.amount)} ₺`
                  : 'Bu link daha önce kullanıldı.'}
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5">
              <TextInput
                label="Kart üzerindeki ad soyad"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                error={errors.holder}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="T.C. kimlik no"
                  value={tc}
                  onChange={(e) => setTc(digitsOnly(e.target.value).slice(0, 11))}
                  inputMode="numeric"
                  error={errors.tc}
                />
                <TextInput
                  label="Telefon"
                  value={formatPhoneLive(phone)}
                  onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                  inputMode="tel"
                  error={errors.phone}
                />
              </div>
              <TextInput
                label="Kart numarası"
                value={formatCardNumber(card)}
                onChange={(e) => setCard(digitsOnly(e.target.value).slice(0, 16))}
                inputMode="numeric"
                error={errors.card}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="Son kullanma (AA/YY)"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                  inputMode="numeric"
                  error={errors.expiry}
                />
                <TextInput
                  label="CVC"
                  value={cvc}
                  onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                  inputMode="numeric"
                  error={errors.cvc}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  Taksit
                </p>
                <div className="flex flex-wrap gap-2">
                  {installmentOpts.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallment(n)}
                      className={[
                        'rounded-xl px-3.5 py-2 text-sm font-bold tabular-nums transition',
                        installment === n
                          ? 'bg-[var(--color-brand-600)] text-white'
                          : 'border border-[var(--panel-line)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                      ].join(' ')}
                    >
                      {n === 1 ? 'Tek çekim' : `${n} taksit`}
                    </button>
                  ))}
                </div>
                {errors.install ? (
                  <p className="mt-1 text-xs text-rose-500">{errors.install}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
              >
                {saving ? 'İşleniyor…' : `Öde — ${formatMoneyTr(view.amount)} ₺`}
              </button>
              <p className="text-center text-[11px] text-[var(--panel-muted)]">
                Kart bilgileri bankaya iletilmeden önce panel kaydı oluşturulur; 3D Secure sonraki adım.
              </p>
            </form>
          )}
        </section>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
