import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

gsap.registerPlugin(useGSAP);

type Props = {
  open: boolean;
  toEmail?: string;
  onDone: () => void;
};

/** Şifre / giriş bilgisi gönderildiğinde uçan kurye + zarf animasyonu. */
export function PasswordCourierOverlay({ open, toEmail, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const craftRef = useRef<HTMLDivElement>(null);
  const bobRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useGSAP(
    () => {
      if (!open || !craftRef.current) return;

      const craft = craftRef.current;
      const bobEl = bobRef.current;
      const bubble = bubbleRef.current;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      gsap.set(craft, {
        x: -180,
        y: vh * 0.55,
        rotation: -8,
        scale: 0.72,
        autoAlpha: 0,
      });
      if (bobEl) gsap.set(bobEl, { y: 0 });
      if (bubble) gsap.set(bubble, { autoAlpha: 0, y: 8, scale: 0.92 });

      const tl = gsap.timeline({
        onComplete: () => {
          doneRef.current();
        },
      });

      if (reduced) {
        tl.to(craft, { autoAlpha: 1, duration: 0.2 })
          .to(bubble, { autoAlpha: 1, duration: 0.2 }, '<')
          .to(craft, { x: vw + 160, y: vh * 0.2, duration: 1.2, ease: 'power1.inOut' })
          .to([craft, bubble], { autoAlpha: 0, duration: 0.2 }, '-=0.25');
        return;
      }

      const bob =
        bobEl &&
        gsap.to(bobEl, {
          y: 10,
          duration: 0.48,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          paused: true,
        });

      tl.to(craft, {
        autoAlpha: 1,
        x: vw * 0.18,
        y: vh * 0.42,
        rotation: 4,
        scale: 0.95,
        duration: 0.85,
        ease: 'power2.out',
        onComplete: () => bob?.play(),
      })
        .to(
          bubble,
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.6)' },
          '-=0.35',
        )
        .to(craft, {
          x: vw * 0.34,
          y: vh * 0.24,
          rotation: -9,
          duration: 1.15,
          ease: 'sine.inOut',
        })
        .to(craft, {
          x: vw * 0.5,
          y: vh * 0.42,
          rotation: 10,
          duration: 1.05,
          ease: 'sine.inOut',
        })
        .to(
          bubble,
          { autoAlpha: 0, y: -10, scale: 0.94, duration: 0.35, ease: 'power1.in' },
          '-=0.45',
        )
        .to(craft, {
          x: vw * 0.72,
          y: vh * 0.14,
          rotation: -6,
          scale: 0.88,
          duration: 1.0,
          ease: 'sine.inOut',
        })
        .add(() => bob?.pause())
        .to(craft, {
          x: vw + 220,
          y: vh * 0.04,
          rotation: 14,
          scale: 0.7,
          autoAlpha: 0,
          duration: 0.85,
          ease: 'power2.in',
        });
    },
    { dependencies: [open], scope: rootRef, revertOnUpdate: true },
  );

  if (!open) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[10100] overflow-hidden"
      aria-live="polite"
      aria-label="Şifre gönderiliyor"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-300/5 to-transparent" />

      <div ref={craftRef} className="absolute left-0 top-0 will-change-transform">
        <div ref={bobRef} className="relative">
          <div
            ref={bubbleRef}
            className="absolute -top-16 left-1/2 z-10 w-[230px] -translate-x-1/2 rounded-2xl border border-sky-400/35 bg-[var(--panel-elevated)] px-3.5 py-2.5 shadow-[0_16px_40px_rgba(14,165,233,0.28)]"
          >
            <p className="text-center text-[13px] font-bold leading-snug text-[var(--panel-ink)]">
              Senin için şifreyi götürüyoruz
            </p>
            {toEmail ? (
              <p className="mt-1 truncate text-center text-[11px] text-[var(--panel-muted)]">
                {toEmail}
              </p>
            ) : null}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-sky-400/35 bg-[var(--panel-elevated)]" />
          </div>

          <CourierCraft />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CourierCraft() {
  return (
    <svg
      width="200"
      height="150"
      viewBox="0 0 200 150"
      fill="none"
      aria-hidden
      className="drop-shadow-[0_18px_28px_rgba(14,165,233,0.35)]"
    >
      <style>{`
        .courier-rotor { transform-origin: center; transform-box: fill-box; animation: courier-spin 0.28s linear infinite; }
        @keyframes courier-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .courier-rotor { animation-duration: 1s; }
        }
      `}</style>

      <path d="M100 78 V98" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      <g transform="translate(78,96)">
        <rect
          x="0"
          y="0"
          width="44"
          height="30"
          rx="4"
          fill="#f8fafc"
          stroke="#0ea5e9"
          strokeWidth="1.6"
        />
        <path
          d="M2 2 L22 16 L42 2"
          stroke="#0ea5e9"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M2 28 L18 14" stroke="#94a3b8" strokeWidth="1.2" />
        <path d="M42 28 L26 14" stroke="#94a3b8" strokeWidth="1.2" />
      </g>

      <ellipse cx="100" cy="58" rx="34" ry="12" fill="#e2e8f0" />
      <rect
        x="78"
        y="48"
        width="44"
        height="26"
        rx="8"
        fill="#cbd5e1"
        stroke="#94a3b8"
        strokeWidth="1.2"
      />
      <rect
        x="84"
        y="52"
        width="32"
        height="14"
        rx="4"
        fill="#0ea5e9"
        fillOpacity="0.35"
        stroke="#38bdf8"
        strokeWidth="1"
      />
      <path d="M88 78 L92 86 H108 L112 78" fill="#334155" />
      <path d="M86 86 H114" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />

      <ellipse cx="100" cy="44" rx="52" ry="10" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.4" />

      {[
        [70, 42],
        [130, 42],
        [78, 36],
        [122, 36],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle
            cx={cx}
            cy={cy}
            r="16"
            fill="#0f172a"
            fillOpacity="0.15"
            stroke="#38bdf8"
            strokeWidth="2.2"
          />
          <circle cx={cx} cy={cy} r="12" fill="#0ea5e9" fillOpacity="0.28" />
          <g className="courier-rotor" style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <ellipse cx={cx} cy={cy} rx="11" ry="2.2" fill="#e0f2fe" fillOpacity="0.95" />
            <ellipse cx={cx} cy={cy} rx="2.2" ry="11" fill="#bae6fd" fillOpacity="0.9" />
            <circle cx={cx} cy={cy} r="2.4" fill="#0284c7" />
          </g>
        </g>
      ))}

      <circle cx="100" cy="60" r="2.5" fill="#0369a1" />
    </svg>
  );
}
