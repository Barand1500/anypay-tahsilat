import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type ThemeMode } from '../../theme/ThemeProvider';

gsap.registerPlugin(useGSAP);

type ThemeFx = 'sunMoon' | 'ink' | 'flip';
const FX_ORDER: ThemeFx[] = ['sunMoon', 'ink', 'flip'];

/**
 * Gece/gündüz — efekt çifti: gece↔gündüz aynı animasyon,
 * tam tur bitince sıradaki efekte geçilir.
 * 1) Güneş/Ay  2) Ink damla  3) Widget 3D flip (rastgele sıra)
 */
export function ThemeBurstToggle() {
  const { theme, applyTheme } = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const fxIndexRef = useRef(0);
  /** 0 = çiftin ilk tıkı, 1 = ikinci (aynı efekt); sonra indeks artar */
  const pairStepRef = useRef(0);
  const [busy, setBusy] = useState(false);

  useGSAP(() => {});

  function onToggle() {
    if (busy) return;
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    const layer = layerRef.current;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !layer) {
      applyTheme(next);
      return;
    }

    const fx = FX_ORDER[fxIndexRef.current % FX_ORDER.length];
    pairStepRef.current += 1;
    if (pairStepRef.current >= 2) {
      pairStepRef.current = 0;
      fxIndexRef.current += 1;
    }

    setBusy(true);
    layer.innerHTML = '';
    layer.style.pointerEvents = 'auto';
    gsap.set(layer, { opacity: 1 });

    const finish = () => {
      layer.innerHTML = '';
      layer.style.pointerEvents = 'none';
      gsap.set(layer, { opacity: 0 });
      setBusy(false);
    };

    if (fx === 'sunMoon') runSunMoon(layer, next, applyTheme, finish);
    else if (fx === 'ink') runInkReveal(layer, next, applyTheme, finish);
    else if (fx === 'flip') runFlipCard(layer, next, applyTheme, finish);
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

/* ─── 1) Güneş / Ay ─────────────────────────────────────────── */

function runSunMoon(
  layer: HTMLDivElement,
  next: ThemeMode,
  applyTheme: (m: ThemeMode) => void,
  onDone: () => void,
) {
  const toDark = next === 'dark';
  const sky = toDark ? '#0b1220' : '#dce9f8';
  const glow = toDark ? '#9bb0d0' : '#ffc56a';

  const skyEl = document.createElement('div');
  skyEl.style.cssText = [
    'position:absolute',
    'inset:0',
    `background:${sky}`,
    'opacity:0',
    'will-change:opacity',
  ].join(';');
  layer.appendChild(skyEl);

  const glowEl = document.createElement('div');
  glowEl.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:42%',
    'width:min(78vw,460px)',
    'height:min(78vw,460px)',
    'margin-left:calc(min(78vw,460px) / -2)',
    'margin-top:calc(min(78vw,460px) / -2)',
    'border-radius:9999px',
    `background:radial-gradient(circle, ${glow}aa 0%, ${glow}44 34%, transparent 68%)`,
    'transform:scale(0.18)',
    'opacity:0',
    'will-change:transform,opacity',
  ].join(';');
  layer.appendChild(glowEl);

  const stage = document.createElement('div');
  stage.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:42%',
    'width:128px',
    'height:128px',
    'margin-left:-64px',
    'margin-top:-64px',
    'transform:scale(0.12)',
    'opacity:0',
    'will-change:transform,opacity',
    'filter:drop-shadow(0 10px 32px rgba(0,0,0,0.22))',
  ].join(';');
  stage.innerHTML = toDark ? celestialMoonSvg() : celestialSunSvg();
  layer.appendChild(stage);

  const tl = gsap.timeline({ onComplete: onDone });

  tl.to(skyEl, { opacity: 1, duration: 0.42, ease: 'power2.inOut' }, 0)
    .to(glowEl, { scale: 1, opacity: 1, duration: 0.72, ease: 'power3.out' }, 0.04)
    .to(stage, { scale: 1, opacity: 1, duration: 0.78, ease: 'power3.out' }, 0.06)
    .add(() => applyTheme(next), 0.36);

  if (toDark) {
    tl.fromTo(stage, { y: 42, rotation: -10 }, { y: 0, rotation: 0, duration: 0.85, ease: 'power2.out' }, 0.06);
  } else {
    const corona = stage.querySelector('[data-corona]');
    if (corona) {
      tl.fromTo(corona, { scale: 0.7, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' }, 0.06);
    }
  }

  tl.to(stage, { scale: 1.16, opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.98)
    .to(glowEl, { scale: 1.38, opacity: 0, duration: 0.34, ease: 'power2.in' }, 0.98)
    .to(skyEl, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 1.02);
}

function celestialSunSvg() {
  const uid = `sun-${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}-body" cx="32%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#fff8e8"/>
        <stop offset="38%" stop-color="#ffd056"/>
        <stop offset="72%" stop-color="#f0a020"/>
        <stop offset="100%" stop-color="#d97706"/>
      </radialGradient>
      <radialGradient id="${uid}-spot" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#e89a18"/>
        <stop offset="100%" stop-color="#c45f0a" stop-opacity="0.55"/>
      </radialGradient>
      <radialGradient id="${uid}-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd978" stop-opacity="0.45"/>
        <stop offset="55%" stop-color="#ffb83a" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#ffb83a" stop-opacity="0"/>
      </radialGradient>
      <filter id="${uid}-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g data-corona>
      <circle cx="64" cy="64" r="56" fill="url(#${uid}-halo)"/>
    </g>
    <circle cx="64" cy="64" r="36" fill="url(#${uid}-body)" filter="url(#${uid}-glow)"/>
    <circle cx="64" cy="64" r="36" fill="none" stroke="#ffe9b0" stroke-width="1.3" opacity="0.4"/>
    <circle cx="50" cy="52" r="7" fill="url(#${uid}-spot)" opacity="0.4"/>
    <circle cx="74" cy="46" r="4" fill="url(#${uid}-spot)" opacity="0.32"/>
    <circle cx="78" cy="70" r="9" fill="url(#${uid}-spot)" opacity="0.36"/>
    <circle cx="52" cy="76" r="3.4" fill="url(#${uid}-spot)" opacity="0.28"/>
    <ellipse cx="54" cy="48" rx="3.4" ry="1.7" fill="#fff8e0" opacity="0.45" transform="rotate(-28 54 48)"/>
  </svg>`;
}

function celestialMoonSvg() {
  const uid = `moon-${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}-body" cx="32%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#f7f9fc"/>
        <stop offset="48%" stop-color="#d7e0ee"/>
        <stop offset="100%" stop-color="#8fa0b8"/>
      </radialGradient>
      <radialGradient id="${uid}-crater" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#b8c4d6"/>
        <stop offset="100%" stop-color="#7e8fa8" stop-opacity="0.5"/>
      </radialGradient>
      <filter id="${uid}-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="64" cy="64" r="36" fill="url(#${uid}-body)" filter="url(#${uid}-glow)"/>
    <circle cx="64" cy="64" r="36" fill="none" stroke="#eef3fa" stroke-width="1.3" opacity="0.4"/>
    <circle cx="50" cy="52" r="8" fill="url(#${uid}-crater)" opacity="0.5"/>
    <circle cx="74" cy="46" r="4.5" fill="url(#${uid}-crater)" opacity="0.4"/>
    <circle cx="78" cy="72" r="10" fill="url(#${uid}-crater)" opacity="0.45"/>
    <circle cx="52" cy="78" r="3.6" fill="url(#${uid}-crater)" opacity="0.35"/>
    <ellipse cx="54" cy="48" rx="3.4" ry="1.7" fill="#ffffff" opacity="0.3" transform="rotate(-28 54 48)"/>
  </svg>`;
}

/* ─── 2) Ink — üstten damla → widget’a çarp → oradan yayıl ─── */

function pickDropTarget(): { x: number; y: number; el: HTMLElement | null } {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.panel-card, main article, main .rounded-2xl.border, main table, main [class*="rounded-2xl"]',
    ),
  );

  const visible = nodes.filter((el) => {
    if (el.closest('[data-logout-portal], [data-profile-panel], [aria-modal]')) return false;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    return (
      r.width * r.height >= 6000 &&
      r.width >= 72 &&
      r.height >= 48 &&
      r.top < vh - 48 &&
      r.bottom > 96 &&
      r.left < vw - 24 &&
      r.right > 24
    );
  });

  if (!visible.length) {
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.42, el: null };
  }

  const el = visible[Math.floor(Math.random() * visible.length)];
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width * (0.28 + Math.random() * 0.44),
    y: r.top + r.height * (0.22 + Math.random() * 0.4),
    el,
  };
}

function runInkReveal(
  layer: HTMLDivElement,
  next: ThemeMode,
  applyTheme: (m: ThemeMode) => void,
  onDone: () => void,
) {
  const toDark = next === 'dark';
  const fill = toDark ? '#0b1220' : '#e8f0fa';
  const dropColor = toDark ? '#152033' : '#ffffff';
  const gloss = toDark ? '#3a4d6a' : '#cfe0f2';
  const { x, y, el: hitEl } = pickDropTarget();
  const maxR =
    Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 80;

  let hitFlash: HTMLDivElement | null = null;
  if (hitEl) {
    const r = hitEl.getBoundingClientRect();
    hitFlash = document.createElement('div');
    hitFlash.style.cssText = [
      'position:fixed',
      `left:${r.left}px`,
      `top:${r.top}px`,
      `width:${r.width}px`,
      `height:${r.height}px`,
      `border-radius:${getComputedStyle(hitEl).borderRadius || '16px'}`,
      `box-shadow:inset 0 0 0 2px ${toDark ? '#60a5fa66' : '#3b82f688'}`,
      `background:${toDark ? 'rgba(15,20,30,0.2)' : 'rgba(255,255,255,0.4)'}`,
      'opacity:0',
      'pointer-events:none',
      'z-index:9998',
    ].join(';');
    document.body.appendChild(hitFlash);
  }

  const drop = document.createElement('div');
  drop.style.cssText = [
    'position:absolute',
    `left:${x}px`,
    'top:-56px',
    'width:28px',
    'height:40px',
    'margin-left:-14px',
    'will-change:transform,opacity',
    'filter:drop-shadow(0 6px 10px rgba(0,0,0,0.25))',
  ].join(';');
  drop.innerHTML = `<svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true">
    <defs>
      <linearGradient id="ink-drop-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${gloss}"/>
        <stop offset="45%" stop-color="${dropColor}"/>
        <stop offset="100%" stop-color="${fill}"/>
      </linearGradient>
    </defs>
    <path fill="url(#ink-drop-g)" d="M14 2C14 2 4 16 4 24a10 10 0 0 0 20 0C24 16 14 2 14 2Z"/>
    <ellipse cx="11" cy="22" rx="3.2" ry="4.5" fill="${toDark ? '#ffffff22' : '#ffffff99'}"/>
  </svg>`;
  layer.appendChild(drop);

  const trail = document.createElement('div');
  trail.style.cssText = [
    'position:absolute',
    `left:${x}px`,
    'top:0',
    'width:3px',
    'height:0',
    'margin-left:-1.5px',
    `background:linear-gradient(to bottom, transparent, ${dropColor}88)`,
    'border-radius:9999px',
    'opacity:0.55',
    'transform-origin:top center',
  ].join(';');
  layer.appendChild(trail);

  const diam = maxR * 2;
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
    `background:radial-gradient(circle, ${dropColor} 0%, ${fill} 42%, ${fill} 100%)`,
    'transform:scale(0)',
    'opacity:0',
    'will-change:transform,opacity',
  ].join(';');
  layer.appendChild(wave);

  const splashes: HTMLDivElement[] = [];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    const ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.35;
    const dist = 18 + Math.random() * 28;
    s.dataset.tx = String(Math.cos(ang) * dist);
    s.dataset.ty = String(Math.sin(ang) * dist * 0.75);
    const size = 5 + Math.random() * 7;
    s.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      `margin-left:${-size / 2}px`,
      `margin-top:${-size / 2}px`,
      'border-radius:9999px',
      `background:${dropColor}`,
      'opacity:0',
      'transform:scale(0)',
    ].join(';');
    layer.appendChild(s);
    splashes.push(s);
  }

  const fallDist = y + 56;
  const fallDur = Math.min(0.85, 0.38 + fallDist / 1400);

  const tl = gsap.timeline({
    onComplete: () => {
      hitFlash?.remove();
      onDone();
    },
  });

  tl.to(trail, { height: fallDist, duration: fallDur, ease: 'power2.in' }, 0)
    .to(drop, { y: fallDist, duration: fallDur, ease: 'power2.in' }, 0)
    .to(drop, { scaleX: 1.55, scaleY: 0.45, duration: 0.1, ease: 'power2.out' })
    .to(drop, { opacity: 0, scale: 0.2, duration: 0.12, ease: 'power1.in' }, '-=0.02')
    .to(trail, { opacity: 0, duration: 0.15 }, '<')
    .add(() => {
      if (hitFlash) gsap.to(hitFlash, { opacity: 1, duration: 0.18 });
    })
    .add(() => {
      splashes.forEach((s, i) => {
        gsap.to(s, {
          opacity: 1,
          scale: 1,
          x: Number(s.dataset.tx),
          y: Number(s.dataset.ty),
          duration: 0.28,
          delay: i * 0.015,
          ease: 'power2.out',
        });
        gsap.to(s, {
          opacity: 0,
          scale: 0.3,
          duration: 0.25,
          delay: 0.22 + i * 0.015,
          ease: 'power1.in',
        });
      });
    })
    .to(wave, { scale: 0.12, opacity: 1, duration: 0.22, ease: 'power2.out' }, '-=0.05')
    .to(wave, { scale: 1, duration: 0.72, ease: 'power3.inOut' })
    .add(() => applyTheme(next), '-=0.48')
    .add(() => {
      if (hitFlash) gsap.to(hitFlash, { opacity: 0, duration: 0.35 });
    }, '-=0.4')
    .to(wave, { opacity: 0, duration: 0.32, ease: 'power1.out' }, '-=0.12');
}

/* ─── 3) 3D flip — widget’lar tek tek döner; sayfa en sonda ─── */

const THEME_LOCAL: Record<
  ThemeMode,
  Record<string, string>
> = {
  light: {
    '--panel-bg': '#f3f6fa',
    '--panel-elevated': '#ffffff',
    '--panel-surface': '#eef2f7',
    '--panel-hover': '#e8eef6',
    '--panel-ink': '#1a1d23',
    '--panel-muted': '#6b7280',
    '--panel-line': '#e4ebf3',
    '--panel-shadow': '0 8px 24px rgba(26, 29, 35, 0.06)',
    '--chart-bg': '#f7f9fc',
    '--input-bg': '#ffffff',
    '--input-border': '#c5d4e8',
    '--brand-soft-bg': '#dbeafe',
    '--brand-on-soft': '#1d4ed8',
  },
  dark: {
    '--panel-bg': '#0f141b',
    '--panel-elevated': '#171e29',
    '--panel-surface': '#1c2430',
    '--panel-hover': '#222b38',
    '--panel-ink': '#e8eef6',
    '--panel-muted': '#9aa6b5',
    '--panel-line': '#2a3444',
    '--panel-shadow': '0 10px 28px rgba(0, 0, 0, 0.35)',
    '--chart-bg': '#121820',
    '--input-bg': '#171e29',
    '--input-border': '#2a3444',
    '--brand-soft-bg': '#1a2a44',
    '--brand-on-soft': '#93c5fd',
  },
};

function paintWidgetLocal(el: HTMLElement, mode: ThemeMode) {
  const vars = THEME_LOCAL[mode];
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
  el.style.backgroundColor = vars['--panel-elevated'];
  el.style.color = vars['--panel-ink'];
  el.style.borderColor = vars['--panel-line'];
  el.style.boxShadow = vars['--panel-shadow'];
}

function clearWidgetLocal(el: HTMLElement) {
  for (const k of Object.keys(THEME_LOCAL.light)) {
    el.style.removeProperty(k);
  }
  el.style.removeProperty('background-color');
  el.style.removeProperty('color');
  el.style.removeProperty('border-color');
  el.style.removeProperty('box-shadow');
}

function collectFlipTargets(): HTMLElement[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.panel-card, .panel-card-in, .chart-panel, main section.rounded-2xl.border, main article.rounded-2xl',
    ),
  );

  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];

  for (const el of nodes) {
    if (seen.has(el)) continue;
    if (el.closest('[data-logout-portal], [data-profile-panel], [aria-modal], [role="dialog"]')) continue;
    if (el.parentElement?.closest('.panel-card, .panel-card-in, .chart-panel')) continue;

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    if (r.width < 64 || r.height < 48) continue;
    if (r.bottom < 72 || r.top > vh - 24) continue;
    if (r.right < 24 || r.left > vw - 24) continue;

    seen.add(el);
    out.push(el);
  }

  return out;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function runFlipCard(
  layer: HTMLDivElement,
  next: ThemeMode,
  applyTheme: (m: ThemeMode) => void,
  onDone: () => void,
) {
  const targets = shuffleInPlace(collectFlipTargets());

  if (!targets.length) {
    applyTheme(next);
    breathePage(next, onDone);
    return;
  }

  layer.style.background = 'transparent';

  const restores: Array<() => void> = [];
  const half = 0.24;
  // Hafif gecikmeyle üst üste dönsün (birinin bitmesini beklemesin)
  const step = 0.11;

  const tl = gsap.timeline({
    onComplete: () => {
      // Önce global tema, sonra yerel boyaları temizle (flaş olmasın)
      applyTheme(next);
      targets.forEach(clearWidgetLocal);
      restores.forEach((fn) => fn());
      breathePage(next, onDone);
    },
  });

  targets.forEach((el, i) => {
    const prevTransition = el.style.transition;
    const prevOverflow = el.style.overflow;
    const prevTransform = el.style.transform;
    const prevWillChange = el.style.willChange;
    const prevZ = el.style.zIndex;

    el.style.transition = 'none';
    el.style.overflow = 'visible';
    el.style.willChange = 'transform';
    el.style.zIndex = String(30 + i);

    restores.push(() => {
      gsap.set(el, { clearProps: 'transform,transformPerspective,rotationY,rotateY' });
      el.style.transition = prevTransition;
      el.style.overflow = prevOverflow;
      el.style.transform = prevTransform;
      el.style.willChange = prevWillChange;
      el.style.zIndex = prevZ;
    });

    const t0 = i * step;

    tl.fromTo(
      el,
      { rotateY: 0, transformPerspective: 900, transformOrigin: '50% 50%' },
      {
        rotateY: 90,
        duration: half,
        ease: 'power2.in',
        onComplete: () => {
          // Bu widget yeni temaya boyanır; sayfa henüz değişmez
          paintWidgetLocal(el, next);
        },
      },
      t0,
    );

    tl.set(el, { rotateY: -90 }, t0 + half);
    tl.to(
      el,
      {
        rotateY: 0,
        duration: half + 0.04,
        ease: 'power2.out',
      },
      t0 + half,
    );
  });
}

/** Tüm widget’lar bittikten sonra sayfa nefes alarak temaya oturur */
function breathePage(next: ThemeMode, onDone: () => void) {
  const shell =
    document.querySelector<HTMLElement>('[data-app-shell]') ??
    document.querySelector<HTMLElement>('main') ??
    document.body;

  const veil = document.createElement('div');
  const tint = next === 'dark' ? 'rgba(11,18,32,0.22)' : 'rgba(255,255,255,0.28)';
  veil.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:9999',
    'pointer-events:none',
    `background:${tint}`,
    'opacity:0',
  ].join(';');
  document.body.appendChild(veil);

  const tl = gsap.timeline({
    onComplete: () => {
      veil.remove();
      gsap.set(shell, { clearProps: 'filter,scale' });
      onDone();
    },
  });

  tl.to(veil, { opacity: 1, duration: 0.2, ease: 'sine.out' }, 0)
    .fromTo(
      shell,
      { scale: 1, filter: 'brightness(1)' },
      {
        scale: 1.008,
        filter: 'brightness(1.04)',
        duration: 0.28,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1,
      },
      0.04,
    )
    .to(veil, { opacity: 0, duration: 0.32, ease: 'sine.inOut' }, 0.22);
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
