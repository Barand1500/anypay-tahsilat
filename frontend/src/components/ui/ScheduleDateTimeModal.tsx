import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type Props = {
  open: boolean;
  valueIso: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseIso(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) {
    const n = new Date();
    return {
      y: n.getFullYear(),
      m: n.getMonth(),
      day: n.getDate(),
      h: n.getHours(),
      min: n.getMinutes(),
    };
  }
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
    h: d.getHours(),
    min: d.getMinutes(),
  };
}

function monthCells(y: number, m: number) {
  const total = new Date(y, m + 1, 0).getDate();
  const startRaw = new Date(y, m, 1).getDay();
  const start = startRaw === 0 ? 6 : startRaw - 1;
  const out: { key: string; day: number; inMonth: boolean; weekend: boolean }[] = [];
  for (let i = 0; i < start; i++) {
    out.push({ key: `pad-${y}-${m}-${i}`, day: 0, inMonth: false, weekend: false });
  }
  for (let d = 1; d <= total; d++) {
    const wd = (start + d - 1) % 7;
    out.push({ key: toKey(y, m, d), day: d, inMonth: true, weekend: wd >= 5 });
  }
  return out;
}

/**
 * Hatırlatma tarih+saat — Esc / X; overlay kapatmaz.
 * Takvim + analog kadran yan yana.
 */
export function ScheduleDateTimeModal({ open, valueIso, onClose, onConfirm }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const initial = parseIso(valueIso);
  const [view, setView] = useState({ y: initial.y, m: initial.m });
  const [sel, setSel] = useState({ y: initial.y, m: initial.m, day: initial.day });
  const [hour, setHour] = useState(initial.h);
  const [minute, setMinute] = useState(initial.min);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const dragging = useRef(false);

  useEffect(() => {
    if (!open) return;
    const p = parseIso(valueIso);
    setView({ y: p.y, m: p.m });
    setSel({ y: p.y, m: p.m, day: p.day });
    setHour(p.h);
    setMinute(p.min);
    setMode('hour');
  }, [open, valueIso]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 18, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.36, ease: 'power3.out' },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const cells = useMemo(() => monthCells(view.y, view.m), [view.y, view.m]);
  const selectedKey = toKey(sel.y, sel.m, sel.day);
  const todayKey = (() => {
    const n = new Date();
    return toKey(n.getFullYear(), n.getMonth(), n.getDate());
  })();

  const previewLabel = `${pad(sel.day)}.${pad(sel.m + 1)}.${sel.y} · ${pad(hour)}:${pad(minute)}`;

  function angleFromPointer(clientX: number, clientY: number): number | null {
    const el = dialRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  }

  function applyAngle(deg: number) {
    if (mode === 'hour') {
      const slot = Math.round(deg / 30) % 12;
      setHour(hour >= 12 ? (slot === 0 ? 12 : slot + 12) % 24 || 12 : slot);
    } else {
      setMinute(Math.round(deg / 6) % 60);
    }
  }

  function confirm() {
    const d = new Date(sel.y, sel.m, sel.day, hour, minute, 0, 0);
    onConfirm(d.toISOString());
  }

  if (!open) return null;

  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const minuteAngle = minute * 6;

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="schedule-dt-title"
        className="relative z-10 flex w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
      >
        <header className="relative border-b border-[var(--panel-line)] bg-gradient-to-br from-[var(--color-brand-500)]/18 via-[var(--color-brand-500)]/6 to-transparent px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            ✕ ESC
          </button>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand-600)]">
            Zaman seç
          </p>
          <h2 id="schedule-dt-title" className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            {previewLabel}
          </h2>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Takvimden günü, kadrandan saati seçin.
          </p>
        </header>

        <div className="grid gap-0 md:grid-cols-2">
          {/* Takvim */}
          <section className="border-b border-[var(--panel-line)] p-5 md:border-b-0 md:border-r">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                data-km-jump
                onClick={() =>
                  setView((v) => {
                    const m = v.m - 1;
                    return m < 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m };
                  })
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                aria-label="Önceki ay"
              >
                ‹
              </button>
              <p className="text-sm font-bold text-[var(--panel-ink)]">
                {MONTHS[view.m]} {view.y}
              </p>
              <button
                type="button"
                data-km-jump
                onClick={() =>
                  setView((v) => {
                    const m = v.m + 1;
                    return m > 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m };
                  })
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--panel-line)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                aria-label="Sonraki ay"
              >
                ›
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              {WEEKDAYS.map((w, i) => (
                <span key={w} className={i >= 5 ? 'text-rose-500' : ''}>
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c) => {
                if (!c.inMonth) return <span key={c.key} className="h-10" />;
                const selected = c.key === selectedKey;
                const isToday = c.key === todayKey;
                return (
                  <button
                    key={c.key}
                    type="button"
                    data-km-jump
                    onClick={() => setSel({ y: view.y, m: view.m, day: c.day })}
                    className={[
                      'flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition',
                      selected
                        ? 'bg-[var(--color-brand-600)] text-white shadow-md shadow-[color-mix(in_srgb,var(--color-brand-600)_35%,transparent)]'
                        : isToday
                          ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] text-[var(--color-brand-700)]'
                          : c.weekend
                            ? 'text-rose-500 hover:bg-[var(--panel-hover)]'
                            : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                    ].join(' ')}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              data-km-jump
              onClick={() => {
                const n = new Date();
                setView({ y: n.getFullYear(), m: n.getMonth() });
                setSel({ y: n.getFullYear(), m: n.getMonth(), day: n.getDate() });
              }}
              className="mt-3 w-full rounded-xl border border-[var(--panel-line)] py-2 text-xs font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            >
              Bugüne git
            </button>
          </section>

          {/* Saat */}
          <section className="flex flex-col items-center p-5">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                data-km-jump
                onClick={() => setMode('hour')}
                className={[
                  'rounded-full px-4 py-2 text-xs font-bold transition',
                  mode === 'hour'
                    ? 'bg-[var(--color-brand-600)] text-white'
                    : 'border border-[var(--panel-line)] text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
                ].join(' ')}
              >
                Saat
              </button>
              <button
                type="button"
                data-km-jump
                onClick={() => setMode('minute')}
                className={[
                  'rounded-full px-4 py-2 text-xs font-bold transition',
                  mode === 'minute'
                    ? 'bg-[var(--color-brand-600)] text-white'
                    : 'border border-[var(--panel-line)] text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
                ].join(' ')}
              >
                Dakika
              </button>
            </div>

            <p className="mb-3 text-4xl font-bold tabular-nums tracking-tight text-[var(--panel-ink)]">
              {pad(hour)}
              <span className="text-[var(--color-brand-500)]">:</span>
              {pad(minute)}
            </p>

            <div
              ref={dialRef}
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const deg = angleFromPointer(e.clientX, e.clientY);
                if (deg != null) applyAngle(deg);
              }}
              onPointerMove={(e) => {
                if (!dragging.current) return;
                const deg = angleFromPointer(e.clientX, e.clientY);
                if (deg != null) applyAngle(deg);
              }}
              onPointerUp={(e) => {
                dragging.current = false;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* */
                }
                if (mode === 'hour') setMode('minute');
              }}
              className="relative h-[220px] w-[220px] cursor-pointer touch-none select-none rounded-full border border-[var(--panel-line)] bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-brand-500)_12%,var(--panel-bg)),var(--panel-bg))] shadow-inner"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const n = i === 0 ? 12 : i;
                const ang = (i * 30 - 90) * (Math.PI / 180);
                const r = 88;
                const x = 110 + Math.cos(ang) * r;
                const y = 110 + Math.sin(ang) * r;
                return (
                  <span
                    key={n}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-[13px] font-semibold text-[var(--panel-muted)]"
                    style={{ left: x, top: y }}
                  >
                    {n}
                  </span>
                );
              })}
              <div
                className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
                style={{
                  width: 2,
                  height: 78,
                  marginLeft: -1,
                  marginTop: -78,
                  background: 'var(--color-brand-500)',
                  transform: `rotate(${minuteAngle}deg)`,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
                style={{
                  width: 4,
                  height: 52,
                  marginLeft: -2,
                  marginTop: -52,
                  background: 'var(--panel-ink)',
                  transform: `rotate(${hourAngle}deg)`,
                }}
              />
              <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand-600)] ring-4 ring-[color-mix(in_srgb,var(--color-brand-500)_25%,transparent)]" />
            </div>

            <button
              type="button"
              data-km-jump
              onClick={() => setHour((h) => (h >= 12 ? h - 12 : h + 12))}
              className="mt-3 rounded-lg px-3 py-1.5 text-[11px] font-bold text-[var(--color-brand-600)] hover:bg-[var(--panel-hover)]"
            >
              {hour >= 12 ? 'Öğleden sonra (12–23)' : 'Öğleden önce (00–11)'}
            </button>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-4">
          <button
            type="button"
            data-km-jump
            onClick={onClose}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            data-km-jump
            onClick={confirm}
            className="h-11 min-w-[10rem] rounded-xl bg-[var(--color-brand-600)] px-5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
          >
            Bu zamanı kullan
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Görünen tarih-saat etiketi (local YYYY-MM-DDTHH:mm veya ISO) */
export function formatScheduleDisplay(isoOrLocal: string): string {
  const date = new Date(isoOrLocal);
  if (Number.isNaN(+date)) return 'Zaman seçin';
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
