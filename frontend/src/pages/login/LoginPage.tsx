import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { LoginMascot, type MascotFocus } from './LoginMascot';
import { LoginSky } from './LoginSky';

export default function LoginPage() {
  const { login } = useAuth();
  const cardRef = useRef<HTMLElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<MascotFocus>('none');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<'idle' | 'success' | 'fail'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOutcome('idle');
    setLoading(true);
    try {
      await login(email.trim(), password);
      setOutcome('success');
    } catch (err) {
      setOutcome('fail');
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

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
            passwordVisible={showPassword}
            outcome={outcome}
            trackRef={cardRef}
          />
        </aside>

        <div className="flex items-center justify-center bg-[#eef2f7] px-8 py-12 sm:px-12 sm:py-14 [--input-notch:#eef2f7]">
          <div className="w-full max-w-[420px]">
            <div className="mb-9 flex flex-col items-center text-center">
              {/* Tam marka logosu (webp) — yanına tekrar metin yazılmıyor */}
              <img
                src="/brand/logo.png"
                alt="Güzel Teknoloji"
                className="mb-6 h-[4.5rem] w-auto max-w-[280px] object-contain sm:h-20 sm:max-w-[320px]"
              />
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.85rem]">
                Hoş geldin!
              </h1>
              <p className="mt-2 max-w-[340px] text-sm leading-relaxed text-muted">
                Hesabınıza giriş yapmak için e-posta ve şifrenizi giriniz.
              </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <TextInput
                label="E-Posta"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus((f) => (f === 'email' ? 'none' : f))}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-end">
                  <Link
                    to="/login"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    onClick={(e) => e.preventDefault()}
                  >
                    Şifremi unuttum?
                  </Link>
                </div>
                <TextInput
                  label="Şifre"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus((f) => (f === 'password' ? 'none' : f))}
                  endAdornment={
                    <button
                      type="button"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      // Blur yarışını önle: önce focus kaybolup göz açılmasın
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

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
                >
                  {error}
                </div>
              ) : null}

              <Button type="submit" loading={loading} className="mt-1 rounded-xl py-3.5">
                Giriş Yap
              </Button>
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
