import { useRef, useState } from 'react';
import type { BankInfo } from '../../pages/payments/mockBanks';

export type AnimatedPayCardValues = {
  holder: string;
  card: string;
  expiry: string;
  cvc: string;
};

export type AnimatedPayCardErrors = {
  holder?: string;
  card?: string;
  expiry?: string;
  cvc?: string;
};

type Props = {
  values: AnimatedPayCardValues;
  errors?: AnimatedPayCardErrors;
  bank: BankInfo | null;
  cardFaulty?: boolean;
  expiryOk?: boolean;
  expiryFaulty?: boolean;
  onHolder: (v: string) => void;
  onCard: (v: string) => void;
  onExpiry: (v: string) => void;
  onCvc: (v: string) => void;
  onCardBlur?: () => void;
  onExpiryBlur?: () => void;
};

const GRADIENTS: Record<string, string> = {
  akbank: 'linear-gradient(145deg, #c41e3a 0%, #7a1020 50%, #1a0a0e 100%)',
  garanti: 'linear-gradient(145deg, #00a3e0 0%, #005a8c 50%, #0a1628 100%)',
  isbank: 'linear-gradient(145deg, #003d7a 0%, #001a3a 55%, #0a0e18 100%)',
  yapikredi: 'linear-gradient(145deg, #00205b 0%, #6b1d3a 50%, #1a0a14 100%)',
  qnb: 'linear-gradient(145deg, #7b2d8e 0%, #3d1050 50%, #120818 100%)',
  ziraat: 'linear-gradient(145deg, #e30613 0%, #7a080e 50%, #140608 100%)',
  halkbank: 'linear-gradient(145deg, #1e4d8c 0%, #0c2340 55%, #080e18 100%)',
  vakifbank: 'linear-gradient(145deg, #f5a623 0%, #8b5a00 50%, #1a1208 100%)',
  default: 'linear-gradient(145deg, #334155 0%, #1e293b 45%, #0f172a 100%)',
};

/**
 * 3D kredi kartı — yazmaya öncelik; çevirme yalnızca butonla.
 * Sürükleyerek döndürme yok (odak/imleç kayması engellenir).
 */
export function AnimatedPayCard({
  values,
  errors,
  bank,
  cardFaulty,
  expiryOk,
  expiryFaulty,
  onHolder,
  onCard,
  onExpiry,
  onCvc,
  onCardBlur,
  onExpiryBlur,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const cvcRef = useRef<HTMLInputElement>(null);
  const holderRef = useRef<HTMLInputElement>(null);

  const faceBg = GRADIENTS[bank?.id ?? ''] ?? GRADIENTS.default!;
  const displayName = (values.holder.trim() || 'AD SOYAD').toLocaleUpperCase('tr-TR');

  function showFront() {
    setFlipped(false);
  }

  function showBack() {
    setFlipped(true);
    window.setTimeout(() => cvcRef.current?.focus(), 280);
  }

  function flip() {
    if (flipped) {
      setFlipped(false);
      window.setTimeout(() => holderRef.current?.focus(), 280);
    } else {
      showBack();
    }
  }

  return (
    <div className="w-full">
      <div
        className="relative mx-auto w-full max-w-[420px]"
        style={{ perspective: '1400px' }}
      >
        {/* Daha yüksek alan — kredi kartına yer */}
        <div
          className="relative w-full"
          style={{
            minHeight: '240px',
            aspectRatio: '1.586 / 1.08',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute inset-0 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `rotateY(${flipped ? 180 : 0}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Ön yüz */}
            <div
              className="absolute inset-0 overflow-hidden rounded-[1.25rem] border border-white/20 shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55)]"
              style={{
                background: faceBg,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  background:
                    'radial-gradient(ellipse at 18% 8%, rgba(255,255,255,0.4), transparent 50%), radial-gradient(ellipse at 88% 90%, rgba(56,189,248,0.18), transparent 42%)',
                }}
              />
              <div className="relative flex h-full flex-col gap-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <img
                    src="/card-chip.png"
                    alt=""
                    className="h-10 w-auto rounded-sm object-contain drop-shadow-md sm:h-11"
                    draggable={false}
                  />
                  {bank ? (
                    <img
                      src={bank.logo}
                      alt=""
                      title={bank.name}
                      className="h-9 max-w-[110px] object-contain brightness-0 invert sm:h-10"
                      draggable={false}
                    />
                  ) : (
                    <span className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/70">
                      BIN
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Kart numarası
                  </span>
                  <input
                    data-km-jump
                    value={values.card}
                    onChange={(e) => onCard(e.target.value)}
                    onBlur={onCardBlur}
                    onFocus={showFront}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="•••• •••• •••• ••••"
                    className={[
                      'w-full rounded-lg bg-white/10 px-3 py-2.5 font-mono text-[1.05rem] tracking-[0.12em] text-white outline-none ring-1 ring-white/15 placeholder:text-white/35 focus:bg-white/15 focus:ring-white/35 sm:text-[1.12rem]',
                      cardFaulty || errors?.card ? 'ring-rose-300/60 text-rose-100' : '',
                    ].join(' ')}
                  />
                  {errors?.card || cardFaulty ? (
                    <p className="mt-1 text-[10px] font-semibold text-rose-200">
                      {errors?.card || 'Kart numarası hatalı'}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                  <div className="min-w-0">
                    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Kart sahibi
                    </span>
                    <input
                      ref={holderRef}
                      data-km-jump
                      value={values.holder}
                      onChange={(e) => onHolder(e.target.value)}
                      onFocus={showFront}
                      autoComplete="cc-name"
                      placeholder="AD SOYAD"
                      className={[
                        'w-full rounded-lg bg-white/10 px-3 py-2 text-[13px] font-bold tracking-wide text-white outline-none ring-1 ring-white/15 placeholder:text-white/35 focus:bg-white/15 focus:ring-white/35',
                        errors?.holder ? 'ring-rose-300/60 text-rose-100' : '',
                      ].join(' ')}
                    />
                    {errors?.holder ? (
                      <p className="mt-1 text-[10px] font-semibold text-rose-200">{errors.holder}</p>
                    ) : null}
                  </div>
                  <div>
                    <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      SKT
                    </span>
                    <input
                      data-km-jump
                      value={values.expiry}
                      onChange={(e) => onExpiry(e.target.value)}
                      onBlur={onExpiryBlur}
                      onFocus={showFront}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="AA/YY"
                      className={[
                        'w-full rounded-lg bg-white/10 px-2.5 py-2 text-center font-mono text-[13px] font-bold tabular-nums text-white outline-none ring-1 ring-white/15 placeholder:text-white/35 focus:bg-white/15 focus:ring-white/35',
                        expiryFaulty || errors?.expiry ? 'ring-rose-300/60 text-rose-100' : '',
                        expiryOk ? 'ring-emerald-300/50 text-emerald-100' : '',
                      ].join(' ')}
                    />
                    {errors?.expiry ? (
                      <p className="mt-1 text-[10px] font-semibold text-rose-200">{errors.expiry}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Arka yüz */}
            <div
              className="absolute inset-0 overflow-hidden rounded-[1.25rem] border border-white/20 shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55)]"
              style={{
                background: faceBg,
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div className="mt-7 h-11 w-full bg-black/85" />
              <div className="mt-6 px-5 sm:px-6">
                <div className="flex items-center gap-2 rounded-lg bg-white/95 px-2.5 py-2.5 shadow-sm">
                  <div className="h-8 flex-1 rounded bg-[repeating-linear-gradient(-45deg,#e2e8f0,#e2e8f0_4px,#cbd5e1_4px,#cbd5e1_8px)]" />
                  <div className="shrink-0">
                    <span className="mb-0.5 block text-center text-[8px] font-bold uppercase tracking-wider text-slate-500">
                      CVC
                    </span>
                    <input
                      ref={cvcRef}
                      data-km-jump
                      value={values.cvc}
                      onChange={(e) => onCvc(e.target.value)}
                      onFocus={() => setFlipped(true)}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="•••"
                      maxLength={4}
                      className={[
                        'w-16 rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-center font-mono text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--color-brand-500)]/25',
                        errors?.cvc ? 'border-rose-400 text-rose-600' : '',
                      ].join(' ')}
                    />
                  </div>
                </div>
                {errors?.cvc ? (
                  <p className="mt-2 text-[10px] font-semibold text-rose-200">{errors.cvc}</p>
                ) : (
                  <p className="mt-2 text-[10px] text-white/55">
                    Kartın arkasındaki 3–4 haneli güvenlik kodu
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold tracking-wide text-white/75">
                    {displayName}
                  </p>
                  {bank ? (
                    <img
                      src={bank.logo}
                      alt=""
                      className="h-7 max-w-[90px] object-contain brightness-0 invert"
                      draggable={false}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-km-jump
          onClick={flip}
          className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-xs font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
        >
          {flipped ? '← Ön yüze dön' : 'CVC için çevir →'}
        </button>
        <p className="w-full text-center text-[10px] text-[var(--panel-muted)] sm:w-auto">
          Alanlara tıklayıp yazın · çevirmek için butonu kullanın
        </p>
      </div>
    </div>
  );
}
