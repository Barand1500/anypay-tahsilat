import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  defById,
  loadQuickActionIds,
  QUICK_ACTION_CATALOG,
  QUICK_SLOTS,
  saveQuickActionIds,
  type QuickActionDef,
  type QuickActionId,
} from '../../pages/overview/mockQuickActions';

const TONE: Record<
  QuickActionDef['tone'],
  { card: string; icon: string }
> = {
  orange: {
    card: 'bg-orange-500/10 hover:bg-orange-500/15',
    icon: 'bg-orange-500/15 text-orange-600',
  },
  slate: {
    card: 'bg-[var(--panel-surface)] hover:bg-[var(--panel-hover)]',
    icon: 'bg-[var(--panel-hover)] text-[var(--panel-ink)]',
  },
  blue: {
    card: 'bg-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)]',
    icon: 'bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]',
  },
  green: {
    card: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    icon: 'bg-emerald-500/15 text-emerald-600',
  },
  rose: {
    card: 'bg-rose-500/10 hover:bg-rose-500/15',
    icon: 'bg-rose-500/15 text-rose-600',
  },
  violet: {
    card: 'bg-violet-500/10 hover:bg-violet-500/15',
    icon: 'bg-violet-500/15 text-violet-600',
  },
};

/**
 * Özet — Hızlı İşlemler (4 slot, çark ile düzenle).
 */
export function QuickActionsPanel() {
  const [ids, setIds] = useState<(QuickActionId | null)[]>(() => loadQuickActionIds());
  const [editOpen, setEditOpen] = useState(false);
  const [pickSlot, setPickSlot] = useState<number | null>(null);

  function persist(next: (QuickActionId | null)[]) {
    setIds(next);
    saveQuickActionIds(next);
  }

  function clearSlot(i: number) {
    const next = [...ids];
    next[i] = null;
    persist(next);
  }

  function assignSlot(i: number, id: QuickActionId) {
    const next = ids.map((x) => (x === id ? null : x));
    next[i] = id;
    persist(next);
    setPickSlot(null);
  }

  return (
    <section className="flex h-full min-h-[220px] flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600">
            <BoltIcon />
          </span>
          <h2 className="text-sm font-bold text-[var(--panel-ink)]">Hızlı İşlemler</h2>
        </div>
        <button
          type="button"
          data-km-jump
          aria-label="Hızlı işlemleri düzenle"
          title="Düzenle"
          onClick={() => {
            setPickSlot(null);
            setEditOpen(true);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
        >
          <GearIcon />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2.5">
        {Array.from({ length: QUICK_SLOTS }, (_, i) => {
          const id = ids[i];
          const def = id ? defById(id) : null;
          if (!def) {
            return (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => {
                  setEditOpen(true);
                  setPickSlot(i);
                }}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/40 text-[var(--panel-muted)] transition hover:border-[var(--color-brand-500)] hover:text-[var(--brand-on-soft)]"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-[10px] font-medium">Ekle</span>
              </button>
            );
          }
          const tone = TONE[def.tone];
          return (
            <Link
              key={def.id}
              to={def.to}
              data-km-jump
              className={['flex min-h-[72px] items-center gap-2.5 rounded-xl px-3 py-2.5 transition', tone.card].join(
                ' ',
              )}
            >
              <span
                className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone.icon].join(
                  ' ',
                )}
              >
                <ActionIcon name={def.icon} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[var(--panel-ink)]">
                  {def.title}
                </span>
                <span className="block truncate text-[11px] text-[var(--panel-muted)]">{def.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {editOpen ? (
        <QuickActionsModal
          ids={ids}
          pickSlot={pickSlot}
          onClose={() => {
            setEditOpen(false);
            setPickSlot(null);
          }}
          onClear={clearSlot}
          onAssign={assignSlot}
          onPickSlot={setPickSlot}
        />
      ) : null}
    </section>
  );
}

function QuickActionsModal({
  ids,
  pickSlot,
  onClose,
  onClear,
  onAssign,
  onPickSlot,
}: {
  ids: (QuickActionId | null)[];
  pickSlot: number | null;
  onClose: () => void;
  onClear: (i: number) => void;
  onAssign: (i: number, id: QuickActionId) => void;
  onPickSlot: (i: number | null) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out' },
    );
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const used = new Set(ids.filter(Boolean));
  const target = pickSlot ?? ids.findIndex((x) => x == null);
  const slotIndex = target >= 0 ? target : 0;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(560px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--panel-line)] px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Hızlı işlemleri düzenle</h2>
            <p className="text-xs text-[var(--panel-muted)]">4 yuvaya kısayol ekleyin veya çıkarın.</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            ×
          </button>
        </div>

        <div className="border-b border-[var(--panel-line)] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
            Yuvalar
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ids.map((id, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickSlot(i)}
                className={[
                  'rounded-xl border px-2 py-2 text-center text-[11px] font-semibold transition',
                  pickSlot === i
                    ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] text-[var(--brand-on-soft)]'
                    : 'border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                ].join(' ')}
              >
                {id ? defById(id).title.split(' ')[0] : `+ ${i + 1}`}
              </button>
            ))}
          </div>
          {ids[slotIndex] ? (
            <button
              type="button"
              onClick={() => onClear(slotIndex)}
              className="mt-2 text-xs font-semibold text-rose-500 hover:underline"
            >
              Seçili yuvayı boşalt
            </button>
          ) : null}
        </div>

        <ul className="flex-1 overflow-y-auto p-2">
          {QUICK_ACTION_CATALOG.map((c) => {
            const on = used.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={on && ids[slotIndex] !== c.id}
                  onClick={() => onAssign(slotIndex, c.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                    on && ids[slotIndex] !== c.id
                      ? 'opacity-40'
                      : 'hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      TONE[c.tone].icon,
                    ].join(' ')}
                  >
                    <ActionIcon name={c.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--panel-ink)]">{c.title}</span>
                    <span className="block text-[11px] text-[var(--panel-muted)]">{c.hint}</span>
                  </span>
                  {on ? (
                    <span className="text-[10px] font-semibold text-[var(--brand-on-soft)]">Seçili</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[var(--panel-muted)]">Ekle</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 10-14h-7l1-6Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.998 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActionIcon({ name }: { name: QuickActionDef['icon'] }) {
  const c = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'plus':
      return (
        <svg {...c}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'user':
      return (
        <svg {...c}>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 19c0-3.2 3.1-5.5 7-5.5s7 2.3 7 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'link':
      return (
        <svg {...c}>
          <path
            d="M9 12a4 4 0 0 1 0-5.7l1.4-1.4a4 4 0 0 1 5.7 5.7L15 12"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M15 12a4 4 0 0 1 0 5.7l-1.4 1.4a4 4 0 0 1-5.7-5.7L9 12"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'chart':
      return (
        <svg {...c}>
          <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 15v-4M12 15V8M16 15v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'pay':
      return (
        <svg {...c}>
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case 'logs':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'users':
      return (
        <svg {...c}>
          <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="16" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 19c0-2.5 2.5-4.5 6-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
