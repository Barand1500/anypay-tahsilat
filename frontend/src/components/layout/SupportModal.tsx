import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/TextArea';
import { TextInput } from '../ui/TextInput';
import { api } from '../../lib/api';

type Channel = 'email' | 'sms' | 'whatsapp';

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

type Props = {
  onClose: () => void;
};

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
 * Destek talebi — Esc / X; overlay tıklanınca kapanmaz.
 * Entegrasyon açıksa API, değilse mailto / wa.me / sms:.
 */
export function SupportModal({ onClose }: Props) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [channels, setChannels] = useState<ChannelsApi | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token || busy || done) return;
    const sub = subject.trim();
    const desc = body.trim();
    if (!sub) {
      setError('Konu gerekli');
      return;
    }
    if (!desc) {
      setError('Açıklama gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<TicketResult>(
        '/api/support/ticket',
        { channel, subject: sub, body: desc },
        token,
      );
      if (data.method === 'client' && data.clientUrl) {
        window.open(data.clientUrl, '_blank', 'noopener,noreferrer');
      }
      setDone(true);
      window.setTimeout(() => onClose(), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10070] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="support-modal-title"
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="relative shrink-0 border-b border-[var(--panel-line)] bg-gradient-to-br from-rose-500/12 via-transparent to-transparent px-5 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            <CloseIcon />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
              <BugIcon />
            </span>
            <div>
              <h2
                id="support-modal-title"
                className="text-lg font-bold tracking-tight text-[var(--panel-ink)]"
              >
                Destek talebi
              </h2>
              <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
                Konu ve açıklamanızı yazın; hangi kanaldan göndereceğinizi seçin.
              </p>
            </div>
          </div>
        </header>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckIcon />
            </span>
            <p className="text-base font-bold text-[var(--panel-ink)]">
              Destek talebiniz alınmıştır
            </p>
            <p className="text-sm text-[var(--panel-muted)]">En kısa sürede dönüş yapılacaktır.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => void submit(e)}
            className="flex flex-col gap-4 px-5 py-5 sm:px-6 [--input-notch:var(--panel-elevated)]"
          >
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

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Gönderim kanalı
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CHANNELS.map((c) => {
                  const apiOn = channels?.[c.id]?.api;
                  const selected = channel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-km-jump
                      onClick={() => setChannel(c.id)}
                      className={[
                        'flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition',
                        selected
                          ? 'border-rose-400/60 bg-rose-500/10 shadow-sm'
                          : 'border-[var(--panel-line)] bg-[var(--panel-bg)] hover:border-rose-300/40',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-[var(--panel-ink)]">
                        <ChannelIcon name={c.icon} />
                        {c.label}
                      </span>
                      <span className="text-[11px] text-[var(--panel-muted)]">{c.hint}</span>
                      <span
                        className={[
                          'mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                          apiOn
                            ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                            : 'bg-[var(--panel-line)]/60 text-[var(--panel-muted)]',
                        ].join(' ')}
                      >
                        {apiOn ? 'Entegrasyon' : c.id === 'email' ? 'mailto' : c.id === 'whatsapp' ? 'wa.me' : 'sms:'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-km-jump
                onClick={onClose}
                className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
              >
                Vazgeç
              </button>
              <div className="min-w-[9rem]">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Gönderiliyor…' : 'Gönder'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function BugIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 9.5V8a4 4 0 0 1 8 0v1.5M6 13h12M9 16.5h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7 9.5h10v6.2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.5 7 10M19.5 8.5 17 10M4.5 16 7 14.5M19.5 16 17 14.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'sms') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.15 6.29 2.15 11.57c0 1.94.58 3.74 1.58 5.25L2 22l5.4-1.71a10.1 10.1 0 0 0 4.64 1.13c5.46 0 9.89-4.29 9.89-9.57S17.5 2 12.04 2Zm5.5 13.6c-.23.65-1.33 1.2-1.84 1.27-.47.07-1.07.1-1.73-.11-.4-.12-.91-.29-1.57-.57-2.76-1.19-4.56-3.97-4.7-4.15-.14-.19-1.15-1.53-1.15-2.92 0-1.39.73-2.07 1-2.35.26-.28.57-.35.76-.35.19 0 .38 0 .54.01.17.01.41-.07.64.49.23.57.79 1.97.86 2.11.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.16-.3.37-.42.49-.14.14-.29.29-.12.56.16.28.73 1.2 1.56 1.95 1.07.96 1.97 1.26 2.25 1.4.28.14.44.12.61-.07.16-.19.7-.81.89-1.09.19-.28.38-.23.64-.14.26.1 1.66.78 1.95.92.28.14.47.21.54.33.07.12.07.68-.16 1.33Z" />
    </svg>
  );
}
