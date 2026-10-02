import type { ChangeEvent, RefObject } from 'react';

type Props = {
  variant: 'classic' | 'globe';
  value: string;
  onChange: (value: string) => void;
  remainingSeconds: number;
  panelRef: RefObject<HTMLDivElement | null>;
};

export function TwoFactorStep({ variant, value, onChange, remainingSeconds, panelRef }: Props) {
  const time = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const globe = variant === 'globe';
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value.replace(/\D/g, '').slice(0, 6));
  }

  return (
    <div ref={panelRef} className={globe ? 'space-y-3' : 'space-y-4'}>
      <div className={globe ? 'rounded-xl border border-white/25 bg-white/10 p-4' : 'rounded-xl border border-brand-200 bg-brand-50/60 p-4'}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">E-posta doğrulaması</span>
          <span role="timer" aria-label={`Kalan süre ${time}`} className={`font-mono text-sm font-bold tabular-nums ${remainingSeconds === 0 ? 'text-red-500' : ''}`}>{time}</span>
        </div>
        <p className={`mt-1 text-xs leading-relaxed ${globe ? 'text-white/65' : 'text-muted'}`}>
          E-postanıza gönderilen 6 haneli kodu 1 dakika 30 saniye içinde girin.
        </p>
      </div>
      {remainingSeconds > 0 ? (
        <input
          type="text"
          name="two-factor-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="İki aşamalı doğrulama kodu"
          placeholder="6 haneli kod"
          maxLength={6}
          required
          autoFocus
          value={value}
          onChange={handleChange}
          className={globe
            ? 'w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3.5 text-center font-mono text-xl tracking-[0.35em] text-white outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-white/45 focus:border-white/60'
            : 'w-full rounded-xl border border-brand-200 bg-white px-4 py-3.5 text-center font-mono text-xl tracking-[0.35em] text-ink outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-muted focus:border-brand-500'}
        />
      ) : (
        <p className={globe ? 'text-sm text-red-200' : 'text-sm text-red-600'}>Kodun süresi doldu. Geri dönüp şifrenizle yeniden giriş yapın.</p>
      )}
    </div>
  );
}
