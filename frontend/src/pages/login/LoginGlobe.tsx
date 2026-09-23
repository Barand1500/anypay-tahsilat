import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { BrandSideScroll } from './BrandSideScroll';
import Globe from './globe/Globe';
import { getLoginBrandWords, type LoginBrandWords } from './loginTheme';
import { LoginModeActions, useLoginModeFlow } from './useLoginModeFlow';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Dünya temalı giriş — Variant 2 (solid yeşil kara / cyan okyanus) */
export function LoginGlobe() {
  const { login, loginWithOtp } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const [brandWords, setBrandWords] = useState<LoginBrandWords>(() => getLoginBrandWords());

  const flow = useLoginModeFlow({
    onPasswordLogin: async (email, password) => {
      await sleep(1200);
      await login(email, password);
    },
    onOtpLogin: async (email, code) => {
      await sleep(1200);
      await loginWithOtp(email, code);
    },
  });

  useEffect(() => {
    function sync() {
      setBrandWords(getLoginBrandWords());
    }
    function onCustom(e: Event) {
      const detail = (e as CustomEvent<LoginBrandWords>).detail;
      if (detail && typeof detail.word1 === 'string' && typeof detail.word2 === 'string') {
        setBrandWords(detail);
      } else sync();
    }
    window.addEventListener('storage', sync);
    window.addEventListener('anypay:login-brand-words', onCustom);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('anypay:login-brand-words', onCustom);
    };
  }, []);

  useEffect(() => {
    if (!flow.loading) {
      setDotCount(1);
      return;
    }
    const id = window.setInterval(() => {
      setDotCount((n) => (n % 3) + 1);
    }, 420);
    return () => window.clearInterval(id);
  }, [flow.loading]);

  const markerConfig = useMemo(
    () => ({
      markers: [{ lat: 39.0, lng: 35.2 }],
      color: '#E11D48',
      size: 72,
    }),
    [],
  );

  const statusText = `Giriş yapılıyor${'.'.repeat(dotCount)}`;
  const inputClass =
    'w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/50 focus:bg-white/14 disabled:opacity-55';
  const busy = flow.loading || flow.transitioning;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-white"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 32% 48%, #1CA8FF 0%, #0b6fa8 22%, #074a72 48%, #031820 72%, #01080c 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 18% 22%, rgba(188,237,107,0.28) 0%, transparent 42%), radial-gradient(circle at 72% 78%, rgba(28,168,255,0.35) 0%, transparent 45%)',
        }}
      />

      <BrandSideScroll
        word1={brandWords.word1}
        word2={brandWords.word2}
        color="#d7ebe8"
        fadeColor="#031820"
      />

      <div className="pointer-events-auto absolute inset-0 z-0 md:left-28 lg:left-36 lg:right-1/4">
        <Globe
          direction="left"
          scale={7.2}
          stopOnHover
          speed={2}
          fill="solid"
          fillColor="#BCED6B"
          showOutline
          outlineColor="#000000"
          showGrid={false}
          graticuleColor="#77CBDD"
          oceanColor="#1CA8FF"
          initialLatitude={38}
          initialLongitude={28}
          markerConfig={markerConfig}
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-[38%] lg:block"
        style={{
          background:
            'linear-gradient(to left, #01080c 0%, rgba(3,24,32,0.75) 45%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 lg:hidden"
        style={{
          background: 'linear-gradient(to top, #01080c 0%, rgba(3,24,32,0.7) 50%, transparent 100%)',
        }}
      />

      <div className="relative z-30 flex min-h-screen w-full flex-col justify-end px-6 pb-10 pt-24 sm:px-10 lg:ml-auto lg:w-1/4 lg:justify-center lg:px-8 lg:pb-0 lg:pt-0 xl:px-10">
        <form
          ref={formRef}
          onSubmit={flow.submit}
          className="relative z-10 mx-auto w-full max-w-[320px] space-y-4 overflow-visible rounded-2xl bg-black/20 p-5 backdrop-blur-[3px] lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          {flow.mode === 'forgot' ? (
            <div ref={flow.forgotStageRef} className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => flow.leaveForgot('password')}
                className="text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-50"
              >
                ← Geri
              </button>

              <input
                type="email"
                value={flow.email}
                readOnly
                className={`${inputClass} opacity-70`}
                aria-label="E-posta"
              />

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={flow.resetCode}
                onChange={(e) => flow.setResetCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="E-postanıza gönderdiğimiz şifreyi giriniz"
                disabled={busy || flow.codeVerified}
                className={inputClass}
              />

              <button
                type="button"
                disabled={busy || flow.codeVerified}
                onClick={flow.verifyResetCode}
                className="w-full rounded-xl border border-white/30 bg-white/12 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/18 disabled:opacity-45"
              >
                {flow.codeVerified ? 'Doğrulandı' : 'Doğrula'}
              </button>

              <div className="relative">
                <input
                  type={flow.showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={flow.newPassword}
                  onChange={(e) => flow.setNewPassword(e.target.value)}
                  placeholder="Yeni şifre"
                  disabled={busy || !flow.codeVerified}
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  disabled={!flow.codeVerified}
                  aria-label={flow.showNewPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => flow.setShowNewPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 hover:text-white disabled:opacity-30"
                >
                  {flow.showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {flow.error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/35 bg-red-500/15 px-3 py-2 text-sm text-red-200"
                >
                  {flow.error}
                </div>
              ) : null}

              <div className="overflow-visible py-2">
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
            </div>
          ) : (
            <div ref={flow.loginStageRef} className="space-y-4">
              <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
                <div>
                  <label htmlFor="globe-email" className="sr-only">
                    E-posta
                  </label>
                  <input
                    id="globe-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={flow.email}
                    onChange={(e) => flow.setEmail(e.target.value)}
                    placeholder="E-posta"
                    className={inputClass}
                  />
                </div>

                {flow.mode === 'otp' ? (
                  <div ref={flow.otpPanelRef}>
                    <label htmlFor="globe-otp" className="sr-only">
                      Geçici kod
                    </label>
                    <input
                      id="globe-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={flow.otp}
                      onChange={(e) => flow.setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="Geçici kodu giriniz"
                      className={inputClass}
                    />
                  </div>
                ) : null}

                {flow.mode === 'password' ? (
                  <div ref={flow.passwordPanelRef} className="space-y-1.5">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={flow.goForgot}
                        className="text-xs font-medium text-[#9fd4ff] hover:text-white"
                      >
                        Şifremi unuttum?
                      </button>
                    </div>
                    <div className="relative">
                      <label htmlFor="globe-password" className="sr-only">
                        Şifre
                      </label>
                      <input
                        id="globe-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={flow.password}
                        onChange={(e) => flow.setPassword(e.target.value)}
                        placeholder="Şifre"
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 hover:text-white"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                ) : null}
              </fieldset>

              {flow.error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/35 bg-red-500/15 px-3 py-2 text-sm text-red-200"
                >
                  {flow.error}
                </div>
              ) : null}

              {flow.mode === 'choose' ? (
                <LoginModeActions
                  mode={flow.mode}
                  loading={busy}
                  onQuick={flow.goQuick}
                  onPassword={flow.goPassword}
                  onBack={flow.goBack}
                  variant="globe"
                />
              ) : (
                <div className="relative z-30 w-full space-y-2 overflow-visible">
                  <LoginModeActions
                    mode={flow.mode}
                    loading={busy}
                    onQuick={flow.goQuick}
                    onPassword={flow.goPassword}
                    onBack={flow.goBack}
                    variant="globe"
                  />
                  <p
                    aria-live="polite"
                    className={[
                      'mb-1.5 min-h-[1.1rem] text-center text-[11px] font-medium tracking-wide text-white/70 transition-opacity duration-300',
                      flow.loading ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                  >
                    {flow.loading ? statusText : '\u00a0'}
                  </p>
                  <div className="overflow-visible py-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (busy) return;
                        formRef.current?.requestSubmit();
                      }}
                    >
                      GİRİŞ YAP
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
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
