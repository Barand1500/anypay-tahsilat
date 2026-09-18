import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const MONTH_W = 272;
const MAX_MONTHS = 8;
/** Ham sürükleme (px) — sonraki ay ekle */
const ADD_THRESHOLD = 48;
/** Önceki ay / geri */
const PREV_THRESHOLD = 40;

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

type YM = { y: number; m: number };

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseKey(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(k: string) {
  if (!k) return '';
  const d = parseKey(k);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function startWeekday(y: number, m: number) {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function shiftMonth(ym: YM, delta: number): YM {
  const d = new Date(ym.y, ym.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function monthCells(y: number, m: number) {
  const total = daysInMonth(y, m);
  const start = startWeekday(y, m);
  const out: { key: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < start; i++) out.push({ key: `${y}-${m}-pad-${i}`, day: 0, inMonth: false });
  for (let d = 1; d <= total; d++) out.push({ key: toKey(y, m, d), day: d, inMonth: true });
  return out;
}

/**
 * Başta 1 ay. Sürükle / › ile sağdan yeni ay eklenir (2, 3, 4…).
 * Pan transform ref ile — React re-render yok, takılma yok.
 */
export function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<YM>(() => {
    const base = from ? parseKey(from) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  /** 0 = yalnızca 1 ay */
  const [span, setSpan] = useState(0);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [dragMode, setDragMode] = useState<'none' | 'select' | 'pan' | 'pending'>('none');
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const prevSpan = useRef(0);

  const panStart = useRef({ x: 0, y: 0, scroll: 0 });
  const pullRef = useRef(0);
  const selectMoved = useRef(false);
  const pendingDay = useRef<string | null>(null);
  const dragModeRef = useRef(dragMode);
  dragModeRef.current = dragMode;
  const spanRef = useRef(span);
  spanRef.current = span;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  const months = useMemo(() => {
    const list: YM[] = [];
    for (let i = 0; i <= span; i++) list.push(shiftMonth(anchor, i));
    return list;
  }, [anchor, span]);

  const count = months.length;

  const setPullVisual = useCallback((px: number) => {
    pullRef.current = px;
    const track = trackRef.current;
    if (track) track.style.transform = px ? `translate3d(${px}px,0,0)` : '';
  }, []);

  const clearPull = useCallback(() => {
    pullRef.current = 0;
    const track = trackRef.current;
    if (track) {
      track.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform = '';
      window.setTimeout(() => {
        if (track) track.style.transition = '';
      }, 300);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    const base = from ? parseKey(from) : new Date();
    setAnchor({ y: base.getFullYear(), m: base.getMonth() });
    setSpan(0);
    prevSpan.current = 0;
    setFreshKey(null);
    setDragMode('none');
    dragModeRef.current = 'none';
    pullRef.current = 0;
    // Açılışta kaydırma / transform sıfır
    requestAnimationFrame(() => {
      const strip = stripRef.current;
      const track = trackRef.current;
      if (strip) strip.scrollLeft = 0;
      if (track) {
        track.style.transition = '';
        track.style.transform = '';
      }
    });
  }, [open, from, to]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = Math.min(Math.max(MONTH_W + 12, count * MONTH_W + 12), window.innerWidth - 16);
    setPos({
      top: r.bottom + 8,
      left: Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8),
    });
  }, [open, count]);

  // Yalnızca ay eklendiğinde sağa kaydır — açılışta değil
  useEffect(() => {
    if (!open || !stripRef.current) return;
    if (span <= prevSpan.current) {
      prevSpan.current = span;
      return;
    }
    prevSpan.current = span;
    const el = stripRef.current;
    requestAnimationFrame(() => {
      el.scrollTo({ left: Math.max(0, el.scrollWidth - el.clientWidth), behavior: 'smooth' });
    });
  }, [open, span]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
      setDragMode('none');
      clearPull();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, clearPull]);

  const goNext = useCallback(() => {
    const s = spanRef.current;
    const a = anchorRef.current;
    if (s + 1 >= MAX_MONTHS) {
      const n = shiftMonth(a, 1);
      setAnchor(n);
      setFreshKey(`${shiftMonth(n, s).y}-${shiftMonth(n, s).m}`);
    } else {
      const next = s + 1;
      const added = shiftMonth(a, next);
      setSpan(next);
      setFreshKey(`${added.y}-${added.m}`);
    }
    clearPull();
  }, [clearPull]);

  const goPrev = useCallback(() => {
    setFreshKey(null);
    const s = spanRef.current;
    if (s > 0) setSpan(s - 1);
    else setAnchor((a) => shiftMonth(a, -1));
    clearPull();
  }, [clearPull]);

  const rangeStart = draftFrom && draftTo ? (draftFrom <= draftTo ? draftFrom : draftTo) : draftFrom;
  const rangeEnd = draftFrom && draftTo ? (draftFrom <= draftTo ? draftTo : draftFrom) : draftTo;

  function applyRange(a: string, b: string) {
    setDraftFrom(a <= b ? a : b);
    setDraftTo(a <= b ? b : a);
  }

  function beginPan(pointerId: number) {
    const strip = stripRef.current;
    if (!strip) return;
    setDragMode('pan');
    dragModeRef.current = 'pan';
    pendingDay.current = null;
    try {
      strip.setPointerCapture(pointerId);
    } catch {
      /* */
    }
    if (trackRef.current) trackRef.current.style.transition = 'none';
  }

  function applyPanDelta(dx: number) {
    const strip = stripRef.current;
    if (!strip) return;
    const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const nextScroll = panStart.current.scroll - dx;

    if (nextScroll < 0) {
      strip.scrollLeft = 0;
      // Sağa çek → önceki; sola aşırı çek → sonraki ay peeki
      setPullVisual(Math.min(64, -nextScroll * 0.62));
    } else if (nextScroll > maxScroll) {
      strip.scrollLeft = maxScroll;
      const over = nextScroll - maxScroll;
      setPullVisual(-Math.min(110, over * 0.62));
    } else {
      strip.scrollLeft = nextScroll;
      setPullVisual(0);
    }
  }

  function finishPan() {
    const p = pullRef.current;
    if (p <= -ADD_THRESHOLD) goNext();
    else if (p >= PREV_THRESHOLD) goPrev();
    else clearPull();
    setDragMode('none');
    dragModeRef.current = 'none';
  }

  function onStripPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const strip = stripRef.current;
    if (!strip) return;
    panStart.current = { x: e.clientX, y: e.clientY, scroll: strip.scrollLeft };
    const onDay = (e.target as HTMLElement).closest('[data-cal-day]');
    if (onDay) return; // gün kendi handler'ında
    beginPan(e.pointerId);
  }

  function onStripPointerMove(e: PointerEvent) {
    const mode = dragModeRef.current;
    if (mode === 'none') return;

    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;

    // Gün üstünden başladıysa: yatay kaydırma → pan, dikey/az hareket → seçim
    if (mode === 'pending') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) >= Math.abs(dy) * 1.15 && Math.abs(dx) >= 10) {
        beginPan(e.pointerId);
        applyPanDelta(dx);
        return;
      }
      // seçim moduna geç
      const day = pendingDay.current;
      if (day) {
        setDragMode('select');
        dragModeRef.current = 'select';
        setRangeAnchor(day);
        setDraftFrom(day);
        setDraftTo(day);
        selectMoved.current = Math.abs(dx) > 4 || Math.abs(dy) > 4;
      }
      return;
    }

    if (mode === 'pan') {
      applyPanDelta(dx);
      return;
    }

    if (mode === 'select' && rangeAnchor) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) selectMoved.current = true;
      const strip = stripRef.current;
      if (!strip) return;
      const r = strip.getBoundingClientRect();
      const edge = 36;
      if (e.clientX > r.right - edge) {
        strip.scrollLeft += 14;
        if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2) {
          const n = Math.max(pullRef.current - 6, -90);
          setPullVisual(n);
          if (n <= -ADD_THRESHOLD) goNext();
        }
      } else if (e.clientX < r.left + edge) {
        strip.scrollLeft -= 14;
        if (strip.scrollLeft <= 2) {
          const n = Math.min(pullRef.current + 6, 56);
          setPullVisual(n);
          if (n >= PREV_THRESHOLD) goPrev();
        }
      } else if (pullRef.current !== 0) {
        setPullVisual(0);
      }
    }
  }

  function onStripPointerUp(e: PointerEvent) {
    const mode = dragModeRef.current;
    const strip = stripRef.current;
    if (mode === 'pan') {
      try {
        strip?.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      finishPan();
      return;
    }
    if (mode === 'pending') {
      // tık = tek gün seç
      const day = pendingDay.current;
      if (day) {
        if (!draftFrom || (draftFrom && draftTo && draftFrom !== draftTo)) {
          setDraftFrom(day);
          setDraftTo('');
          setRangeAnchor(day);
        } else if (draftFrom && !draftTo) {
          applyRange(draftFrom, day);
        } else {
          setDraftFrom(day);
          setDraftTo('');
        }
      }
      pendingDay.current = null;
      setDragMode('none');
      dragModeRef.current = 'none';
      return;
    }
    setDragMode('none');
    dragModeRef.current = 'none';
  }

  function onDayDown(key: string, e: PointerEvent) {
    e.stopPropagation();
    const strip = stripRef.current;
    pendingDay.current = key;
    selectMoved.current = false;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scroll: strip?.scrollLeft ?? 0,
    };
    setDragMode('pending');
    dragModeRef.current = 'pending';
    try {
      strip?.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }

  function onDayEnter(key: string) {
    if (dragModeRef.current !== 'select' || !rangeAnchor) return;
    applyRange(rangeAnchor, key);
    selectMoved.current = true;
  }

  function onDayUp(key: string, e: PointerEvent) {
    const mode = dragModeRef.current;
    if (mode === 'pan') {
      onStripPointerUp(e);
      return;
    }
    if (mode === 'pending') {
      onStripPointerUp(e);
      return;
    }
    try {
      stripRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* */
    }
    if (mode === 'select' && rangeAnchor) {
      if (!selectMoved.current) {
        if (!draftFrom || (draftFrom && draftTo && draftFrom !== draftTo)) {
          setDraftFrom(key);
          setDraftTo('');
          setRangeAnchor(key);
        } else if (draftFrom && !draftTo) {
          applyRange(draftFrom, key);
        } else {
          setDraftFrom(key);
          setDraftTo('');
        }
      } else {
        applyRange(rangeAnchor, key);
      }
    }
    const p = pullRef.current;
    if (p <= -ADD_THRESHOLD) goNext();
    else if (p >= PREV_THRESHOLD) goPrev();
    else clearPull();
    setDragMode('none');
    dragModeRef.current = 'none';
  }

  function commit() {
    onChange(rangeStart || '', rangeEnd || rangeStart || '');
    setOpen(false);
  }

  function clear() {
    setDraftFrom('');
    setDraftTo('');
    onChange('', '');
    setOpen(false);
  }

  const hasRange = !!(from && to);
  const label = hasRange
    ? from === to
      ? formatShort(from)
      : `${formatShort(from)} – ${formatShort(to)}`
    : null;

  const panelW = Math.min(
    Math.max(MONTH_W + 12, count * MONTH_W + 12),
    typeof window !== 'undefined' ? window.innerWidth - 16 : 300,
  );
  const first = months[0];
  const last = months[months.length - 1];

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        data-km-jump
        title={label || 'Tarih aralığı'}
        aria-label="Tarih aralığı seç"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-sm transition',
          open || hasRange
            ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-elevated))] text-[var(--color-brand-700)]'
            : 'border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
        ].join(' ')}
      >
        <CalendarIcon />
        {label ? (
          <span className="hidden max-w-[140px] truncate text-xs font-semibold tabular-nums sm:inline">
            {label}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[12000] select-none overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ top: pos.top, left: pos.left, width: panelW }}
            >
              <div className="flex items-center justify-between border-b border-[var(--panel-line)] px-3 py-2">
                <button
                  type="button"
                  aria-label="Önceki ay"
                  onClick={goPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                >
                  ‹
                </button>
                <p className="text-sm font-bold text-[var(--panel-ink)]">
                  {MONTHS[first.m]} {first.y}
                  {count > 1 ? (
                    <span className="font-medium text-[var(--panel-muted)]">
                      {' '}
                      – {MONTHS[last.m]} {last.y}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  aria-label="Sonraki ay"
                  onClick={goNext}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                >
                  ›
                </button>
              </div>

              <div
                ref={stripRef}
                className="touch-pan-x overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onPointerDown={onStripPointerDown}
                onPointerMove={onStripPointerMove}
                onPointerUp={onStripPointerUp}
                onPointerCancel={onStripPointerUp}
                style={{ cursor: dragMode === 'pan' ? 'grabbing' : 'grab' }}
              >
                <div
                  ref={trackRef}
                  className="flex will-change-transform"
                  style={{ width: count * MONTH_W }}
                >
                  {months.map((ym) => (
                    <div
                      key={`${ym.y}-${ym.m}`}
                      className={freshKey === `${ym.y}-${ym.m}` ? 'cal-month-in' : ''}
                      style={{ width: MONTH_W, flexShrink: 0 }}
                    >
                      <MonthPane
                        y={ym.y}
                        m={ym.m}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        onDayDown={onDayDown}
                        onDayEnter={onDayEnter}
                        onDayUp={onDayUp}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[var(--panel-line)] px-3 py-2">
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs font-semibold text-[var(--panel-muted)] hover:text-rose-600"
                >
                  Temizle
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums text-[var(--panel-muted)]">
                    {rangeStart
                      ? rangeEnd && rangeEnd !== rangeStart
                        ? `${formatShort(rangeStart)} – ${formatShort(rangeEnd)}`
                        : formatShort(rangeStart)
                      : '—'}
                  </span>
                  <button
                    type="button"
                    disabled={!rangeStart}
                    onClick={commit}
                    className="rounded-lg bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Uygula
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MonthPane({
  y,
  m,
  rangeStart,
  rangeEnd,
  onDayDown,
  onDayEnter,
  onDayUp,
  ghost,
}: {
  y: number;
  m: number;
  rangeStart: string;
  rangeEnd: string;
  onDayDown: (key: string, e: PointerEvent) => void;
  onDayEnter: (key: string) => void;
  onDayUp: (key: string, e: PointerEvent) => void;
  ghost?: boolean;
}) {
  const cells = useMemo(() => monthCells(y, m), [y, m]);

  return (
    <div className="px-2.5 pb-2 pt-2">
      <div className="mb-1.5 text-center text-xs font-bold text-[var(--panel-ink)]">
        {MONTHS[m]} {y}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[var(--panel-muted)]">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={i >= 5 ? 'text-rose-500/80' : ''}>
            {w}
          </span>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {cells.map((c) => {
          if (!c.inMonth) return <span key={c.key} className="h-8" />;
          const inRange =
            !!rangeStart && !!rangeEnd && c.key >= rangeStart && c.key <= rangeEnd;
          const isEdge = c.key === rangeStart || c.key === rangeEnd;
          return (
            <button
              key={c.key}
              type="button"
              data-cal-day
              disabled={ghost}
              onPointerDown={(e) => {
                if (ghost) return;
                e.preventDefault();
                onDayDown(c.key, e);
              }}
              onPointerEnter={() => onDayEnter(c.key)}
              onPointerUp={(e) => onDayUp(c.key, e)}
              className={[
                'h-8 rounded-lg text-[13px] font-medium transition',
                isEdge
                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                  : inRange
                    ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_22%,transparent)] text-[var(--panel-ink)]'
                    : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
              ].join(' ')}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
