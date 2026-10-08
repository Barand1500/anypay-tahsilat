import gsap from 'gsap';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { TextInput } from '../ui/TextInput';
import { api } from '../../lib/api';

type Channel = 'email' | 'sms' | 'whatsapp';
type Step = 'details' | 'channel' | 'confirm' | 'done';

type ChannelsApi = {
  email: { api: boolean; to: string };
  sms: { api: boolean; to: string };
  whatsapp: { api: boolean; to: string };
};

type TicketResult = {
  method: 'api' | 'client';
  channel: Channel;
  sent: boolean;
  to: string;
  clientUrl?: string;
  error?: string;
};

type Props = { onClose: () => void };

const CHANNELS: {
  id: Channel;
  label: string;
  hint: string;
  icon: 'mail' | 'sms' | 'wp';
}[] = [
  { id: 'email', label: 'E-posta', hint: 'guzelteknoloji50@gmail.com', icon: 'mail' },
  { id: 'whatsapp', label: 'WhatsApp', hint: '0540 885 12 60', icon: 'wp' },
  { id: 'sms', label: 'SMS', hint: '0540 885 12 60', icon: 'sms' },
];

/**
 * Destek talebi sihirbazı — Esc / X; overlay tıklanınca kapanmaz.
 */
export function SupportModal({ onClose }: Props) {
  const { token, user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('details');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [channels, setChannels] = useState<ChannelsApi | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void api
      .get<ChannelsApi>('/api/support/channels', token)
      .then(setChannels)
      .catch(() => setChannels(null));
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
    const bodyEl = panelRef.current?.querySelector('[data-step-body]');
    if (!bodyEl) return;
    gsap.fromTo(
      bodyEl,
      { autoAlpha: 0, x: 10 },
      { autoAlpha: 1, x: 0, duration: 0.28, ease: 'power2.out' },
    );
  }, [step]);

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

  function goChannel() {
    if (!subject.trim()) {
      setError('Konu gerekli');
      return;
    }
    if (!body.trim()) {
      setError('Açıklama gerekli');
      return;
    }
    setError(null);
    setStep('channel');
  }

  function goConfirm() {
    setError(null);
    setStep('confirm');
  }

  async function send() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<TicketResult>(
        '/api/support/ticket',
        { channel, subject: subject.trim(), body: body.trim() },
        token,
      );
      if (data.method === 'client' && data.clientUrl) {
        window.open(data.clientUrl, '_blank', 'noopener,noreferrer');
      }
      setStep('done');
      window.setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  const channelMeta = CHANNELS.find((c) => c.id === channel)!;
  const apiOn = channels?.[channel]?.api;

  const subtitle =
    step === 'details'
      ? '1 · Talebinizi yazın'
      : step === 'channel'
        ? '2 · Kanal seçin'
        : step === 'confirm'
          ? '3 · Kontrol edip gönderin'
          : 'Talebiniz alındı';

  return createPortal(
    <div className="fixed inset-0 z-[10070] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="support-modal-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-rose-500/14 via-rose-500/5 to-transparent px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <CloseIcon />
            <span>ESC</span>
          </button>
          <div className="flex items-start gap-3 pr-16">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-rose-300/35 bg-rose-500/10 p-1.5">
              <img
                src="/brand/support-headset.jpg"
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
            </span>
            <div>
              <h2
                id="support-modal-title"
                className="text-lg font-bold tracking-tight text-[var(--panel-ink)]"
              >
                Destek talebi
              </h2>
              <p className="mt-0.5 text-sm text-[var(--panel-muted)]">{subtitle}</p>
            </div>
          </div>

          {step !== 'done' ? (
            <ol className="mt-4 flex flex-wrap gap-2">
              <Phase
                n={1}
                label="Talep"
                done={step === 'channel' || step === 'confirm'}
                active={step === 'details'}
              />
              <Phase
                n={2}
                label="Kanal"
                done={step === 'confirm'}
                active={step === 'channel'}
              />
              <Phase n={3} label="Gönder" done={false} active={step === 'confirm'} />
            </ol>
          ) : null}
        </header>

        <div data-step-body className="flex min-h-0 flex-1 flex-col">
          {step === 'details' ? (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6 [--input-notch:var(--panel-elevated)]">
                <StepBlock n={1} title="Konu ve açıklama">
                  <p className="mb-3">
                    Sorununuzu kısaca yazın. İsterseniz adım adım ne olduğunu da ekleyin.
                    {user?.adsoyad || user?.email
                      ? ` Talep ${user.adsoyad || user.email} adına iletilir.`
                      : null}
                  </p>
                </StepBlock>
                <TextInput
                  data-km-jump
                  label="Konu"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setError(null);
                  }}
                  maxLength={200}
                  autoFocus
                />
                <TextArea
                  data-km-jump
                  label="Açıklama"
                  rows={5}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setError(null);
                  }}
                  maxLength={5000}
                />
                {error ? <ErrorBox>{error}</ErrorBox> : null}
              </div>
              <FooterBar>
                <button type="button" data-km-jump onClick={onClose} className={ghostBtn}>
                  Vazgeç
                </button>
                <div className="min-w-[9rem]">
                  <Button type="button" onClick={goChannel}>
                    Devam
                  </Button>
                </div>
              </FooterBar>
            </>
          ) : null}

          {step === 'channel' ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
                <StepBlock n={2} title="Nasıl ulaşmak istersiniz?">
                  <p>
                    Entegrasyon açıksa mesaj panelden gider. Kapalıysa e-posta / WhatsApp / SMS
                    uygulamanız açılır.
                  </p>
                </StepBlock>
                <div className="grid gap-2">
                  {CHANNELS.map((c) => {
                    const on = channels?.[c.id]?.api;
                    const selected = channel === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-km-jump
                        onClick={() => setChannel(c.id)}
                        className={[
                          'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition',
                          selected
                            ? 'border-rose-400/55 bg-rose-500/10 shadow-sm'
                            : 'border-[var(--panel-line)] bg-[var(--panel-surface)] hover:border-rose-300/40',
                        ].join(' ')}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-elevated)] text-[var(--panel-ink)]">
                          <ChannelIcon name={c.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[var(--panel-ink)]">
                            {c.label}
                          </span>
                          <span className="block text-xs text-[var(--panel-muted)]">{c.hint}</span>
                        </span>
                        <span
                          className={[
                            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                            on
                              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                              : 'bg-[var(--panel-line)]/70 text-[var(--panel-muted)]',
                          ].join(' ')}
                        >
                          {on ? 'Entegrasyon' : c.id === 'email' ? 'mailto' : c.id === 'whatsapp' ? 'wa.me' : 'sms:'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <FooterBar>
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setStep('details')}
                  className={ghostBtn}
                >
                  Geri
                </button>
                <div className="min-w-[9rem]">
                  <Button type="button" onClick={goConfirm}>
                    Devam
                  </Button>
                </div>
              </FooterBar>
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
                <StepBlock n={3} title="Özet">
                  <p>Göndermeden önce kontrol edin. Yanlış kanal seçtiyseniz geri dönebilirsiniz.</p>
                </StepBlock>
                <div className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-3.5">
                  <Row label="Kanal">
                    {channelMeta.label}
                    <span className="ml-2 text-[11px] text-[var(--panel-muted)]">
                      ({apiOn ? 'entegrasyon' : 'istemci'}) → {channelMeta.hint}
                    </span>
                  </Row>
                  <Row label="Konu">{subject.trim()}</Row>
                  <div className="mt-3 border-t border-[var(--panel-line)] pt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                      Açıklama
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--panel-ink)]">
                      {body.trim()}
                    </p>
                  </div>
                </div>
                {error ? <ErrorBox>{error}</ErrorBox> : null}
              </div>
              <FooterBar>
                <button
                  type="button"
                  data-km-jump
                  onClick={() => setStep('channel')}
                  className={ghostBtn}
                  disabled={busy}
                >
                  Geri
                </button>
                <div className="min-w-[9rem]">
                  <Button type="button" disabled={busy} onClick={() => void send()}>
                    {busy ? 'Gönderiliyor…' : 'Gönder'}
                  </Button>
                </div>
              </FooterBar>
            </>
          ) : null}

          {step === 'done' ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckIcon />
              </span>
              <p className="text-base font-bold text-[var(--panel-ink)]">
                Destek talebiniz alınmıştır
              </p>
              <p className="max-w-xs text-sm text-[var(--panel-muted)]">
                En kısa sürede dönüş yapılacaktır.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ghostBtn =
  'h-11 rounded-xl px-4 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-50';

function FooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-4">
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
      {children}
    </div>
  );
}

function Phase({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        active
          ? 'bg-rose-500 text-white'
          : done
            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            : 'bg-[var(--panel-surface)] text-[var(--panel-muted)]',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-4 w-4 items-center justify-center rounded-full text-[9px]',
          active ? 'bg-white/25' : done ? 'bg-rose-500 text-white' : 'bg-[var(--panel-line)]',
        ].join(' ')}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </li>
  );
}

function StepBlock({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
          {n}
        </span>
        <h3 className="text-sm font-bold text-[var(--panel-ink)]">{title}</h3>
      </div>
      <div className="pl-9 text-sm leading-relaxed text-[var(--panel-muted)]">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
        {label}
      </span>
      <span className="min-w-0 text-sm font-semibold text-[var(--panel-ink)]">{children}</span>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChannelIcon({ name }: { name: 'mail' | 'sms' | 'wp' }) {
  if (name === 'mail') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'sms') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.29 2.15 11.57c0 1.94.58 3.74 1.58 5.25L2 22l5.4-1.71a10.1 10.1 0 0 0 4.64 1.13c5.46 0 9.89-4.29 9.89-9.57S17.5 2 12.04 2Zm5.5 13.6c-.23.65-1.33 1.2-1.84 1.27-.47.07-1.07.1-1.73-.11-.4-.12-.91-.29-1.57-.57-2.76-1.19-4.56-3.97-4.7-4.15-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07 1-2.35.26-.28.57-.35.76-.35.19 0 .38 0 .54.01.17.01.41-.07.64.49.23.57.79 1.97.86 2.11.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.16-.3.37-.42.49-.14.14-.29.29-.12.56.16.28.73 1.2 1.56 1.95 1.07.96 1.97 1.26 2.25 1.4.28.14.44.12.61-.07.16-.19.7-.81.89-1.09.19-.28.38-.23.64-.14.26.1 1.66.78 1.95.92.28.14.47.21.54.33.07.12.07.68-.16 1.33Z" />
    </svg>
  );
}
