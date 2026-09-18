import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type ThemeMode } from '../../theme/ThemeProvider';

gsap.registerPlugin(useGSAP);

/**
 * Gece/gündüz — ikon yerinde kalır; tıklama noktasından venom dalga yayılır.
 */
export function ThemeBurstToggle() {
  const { theme, applyTheme } = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useGSAP(() => {});

  function onToggle() {
    if (busy) return;
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    const btn = btnRef.current;
    const layer = layerRef.current;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !btn || !layer) {
      applyTheme(next);
      return;
    }

    setBusy(true);
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxR = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const fill = next === 'dark' ? '#0b1220' : '#eef4fb';
    const soft = next === 'dark' ? '#152033' : '#ffffff';

    layer.innerHTML = '';
    layer.style.pointerEvents = 'auto';
    gsap.set(layer, { opacity: 1 });

    const diam = (maxR + 48) * 2;
    const wave = document.createElement('div');
    wave.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${diam}px`,
      `height:${diam}px`,
      `margin-left:${-diam / 2}px`,
      `margin-top:${-diam / 2}px`,
      'border-radius:9999px',
      `background:radial-gradient(circle, ${soft} 0%, ${fill} 52%, ${fill} 100%)`,
      'transform:scale(0)',
      'transform-origin:center center',
      'will-change:transform,opacity',
    ].join(';');
    layer.appendChild(wave);

    const blobs = [
      { ox: -0.18, oy: -0.08, delay: 0.03 },
      { ox: 0.16, oy: 0.14, delay: 0.06 },
      { ox: -0.06, oy: 0.2, delay: 0.09 },
    ].map((cfg) => {
      const el = document.createElement('div');
      el.className = 'theme-venom-blob';
      const size = maxR * 1.05;
      el.style.left = `${x + cfg.ox * maxR - size / 2}px`;
      el.style.top = `${y + cfg.oy * maxR - size / 2}px`;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = `radial-gradient(circle, ${soft}bb 0%, ${fill}88 48%, transparent 72%)`;
      layer.appendChild(el);
      gsap.set(el, { scale: 0.08, opacity: 0 });
      return { el, delay: cfg.delay };
    });

    const tl = gsap.timeline({
      onComplete: () => {
        layer.innerHTML = '';
        layer.style.pointerEvents = 'none';
        gsap.set(layer, { opacity: 0 });
        setBusy(false);
      },
    });

    tl.to(wave, { scale: 1, duration: 0.65, ease: 'power2.inOut' }, 0)
      .add(() => {
        blobs.forEach(({ el, delay }) => {
          gsap.to(el, {
            scale: 1.3,
            opacity: 0.85,
            duration: 0.55,
            delay,
            ease: 'power2.out',
          });
        });
      }, 0)
      .add(() => applyTheme(next), 0.28)
      .to(wave, { opacity: 0, duration: 0.28, ease: 'power1.out' })
      .to(
        blobs.map((b) => b.el),
        { opacity: 0, duration: 0.22, stagger: 0.02, ease: 'power1.in' },
        '-=0.18',
      );
  }

  const overlay =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={layerRef}
            className="pointer-events-none fixed inset-0 z-[10000] overflow-hidden opacity-0"
            aria-hidden
          />,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
        disabled={busy}
        onClick={onToggle}
        className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:opacity-60"
      >
        {theme === 'light' ? <SunIcon /> : <MoonIcon />}
      </button>
      {overlay}
    </>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
