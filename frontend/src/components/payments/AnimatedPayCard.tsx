import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { BankInfo } from '../../pages/payments/mockBanks';
import { useTheme } from '../../theme/ThemeProvider';

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

/** Gece — koyu banka tonları */
const DARK: Record<string, string> = {
  akbank: 'linear-gradient(145deg, #c41e3a 0%, #7a1020 50%, #1a0a0e 100%)',
  garanti: 'linear-gradient(145deg, #00a3e0 0%, #005a8c 50%, #0a1628 100%)',
  isbank: 'linear-gradient(145deg, #003d7a 0%, #001a3a 55%, #0a0e18 100%)',
  yapikredi: 'linear-gradient(145deg, #00205b 0%, #6b1d3a 50%, #1a0a14 100%)',
  qnb: 'linear-gradient(145deg, #7b2d8e 0%, #3d1050 50%, #120818 100%)',
  ziraat: 'linear-gradient(145deg, #e30613 0%, #7a080e 50%, #140608 100%)',
  halkbank: 'linear-gradient(145deg, #1e4d8c 0%, #0c2340 55%, #080e18 100%)',
  vakifbank: 'linear-gradient(145deg, #f5a623 0%, #8b5a00 50%, #1a1208 100%)',
  default: 'linear-gradient(145deg, #475569 0%, #1e293b 50%, #0f172a 100%)',
};

/** Gündüz — açık, soft tonlar */
const LIGHT: Record<string, string> = {
  akbank: 'linear-gradient(145deg, #fff1f2 0%, #fecdd3 45%, #fda4af 100%)',
  garanti: 'linear-gradient(145deg, #f0f9ff 0%, #bae6fd 45%, #7dd3fc 100%)',
  isbank: 'linear-gradient(145deg, #eff6ff 0%, #bfdbfe 45%, #93c5fd 100%)',
  yapikredi: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 40%, #cbd5e1 100%)',
  qnb: 'linear-gradient(145deg, #faf5ff 0%, #e9d5ff 45%, #d8b4fe 100%)',
  ziraat: 'linear-gradient(145deg, #fff1f2 0%, #fecaca 45%, #fca5a5 100%)',
  halkbank: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 45%, #bfdbfe 100%)',
  vakifbank: 'linear-gradient(145deg, #fffbeb 0%, #fde68a 45%, #fcd34d 100%)',
  default: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 45%, #e2e8f0 100%)',
};

/**
 * 3D kredi kartı — soft tilt + flip; yazarken döndürme kapalı.
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
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 4, y: -6 });
  const [typing, setTyping] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const holderRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    active: boolean;
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);

  const map = isLight ? LIGHT : DARK;
  const faceBg = map[bank?.id ?? ''] ?? map.default!;
  const displayName = (values.holder.trim() || 'AD SOYAD').toLocaleUpperCase('tr-TR');

  const ink = isLight ? 'text-slate-800' : 'text-white';
  const muted = isLight ? 'text-slate-500' : 'text-white/55';
  const field = isLight
    ? 'bg-white/70 ring-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-[var(--color-brand-500)]/35'
    : 'bg-white/10 ring-white/15 text-white placeholder:text-white/35 focus:bg-white/15 focus:ring-white/35';
  const errField = isLight ? 'ring-rose-400/70 text-rose-700' : 'ring-rose-300/60 text-rose-100';
  const errText = isLight ? 'text-rose-600' : 'text-rose-200';
  const logoClass = isLight
    ? 'h-9 max-w-[110px] object-contain sm:h-10'
    : 'h-9 max-w-[110px] object-contain brightness-0 invert sm:h-10';
  const binClass = isLight
    ? 'rounded-md bg-slate-900/8 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-500'
    : 'rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/70';
  const borderFace = isLight ? 'border-slate-200/80' : 'border-white/20';
  const shadowFace = isLight
    ? 'shadow-[0_20px_40px_-12px_rgba(15,23,42,0.18)]'
    : 'shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55)]';

  function showFront() {
    setFlipped(false);
  }

  function flip() {
    if (flipped) {
      setFlipped(false);
      window.setTimeout(() => holderRef.current?.focus(), 320);
    } else {
      setFlipped(true);
      window.setTimeout(() => cvcRef.current?.focus(), 320);
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (typing) return;
    if ((e.target as HTMLElement).closest('input,button,textarea,label')) return;
    drag.current = {
      active: true,
      px: e.clientX,
      py: e.clientY,
      ox: tilt.x,
      oy: tilt.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d?.active || typing) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    // Soft limit — agresif 360 yok
    setTilt({
      x: Math.max(-14, Math.min(14, d.ox - dy * 0.08)),
      y: Math.max(-22, Math.min(22, d.oy + dx * 0.12)),
    });
  }

  function onPointerUp(e: ReactPointerEvent) {
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Yavaşça yumuşak dinlenme pozisyonuna
    setTilt({ x: 4, y: flipped ? 0 : -6 });
  }

  function onShellMove(e: ReactPointerEvent) {
    if (typing || drag.current?.active) return;
    if ((e.target as HTMLElement).closest('input,button')) return;
    const el = shellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({
      x: Math.max(-10, Math.min(10, -py * 10)),
      y: Math.max(-14, Math.min(14, px * 14)),
    });
  }

  function onShellLeave() {
    if (drag.current?.active) return;
    setTilt({ x: 4, y: flipped ? 0 : -6 });
  }

  const transformStyle: CSSProperties = {
    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y + (flipped ? 180 : 0)}deg)`,
    transition: drag.current?.active
      ? 'none'
      : 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
    transformStyle: 'preserve-3d',
  };

  return (
    <div className="w-full">
      <div
        className="relative mx-auto w-full max-w-[420px]"
        style={{ perspective: '1600px' }}
      >
        <div
          ref={shellRef}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => {
            onPointerMove(e);
            onShellMove(e);
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onShellLeave}
          className={[
            'relative w-full',
            typing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing',
          ].join(' ')}
          style={{
            minHeight: '252px',
            aspectRatio: '1.586 / 1.1',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="absolute inset-0 will-change-transform" style={transformStyle}>
            {/* Ön */}
            <div
              className={`absolute inset-0 overflow-hidden rounded-[1.25rem] border ${borderFace} ${shadowFace}`}
              style={{
                background: faceBg,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  opacity: isLight ? 0.55 : 0.45,
                  background: isLight
                    ? 'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.9), transparent 55%), linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.35))'
                    : 'radial-gradient(ellipse at 18% 8%, rgba(255,255,255,0.35), transparent 50%)',
                }}
              />
              <div className="relative flex h-full flex-col gap-3 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={[
                      'flex h-11 w-12 items-center justify-center rounded-md',
                      isLight ? 'bg-slate-900/5' : 'bg-black/25',
                    ].join(' ')}
                  >
                    <img
                      src="/card-chip.png"
                      alt=""
                      className="h-8 w-auto rounded-sm object-contain drop-shadow-sm sm:h-9"
                      draggable={false}
                    />
                  </div>
                  {bank ? (
                    <img
                      src={bank.logo}
                      alt=""
                      title={bank.name}
                      className={logoClass}
                      draggable={false}
                    />
                  ) : (
                    <span className={binClass}>BIN</span>
                  )}
                </div>

                <div className="mt-1">
                  <span
                    className={`mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                  >
                    Kart numarası
                  </span>
                  <input
                    data-km-jump
                    value={values.card}
                    onChange={(e) => onCard(e.target.value)}
                    onBlur={() => {
                      setTyping(false);
                      onCardBlur?.();
                    }}
                    onFocus={() => {
                      setTyping(true);
                      showFront();
                    }}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="•••• •••• •••• ••••"
                    className={[
                      'w-full rounded-lg px-3 py-2.5 font-mono text-[1.05rem] tracking-[0.12em] outline-none ring-1 sm:text-[1.12rem]',
                      field,
                      cardFaulty || errors?.card ? errField : '',
                    ].join(' ')}
                  />
                  {errors?.card || cardFaulty ? (
                    <p className={`mt-1 text-[10px] font-semibold ${errText}`}>
                      {errors?.card || 'Kart numarası hatalı'}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                  <div className="min-w-0">
                    <span
                      className={`mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                    >
                      Kart sahibi
                    </span>
                    <input
                      ref={holderRef}
                      data-km-jump
                      value={values.holder}
                      onChange={(e) => onHolder(e.target.value)}
                      onBlur={() => setTyping(false)}
                      onFocus={() => {
                        setTyping(true);
                        showFront();
                      }}
                      autoComplete="cc-name"
                      placeholder="AD SOYAD"
                      className={[
                        'w-full rounded-lg px-3 py-2 text-[13px] font-bold tracking-wide outline-none ring-1',
                        field,
                        ink,
                        errors?.holder ? errField : '',
                      ].join(' ')}
                    />
                    {errors?.holder ? (
                      <p className={`mt-1 text-[10px] font-semibold ${errText}`}>{errors.holder}</p>
                    ) : null}
                  </div>
                  <div>
                    <span
                      className={`mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] ${muted}`}
                    >
                      SKT
                    </span>
                    <input
                      data-km-jump
                      value={values.expiry}
                      onChange={(e) => onExpiry(e.target.value)}
                      onBlur={() => {
                        setTyping(false);
                        onExpiryBlur?.();
                      }}
                      onFocus={() => {
                        setTyping(true);
                        showFront();
                      }}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="AA/YY"
                      className={[
                        'w-full rounded-lg px-2.5 py-2 text-center font-mono text-[13px] font-bold tabular-nums outline-none ring-1',
                        field,
                        expiryFaulty || errors?.expiry ? errField : '',
                        expiryOk
                          ? isLight
                            ? 'ring-emerald-400/60 text-emerald-700'
                            : 'ring-emerald-300/50 text-emerald-100'
                          : '',
                      ].join(' ')}
                    />
                    {errors?.expiry ? (
                      <p className={`mt-1 text-[10px] font-semibold ${errText}`}>{errors.expiry}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Arka */}
            <div
              className={`absolute inset-0 overflow-hidden rounded-[1.25rem] border ${borderFace} ${shadowFace}`}
              style={{
                background: faceBg,
                transform: 'rotateY(180deg)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div
                className={`mt-7 h-11 w-full ${isLight ? 'bg-slate-800/85' : 'bg-black/85'}`}
              />
              <div className="mt-6 px-5 sm:px-6">
                <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2.5 shadow-sm ring-1 ring-slate-200/80">
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
                      onBlur={() => setTyping(false)}
                      onFocus={() => {
                        setTyping(true);
                        setFlipped(true);
                      }}
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
                  <p className={`mt-2 text-[10px] font-semibold ${errText}`}>{errors.cvc}</p>
                ) : (
                  <p className={`mt-2 text-[10px] ${muted}`}>
                    Kartın arkasındaki 3–4 haneli güvenlik kodu
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between gap-2">
                  <p className={`truncate text-[11px] font-semibold tracking-wide ${ink}`}>
                    {displayName}
                  </p>
                  {bank ? (
                    <img
                      src={bank.logo}
                      alt=""
                      className={
                        isLight
                          ? 'h-7 max-w-[90px] object-contain'
                          : 'h-7 max-w-[90px] object-contain brightness-0 invert'
                      }
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
          Yazarken sabit · boş alanda sürükleyince soft 3D
        </p>
      </div>
    </div>
  );
}
