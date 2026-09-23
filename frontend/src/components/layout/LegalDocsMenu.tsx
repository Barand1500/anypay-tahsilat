import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadContracts } from '../../pages/definitions/mockContracts';
import { LEGAL_DOCS, type LegalDoc } from './legalDocs';
import { LegalDocModal } from './LegalDocModal';

const PANEL_W = 280;

/**
 * Footer “Sözleşmeler” — profil menüsü gibi yukarı açılır; madde → modal.
 * Sıra Tanımlamalar › Sözleşmeler listesinden gelir.
 */
export function LegalDocsMenu() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 72, left: 8 });
  const [active, setActive] = useState<LegalDoc | null>(null);
  const [tick, setTick] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const docs = useMemo(() => {
    const contracts = loadContracts().filter((c) => c.link !== 'none');
    const byLink = new Map(LEGAL_DOCS.map((d) => [d.id, d]));
    const ordered: LegalDoc[] = [];
    for (const c of contracts) {
      const base = byLink.get(c.link as LegalDoc['id']);
      if (!base) continue;
      ordered.push({ ...base, title: c.name || base.title });
      byLink.delete(c.link as LegalDoc['id']);
    }
    for (const rest of byLink.values()) ordered.push(rest);
    return ordered;
  }, [tick, open]);

  function updatePos() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8);
    setPos({
      bottom: window.innerHeight - r.top + 10,
      left: Math.max(8, left),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      updatePos();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !active) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const items = Array.from(panel.querySelectorAll('[data-menu-item]'));
    gsap.set(panel, { transformOrigin: 'bottom right' });
    gsap.set(items, { autoAlpha: 0, y: 8 });
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      panel,
      { autoAlpha: 0, y: 12, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32 },
    ).to(items, { autoAlpha: 1, y: 0, duration: 0.26, stagger: 0.035 }, '-=0.14');

    if (btnRef.current) {
      gsap.fromTo(
        btnRef.current,
        { scale: 1 },
        { scale: 1.05, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' },
      );
    }

    return () => {
      tl.kill();
    };
  }, [open]);

  function openDoc(doc: LegalDoc) {
    setOpen(false);
    setActive(doc);
  }

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed z-[10050] w-[280px] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
            style={{ bottom: pos.bottom, left: pos.left }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--panel-line)] px-4 py-3" data-menu-item>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-600)]">
                Yasal
              </p>
              <p className="text-sm font-bold text-[var(--panel-ink)]">Sözleşmeler</p>
            </div>
            <ul className="max-h-[min(60vh,420px)] overflow-y-auto py-1.5">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    role="menuitem"
                    data-menu-item
                    data-km-jump
                    onClick={() => openDoc(doc)}
                    className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-[var(--panel-hover)]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--panel-surface)] text-[var(--panel-muted)]">
                      <DocSmIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug text-[var(--panel-ink)]">
                        {doc.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--panel-muted)]">
                        {doc.subtitle}
                      </span>
                    </span>
                    <span className="mt-1 text-[var(--panel-muted)]">
                      <ChevronIcon />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-km-jump
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setTick((t) => t + 1);
          setOpen((v) => !v);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={[
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition',
          open
            ? 'border-[var(--color-brand-500)]/45 bg-[var(--brand-soft-bg)] text-[var(--color-brand-700)]'
            : 'border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]/40 hover:text-[var(--color-brand-600)]',
        ].join(' ')}
      >
        <DocSmIcon />
        Sözleşmeler
        <span className={['transition', open ? 'rotate-180' : ''].join(' ')}>
          <ChevronUpIcon />
        </span>
      </button>

      {panel}

      {active ? <LegalDocModal doc={active} onClose={() => setActive(null)} /> : null}
    </>
  );
}

function DocSmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
