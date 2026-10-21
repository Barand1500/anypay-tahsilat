import gsap from 'gsap';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { vaultFetch, useVault } from './VaultContext';

/** Şifre gir / unuttum / şifre belirle */
export function VaultAuthLayer() {
  const { token } = useAuth();
  const {
    open,
    hasPassword,
    unlocked,
    unlockToken,
    mustChangePassword,
    setUnlocked,
    refreshStatus,
  } = useVault();

  const needUnlock = open && hasPassword && !unlocked;
  const needSetAfterForgot = open && unlocked && mustChangePassword;

  if (!token) return null;
  if (needUnlock) {
    return (
      <PasswordModal
        mode="unlock"
        token={token}
        onUnlocked={(t, mustChange) => setUnlocked(t, mustChange)}
      />
    );
  }
  if (needSetAfterForgot) {
    return (
      <PasswordModal
        mode="change"
        token={token}
        unlockToken={unlockToken}
        onUnlocked={async (t) => {
          setUnlocked(t, false);
          await refreshStatus();
        }}
      />
    );
  }
  return null;
}

function PasswordModal({
  mode,
  token,
  unlockToken,
  onUnlocked,
  onCancel,
}: {
  mode: 'unlock' | 'change' | 'set';
  token: string;
  unlockToken?: string | null;
  onUnlocked: (t: string, mustChange?: boolean) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { closeVault } = useVault();
  const cancel = onCancel || closeVault;
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 14, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' },
    );
    window.setTimeout(() => inputRef.current?.focus(), 180);
  }, [forgot, otpSent]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [cancel]);

  async function submitUnlock(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError('Şifre girin');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await vaultFetch<{ unlockToken: string }>(
        'POST',
        '/api/vault/unlock',
        token,
        null,
        { password },
      );
      await onUnlocked(data.unlockToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Açılamadı');
    } finally {
      setBusy(false);
    }
  }

  async function submitSet(e: FormEvent) {
    e.preventDefault();
    if (password.trim().length < 4) {
      setError('En az 4 karakter');
      return;
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await vaultFetch<{ unlockToken: string }>(
        'POST',
        '/api/vault/password',
        token,
        unlockToken || null,
        { password, unlockToken: unlockToken || undefined },
      );
      await onUnlocked(data.unlockToken, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function startForgot() {
    setBusy(true);
    setError('');
    try {
      await vaultFetch('POST', '/api/vault/forgot/request', token, null, {});
      setOtpSent(true);
      setSecondsLeft(120);
      setForgot(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Kod girin');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await vaultFetch<{ unlockToken: string; mustChangePassword: boolean }>(
        'POST',
        '/api/vault/forgot/verify',
        token,
        null,
        { code: otp.trim() },
      );
      await onUnlocked(data.unlockToken, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod hatalı');
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'change'
      ? 'Yeni kasa şifresi'
      : forgot && otpSent
        ? 'E-posta kodu'
        : 'Kasa kilidi';

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <LockIcon />
            </span>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={cancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            ✕
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          {mode === 'unlock' && !(forgot && otpSent) ? (
            <form onSubmit={(e) => void submitUnlock(e)} className="space-y-3">
              <p className="text-sm text-[var(--panel-muted)]">Kasayı açmak için şifrenizi girin.</p>
              <input
                ref={inputRef}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Kasa şifresi"
                className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Açılıyor…' : 'Aç'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startForgot()}
                className="w-full text-center text-xs font-semibold text-[var(--panel-muted)] underline-offset-2 hover:text-[var(--color-brand-600)] hover:underline"
              >
                Şifremi unuttum
              </button>
            </form>
          ) : null}

          {mode === 'unlock' && forgot && otpSent ? (
            <form onSubmit={(e) => void submitOtp(e)} className="space-y-3">
              <p className="text-sm text-[var(--panel-muted)]">
                E-postanıza gönderilen kodu girin.
                {secondsLeft > 0 ? (
                  <span className="ml-1 font-semibold tabular-nums text-[var(--panel-ink)]">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </span>
                ) : (
                  <span className="ml-1 text-rose-500">Süre doldu — tekrar isteyin</span>
                )}
              </p>
              <input
                ref={inputRef}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                inputMode="numeric"
                placeholder="6 haneli kod"
                className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5 text-center text-lg font-bold tracking-[0.35em] outline-none focus:border-[var(--color-brand-500)]"
              />
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              <button
                type="submit"
                disabled={busy || secondsLeft <= 0}
                className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Doğrulanıyor…' : 'Doğrula'}
              </button>
              {secondsLeft <= 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startForgot()}
                  className="w-full text-center text-xs font-semibold text-[var(--color-brand-600)]"
                >
                  Kodu yeniden gönder
                </button>
              ) : null}
            </form>
          ) : null}

          {(mode === 'change' || mode === 'set') && (
            <form onSubmit={(e) => void submitSet(e)} className="space-y-3">
              <p className="text-sm text-[var(--panel-muted)]">
                {mode === 'change'
                  ? 'Güvenlik için yeni bir kasa şifresi belirleyin.'
                  : 'Kasayı kilitlemek için bir şifre belirleyin.'}
              </p>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Yeni şifre"
                className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              <input
                type="password"
                value={password2}
                onChange={(e) => {
                  setPassword2(e.target.value);
                  setError('');
                }}
                placeholder="Şifre tekrar"
                className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-500)]"
              />
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Ayarlar — şifre koy / değiştir / kaldır */
export function VaultSetPasswordModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const { unlockToken, setUnlocked, refreshStatus, hasPassword } = useVault();
  const [step, setStep] = useState<'menu' | 'set' | 'change'>('menu');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
    );
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (step !== 'menu') setStep('menu');
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, step]);

  if (!token) return null;

  if (step === 'set' || step === 'change') {
    return (
      <PasswordModal
        mode={step === 'change' ? 'change' : 'set'}
        token={token}
        unlockToken={unlockToken}
        onCancel={() => setStep('menu')}
        onUnlocked={async (t) => {
          setUnlocked(t, false);
          await refreshStatus();
          onClose();
        }}
      />
    );
  }

  async function clearPassword() {
    if (!token) return;
    setBusy(true);
    setErr('');
    try {
      await vaultFetch('DELETE', '/api/vault/password', token, unlockToken);
      await refreshStatus();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Kaldırılamadı');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <h2 className="text-base font-bold text-[var(--panel-ink)]">Kasa ayarları</h2>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            ✕
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[var(--panel-muted)]">
            {hasPassword
              ? 'Kasa şu an şifreli. Değiştirebilir veya kaldırabilirsiniz.'
              : 'İsterseniz kasaya şifre koyun; kapattıktan sonra açmak için istenir.'}
          </p>
          {err ? <p className="text-sm text-rose-500">{err}</p> : null}
          {hasPassword ? (
            <>
              <button
                type="button"
                onClick={() => setStep('change')}
                className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Şifreyi değiştir
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void clearPassword()}
                className="w-full rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-50"
              >
                {busy ? '…' : 'Şifreyi kaldır'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStep('set')}
              className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Şifre koy
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
