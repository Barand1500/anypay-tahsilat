import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';

export type ReminderSettings = {
  active: boolean;
  days: number[];
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
};

type Props = { onClose: () => void };

const DAY_PRESETS = [1, 2, 3, 5, 7, 14, 30];

/**
 * Ödeme isteği otomatik hatırlatma — Esc / X; overlay kapatmaz.
 */
export function ReminderSettingsModal({ onClose }: Props) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ReminderSettings>({
    active: false,
    days: [1, 3, 7],
    email: true,
    sms: true,
    whatsapp: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void api
      .get<ReminderSettings>('/api/payment-requests/reminders/settings', token)
      .then((data) => {
        setDraft({
          active: Boolean(data.active),
          days: data.days?.length ? data.days : [1, 3, 7],
          email: data.email !== false,
          sms: Boolean(data.sms),
          whatsapp: Boolean(data.whatsapp),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Yüklenemedi'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function toggleDay(d: number) {
    setDraft((prev) => {
      const has = prev.days.includes(d);
      const days = has ? prev.days.filter((x) => x !== d) : [...prev.days, d].sort((a, b) => a - b);
      return { ...prev, days };
    });
    setOkMsg(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || saving) return;
    if (!draft.days.length) {
      setError('En az bir gün seçin');
      return;
    }
    if (!draft.email && !draft.sms && !draft.whatsapp) {
      setError('En az bir kanal seçin');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<ReminderSettings>(
        '/api/payment-requests/reminders/settings',
        draft,
        token,
      );
      setDraft(data);
      setOkMsg('Ayarlar kaydedildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!token || running) return;
    setRunning(true);
    setError(null);
    try {
      const data = await api.post<{ checked: number; sent: number; skipped: number; errors: number }>(
        '/api/payment-requests/reminders/run',
        {},
        token,
      );
      setOkMsg(
        `Tarama bitti — kontrol: ${data.checked}, gönderilen: ${data.sent}, atlanan: ${data.skipped}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tarama başarısız');
    } finally {
      setRunning(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10055] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="reminder-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/14 via-[var(--color-brand-500)]/5 to-transparent px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            ✕ <span>ESC</span>
          </button>
          <h2 id="reminder-title" className="pr-16 text-lg font-bold text-[var(--panel-ink)]">
            Otomatik hatırlatma
          </h2>
          <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
            Ödenmemiş ödeme isteklerine gün bazlı SMS / e-posta / WhatsApp hatırlatması.
          </p>
        </header>

        <form
          onSubmit={(e) => void save(e)}
          className="flex min-h-0 flex-1 flex-col [--input-notch:var(--panel-elevated)]"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            {loading ? (
              <p className="text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--panel-ink)]">Hatırlatmayı etkinleştir</p>
                    <p className="text-xs text-[var(--panel-muted)]">Saatte bir otomatik taranır</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.active}
                    data-km-jump
                    onClick={() => {
                      setDraft((d) => ({ ...d, active: !d.active }));
                      setOkMsg(null);
                    }}
                    className={[
                      'relative h-7 w-12 shrink-0 rounded-full transition',
                      draft.active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition',
                        draft.active ? 'translate-x-5' : '',
                      ].join(' ')}
                    />
                  </button>
                </div>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                    Kaç gün sonra?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_PRESETS.map((d) => {
                      const on = draft.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          data-km-jump
                          onClick={() => toggleDay(d)}
                          className={[
                            'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                            on
                              ? 'bg-[var(--color-brand-600)] text-white'
                              : 'border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]',
                          ].join(' ')}
                        >
                          {d}. gün
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                    Kanallar
                  </p>
                  <div className="grid gap-2">
                    <ChannelToggle
                      label="E-posta"
                      checked={draft.email}
                      onChange={(v) => {
                        setDraft((d) => ({ ...d, email: v }));
                        setOkMsg(null);
                      }}
                    />
                    <ChannelToggle
                      label="SMS"
                      checked={draft.sms}
                      onChange={(v) => {
                        setDraft((d) => ({ ...d, sms: v }));
                        setOkMsg(null);
                      }}
                    />
                    <ChannelToggle
                      label="WhatsApp (yalnızca entegrasyon açıkken)"
                      checked={draft.whatsapp}
                      onChange={(v) => {
                        setDraft((d) => ({ ...d, whatsapp: v }));
                        setOkMsg(null);
                      }}
                    />
                  </div>
                </section>

                <p className="text-xs leading-relaxed text-[var(--panel-muted)]">
                  Her gün kademesi bir kez gönderilir. WhatsApp kapalıysa veya Meta engelliyse o kanal
                  atlanır; e-posta/SMS devam eder.
                </p>
              </>
            )}

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

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-line)] px-5 py-4">
            <button
              type="button"
              data-km-jump
              disabled={running || loading}
              onClick={() => void runNow()}
              className="h-11 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:opacity-50"
            >
              {running ? 'Taranıyor…' : 'Şimdi tara'}
            </button>
            <div className="flex gap-2">
              <button type="button" data-km-jump onClick={onClose} className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]">
                Kapat
              </button>
              <div className="min-w-[8.5rem]">
                <Button type="submit" disabled={saving || loading}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function ChannelToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-km-jump
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition',
        checked
          ? 'border-[color-mix(in_srgb,var(--color-brand-500)_45%,var(--panel-line))] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]'
          : 'border-[var(--panel-line)] bg-[var(--panel-surface)]',
      ].join(' ')}
    >
      <span className="text-sm font-semibold text-[var(--panel-ink)]">{label}</span>
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
