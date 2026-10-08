import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import {
  formatScheduleDisplay,
  ScheduleDateTimeModal,
} from '../../components/ui/ScheduleDateTimeModal';
import { TextArea } from '../../components/ui/TextArea';
import { api } from '../../lib/api';
import { useCustomersList } from '../customers/useCustomersList';

export type ReminderRow = {
  id: number;
  customerId: string;
  customerTitle: string;
  scheduledAt: string;
  description: string;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  status: 'pending' | 'sent' | 'cancelled';
  deepLink: string;
  remainingMs: number;
};

type Props = { onClose: () => void };

const QUICK_OFFSETS = [
  { label: '30 dk', ms: 30 * 60_000 },
  { label: '1 saat', ms: 60 * 60_000 },
  { label: '3 saat', ms: 3 * 60 * 60_000 },
  { label: '1 gün', ms: 24 * 60 * 60_000 },
  { label: '3 gün', ms: 3 * 24 * 60 * 60_000 },
  { label: '7 gün', ms: 7 * 24 * 60 * 60_000 },
];

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  const d = new Date(local);
  return Number.isNaN(+d) ? '' : d.toISOString();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Zamanı geldi';
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}g ${h}sa ${m}dk`;
  if (h > 0) return `${h}sa ${m}dk ${s}sn`;
  return `${m}dk ${s}sn`;
}

/**
 * Ödeme hatırlatması — müşteri + zaman + kanallar; sağda liste / geri sayım.
 * Esc / X; overlay kapatmaz.
 */
export function ReminderSettingsModal({ onClose }: Props) {
  const { token } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { customers, loading: customersLoading } = useCustomersList({
    enabled: true,
    parentId: 'all',
  });

  const [list, setList] = useState<ReminderRow[]>([]);
  const [activeId, setActiveId] = useState<number | 'new'>('new');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [whenLocal, setWhenLocal] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 60 * 60_000).toISOString()),
  );
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.title}${c.code ? ` · ${c.code}` : ''}`,
      })),
    [customers],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await api.get<ReminderRow[]>('/api/payment-requests/reminders', token);
      setList(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (scheduleOpen) return;
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, scheduleOpen]);

  const active = activeId === 'new' ? null : list.find((r) => r.id === activeId) ?? null;

  useEffect(() => {
    if (!active) return;
    setCustomerId(active.customerId);
    setWhenLocal(toLocalInputValue(active.scheduledAt));
    setDescription(active.description || '');
    setEmail(active.email);
    setSms(active.sms);
    setWhatsapp(active.whatsapp);
    setError(null);
    setOkMsg(null);
  }, [active]);

  function startNew() {
    setActiveId('new');
    setCustomerId(null);
    setWhenLocal(toLocalInputValue(new Date(Date.now() + 60 * 60_000).toISOString()));
    setDescription('');
    setEmail(true);
    setSms(true);
    setWhatsapp(false);
    setError(null);
    setOkMsg(null);
  }

  function applyQuick(ms: number) {
    setWhenLocal(toLocalInputValue(new Date(Date.now() + ms).toISOString()));
    setOkMsg(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || saving) return;
    if (!customerId) {
      setError('Müşteri seçin');
      return;
    }
    const scheduledAt = fromLocalInputValue(whenLocal);
    if (!scheduledAt) {
      setError('Geçerli bir zaman seçin');
      return;
    }
    if (!email && !sms && !whatsapp) {
      setError('En az bir kanal seçin');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (activeId === 'new') {
        const row = await api.post<ReminderRow>(
          '/api/payment-requests/reminders',
          {
            customerId: Number(customerId),
            scheduledAt,
            description,
            email,
            sms,
            whatsapp,
          },
          token,
        );
        setList((prev) => [...prev, row].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)));
        setActiveId(row.id);
        setOkMsg('Hatırlatma oluşturuldu');
      } else {
        const row = await api.patch<ReminderRow>(
          `/api/payment-requests/reminders/${activeId}`,
          { scheduledAt, description, email, sms, whatsapp },
          token,
        );
        setList((prev) =>
          prev
            .map((x) => (x.id === row.id ? row : x))
            .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)),
        );
        setOkMsg('Hatırlatma güncellendi');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function removeActive() {
    if (!token || activeId === 'new' || saving) return;
    setSaving(true);
    try {
      await api.delete(`/api/payment-requests/reminders/${activeId}`, token);
      setList((prev) => prev.filter((x) => x.id !== activeId));
      startNew();
      setOkMsg('Hatırlatma iptal edildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setSaving(false);
    }
  }

  const previewRemaining = useMemo(() => {
    const iso = fromLocalInputValue(whenLocal);
    if (!iso) return 0;
    return Math.max(0, +new Date(iso) - nowMs);
  }, [whenLocal, nowMs]);

  return createPortal(
    <>
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={wrapRef}
        className="relative z-10 flex w-full max-w-5xl flex-col items-stretch gap-4 sm:max-w-none sm:w-auto sm:flex-row sm:items-stretch"
      >
        {/* Ana form */}
        <form
          onSubmit={(e) => void save(e)}
          className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.22)] sm:w-[40rem] [--input-notch:var(--panel-elevated)]"
        >
          <header className="relative shrink-0 overflow-hidden border-b border-[var(--panel-line)] px-6 pb-5 pt-6">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-brand-500)]/20 via-[var(--color-brand-500)]/5 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
              aria-label="Kapat"
            >
              ✕ ESC
            </button>
            <div className="relative flex items-start gap-3.5 pr-14">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-600)] text-white shadow-lg shadow-[color-mix(in_srgb,var(--color-brand-600)_35%,transparent)]">
                <BellGlyph />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-600)]">
                  AnyPay · Hatırlatma
                </p>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[var(--panel-ink)]">
                  {activeId === 'new' ? 'Ödeme hatırlatması oluştur' : 'Hatırlatmayı düzenle'}
                </h2>
                <p className="mt-1 text-sm leading-snug text-[var(--panel-muted)]">
                  Zamanı gelince size bildirim gider; link ödeme isteği sayfasını açar.
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <FloatingSearchSelect
              label="Müşteri"
              options={customerOptions}
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                setOkMsg(null);
              }}
              placeholder={customersLoading ? 'Yükleniyor…' : 'Müşteri seçiniz.'}
              kmJump
            />

            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Ne zaman sonra?
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_OFFSETS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    data-km-jump
                    onClick={() => applyQuick(q.ms)}
                    className="rounded-full border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--panel-ink)] shadow-sm transition hover:border-[var(--color-brand-500)] hover:bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-surface))] hover:text-[var(--color-brand-600)]"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-km-jump
                onClick={() => setScheduleOpen(true)}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/12 via-[var(--panel-surface)] to-[var(--panel-surface)] px-4 py-4 text-left shadow-sm transition hover:border-[var(--color-brand-500)] hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-600)] text-white shadow-sm">
                  <CalendarGlyph />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                    Tarih / saat
                  </span>
                  <span className="mt-0.5 block truncate text-lg font-bold tabular-nums tracking-tight text-[var(--panel-ink)]">
                    {formatScheduleDisplay(whenLocal)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[var(--panel-elevated)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--color-brand-600)] ring-1 ring-[var(--panel-line)] transition group-hover:ring-[var(--color-brand-500)]">
                  Değiştir
                </span>
              </button>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--color-brand-500)_28%,var(--panel-line))] bg-gradient-to-r from-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] to-transparent px-4 py-3.5">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-600)]/80">
                  Canlı geri sayım
                </p>
                <p className="mt-1 text-center text-2xl font-bold tabular-nums tracking-tight text-[var(--color-brand-600)]">
                  {formatCountdown(previewRemaining)}
                </p>
              </div>
            </div>

            <TextArea
              data-km-jump
              label="Açıklama (opsiyonel)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />

            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Bildirim kanalları
              </p>
              <div className="grid gap-2.5">
                <ChannelCard
                  title="E-posta bildirimi"
                  hint="Hesabınızdaki e-postaya"
                  checked={email}
                  onChange={setEmail}
                  tone="sky"
                  icon={<MailGlyph />}
                />
                <ChannelCard
                  title="SMS bildirimi"
                  hint="Kayıtlı telefonunuza"
                  checked={sms}
                  onChange={setSms}
                  tone="emerald"
                  icon={<SmsGlyph />}
                />
                <ChannelCard
                  title="WhatsApp bildirimi"
                  hint="Entegrasyon açıksa"
                  checked={whatsapp}
                  onChange={setWhatsapp}
                  tone="teal"
                  icon={<WaGlyph />}
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
                {error}
              </p>
            ) : null}
            {okMsg ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                {okMsg}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-6 py-4">
            {activeId !== 'new' ? (
              <button
                type="button"
                data-km-jump
                disabled={saving}
                onClick={() => void removeActive()}
                className="h-11 rounded-xl px-3 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
              >
                İptal et
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                data-km-jump
                onClick={onClose}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
              >
                Kapat
              </button>
              <div className="min-w-[8.5rem]">
                <Button type="submit" disabled={saving || loading}>
                  {saving ? 'Kaydediliyor…' : activeId === 'new' ? 'Oluştur' : 'Kaydet'}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Sağ liste */}
        <aside className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.22)] sm:w-[22rem]">
          <div className="relative overflow-hidden border-b border-[var(--panel-line)] px-4 py-4">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-brand-500)]/16 to-transparent"
              aria-hidden
            />
            <div className="relative flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                  Hatırlatmalarım
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--panel-muted)]">
                  {list.length} kayıt · geri sayım canlı
                </p>
              </div>
              <button
                type="button"
                data-km-jump
                onClick={startNew}
                className="rounded-xl bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
              >
                + Yeni
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
            {loading ? (
              <p className="px-1 py-8 text-center text-xs text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--panel-line)] px-4 py-10 text-center">
                <p className="text-xs font-semibold text-[var(--panel-muted)]">
                  Henüz hatırlatma yok
                </p>
                <p className="mt-1 text-[11px] text-[var(--panel-muted)]">
                  Soldan yeni bir kayıt oluşturun.
                </p>
              </div>
            ) : (
              list.map((r) => {
                const remain = Math.max(0, +new Date(r.scheduledAt) - nowMs);
                const selected = activeId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-km-jump
                    onClick={() => setActiveId(r.id)}
                    className={[
                      'w-full rounded-2xl border px-3.5 py-3 text-left transition',
                      selected
                        ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-elevated))] shadow-sm'
                        : 'border-[var(--panel-line)] bg-[var(--panel-surface)] hover:border-[var(--color-brand-500)]/55',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-[var(--panel-ink)]">
                        {r.customerTitle}
                      </p>
                      {r.status === 'sent' ? (
                        <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          Gönderildi
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={[
                        'mt-1.5 text-sm font-bold tabular-nums',
                        r.status === 'sent'
                          ? 'text-[var(--panel-muted)]'
                          : 'text-[var(--color-brand-600)]',
                      ].join(' ')}
                    >
                      {r.status === 'sent' ? 'Tamamlandı' : formatCountdown(remain)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.email ? <Chip>E-posta</Chip> : null}
                      {r.sms ? <Chip>SMS</Chip> : null}
                      {r.whatsapp ? <Chip>WhatsApp</Chip> : null}
                    </div>
                  </button>
                );
              })
            )}
            {activeId === 'new' ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-brand-500)]/45 bg-[color-mix(in_srgb,var(--color-brand-500)_8%,transparent)] px-3.5 py-3 text-xs font-semibold text-[var(--color-brand-600)]">
                Yeni taslak düzenleniyor…
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
    <ScheduleDateTimeModal
      open={scheduleOpen}
      valueIso={fromLocalInputValue(whenLocal) || new Date().toISOString()}
      onClose={() => setScheduleOpen(false)}
      onConfirm={(iso) => {
        setWhenLocal(toLocalInputValue(iso));
        setOkMsg(null);
        setScheduleOpen(false);
      }}
    />
    </>,
    document.body,
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--panel-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--panel-muted)] ring-1 ring-[var(--panel-line)]">
      {children}
    </span>
  );
}

function ChannelCard({
  title,
  hint,
  checked,
  onChange,
  tone,
  icon,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone: 'sky' | 'emerald' | 'teal';
  icon: ReactNode;
}) {
  const toneCls =
    tone === 'sky'
      ? 'border-sky-400/50 bg-sky-500/10'
      : tone === 'emerald'
        ? 'border-emerald-400/50 bg-emerald-500/10'
        : 'border-teal-400/50 bg-teal-500/10';
  const iconTone =
    tone === 'sky'
      ? 'bg-sky-500/20 text-sky-600'
      : tone === 'emerald'
        ? 'bg-emerald-500/20 text-emerald-600'
        : 'bg-teal-500/20 text-teal-600';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-km-jump
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition',
        checked ? toneCls : 'border-[var(--panel-line)] bg-[var(--panel-surface)]',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            checked ? iconTone : 'bg-[var(--panel-elevated)] text-[var(--panel-muted)]',
          ].join(' ')}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--panel-ink)]">{title}</span>
          <span className="block text-[11px] text-[var(--panel-muted)]">{hint}</span>
        </span>
      </span>
      <span
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : '',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

function BellGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1.2 5 2 6H4c.8-1 2-2.5 2-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SmsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WaGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5a8 8 0 0 0-6.9 12.1L4 20.5l5.1-1.3A8 8 0 1 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 9.8c.3-.5.6-.5.8-.5h.3c.1 0 .3 0 .4.3l.5 1.2c.1.2 0 .4-.1.5l-.3.4c-.1.1-.1.3 0 .4.4.6 1 1.2 1.6 1.6.2.1.3.1.4 0l.4-.3c.2-.1.3-.1.5 0l1.2.5c.2.1.3.3.3.4v.3c0 .2 0 .5-.5.8-.4.2-1 .3-1.7 0A7 7 0 0 1 9.5 11c-.2-.7-.1-1.3.0-1.7.1-.1.2-.3.2-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
