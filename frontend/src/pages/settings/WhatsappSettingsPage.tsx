import { CanRemove } from '../../permissions/CanRemove';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { EMPTY_WHATSAPP, type WhatsappSettings, type WhatsappSettingsApi } from './whatsappTypes';

gsap.registerPlugin(useGSAP);

/**
 * Ayarlar › WhatsApp — Meta Cloud API kimlik bilgileri.
 */
export default function WhatsappSettingsPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<WhatsappSettings>({ ...EMPTY_WHATSAPP });
  const [baseline, setBaseline] = useState<WhatsappSettings>({ ...EMPTY_WHATSAPP });
  const [callbackUrl, setCallbackUrl] = useState('');
  const [appSecretSet, setAppSecretSet] = useState(false);
  const [accessTokenSet, setAccessTokenSet] = useState(false);
  const [verifyTokenSet, setVerifyTokenSet] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<WhatsappSettingsApi>('/api/settings/whatsapp', token);
      const next: WhatsappSettings = {
        active: Boolean(data.active),
        appId: data.appId || '',
        appSecret: '',
        phoneNumberId: data.phoneNumberId || '',
        accessToken: '',
        verifyToken: '',
      };
      setDraft(next);
      setBaseline({ ...next });
      setCallbackUrl(data.callbackUrl || '');
      setAppSecretSet(Boolean(data.appSecretSet));
      setAccessTokenSet(Boolean(data.accessTokenSet));
      setVerifyTokenSet(Boolean(data.verifyTokenSet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WhatsApp ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    draft.active !== baseline.active ||
    draft.appId !== baseline.appId ||
    draft.appSecret !== '' ||
    draft.phoneNumberId !== baseline.phoneNumberId ||
    draft.accessToken !== '' ||
    draft.verifyToken !== '';

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: rootRef },
  );

  function patch<K extends keyof WhatsappSettings>(key: K, value: WhatsappSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<WhatsappSettingsApi>(
        '/api/settings/whatsapp',
        {
          active: draft.active,
          appId: draft.appId,
          appSecret: draft.appSecret,
          phoneNumberId: draft.phoneNumberId,
          accessToken: draft.accessToken,
          verifyToken: draft.verifyToken,
        },
        token,
      );
      const next: WhatsappSettings = {
        active: data.active,
        appId: data.appId || '',
        appSecret: '',
        phoneNumberId: data.phoneNumberId || '',
        accessToken: '',
        verifyToken: '',
      };
      setDraft(next);
      setBaseline({ ...next });
      setCallbackUrl(data.callbackUrl || '');
      setAppSecretSet(Boolean(data.appSecretSet));
      setAccessTokenSet(Boolean(data.accessTokenSet));
      setVerifyTokenSet(Boolean(data.verifyTokenSet));
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.delete<WhatsappSettingsApi>('/api/settings/whatsapp', token);
      const next: WhatsappSettings = {
        active: Boolean(data.active),
        appId: data.appId || '',
        appSecret: '',
        phoneNumberId: data.phoneNumberId || '',
        accessToken: '',
        verifyToken: '',
      };
      setDraft(next);
      setBaseline({ ...next });
      setCallbackUrl(data.callbackUrl || '');
      setAppSecretSet(Boolean(data.appSecretSet));
      setAccessTokenSet(Boolean(data.accessTokenSet));
      setVerifyTokenSet(Boolean(data.verifyTokenSet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sıfırlanamadı');
    } finally {
      setSaving(false);
    }
  }

  async function copyCallback() {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Adres kopyalanamadı');
    }
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    if (!token || testBusy) return;
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setTestMsg('Geçerli bir telefon numarası girin');
      setTestOk(false);
      return;
    }
    setTestBusy(true);
    setTestMsg(null);
    setTestOk(false);
    try {
      const data = await api.post<{ sent: true; to: string }>(
        '/api/settings/whatsapp/test',
        { phone: testPhone },
        token,
      );
      setTestMsg(`Sınama WhatsApp gönderildi → ${data.to}`);
      setTestOk(true);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : 'Sınama gönderilemedi');
      setTestOk(false);
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          WhatsApp Ayarları
        </h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Meta WhatsApp Cloud API ile ödeme linklerini sunucu üzerinden gönderin. Kapalıysa mevcut
          wa.me yöntemi kullanılır.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
      <form
        data-anim
        onSubmit={(e) => void save(e)}
        className="space-y-5 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Meta WhatsApp Cloud API</h2>
            {loading ? (
              <p className="mt-0.5 text-xs text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[var(--panel-muted)]">
              WhatsApp entegrasyonunu etkinleştir
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.active}
              data-km-jump
              title={draft.active ? 'Aktif' : 'Pasif'}
              onClick={() => patch('active', !draft.active)}
              className={[
                'relative h-7 w-12 shrink-0 rounded-full transition',
                draft.active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold shadow transition',
                  draft.active
                    ? 'translate-x-5 text-[var(--color-brand-600)]'
                    : 'text-[var(--panel-muted)]',
                ].join(' ')}
              >
                {draft.active ? '✓' : '✕'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput
            data-km-jump
            label="Meta uygulama kimliği"
            value={draft.appId}
            onChange={(e) => patch('appId', e.target.value)}
            autoComplete="off"
          />
          <TextInput
            data-km-jump
            label={appSecretSet ? 'Uygulama gizli anahtarı (değiştirmek için yazın)' : 'Uygulama gizli anahtarı'}
            type={showSecret ? 'text' : 'password'}
            value={draft.appSecret}
            placeholder={appSecretSet ? '••••••••••' : ''}
            onChange={(e) => patch('appSecret', e.target.value)}
            autoComplete="off"
            endAdornment={
              <button
                type="button"
                className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? 'Gizle' : 'Göster'}
              </button>
            }
          />
          <TextInput
            data-km-jump
            label="Telefon numarası kimliği"
            value={draft.phoneNumberId}
            onChange={(e) => patch('phoneNumberId', e.target.value)}
            autoComplete="off"
          />
          <div className="sm:col-span-2 lg:col-span-2">
            <TextInput
              data-km-jump
              label={accessTokenSet ? 'Erişim belirteci (değiştirmek için yazın)' : 'Erişim belirteci'}
              type={showAccess ? 'text' : 'password'}
              value={draft.accessToken}
              placeholder={accessTokenSet ? '••••••••••' : ''}
              onChange={(e) => patch('accessToken', e.target.value)}
              autoComplete="off"
              endAdornment={
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                  onClick={() => setShowAccess((v) => !v)}
                >
                  {showAccess ? 'Gizle' : 'Göster'}
                </button>
              }
            />
          </div>
          <TextInput
            data-km-jump
            label={
              verifyTokenSet
                ? 'Webhook doğrulama belirteci (değiştirmek için yazın)'
                : 'Webhook doğrulama belirteci'
            }
            type={showVerify ? 'text' : 'password'}
            value={draft.verifyToken}
            placeholder={verifyTokenSet ? '••••••••••' : ''}
            onChange={(e) => patch('verifyToken', e.target.value)}
            autoComplete="off"
            endAdornment={
              <button
                type="button"
                className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                onClick={() => setShowVerify((v) => !v)}
              >
                {showVerify ? 'Gizle' : 'Göster'}
              </button>
            }
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)]">
          <button
            type="button"
            data-km-jump
            onClick={() => setSetupOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-[var(--panel-ink)] transition hover:bg-[color-mix(in_srgb,var(--panel-ink)_4%,transparent)]"
          >
            <span
              className={[
                'inline-block text-[var(--panel-muted)] transition',
                setupOpen ? 'rotate-90' : '',
              ].join(' ')}
            >
              ›
            </span>
            Gelen WhatsApp kurulumu
          </button>
          {setupOpen ? (
            <div className="space-y-3 border-t border-[var(--panel-line)] px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <TextInput
                    data-km-jump
                    label="Meta callback adresi"
                    value={callbackUrl}
                    readOnly
                    onChange={() => undefined}
                  />
                </div>
                <button
                  type="button"
                  data-km-jump
                  onClick={() => void copyCallback()}
                  className={[
                    'h-[3.25rem] shrink-0 rounded-xl border px-4 text-sm font-semibold transition',
                    copied
                      ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-elevated))] text-[var(--color-brand-700)]'
                      : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]',
                  ].join(' ')}
                >
                  {copied ? 'Kopyalandı' : 'Adresi kopyala'}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-[var(--panel-muted)]">
                Bu adres Meta Developer panelinde Callback URL olarak kullanılır. Doğrulama için
                yukarıdaki webhook belirtecini girin ve <code className="font-mono">messages</code>{' '}
                alanına abone olun. Canlı adres HTTPS olmalıdır. Gelen mesajların panoda listelenmesi
                sonraki aşamada eklenecek; şimdilik yalnızca gönderim için kullanılır.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]">
            <Button
              type="submit"
              disabled={(!dirty && !saveOk) || saving || loading}
              success={saveOk}
            >
              <span className="inline-flex items-center gap-2">
                <SaveIcon />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </span>
            </Button>
          </div>
          <CanRemove>
            <button
              type="button"
              data-km-jump
              title="Sıfırla"
              aria-label="Sıfırla"
              disabled={saving}
              onClick={() => void reset()}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/8 text-rose-500 transition hover:bg-rose-500/15 disabled:opacity-50"
            >
              <TrashIcon />
            </button>
          </CanRemove>
        </div>
      </form>

      <form
        data-anim
        onSubmit={(e) => void sendTest(e)}
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
      >
        <div className="mb-4">
          <h2 className="text-base font-bold text-[var(--panel-ink)]">WhatsApp Gönderim Sınama</h2>
          <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
            Kayıtlı Meta ayarlarıyla gerçek sınama mesajı gönderir. Entegrasyonun açık olması gerekir.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <TextInput
              data-km-jump
              label="Telefon Numarası"
              inputMode="tel"
              value={testPhone}
              onChange={(e) => {
                setTestPhone(formatPhone(e.target.value));
                setTestMsg(null);
              }}
              autoComplete="tel"
            />
          </div>
          <button
            type="submit"
            data-km-jump
            disabled={testBusy || loading}
            className="inline-flex h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          >
            <SendIcon />
            {testBusy ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
        {testMsg ? (
          <p
            className={[
              'mt-2 text-xs font-medium',
              testOk ? 'text-emerald-600' : 'text-rose-600',
            ].join(' ')}
          >
            {testMsg}
          </p>
        ) : null}
      </form>
      </div>
    </div>
  );
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12 20 4l-7 16-2-7-7-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5a2 2 0 0 1 2-2h9l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 4.5v5h7v-5M8 19v-5h8v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
