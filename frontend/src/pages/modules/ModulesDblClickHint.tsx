import gsap from 'gsap';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  targetRef: RefObject<HTMLElement | null>;
};

/**
 * Her Modüller ziyaretinde kısa ipucu: imleç + çift tık + balon.
 * Fare/scroll/tuş ile temiz kapanır.
 */
export function ModulesDblClickHint({ targetRef }: Props) {
  const [show, setShow] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const [bubblePos, setBubblePos] = useState({ top: 120, left: 120 });

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let cancelled = false;
    let tries = 0;

    function waitForRow() {
      if (cancelled) return;
      if (targetRef.current) {
        setShow(true);
        return;
      }
      tries += 1;
      if (tries < 60) window.setTimeout(waitForRow, 50);
    }

    const start = window.setTimeout(waitForRow, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [targetRef]);

  useEffect(() => {
    if (!show) return;

    let cancelled = false;
    let tl: gsap.core.Timeline | null = null;
    let frame = 0;

    function runWhenReady() {
      if (cancelled || doneRef.current) return;
      const target = targetRef.current;
      const cursor = cursorRef.current;
      if (!target || !cursor) {
        frame += 1;
        if (frame < 30) window.requestAnimationFrame(runWhenReady);
        return;
      }

      const r = target.getBoundingClientRect();
      const endX = r.left + Math.min(100, r.width * 0.32);
      const endY = r.top + r.height / 2;
      setBubblePos({
        top: Math.max(12, r.top - 10),
        left: Math.min(r.left + 20, window.innerWidth - 220),
      });

      gsap.set(cursor, { left: endX - 70, top: endY - 50, opacity: 0, scale: 0.9 });
      if (bubbleRef.current) gsap.set(bubbleRef.current, { opacity: 0, y: 6 });

      tl = gsap.timeline({ onComplete: () => finish() });
      tl.to(cursor, { opacity: 1, duration: 0.18, ease: 'power2.out' })
        .to(cursor, { left: endX, top: endY, duration: 0.5, ease: 'power2.inOut' })
        .to(cursor, { scale: 0.78, duration: 0.07, yoyo: true, repeat: 1 })
        .to(cursor, { scale: 0.78, duration: 0.07, yoyo: true, repeat: 1 }, '+=0.1')
        .add(() => {
          if (bubbleRef.current) {
            gsap.to(bubbleRef.current, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' });
          }
        })
        .to(cursor, { opacity: 0, duration: 0.22 }, '+=1.25')
        .to(bubbleRef.current, { opacity: 0, duration: 0.18 }, '-=0.12');
    }

    function onAbort() {
      tl?.kill();
      finish();
    }

    window.requestAnimationFrame(runWhenReady);
    window.addEventListener('pointerdown', onAbort, { once: true });
    window.addEventListener('wheel', onAbort, { once: true, passive: true });
    window.addEventListener('keydown', onAbort, { once: true });

    return () => {
      cancelled = true;
      tl?.kill();
      window.removeEventListener('pointerdown', onAbort);
      window.removeEventListener('wheel', onAbort);
      window.removeEventListener('keydown', onAbort);
    };

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      setShow(false);
    }
  }, [show, targetRef]);

  if (!show) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[11000]" aria-hidden data-km-ignore>
      <div ref={cursorRef} className="absolute" style={{ transform: 'translate(-4px, -2px)' }}>
        <CursorSvg />
      </div>
      <div
        ref={bubbleRef}
        className="absolute max-w-[200px] -translate-y-full rounded-2xl bg-[var(--panel-elevated)] px-3.5 py-2 text-sm font-medium text-[var(--panel-ink)] shadow-[0_12px_32px_rgba(0,0,0,0.18)] ring-1 ring-[var(--panel-line)]"
        style={{ top: bubblePos.top, left: bubblePos.left }}
      >
        Çift tıklayınca düzenlersiniz
        <span
          className="absolute left-6 top-full h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-[var(--panel-elevated)]"
          aria-hidden
        />
      </div>
    </div>,
    document.body,
  );
}

function CursorSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
      <path
        d="M5.5 3.5 18 12.2l-5.2 1.2 2.4 6.4-2.3.9-2.4-6.3-3.8 3.5V3.5Z"
        fill="#1a1d23"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
