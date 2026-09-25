import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { BankInfo } from '../../pages/payments/mockBanks';
import { digitsOnly } from '../../pages/payments/mockBanks';

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
  akbank: 'linear-gradient(135deg, #c41e3a 0%, #7a1020 55%, #1a0a0e 100%)',
  garanti: 'linear-gradient(135deg, #00a3e0 0%, #005a8c 55%, #0a1628 100%)',
  isbank: 'linear-gradient(135deg, #003d7a 0%, #001a3a 60%, #0a0e18 100%)',
  yapikredi: 'linear-gradient(135deg, #00205b 0%, #6b1d3a 50%, #1a0a14 100%)',
  qnb: 'linear-gradient(135deg, #7b2d8e 0%, #3d1050 55%, #120818 100%)',
  ziraat: 'linear-gradient(135deg, #e30613 0%, #7a080e 55%, #140608 100%)',
  halkbank: 'linear-gradient(135deg, #1e4d8c 0%, #0c2340 60%, #080e18 100%)',
  vakifbank: 'linear-gradient(135deg, #f5a623 0%, #8b5a00 50%, #1a1208 100%)',
  default: 'linear-gradient(145deg, #1e293b 0%, #0f172a 45%, #020617 100%)',
};

/**
 * 3D etkileşimli kredi kartı — sürükle / çevir; ön yüz + CVC arka yüz.
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
  const shellRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [rot, setRot] = useState({ x: -8, y: 12 });
  const drag = useRef<{
    active: boolean;
    px: number;
    py: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const autoFlipped = useRef(false);
  const cvcRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);

  const digits = digitsOnly(values.card);
  const frontReady =
    values.holder.trim().length >= 2 &&
    digits.length >= 15 &&
    digitsOnly(values.expiry).length === 4;

  useEffect(() => {
    if (frontReady && !autoFlipped.current && digitsOnly(values.cvc).length === 0) {
      autoFlipped.current = true;
      setFlipped(true);
      window.setTimeout(() => cvcRef.current?.focus(), 420);
    }
  }, [frontReady, values.cvc]);

  function onPointerDown(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest('input,button,a,label')) return;
    drag.current = {
      active: true,
      px: e.clientX,
      py: e.clientY,
      ox: rot.x,
      oy: rot.y,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d?.active) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setRot({
      x: Math.max(-28, Math.min(28, d.ox - dy * 0.18)),
      y: d.oy + dx * 0.28,
    });
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = drag.current;
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d && !d.moved) {
      // tıklama — yavaşça sıfırla
      setRot((r) => ({ x: r.x * 0.4, y: r.y * 0.35 }));
    }
  }

  function flipTo(back: boolean) {
    setFlipped(back);
    setRot((r) => ({ x: Math.max(-12, Math.min(12, r.x)), y: r.y }));
    if (back) window.setTimeout(() => cvcRef.current?.focus(), 380);
    else window.setTimeout(() => cardRef.current?.focus(), 380);
  }

  const faceBg = GRADIENTS[bank?.id ?? ''] ?? GRADIENTS.default!;
  const displayNumber =
    values.card.trim() ||
    '•••• •••• •••• ••••';
  const displayName = (values.holder.trim() || 'AD SOYAD').toLocaleUpperCase('tr-TR');
  const displayExp = values.expiry.trim() || 'AA/YY';

  const tiltStyle: CSSProperties = {
    transform: `rotateX(${rot.x}deg) rotateY(${rot.y + (flipped ? 180 : 0)}deg)`,
  };

  return (
    <div className="w-full">
      <div
        className="relative mx-auto w-full max-w-[360px]"
        style={{ perspective: '1200px' }}
      >
        <div
          ref={shellRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-[1.586/1] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ ...tiltStyle, transformStyle: 'preserve-3d' }}
          >
            {/* Ön yüz */}
            <div
              className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]"
              style={{
                background: faceBg,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(ellipse at 90% 80%, rgba(56,189,248,0.2), transparent 45%)',
                }}
              />
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
                style={{ background: 'rgba(255,255,255,0.35)' }}
              />
              <div className="relative flex h-full flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <img
                    src="/card-chip.png"
                    alt=""
                    className="h-9 w-auto rounded-sm object-contain drop-shadow-md sm:h-10"
                    draggable={false}
                  />
                  {bank ? (
                    <img
                      src={bank.logo}
                      alt=""
                      title={bank.name}
                      className="h-8 max-w-[100px] object-contain brightness-0 invert sm:h-9"
                      draggable={false}
                    />
                  ) : (
                    <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wider text-white/70">
                      BIN
                    </span>
                  )}
                </div>

                <label className="mt-3 block">
                  <span className="sr-only">Kart numarası</span>
                  <input
                    ref={cardRef}
                    data-km-jump
                    value={values.card}
                    onChange={(e) => onCard(e.target.value)}
                    onBlur={onCardBlur}
                    onFocus={() => flipTo(false)}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="•••• •••• •••• ••••"
                    className={[
                      'w-full bg-transparent font-mono text-[1.05rem] tracking-[0.14em] text-white outline-none placeholder:text-white/35 sm:text-[1.15rem]',
                      cardFaulty || errors?.card ? 'text-rose-200' : '',
                    ].join(' ')}
                  />
                </label>
                {errors?.card || cardFaulty ? (
                  <p className="mt-0.5 text-[10px] font-semibold text-rose-200">
                    {errors?.card || 'Kart numarası hatalı'}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-white/0 select-none">.</p>
                )}

                <div className="mt-auto grid grid-cols-[1fr_auto] gap-3">
                  <label className="min-w-0">
                    <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">
                      Kart sahibi
                    </span>
                    <input
                      data-km-jump
                      value={values.holder}
                      onChange={(e) => onHolder(e.target.value)}
                      onFocus={() => flipTo(false)}
                      autoComplete="cc-name"
                      placeholder="AD SOYAD"
                      className={[
                        'w-full truncate bg-transparent text-[12px] font-bold tracking-wide text-white outline-none placeholder:text-white/35 sm:text-[13px]',
                        errors?.holder ? 'text-rose-200' : '',
                      ].join(' ')}
                    />
                  </label>
                  <label className="w-[4.5rem]">
                    <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">
                      SKT
                    </span>
                    <input
                      data-km-jump
                      value={values.expiry}
                      onChange={(e) => onExpiry(e.target.value)}
                      onBlur={onExpiryBlur}
                      onFocus={() => flipTo(false)}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="AA/YY"
                      className={[
                        'w-full bg-transparent font-mono text-[12px] font-bold tabular-nums text-white outline-none placeholder:text-white/35 sm:text-[13px]',
                        expiryFaulty || errors?.expiry ? 'text-rose-200' : '',
                        expiryOk ? 'text-emerald-200' : '',
                      ].join(' ')}
                    />
                  </label>
                </div>
                {(errors?.holder || errors?.expiry) && (
                  <p className="mt-1 text-[10px] font-semibold text-rose-200">
                    {errors.holder || errors.expiry}
                  </p>
                )}
              </div>
            </div>

            {/* Arka yüz */}
            <div
              className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)]"
              style={{
                background: faceBg,
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div className="mt-5 h-10 w-full bg-black/80" />
              <div className="mt-5 px-4 sm:px-5">
                <div className="flex items-center gap-2 rounded-md bg-white/90 px-2 py-2">
                  <div className="h-7 flex-1 bg-[repeating-linear-gradient(-45deg,#e2e8f0,#e2e8f0_4px,#cbd5e1_4px,#cbd5e1_8px)]" />
                  <label className="shrink-0">
                    <span className="sr-only">CVC</span>
                    <input
                      ref={cvcRef}
                      data-km-jump
                      value={values.cvc}
                      onChange={(e) => onCvc(e.target.value)}
                      onFocus={() => flipTo(true)}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVC"
                      maxLength={4}
                      className={[
                        'w-14 rounded bg-white px-1.5 py-1 text-center font-mono text-sm font-bold tabular-nums text-slate-900 outline-none ring-1 ring-slate-300',
                        errors?.cvc ? 'ring-rose-400 text-rose-600' : '',
                      ].join(' ')}
                    />
                  </label>
                </div>
                {errors?.cvc ? (
                  <p className="mt-1.5 text-[10px] font-semibold text-rose-200">{errors.cvc}</p>
                ) : (
                  <p className="mt-1.5 text-[10px] text-white/55">
                    Güvenlik kodu — kartın arkasındaki 3–4 hane
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <p className="max-w-[60%] truncate text-[10px] font-semibold tracking-wide text-white/70">
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
                <p className="mt-2 font-mono text-[10px] tracking-widest text-white/40">
                  {displayNumber.replace(/\d(?=\d{4})/g, '•')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-km-jump
          onClick={() => flipTo(!flipped)}
          className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3.5 py-2 text-xs font-bold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
        >
          {flipped ? 'Ön yüze dön' : 'CVC yüzüne çevir'}
        </button>
        <button
          type="button"
          data-km-jump
          onClick={() => setRot({ x: -8, y: 12 })}
          className="rounded-xl border border-[var(--panel-line)] px-3.5 py-2 text-xs font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
        >
          Sıfırla
        </button>
        <p className="w-full text-center text-[10px] text-[var(--panel-muted)] sm:w-auto">
          Sürükleyerek 360° döndürebilirsiniz · SKT: {displayExp}
        </p>
      </div>
    </div>
  );
}
