import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import type { TwoFactorChallenge } from '../../auth/AuthContext';

gsap.registerPlugin(useGSAP);

export type LoginMode = 'choose' | 'password' | 'otp' | 'forgot' | 'two-factor';

type UseLoginModeOpts = {
  onPasswordLogin: (email: string, password: string) => Promise<TwoFactorChallenge | null>;
  onVerifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  onRequestOtp: (email: string) => Promise<void>;
  onOtpLogin: (email: string, code: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onVerifyPasswordReset: (email: string, code: string) => Promise<string>;
  onResetPassword: (resetToken: string, password: string) => Promise<void>;
};

/** Ortak giriş adımları — e-posta → hızlı/şifre + şifremi unuttum */
export function useLoginModeFlow({
  onPasswordLogin,
  onVerifyTwoFactor,
  onRequestOtp,
  onOtpLogin,
  onRequestPasswordReset,
  onVerifyPasswordReset,
  onResetPassword,
}: UseLoginModeOpts) {
  const [mode, setMode] = useState<LoginMode>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeDeadline, setChallengeDeadline] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const passwordPanelRef = useRef<HTMLDivElement>(null);
  const otpPanelRef = useRef<HTMLDivElement>(null);
  const twoFactorPanelRef = useRef<HTMLDivElement>(null);
  const loginStageRef = useRef<HTMLDivElement>(null);
  const forgotStageRef = useRef<HTMLDivElement>(null);
  const prevMode = useRef<LoginMode>('choose');

  useGSAP(
    () => {
      if (mode === 'password' && passwordPanelRef.current) {
        gsap.fromTo(
          passwordPanelRef.current,
          { autoAlpha: 0, y: -12 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' },
        );
      }
      if (mode === 'otp' && otpPanelRef.current) {
        gsap.fromTo(
          otpPanelRef.current,
          { autoAlpha: 0, y: -12 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' },
        );
      }
      if (mode === 'two-factor' && twoFactorPanelRef.current) {
        gsap.fromTo(twoFactorPanelRef.current, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' });
      }
      if (mode === 'forgot' && forgotStageRef.current) {
        gsap.fromTo(
          forgotStageRef.current,
          { autoAlpha: 0, y: -56 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' },
        );
      }
      if (
        prevMode.current === 'forgot' &&
        mode !== 'forgot' &&
        loginStageRef.current
      ) {
        gsap.fromTo(
          loginStageRef.current,
          { autoAlpha: 0, y: -40 },
          { autoAlpha: 1, y: 0, duration: 0.48, ease: 'power3.out' },
        );
      }
      prevMode.current = mode;
    },
    { dependencies: [mode] },
  );

  useEffect(() => {
    if (mode !== 'two-factor' || challengeDeadline == null) return;
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((challengeDeadline - Date.now()) / 1000)));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [mode, challengeDeadline]);

  function requireEmail() {
    const e = email.trim();
    if (!e || !e.includes('@')) {
      setError('Geçerli bir e-posta giriniz');
      return null;
    }
    return e;
  }

  function clearForgotState() {
    setResetCode('');
    setNewPassword('');
    setCodeVerified(false);
    setResetToken(null);
    setShowNewPassword(false);
  }

  async function goQuick() {
    if (loading || transitioning) return;
    const e = requireEmail();
    if (!e) return;
    setError(null);
    setOtp('');
    setLoading(true);
    try {
      await onRequestOtp(e);
      setMode('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi');
    } finally {
      setLoading(false);
    }
  }

  function goPassword() {
    if (loading || transitioning) return;
    const e = requireEmail();
    if (!e) return;
    setError(null);
    setPassword('');
    setMode('password');
  }

  function goBack() {
    if (loading || transitioning) return;
    setError(null);
    setPassword('');
    setOtp('');
    setTwoFactorCode('');
    setChallengeToken(null);
    setChallengeDeadline(null);
    setMode(mode === 'two-factor' ? 'password' : 'choose');
  }

  async function goForgot() {
    if (loading || transitioning) return;
    const e = requireEmail();
    if (!e) return;
    setError(null);
    setLoading(true);
    try {
      await onRequestPasswordReset(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi');
      setLoading(false);
      return;
    }
    setLoading(false);
    setTransitioning(true);
    const el = loginStageRef.current;
    const enterForgot = () => {
      clearForgotState();
      setMode('forgot');
      setTransitioning(false);
    };
    if (!el) {
      enterForgot();
      return;
    }
    gsap.to(el, {
      x: 110,
      autoAlpha: 0,
      duration: 0.38,
      ease: 'power2.in',
      onComplete: () => {
        gsap.set(el, { clearProps: 'transform' });
        enterForgot();
      },
    });
  }

  function leaveForgot(to: LoginMode = 'choose') {
    if (loading || transitioning) return;
    setTransitioning(true);
    const el = forgotStageRef.current;
    const finish = () => {
      clearForgotState();
      setError(null);
      setPassword('');
      setOtp('');
      setMode(to);
      setTransitioning(false);
    };
    if (!el) {
      finish();
      return;
    }
    gsap.to(el, {
      y: -48,
      autoAlpha: 0,
      duration: 0.34,
      ease: 'power2.in',
      onComplete: finish,
    });
  }

  async function verifyResetCode() {
    if (loading || transitioning) return;
    const mail = requireEmail();
    if (!mail) return;
    if (!resetCode.trim()) {
      setError('Gönderilen kodu giriniz');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = await onVerifyPasswordReset(mail, resetCode.trim());
      setResetToken(token);
      setCodeVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod doğrulanamadı');
    } finally {
      setLoading(false);
    }
  }

  async function saveNewPassword() {
    if (loading || transitioning) return;
    if (!codeVerified || !resetToken) {
      setError('Önce gönderilen kodu doğrulayın');
      return;
    }
    if (newPassword.trim().length < 6) {
      setError('Yeni şifre en az 6 karakter olmalı');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onResetPassword(resetToken, newPassword.trim());
      setLoading(false);
      leaveForgot('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre kaydedilemedi');
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading || transitioning || mode === 'choose' || mode === 'forgot') return;
    const mail = requireEmail();
    if (!mail) return;

    setError(null);
    setLoading(true);
    try {
      if (mode === 'password') {
        if (!password) {
          setError('Şifre gerekli');
          setLoading(false);
          return;
        }
        const challenge = await onPasswordLogin(mail, password);
        if (challenge?.requiresTwoFactor) {
          setPassword('');
          setTwoFactorCode('');
          setChallengeToken(challenge.challengeToken);
          setChallengeDeadline(Date.now() + challenge.expiresInSeconds * 1000);
          setRemainingSeconds(challenge.expiresInSeconds);
          setMode('two-factor');
          setLoading(false);
        }
      } else if (mode === 'two-factor') {
        if (!challengeToken || remainingSeconds <= 0) {
          setError('Kodun süresi doldu. Şifrenizle yeniden giriş yapın.');
          setLoading(false);
          return;
        }
        if (!/^\d{6}$/.test(twoFactorCode)) {
          setError('6 haneli kodu girin');
          setLoading(false);
          return;
        }
        await onVerifyTwoFactor(challengeToken, twoFactorCode);
      } else {
        if (!otp.trim()) {
          setError('Geçici kodu giriniz');
          setLoading(false);
          return;
        }
        await onOtpLogin(mail, otp.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
      setLoading(false);
    }
  }

  return {
    mode,
    email,
    setEmail,
    password,
    setPassword,
    otp,
    setOtp,
    twoFactorCode,
    setTwoFactorCode,
    twoFactorPanelRef,
    remainingSeconds,
    error,
    setError,
    loading,
    transitioning,
    resetCode,
    setResetCode,
    newPassword,
    setNewPassword,
    codeVerified,
    showNewPassword,
    setShowNewPassword,
    passwordPanelRef,
    otpPanelRef,
    loginStageRef,
    forgotStageRef,
    goQuick,
    goPassword,
    goBack,
    goForgot,
    leaveForgot,
    verifyResetCode,
    saveNewPassword,
    submit,
  };
}

export function LoginModeActions({
  mode,
  loading,
  onQuick,
  onPassword,
  onBack,
  variant,
}: {
  mode: LoginMode;
  loading: boolean;
  onQuick: () => void;
  onPassword: () => void;
  onBack: () => void;
  variant: 'globe' | 'classic';
}) {
  if (mode === 'forgot') return null;

  if (mode !== 'choose') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={onBack}
        className={
          variant === 'globe'
            ? 'text-xs font-medium text-white/55 transition hover:text-white disabled:opacity-50'
            : 'text-xs font-medium text-muted transition hover:text-ink disabled:opacity-50'
        }
      >
        ← Geri
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-visible">
      <div className="overflow-visible py-1.5">
        <Button type="button" disabled={loading} onClick={onQuick}>
          Hızlı Giriş
        </Button>
      </div>
      <div className="overflow-visible py-1.5">
        <Button type="button" disabled={loading} onClick={onPassword}>
          Şifre ile Giriş Yap
        </Button>
      </div>
    </div>
  );
}
