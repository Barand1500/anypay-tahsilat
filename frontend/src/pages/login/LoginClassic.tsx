import { useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { LoginMascot, type MascotFocus } from './LoginMascot';
import { LoginSky } from './LoginSky';
import { LoginModeActions, useLoginModeFlow } from './useLoginModeFlow';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Klasik maskotlu giriş ekranı */
export function LoginClassic() {
  const { login, requestOtp, loginWithOtp } = useAuth();
  const { logoUrl, systemName } = useBrand();
  const cardRef = useRef<HTMLElement | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<MascotFocus>('none');
  const [outcome, setOutcome] = useState<'idle' | 'success' | 'fail'>('idle');

  const flow = useLoginModeFlow({
    onPasswordLogin: async (email, password) => {
      setOutcome('idle');
      await sleep(2000);
      try {
        await login(email, password);
        setOutcome('success');
      } catch (err) {
        setOutcome('fail');
        throw err;
      }
    },
    onRequestOtp: async (email) => {
      await requestOtp(email);
    },
    onOtpLogin: async (email, code) => {
      setOutcome('idle');
      await sleep(2000);
      try {
        await loginWithOtp(email, code);
        setOutcome('success');
      } catch (err) {
        setOutcome('fail');
        throw err;
      }
    },
  });

  const busy = flow.loading || flow.transitioning;

  const subtitle =
    flow.mode === 'forgot'
      ? 'E-postanıza gelen şifreyi doğrulayıp yeni şifrenizi belirleyin.'
      : flow.mode === 'otp'
        ? 'Geçici kodu girerek giriş yapın.'
        : flow.mode === 'password'
          ? 'Hesabınıza giriş yapmak için e-posta ve şifrenizi giriniz.'
          : 'Önce e-postanızı girin, ardından hızlı giriş veya şifre ile devam edin.';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <LoginSky />

      <article
        ref={cardRef}
        className="relative z-10 grid w-full max-w-[1100px] overflow-hidden rounded-[32px] bg-[#eef2f7] shadow-[0_24px_70px_rgba(20,50,80,0.28)] ring-1 ring-white/40 lg:min-h-[640px] lg:grid-cols-2"
      >
        <aside className="relative bg-[#8ec0f0] lg:min-h-[640px]">
          <LoginMascot
            focus={focus}
            passwordVisible={showPassword || flow.showNewPassword}
            outcome={outcome}
            trackRef={cardRef}
          />
        </aside>

        <div className="flex items-center justify-center bg-[#eef2f7] px-8 py-12 sm:px-12 sm:py-14 [--input-notch:#eef2f7]">
          <div className="w-full max-w-[420px]">
            <div className="mb-9 flex flex-col items-center text-center">
              <img
                src={logoUrl || '/brand/logo.png'}
                alt={systemName}
                className="mb-6 h-[4.5rem] w-auto max-w-[280px] object-contain sm:h-20 sm:max-w-[320px]"
              />
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.85rem]">
                {flow.mode === 'forgot' ? 'Şifre Yenile' : 'Hoş geldin!'}
              </h1>
              <p className="mt-2 max-w-[340px] text-sm leading-relaxed text-muted">{subtitle}</p>
            </div>

            <form onSubmit={flow.submit} className="flex flex-col gap-5 overflow-visible">
              {flow.mode === 'forgot' ? (
                <div ref={flow.forgotStageRef} className="flex flex-col gap-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => flow.leaveForgot('password')}
                    className="self-start text-xs font-medium text-muted transition hover:text-ink disabled:opacity-50"
                  >
                    ← Geri
                  </button>

                  <TextInput label="E-Posta" name="email-ro" type="email" value={flow.email} disabled />

                  <TextInput
                    label="E-postanıza gönderdiğimiz şifreyi giriniz"
                    name="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={flow.resetCode}
                    onChange={(e) => flow.setResetCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    disabled={busy || flow.codeVerified}
                  />

                  <button
                    type="button"
                    disabled={busy || flow.codeVerified}
                    onClick={flow.verifyResetCode}
                    className="w-full rounded-xl border border-[var(--panel-line)] bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[var(--panel-surface)] disabled:opacity-50"
                  >
                    {flow.codeVerified ? 'Doğrulandı' : 'Doğrula'}
                  </button>

                  <TextInput
                    label="Yeni şifre"
                    name="new-password"
                    type={flow.showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={flow.newPassword}
                    onChange={(e) => flow.setNewPassword(e.target.value)}
                    disabled={busy || !flow.codeVerified}
                    endAdornment={
                      <button
                        type="button"
                        disabled={!flow.codeVerified}
                        aria-label={flow.showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => flow.setShowNewPassword((v) => !v)}
                        className="rounded-lg p-1.5 text-muted hover:bg-[var(--panel-surface)] hover:text-ink disabled:opacity-30"
                      >
                        {flow.showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    }
                  />

                  {flow.error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                    >
                      {flow.error}
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    disabled={busy || !flow.codeVerified}
                    loading={flow.loading}
                    loadingLabel="Kaydediliyor…"
                    onClick={flow.saveNewPassword}
                  >
                    Kaydet
                  </Button>
                </div>
              ) : (
                <div ref={flow.loginStageRef} className="flex flex-col gap-5">
                  <TextInput
                    label="E-Posta"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={flow.email}
                    onChange={(e) => flow.setEmail(e.target.value)}
                    onFocus={() => setFocus('email')}
                    onBlur={() => setFocus((f) => (f === 'email' ? 'none' : f))}
                  />

                  {flow.mode === 'otp' ? (
                    <div ref={flow.otpPanelRef}>
                      <TextInput
                        label="Geçici kodu giriniz"
                        name="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={flow.otp}
                        onChange={(e) => flow.setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        onFocus={() => setFocus('email')}
                        onBlur={() => setFocus((f) => (f === 'email' ? 'none' : f))}
                      />
                    </div>
                  ) : null}

                  {flow.mode === 'password' ? (
                    <div ref={flow.passwordPanelRef} className="flex flex-col gap-1.5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={flow.goForgot}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        >
                          Şifremi unuttum?
                        </button>
                      </div>
                      <TextInput
                        label="Şifre"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={flow.password}
                        onChange={(e) => flow.setPassword(e.target.value)}
                        onFocus={() => setFocus('password')}
                        onBlur={() => setFocus((f) => (f === 'password' ? 'none' : f))}
                        endAdornment={
                          <button
                            type="button"
                            aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFocus('password');
                              setShowPassword((v) => !v);
                            }}
                            className="rounded-lg p-1.5 text-muted hover:bg-[var(--panel-surface)] hover:text-ink"
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        }
                      />
                    </div>
                  ) : null}

                  {flow.error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                    >
                      {flow.error}
                    </div>
                  ) : null}

                  <LoginModeActions
                    mode={flow.mode}
                    loading={busy}
                    onQuick={flow.goQuick}
                    onPassword={flow.goPassword}
                    onBack={flow.goBack}
                    variant="classic"
                  />

                  {flow.mode !== 'choose' ? (
                    <Button
                      type="submit"
                      loading={flow.loading}
                      loadingLabel="Giriş yapılıyor…"
                      className="mt-1"
                    >
                      Giriş Yap
                    </Button>
                  ) : null}
                </div>
              )}
            </form>

            <p className="mt-10 text-center text-xs text-muted">
              Powered By <span className="font-semibold text-ink">GÜZEL Teknoloji®</span>
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 10.6A3 3 0 0 0 13.4 13.5M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-4.2 4.8M6.1 6.2A18 18 0 0 0 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
