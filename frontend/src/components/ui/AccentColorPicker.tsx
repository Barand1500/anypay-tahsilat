import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, type AccentColor } from '../../theme/ThemeProvider';

gsap.registerPlugin(useGSAP);

const OPTIONS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: 'blue', label: 'Mavi', swatch: '#2f80ed' },
  { id: 'green', label: 'Yeşil', swatch: '#16a34a' },
  { id: 'purple', label: 'Mor', swatch: '#a855f7' },
];

/** Panel vurgu rengi — seçim noktasından dairesel dalga tüm ekranı kaplar */
export function AccentColorPicker() {
  const { accent, applyAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {});

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = OPTIONS.find((o) => o.id === accent) ?? OPTIONS[0];

  function pick(next: AccentColor) {
    if (busy || next === accent) {
      setOpen(false);
      return;
    }
    setOpen(false);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = layerRef.current;
    const btn = btnRef.current;
    if (reduced || !layer || !btn) {
      applyAccent(next);
      return;
    }

    setBusy(true);
    const color = OPTIONS.find((o) => o.id === next)!.swatch;
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxR = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

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
      `background:${color}`,
      'transform:scale(0)',
      'transform-origin:center center',
      'will-change:transform,opacity',
    ].join(';');
    layer.appendChild(wave);

    const tl = gsap.timeline({
      onComplete: () => {
        layer.innerHTML = '';
        layer.style.pointerEvents = 'none';
        gsap.set(layer, { opacity: 0 });
        setBusy(false);
      },
    });

    tl.to(wave, {
      scale: 1,
      duration: 0.8,
      ease: 'power2.inOut',
    })
      .add(() => applyAccent(next), 0.4)
      .to(wave, { opacity: 0, duration: 0.32, ease: 'power1.out' });
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
      <div ref={rootRef} className="relative mt-auto pt-2">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className="flex w-full items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-brand-500)_35%,transparent)] bg-[var(--panel-elevated)] px-2.5 py-1.5 text-left transition hover:bg-[var(--panel-hover)]"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: current.swatch }}
          >
            <PaletteIcon />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[9px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
              Tema
            </span>
            <span className="block text-xs font-bold text-[var(--panel-ink)]">{current.label}</span>
          </span>
          <Chevron open={open} />
        </button>

        {open ? (
          <div className="absolute bottom-full left-0 z-30 mb-1 w-full min-w-[180px] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-2 shadow-[var(--panel-shadow)]">
            <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
              Panel vurgu rengi
            </p>
            <ul className="space-y-0.5">
              {OPTIONS.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => pick(o.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition',
                      o.id === accent
                        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_16%,transparent)] text-[var(--panel-ink)]'
                        : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                    ].join(' ')}
                  >
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: o.swatch }} />
                    <span className="flex-1 text-left">{o.label}</span>
                    {o.id === accent ? <Check color={o.swatch} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {overlay}
    </>
  );
}

function PaletteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H15a2 2 0 1 1 0-4h3A6 6 0 0 0 12 3Zm-4.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`text-[var(--panel-muted)] transition ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12 5 5L20 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
