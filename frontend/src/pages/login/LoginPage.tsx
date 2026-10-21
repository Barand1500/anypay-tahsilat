import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { LoginModeActions, useLoginModeFlow } from './useLoginModeFlow';
import { TwoFactorStep } from './TwoFactorStep';

/** Tek giriş ekranı — sol 3 birim marka, sağ 1 birim form + hızlı giriş */
export default function LoginPage() {
  const { login, verifyTwoFactor, requestOtp, loginWithOtp, requestPasswordReset, verifyPasswordReset, resetPassword } =
    useAuth();
  const { logoUrl, systemName } = useBrand();
  /** Ayarlar’dan yüklenen şirket logosu — yoksa varsayılan */
  const brandLogo = logoUrl || '/brand/logo-full.png';
  const loginArt = '/illustrations/login-tahsilat.jpg';

  const [showPassword, setShowPassword] = useState(false);

  const flow = useLoginModeFlow({
    onPasswordLogin: (email, password) => login(email, password),
    onVerifyTwoFactor: (challengeToken, code) => verifyTwoFactor(challengeToken, code),
    onRequestOtp: (email) => requestOtp(email),
    onOtpLogin: (email, code) => loginWithOtp(email, code),
    onRequestPasswordReset: async (email) => {
      await requestPasswordReset(email);
    },
    onVerifyPasswordReset: async (email, code) => verifyPasswordReset(email, code),
    onResetPassword: async (resetToken, password) => {
      await resetPassword(resetToken, password);
    },
  });

  const busy = flow.loading || flow.transitioning;

  const subtitle =
    flow.mode === 'forgot'
      ? 'E-postanıza gelen kodu doğrulayıp yeni şifrenizi belirleyin.'
      : flow.mode === 'two-factor'
        ? 'Girişinizi tamamlamak için e-postanıza gönderilen kodu girin.'
        : flow.mode === 'otp'
          ? 'Geçici kodu girerek giriş yapın.'
          : flow.mode === 'password'
            ? 'Hesabınıza giriş yapmak için e-posta ve şifrenizi giriniz.'
            : 'Önce e-postanızı girin, ardından hızlı giriş veya şifre ile devam edin.';

  return (
    <div className="grid min-h-screen bg-[#eef2f7] lg:grid-cols-[3fr_1fr]">
      {/* Sol — şirket logosu + tahsilat görseli (3 birim) */}
      <aside className="relative hidden min-h-screen overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2545] via-[#164e7a] to-[#2f7fbf]" />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, #fff 0, transparent 40%), radial-gradient(circle at 82% 78%, #93c5fd 0, transparent 48%)',
          }}
        />
        <div className="relative z-[1] flex h-full min-h-screen flex-col items-center justify-center gap-10 px-12 xl:gap-14 xl:px-20">
          <div className="flex w-full max-w-[min(480px,52vw)] items-center justify-center rounded-2xl bg-white/95 px-8 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <img
              src={brandLogo}
              alt={systemName}
              className="h-auto max-h-24 w-full object-contain sm:max-h-28"
            />
          </div>
          <img
            src={loginArt}
            alt=""
            className="h-auto w-full max-w-[min(640px,62vw)] rounded-2xl object-contain shadow-[0_24px_60px_rgba(0,0,0,0.32)]"
            draggable={false}
          />
          <p className="max-w-md text-center text-base text-white/75">
            Güvenli, hızlı ve sade tahsilat yönetimi.
          </p>
        </div>
      </aside>

      {/* Sağ — giriş / hızlı giriş (1 birim) */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 [--input-notch:#eef2f7]">
        <div className="w-full max-w-[400px]">
          <div className="mb-9 flex flex-col items-center text-center">
            <img
              src={brandLogo}
              alt={systemName}
              className="mb-6 h-14 w-auto max-w-[240px] object-contain lg:hidden"
            />
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.85rem]">
              {flow.mode === 'forgot'
                ? 'Şifre Yenile'
                : flow.mode === 'two-factor'
                  ? 'İki aşamalı doğrulama'
                  : 'Hoş geldin!'}
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
                  label="E-postanıza gönderdiğimiz kodu giriniz"
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
                  onClick={() => void flow.verifyResetCode()}
                  className="w-full rounded-xl border border-[var(--panel-line)] bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[var(--panel-surface)] disabled:opacity-50"
                >
                  {flow.codeVerified ? 'Doğrulandı' : flow.loading ? 'Doğrulanıyor…' : 'Doğrula'}
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
                  onClick={() => void flow.saveNewPassword()}
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
                  readOnly={flow.mode === 'two-factor'}
                  onChange={(e) => flow.setEmail(e.target.value)}
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
                    />
                  </div>
                ) : null}

                {flow.mode === 'two-factor' ? (
                  <TwoFactorStep
                    value={flow.twoFactorCode}
                    onChange={flow.setTwoFactorCode}
                    remainingSeconds={flow.remainingSeconds}
                    panelRef={flow.twoFactorPanelRef}
                  />
                ) : null}

                {flow.mode === 'password' ? (
                  <div ref={flow.passwordPanelRef} className="flex flex-col gap-1.5">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void flow.goForgot()}
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
                      endAdornment={
                        <button
                          type="button"
                          aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
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
                />

                {flow.mode !== 'choose' ? (
                  <Button
                    type="submit"
                    disabled={flow.mode === 'two-factor' && flow.remainingSeconds === 0}
                    loading={flow.loading}
                    loadingLabel="Giriş yapılıyor…"
                    className="mt-1"
                  >
                    {flow.mode === 'two-factor' ? 'Kodu Doğrula' : 'Giriş Yap'}
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
