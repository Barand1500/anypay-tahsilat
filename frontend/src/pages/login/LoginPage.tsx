import { useEffect, useState } from 'react';
import { LoginClassic } from './LoginClassic';
import { LoginGlobe } from './LoginGlobe';
import { getLoginTheme, type LoginTheme } from './loginTheme';

/** Giriş — profil tercihine göre klasik veya globe */
export default function LoginPage() {
  const [theme, setTheme] = useState<LoginTheme>(() => getLoginTheme());

  useEffect(() => {
    function sync() {
      setTheme(getLoginTheme());
    }
    function onCustom(e: Event) {
      const detail = (e as CustomEvent<LoginTheme>).detail;
      if (detail === 'classic' || detail === 'globe') setTheme(detail);
      else sync();
    }
    window.addEventListener('storage', sync);
    window.addEventListener('anypay:login-theme', onCustom);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('anypay:login-theme', onCustom);
    };
  }, []);

  if (theme === 'globe') return <LoginGlobe />;
  return <LoginClassic />;
}
