import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

gsap.registerPlugin(useGSAP);

const STORAGE_KEY = 'anypay-overview-plan-board';

type CardKind = 'note' | 'list' | 'box';

type PlanCard = {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  title: string;
  body: string;
};

type PlanLink = { id: string; from: string; to: string };

type BoardState = {
  cards: PlanCard[];
  links: PlanLink[];
};

type EditTarget = { id: string; field: 'title' | 'body' };

const DEFAULT_BOARD: BoardState = {
  cards: [
    {
      id: 'c1',
      kind: 'box',
      x: 40,
      y: 90,
      title: 'Günlük plan',
      body: 'Öncelikler…',
    },
    {
      id: 'c2',
      kind: 'note',
      x: 260,
      y: 60,
      title: 'Not',
      body: 'Tahsilat takip',
    },
    {
      id: 'c3',
      kind: 'list',
      x: 260,
      y: 180,
      title: 'Liste',
      body: '• Banka mutabakatı\n• Müşteri aramaları\n• Rapor kontrol',
    },
    {
      id: 'c4',
      kind: 'box',
      x: 500,
      y: 110,
      title: 'Özet',
      body: 'Birleştir',
    },
  ],
  links: [
    { id: 'l1', from: 'c1', to: 'c2' },
    { id: 'l2', from: 'c1', to: 'c3' },
    { id: 'l3', from: 'c2', to: 'c4' },
    { id: 'l4', from: 'c3', to: 'c4' },
  ],
};

function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_BOARD);
    const parsed = JSON.parse(raw) as BoardState;
    if (!Array.isArray(parsed.cards) || !Array.isArray(parsed.links)) {
      return structuredClone(DEFAULT_BOARD);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_BOARD);
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Özet plan tahtası — not / liste, sürükle, bağla, pan, zoom, tam ekran.
 */
export function PlanBoard() {
  const shellRef = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const [board, setBoard] = useState<BoardState>(() => loadBoard());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);
  const pendingCardDrag = useRef<{
    id: string;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
    el: HTMLElement;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  }, [board]);

  useGSAP(
    () => {
      const el = shellRef.current;
      if (!el || entered.current) return;
      entered.current = true;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' },
      );
    },
    { scope: shellRef },
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (linkFrom) setLinkFrom(null);
        else if (editing) setEditing(null);
        else if (fullscreen) setFullscreen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen, linkFrom, editing]);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const stopEditIfOutside = useCallback((e: ReactFocusEvent, cardId: string) => {
    const next = e.relatedTarget as Node | null;
    const card = (e.currentTarget as HTMLElement).closest('[data-plan-card]');
    if (card && next && card.contains(next)) return;
    setEditing((cur) => (cur?.id === cardId ? null : cur));
  }, []);

  const onCardPointerDown = useCallback(
    (e: ReactPointerEvent, card: PlanCard) => {
      if (editing?.id === card.id) return;
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('[data-plan-action]') || t.closest('textarea, input, button')) return;
      e.stopPropagation();
      pendingCardDrag.current = {
        id: card.id,
        ox: card.x,
        oy: card.y,
        startX: e.clientX,
        startY: e.clientY,
        el: e.currentTarget as HTMLElement,
        pointerId: e.pointerId,
      };
    },
    [editing],
  );

  const onCanvasPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('[data-plan-card]') || t.closest('[data-plan-ui]')) return;
      if (editing) setEditing(null);
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        ox: pan.x,
        oy: pan.y,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y, editing],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const pending = pendingCardDrag.current;
      if (pending && !drag) {
        const dist = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
        if (dist >= 6) {
          pending.el.setPointerCapture(pending.pointerId);
          setDrag({
            id: pending.id,
            ox: pending.ox,
            oy: pending.oy,
            startX: pending.startX,
            startY: pending.startY,
          });
          pendingCardDrag.current = null;
        }
      }

      if (drag) {
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        setBoard((prev) => ({
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === drag.id
              ? { ...c, x: Math.max(8, drag.ox + dx), y: Math.max(8, drag.oy + dy) }
              : c,
          ),
        }));
        return;
      }
      if (panning) {
        setPan({
          x: panning.ox + (e.clientX - panning.startX),
          y: panning.oy + (e.clientY - panning.startY),
        });
      }
    },
    [drag, panning, zoom],
  );

  const onPointerUp = useCallback(() => {
    pendingCardDrag.current = null;
    setDrag(null);
    setPanning(null);
  }, []);

  function addCard(kind: Exclude<CardKind, 'box'>) {
    const base =
      kind === 'note'
        ? { title: 'Not', body: 'Yeni not…' }
        : { title: 'Liste', body: '• Madde 1\n• Madde 2' };
    const card: PlanCard = {
      id: uid('c'),
      kind,
      x: 48 + Math.random() * 120 - pan.x / zoom,
      y: 72 + Math.random() * 80 - pan.y / zoom,
      ...base,
    };
    setBoard((prev) => ({ ...prev, cards: [...prev.cards, card] }));
    setEditing({ id: card.id, field: 'body' });
  }

  function updateCard(id: string, patch: Partial<PlanCard>) {
    setBoard((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeCard(id: string) {
    setBoard((prev) => ({
      cards: prev.cards.filter((c) => c.id !== id),
      links: prev.links.filter((l) => l.from !== id && l.to !== id),
    }));
    if (linkFrom === id) setLinkFrom(null);
    if (editing?.id === id) setEditing(null);
  }

  function removeLink(id: string) {
    setBoard((prev) => ({ ...prev, links: prev.links.filter((l) => l.id !== id) }));
  }

  function onPortClick(cardId: string) {
    if (!linkFrom) {
      setLinkFrom(cardId);
      return;
    }
    if (linkFrom === cardId) {
      setLinkFrom(null);
      return;
    }
    setBoard((prev) => {
      const exists = prev.links.some(
        (l) =>
          (l.from === linkFrom && l.to === cardId) ||
          (l.from === cardId && l.to === linkFrom),
      );
      if (exists) {
        return {
          ...prev,
          links: prev.links.filter(
            (l) =>
              !(
                (l.from === linkFrom && l.to === cardId) ||
                (l.from === cardId && l.to === linkFrom)
              ),
          ),
        };
      }
      return {
        ...prev,
        links: [...prev.links, { id: uid('l'), from: linkFrom, to: cardId }],
      };
    });
    setLinkFrom(null);
  }

  function cardCenter(c: PlanCard) {
    const w = c.kind === 'list' ? 200 : 168;
    const h = c.kind === 'list' ? 120 : 88;
    return { cx: c.x + w / 2, cy: c.y + h / 2, w, h };
  }

  function linkPath(from: PlanCard, to: PlanCard) {
    const a = cardCenter(from);
    const b = cardCenter(to);
    const x1 = a.cx + a.w / 2 - 8;
    const y1 = a.cy;
    const x2 = b.cx - b.w / 2 + 8;
    const y2 = b.cy;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  const boardInner = (
    <div
      ref={shellRef}
      className={[
        'relative flex flex-col overflow-hidden border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]',
        fullscreen ? 'h-full w-full rounded-2xl' : 'h-[380px] rounded-2xl sm:h-[420px]',
      ].join(' ')}
    >
      <div
        data-plan-ui
        className="relative z-[2] flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-line)] px-3 py-2.5 sm:px-4"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Canlı plan
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolBtn onClick={() => addCard('note')} label="Not" />
          <ToolBtn onClick={() => addCard('list')} label="Liste" />
        </div>
      </div>

      <div
        className={[
          'relative z-[1] min-h-0 flex-1 overflow-hidden touch-none',
          panning ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
        style={dotGridStyle}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: 2400,
            height: 1600,
          }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {board.links.map((l) => {
              const from = board.cards.find((c) => c.id === l.from);
              const to = board.cards.find((c) => c.id === l.to);
              if (!from || !to) return null;
              const d = linkPath(from, to);
              return (
                <g key={l.id}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" />
                  <path
                    d={d}
                    fill="none"
                    stroke="color-mix(in srgb, var(--panel-ink) 30%, transparent)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="cursor-pointer hover:stroke-rose-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLink(l.id);
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {board.cards.map((card) => {
            const isEdit = editing?.id === card.id;
            return (
              <article
                key={card.id}
                data-plan-card
                data-km-row
                onPointerDown={(e) => onCardPointerDown(e, card)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if ((e.target as HTMLElement).closest('[data-plan-action]')) return;
                  const onTitle = Boolean((e.target as HTMLElement).closest('[data-plan-title]'));
                  setEditing({ id: card.id, field: onTitle ? 'title' : 'body' });
                }}
                className={[
                  'absolute rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_8px_28px_rgba(15,23,42,0.12)]',
                  isEdit ? 'select-text' : 'select-none',
                  drag?.id === card.id ? 'z-20 cursor-grabbing' : 'z-10 cursor-grab',
                  linkFrom === card.id ? 'ring-2 ring-[var(--color-brand-500)]' : '',
                  card.kind === 'list' ? 'w-[200px]' : 'w-[168px]',
                ].join(' ')}
                style={{ left: card.x, top: card.y }}
              >
                <button
                  type="button"
                  data-plan-action
                  aria-label="Bağla"
                  title="Bağlantı"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPortClick(card.id);
                  }}
                  className="absolute -left-1.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-[var(--panel-elevated)] bg-[var(--color-brand-500)]"
                />
                <button
                  type="button"
                  data-plan-action
                  aria-label="Bağla"
                  title="Bağlantı"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPortClick(card.id);
                  }}
                  className="absolute -right-1.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-[var(--panel-elevated)] bg-[var(--color-brand-500)]"
                />

                <div className="flex items-start justify-between gap-1 border-b border-[var(--panel-line)]/70 px-2.5 py-1.5">
                  {isEdit && editing.field === 'title' ? (
                    <input
                      data-plan-action
                      autoFocus
                      value={card.title}
                      onChange={(e) => updateCard(card.id, { title: e.target.value })}
                      onBlur={(e) => stopEditIfOutside(e, card.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditing({ id: card.id, field: 'body' });
                      }}
                      className="min-w-0 flex-1 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-1.5 py-0.5 text-xs font-bold text-[var(--panel-ink)] outline-none"
                    />
                  ) : (
                    <h3
                      data-plan-title
                      className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--panel-ink)]"
                    >
                      {card.title}
                    </h3>
                  )}
                  <button
                    type="button"
                    data-plan-action
                    aria-label="Sil"
                    onClick={() => removeCard(card.id)}
                    className="shrink-0 rounded p-0.5 text-[var(--panel-muted)] hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    ×
                  </button>
                </div>

                <div className="px-2.5 py-2">
                  {isEdit && editing.field === 'body' ? (
                    <textarea
                      data-plan-action
                      autoFocus
                      value={card.body}
                      onChange={(e) => updateCard(card.id, { body: e.target.value })}
                      onBlur={(e) => stopEditIfOutside(e, card.id)}
                      rows={card.kind === 'list' ? 5 : 4}
                      className="w-full resize-y rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-1.5 py-1 text-[11px] leading-relaxed text-[var(--panel-ink)] outline-none"
                    />
                  ) : (
                    <p className="min-h-[2.5rem] whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--panel-muted)]">
                      {card.body}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div
          data-plan-ui
          className="absolute bottom-3 left-3 z-30 flex flex-col overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]/95 shadow-sm backdrop-blur-sm"
        >
          <button
            type="button"
            data-km-jump
            aria-label="Yakınlaştır"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
            className="flex h-9 w-9 items-center justify-center text-sm font-bold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            +
          </button>
          <div className="h-px bg-[var(--panel-line)]" />
          <button
            type="button"
            data-km-jump
            aria-label="Uzaklaştır"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            className="flex h-9 w-9 items-center justify-center text-sm font-bold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            −
          </button>
        </div>

        <button
          type="button"
          data-plan-ui
          data-km-jump
          onClick={(e) => {
            e.stopPropagation();
            setFullscreen((v) => !v);
          }}
          className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-full border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--panel-ink)] shadow-md transition hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)]"
        >
          {fullscreen ? 'Küçült' : 'Tam ekran'}
          <ExpandIcon open={fullscreen} />
        </button>
      </div>
    </div>
  );

  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[10050] flex flex-col p-3 sm:p-5">
        <button
          type="button"
          aria-label="Kapat"
          className="absolute inset-0 bg-black/55"
          onClick={() => setFullscreen(false)}
        />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{boardInner}</div>
      </div>,
      document.body,
    );
  }

  return boardInner;
}

function ToolBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      data-km-jump
      onClick={onClick}
      className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)]"
    >
      + {label}
    </button>
  );
}

function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path
          d="M9 3H5v4M15 3h4v4M9 21H5v-4M15 21h4v-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M9 3H3v6M15 3h6v6M9 21H3v-6M21 15v6h-6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const dotGridStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle, color-mix(in srgb, var(--panel-ink) 14%, transparent) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
  backgroundColor: 'var(--panel-surface)',
};
