import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

gsap.registerPlugin(useGSAP);

export type ArchiveAnimPayload = {
  mode: 'in' | 'out';
  id: string;
  title: string;
  amountLabel: string;
  /** Satırın ekran dikdörtgeni */
  from: { left: number; top: number; width: number; height: number };
};

type Props = {
  payload: ArchiveAnimPayload | null;
  onDone: () => void;
};

/**
 * Arşiv kutusu animasyonu:
 * - in: satır küçülüp kutuya düşer, kapak kapanır, kutu aşağı kaybolur
 * - out: kutu yükselir, kapak açılır, kart yukarı fırlar
 */
export function ArchiveBoxOverlay({ payload, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const boxWrapRef = useRef<HTMLDivElement>(null);
  const lidRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useGSAP(
    () => {
      if (!payload || !cardRef.current || !boxWrapRef.current) return;

      const card = cardRef.current;
      const box = boxWrapRef.current;
      const lid = lidRef.current;
      const body = bodyRef.current;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const boxW = Math.min(220, vw * 0.55);
      const boxH = 120;
      const boxLeft = (vw - boxW) / 2;
      const boxTop = vh * 0.62;

      const tl = gsap.timeline({
        onComplete: () => doneRef.current(),
      });

      if (reduced) {
        tl.to({}, { duration: 0.35 });
        return;
      }

      if (payload.mode === 'in') {
        gsap.set(card, {
          position: 'fixed',
          left: payload.from.left,
          top: payload.from.top,
          width: payload.from.width,
          height: payload.from.height,
          autoAlpha: 1,
          scale: 1,
          rotation: 0,
          transformOrigin: '50% 50%',
          zIndex: 2,
        });
        gsap.set(box, {
          left: boxLeft,
          top: boxTop + 80,
          width: boxW,
          autoAlpha: 0,
          scale: 0.85,
        });
        if (lid) gsap.set(lid, { rotateX: 0, transformOrigin: '50% 100%' });

        tl.to(box, {
          autoAlpha: 1,
          top: boxTop,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.4)',
        })
          .to(lid, { rotateX: -118, duration: 0.35, ease: 'power2.out' }, '-=0.1')
          .to(
            card,
            {
              left: boxLeft + boxW * 0.12,
              top: boxTop - 8,
              width: boxW * 0.76,
              height: Math.min(payload.from.height, 52),
              scale: 0.92,
              rotation: -4,
              duration: 0.55,
              ease: 'power2.inOut',
            },
            '-=0.15',
          )
          .to(card, {
            top: boxTop + boxH * 0.28,
            scale: 0.55,
            rotation: 8,
            autoAlpha: 0.85,
            duration: 0.38,
            ease: 'power2.in',
          })
          .to(card, { autoAlpha: 0, scale: 0.35, duration: 0.18 }, '-=0.05')
          .to(lid, { rotateX: 0, duration: 0.32, ease: 'power2.in' }, '-=0.05')
          .to(body, { y: 4, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '-=0.12')
          .to(box, {
            top: vh + 40,
            autoAlpha: 0,
            scale: 0.9,
            duration: 0.55,
            ease: 'power2.in',
          });
        return;
      }

      // out — arşivden çıkar
      gsap.set(box, {
        left: boxLeft,
        top: vh + 30,
        width: boxW,
        autoAlpha: 1,
        scale: 0.92,
      });
      if (lid) gsap.set(lid, { rotateX: 0, transformOrigin: '50% 100%' });
      gsap.set(card, {
        position: 'fixed',
        left: boxLeft + boxW * 0.12,
        top: boxTop + boxH * 0.2,
        width: boxW * 0.76,
        height: 48,
        autoAlpha: 0,
        scale: 0.4,
        rotation: 6,
        zIndex: 2,
      });

      tl.to(box, {
        top: boxTop,
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
      })
        .to(lid, { rotateX: -118, duration: 0.35, ease: 'power2.out' }, '-=0.1')
        .to(card, { autoAlpha: 1, scale: 0.7, top: boxTop - 12, duration: 0.3, ease: 'back.out(1.5)' })
        .to(card, {
          left: payload.from.left,
          top: payload.from.top,
          width: payload.from.width,
          height: Math.min(payload.from.height, 72),
          scale: 1,
          rotation: 0,
          duration: 0.55,
          ease: 'power2.out',
        })
        .to(lid, { rotateX: 0, duration: 0.28, ease: 'power2.in' }, '-=0.35')
        .to(box, {
          top: vh + 40,
          autoAlpha: 0,
          duration: 0.4,
          ease: 'power2.in',
        }, '-=0.15')
        .to(card, { autoAlpha: 0, duration: 0.2 }, '-=0.15');
    },
    { dependencies: [payload], scope: rootRef, revertOnUpdate: true },
  );

  if (!payload) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-0 z-[10120] overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-slate-900/10" />

      <div
        ref={cardRef}
        className="overflow-hidden rounded-xl border border-sky-400/40 bg-[var(--panel-elevated)] px-3 py-2 shadow-[0_12px_32px_rgba(14,165,233,0.28)]"
      >
        <p className="truncate font-mono text-[12px] font-bold tabular-nums text-[var(--panel-ink)]">
          {payload.id}
        </p>
        <p className="truncate text-[11px] text-[var(--panel-muted)]">{payload.title}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-sky-600">{payload.amountLabel}</p>
      </div>

      <div
        ref={boxWrapRef}
        className="absolute"
        style={{ perspective: 900 }}
      >
        <div ref={bodyRef} className="relative">
          {/* Kapak */}
          <div
            ref={lidRef}
            className="absolute -top-3 left-0 right-0 z-20"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div
              className="mx-auto h-4 rounded-t-lg border border-amber-700/50 bg-gradient-to-b from-amber-500 to-amber-700 shadow-md"
              style={{ width: '100%' }}
            />
            <div className="mx-auto -mt-0.5 h-2 w-10 rounded-sm bg-amber-800/80" />
          </div>

          {/* Kutu gövdesi */}
          <div className="relative overflow-hidden rounded-xl border-2 border-amber-800/60 bg-gradient-to-b from-amber-600 to-amber-900 shadow-[0_16px_40px_rgba(120,53,15,0.45)]">
            <div className="flex h-[100px] flex-col items-center justify-end pb-3 pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/90">
                Arşiv
              </p>
              <div className="mt-2 h-1.5 w-16 rounded-full bg-amber-950/40" />
            </div>
            {/* İç gölge */}
            <div className="pointer-events-none absolute inset-x-2 top-2 bottom-8 rounded-lg bg-amber-950/25" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
