import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** Silinecek satır id’leri (DOM’da data-log-id) */
  targetIds: string[];
  onDone: () => void;
};

/**
 * Onay sonrası: ortada el snap → seçili log satırları kare kare dağılıp solar.
 */
export function LogThanosSnap({ targetIds, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const debrisRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    };

    if (reduced || targetIds.length === 0) {
      finish();
      return;
    }

    const hand = handRef.current;
    const debrisHost = debrisRef.current;
    if (!hand || !debrisHost) {
      finish();
      return;
    }

    const rows = targetIds
      .map((id) => document.querySelector<HTMLElement>(`[data-log-id="${CSS.escape(id)}"]`))
      .filter((el): el is HTMLElement => !!el);

    const tl = gsap.timeline({ onComplete: finish });

    // El ortaya gelsin
    gsap.set(hand, { autoAlpha: 0, scale: 0.55, y: 24, rotate: -8 });
    tl.to(hand, {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      rotate: 0,
      duration: 0.38,
      ease: 'back.out(1.6)',
    })
      // Parmak şıklatma
      .to(hand, {
        scale: 1.08,
        rotate: 6,
        duration: 0.12,
        ease: 'power2.in',
      })
      .to(hand, {
        scale: 0.96,
        rotate: -4,
        duration: 0.1,
        ease: 'power2.out',
      })
      .to(hand, {
        scale: 1.02,
        rotate: 2,
        duration: 0.08,
        ease: 'power1.inOut',
      })
      // Kısa parıltı
      .to(
        hand.querySelector('[data-snap-flash]'),
        { autoAlpha: 1, scale: 1.4, duration: 0.12, ease: 'power2.out' },
        '-=0.05',
      )
      .to(hand.querySelector('[data-snap-flash]'), {
        autoAlpha: 0,
        scale: 2.2,
        duration: 0.35,
        ease: 'power2.out',
      });

    // Satırları parçala
    tl.add(() => {
      for (const row of rows) {
        shatterRow(row, debrisHost);
      }
    }, '-=0.1');

    // El solsun
    tl.to(
      hand,
      { autoAlpha: 0, scale: 0.7, y: -10, duration: 0.45, ease: 'power2.in' },
      '+=0.15',
    );

    // Debris bitsin
    tl.to({}, { duration: Math.min(1.8, 0.55 + rows.length * 0.08) });

    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIds]);

  return createPortal(
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[12000]"
      aria-hidden
      data-km-ignore
    >
      <div ref={debrisRef} className="absolute inset-0 overflow-hidden" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div ref={handRef} className="relative will-change-transform">
          <span
            data-snap-flash
            className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/50 opacity-0 blur-md"
          />
          <SnapHand />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function shatterRow(row: HTMLElement, host: HTMLElement) {
  const rect = row.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) {
    gsap.to(row, { autoAlpha: 0, duration: 0.35 });
    return;
  }

  const cols = Math.min(10, Math.max(5, Math.round(rect.width / 56)));
  const rows = Math.min(4, Math.max(2, Math.round(rect.height / 22)));
  const cellW = rect.width / cols;
  const cellH = rect.height / rows;

  // Orijinal satırı soluklaştır
  gsap.to(row, {
    autoAlpha: 0,
    filter: 'blur(2px)',
    duration: 0.45,
    ease: 'power1.out',
  });

  const bits: HTMLDivElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bit = document.createElement('div');
      bit.style.cssText = [
        'position:fixed',
        `left:${rect.left + c * cellW}px`,
        `top:${rect.top + r * cellH}px`,
        `width:${cellW + 0.5}px`,
        `height:${cellH + 0.5}px`,
        'border-radius:3px',
        'pointer-events:none',
        'z-index:12001',
        'will-change:transform,opacity',
        `background:color-mix(in srgb, var(--panel-elevated) 88%, var(--color-brand-500) ${8 + ((r + c) % 4) * 6}%)`,
        'box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--panel-line) 70%, transparent)',
      ].join(';');
      host.appendChild(bit);
      bits.push(bit);
    }
  }

  gsap.to(bits, {
    x: () => gsap.utils.random(-140, 160),
    y: () => gsap.utils.random(-90, 180),
    rotation: () => gsap.utils.random(-48, 48),
    scale: () => gsap.utils.random(0.25, 0.85),
    autoAlpha: 0,
    duration: () => gsap.utils.random(0.7, 1.35),
    stagger: { each: 0.012, from: 'random' },
    ease: 'power2.out',
    onComplete: () => {
      bits.forEach((b) => b.remove());
    },
  });
}

function SnapHand() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      className="drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
    >
      {/* Eldiven / el */}
      <path
        d="M38 70c-2-14 4-28 14-36 4-3 10-2 12 2l4 10c1-8 4-14 10-16 5-2 10 1 11 6l2 12c2-6 7-9 12-7 5 2 7 8 6 13l-1 9c3-3 8-3 11 1 3 4 2 10-1 13L92 98c-6 8-16 12-26 12H52c-10 0-18-7-20-16l-4-18Z"
        fill="url(#handGrad)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
      />
      {/* Snap kıvılcımı */}
      <circle cx="78" cy="48" r="6" fill="#c4b5fd" opacity="0.9" />
      <path
        d="M78 36v-6M78 66v-6M66 48h-6M96 48h-6M69 39l-4-4M91 57l-4-4M91 39l4-4M69 57l4-4"
        stroke="#a78bfa"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="handGrad" x1="40" y1="30" x2="95" y2="110">
          <stop stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#5b21b6" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>
      </defs>
    </svg>
  );
}
