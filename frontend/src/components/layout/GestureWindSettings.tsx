import gsap from 'gsap';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useCustomersList } from '../../pages/customers/useCustomersList';
import {
  actionSummary,
  GESTURE_ACTION_OPTIONS,
  type GestureAction,
  type GestureActionType,
} from './gestureActions';
import { pathLength, type Pt } from './gesturePath';
import { useGestureWind, type SavedGesture } from './GestureWindContext';
import { EXTRA_QUICK_ITEMS, NAV_ITEMS } from './navItems';

const ROUTES = [...NAV_ITEMS, ...EXTRA_QUICK_ITEMS].filter(
  (x, i, arr) => arr.findIndex((y) => y.to === x.to) === i,
);

/**
 * Jest Rüzgarı ayarları — Esc/X; overlay kapatmaz.
 * Boş listede her seferinde tutorial.
 */
export function GestureWindSettingsModal() {
  const { settingsOpen, setSettingsOpen, gestures, addGesture, removeGesture } = useGestureWind();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!settingsOpen) {
      setMode('list');
      setShowTutorial(false);
      return;
    }
    if (gestures.length === 0) {
      setShowTutorial(true);
      setMode('create');
    }
  }, [settingsOpen, gestures.length]);

  useEffect(() => {
    if (!settingsOpen) return;
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsOpen(false);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="gw-settings-title"
        className="relative z-10 flex max-h-[min(94vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
        data-gw-ignore
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-line)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft-bg)] text-[var(--brand-on-soft)]">
              <WindGlyph />
            </span>
            <div>
              <h2 id="gw-settings-title" className="text-lg font-bold text-[var(--panel-ink)]">
                Jest Rüzgarı
              </h2>
              <p className="text-xs text-[var(--panel-muted)]">
                Serbest çiz · aksiyon seç · havada çalıştır
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setSettingsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {showTutorial ? (
            <Tutorial onDone={() => setShowTutorial(false)} />
          ) : mode === 'list' ? (
            <GestureList
              gestures={gestures}
              onAdd={() => setMode('create')}
              onRemove={removeGesture}
            />
          ) : (
            <CreateGestureForm
              onCancel={() => {
                if (gestures.length) setMode('list');
                else setSettingsOpen(false);
              }}
              onSave={(payload) => {
                addGesture(payload);
                setMode('list');
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TUTORIAL_STEPS = [
  {
    n: '01',
    title: 'Basılı tut, serbest çiz',
    body: 'Boş bir alanda fareyi basılı tutup istediğin şekli çiz — L, daire, Z, dalga… Şekil senin; sabit yön yok.',
  },
  {
    n: '02',
    title: 'Aksiyon bağla',
    body: 'Çizdiğin hareketi bir işe bağla: sayfa aç, global ara, tema değiştir, müşteriye git, ödeme al veya hızlı ödeme.',
  },
  {
    n: '03',
    title: 'Havada çalıştır',
    body: 'Mod açıkken aynı hareketi panelde tekrar çiz — eşleşince aksiyon hemen çalışır. Çizime başladıktan sonra fareyi bırakmadan her yerde devam edebilirsin.',
  },
] as const;

function Tutorial({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const intro = el.querySelector('[data-tut-intro]');
    const stage = el.querySelector('[data-tut-stage]');
    const path = el.querySelector('[data-tut-path]');
    const cursor = el.querySelector('[data-tut-cursor]');
    const steps = el.querySelectorAll('[data-tut-step]');
    const foot = el.querySelector('[data-tut-foot]');

    if (reduced) {
      gsap.set([intro, stage, path, cursor, foot, ...steps], { autoAlpha: 1, clearProps: 'transform' });
      return;
    }

    const tl = gsap.timeline(); // otomatik geçiş yok — sadece Atla

    gsap.set([intro, stage, path, cursor, foot, ...steps], { autoAlpha: 0 });
    gsap.set(steps, { y: 12 });
    gsap.set(cursor, { x: 34, y: 100 });

    const cursorKeys = [
      { x: 34, y: 100 },
      { x: 90, y: 42 },
      { x: 148, y: 78 },
      { x: 200, y: 110 },
      { x: 244, y: 48 },
    ];

    tl.to(intro, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' })
      .to(stage, { autoAlpha: 1, duration: 0.35 }, '-=0.1')
      .to(path, { autoAlpha: 1, duration: 0.2 }, '-=0.1')
      .fromTo(
        path,
        { strokeDashoffset: 280 },
        { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut' },
      )
      .to(cursor, { autoAlpha: 1, duration: 0.15 }, '-=1.6');

    const stepDur = 1.6 / (cursorKeys.length - 1);
    cursorKeys.forEach((p, i) => {
      if (i === 0) return;
      tl.to(cursor, { x: p.x, y: p.y, duration: stepDur, ease: 'none' }, i === 1 ? '-=1.45' : '>');
    });

    tl.to(cursor, { autoAlpha: 0, duration: 0.25 }, '-=0.05');

    steps.forEach((step, i) => {
      tl.to(step, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, i === 0 ? '+=0.15' : '+=0.1');
    });

    tl.to(foot, { autoAlpha: 1, duration: 0.35 }, '+=0.2');

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-6 pb-2 pt-1">
      <div data-tut-intro>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-on-soft)]">
          Nasıl çalışır?
        </p>
        <h3 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--panel-ink)] sm:text-2xl">
          Fareyle bir şekil çiz, panele kısayol bağla
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--panel-muted)]">
          Jest Rüzgarı açıkken boş alanda basılı tutup çizdiğin hareket, kaydettiğin aksiyonu
          tetikler. Aşağıdaki örnek bir “yay” hareketi — sen istediğin şekli çizebilirsin.
        </p>
      </div>

      <div
        data-tut-stage
        className="relative overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-8 sm:px-8"
      >
        <div className="relative mx-auto flex max-w-md flex-col items-center">
          <svg
            width="280"
            height="140"
            viewBox="0 0 280 140"
            className="text-[var(--color-brand-500)]"
            aria-hidden
          >
            <path
              data-tut-path
              d="M36 108 C70 28, 120 28, 148 78 S210 128, 248 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="280"
            />
            <g data-tut-cursor>
              <path
                d="M2 2 L2 22 L8 16.5 L12 26 L15.5 24.5 L11.5 15 L18 15 Z"
                fill="var(--panel-ink)"
                stroke="var(--panel-elevated)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          <p className="mt-2 text-center text-[11px] font-medium text-[var(--panel-muted)]">
            Örnek çizim · basılı tut → sürükle → bırak
          </p>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {TUTORIAL_STEPS.map((s) => (
          <li
            key={s.n}
            data-tut-step
            className="rounded-xl border border-[var(--panel-line)] p-3.5"
          >
            <span className="text-[10px] font-bold tracking-wider text-[var(--brand-on-soft)]">
              {s.n}
            </span>
            <p className="mt-1 text-sm font-bold text-[var(--panel-ink)]">{s.title}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--panel-muted)]">{s.body}</p>
          </li>
        ))}
      </ol>

      <div data-tut-foot className="flex justify-end border-t border-[var(--panel-line)] pt-4">
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl bg-[var(--color-brand-500)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Anladım, çizime geç
        </button>
      </div>
    </div>
  );
}

function GestureList({
  gestures,
  onAdd,
  onRemove,
}: {
  gestures: SavedGesture[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--panel-muted)]">
          {gestures.length === 0
            ? 'Henüz jest yok'
            : `${gestures.length} kayıtlı jest`}
        </p>
        <button
          type="button"
          data-km-jump
          onClick={onAdd}
          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          + Yeni jest
        </button>
      </div>

      {gestures.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--panel-muted)]">
          İlk jestini eklemek için yukarıdaki butonu kullan.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--panel-line)] rounded-xl border border-[var(--panel-line)]">
          {gestures.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-3">
              <MiniPath path={g.path} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--panel-ink)]">{g.name}</p>
                <p className="truncate text-xs text-[var(--panel-muted)]">
                  {actionSummary(g.action)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(g.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--panel-muted)]">
        Mod açıkken boş alanda aynı şekli çiz; eşleşince aksiyon çalışır. Buton/input üzerinde
        başlama.
      </p>
    </div>
  );
}

function WindGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h10a3 3 0 1 0-3-3M4 12h14a3 3 0 1 1-3 3M4 16h8a2.5 2.5 0 1 1-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CreateGestureForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (g: { name: string; path: Pt[]; action: GestureAction }) => void;
}) {
  const { customers } = useCustomersList({ parentId: 'all' });
  const [name, setName] = useState('');
  const [stroke, setStroke] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [actionType, setActionType] = useState<GestureActionType | null>(null);
  const [target, setTarget] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [error, setError] = useState('');
  const padRef = useRef<HTMLDivElement>(null);

  const meta = GESTURE_ACTION_OPTIONS.find((x) => x.type === actionType);

  function padPoint(e: ReactPointerEvent): Pt {
    const r = padRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPadDown(e: ReactPointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrawing(true);
    setStroke([padPoint(e)]);
  }
  function onPadMove(e: ReactPointerEvent) {
    if (!drawing) return;
    setStroke((prev) => [...prev, padPoint(e)]);
  }
  function onPadUp() {
    setDrawing(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pathLength(stroke) < 40) {
      setError('Biraz daha uzun bir hareket çiz');
      return;
    }
    if (!actionType) {
      setError('Önce aksiyon seç');
      return;
    }
    if (meta?.needsTarget !== 'none' && !target) {
      setError('Aksiyon için hedef seç');
      return;
    }
    const action: GestureAction = {
      type: actionType,
      target: meta?.needsTarget === 'none' ? undefined : target,
      label: targetLabel || undefined,
    };
    onSave({
      name: name.trim() || actionSummary(action),
      path: stroke,
      action,
    });
  }

  const d =
    stroke.length > 1
      ? stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
      : '';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold text-[var(--brand-on-soft)]">1 · Hareketi çiz</p>
        <div
          ref={padRef}
          data-gw-ignore
          onPointerDown={onPadDown}
          onPointerMove={onPadMove}
          onPointerUp={onPadUp}
          onPointerCancel={onPadUp}
          className="relative h-44 cursor-crosshair touch-none overflow-hidden rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]"
        >
          {stroke.length < 2 ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-[var(--panel-muted)]">
              Basılı tutup çiz
            </p>
          ) : null}
          <svg className="absolute inset-0 h-full w-full">
            {d ? (
              <path
                d={d}
                fill="none"
                stroke="var(--color-brand-500)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
          {stroke.length > 1 ? (
            <button
              type="button"
              onClick={() => setStroke([])}
              className="absolute right-2 top-2 rounded-lg bg-[var(--panel-elevated)] px-2 py-1 text-[10px] font-bold text-[var(--panel-muted)]"
            >
              Temizle
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold text-[var(--brand-on-soft)]">2 · Aksiyon seç</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {GESTURE_ACTION_OPTIONS.map((opt) => {
            const on = actionType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setActionType(opt.type);
                  setTarget('');
                  setTargetLabel('');
                }}
                className={[
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition',
                  on
                    ? 'border-[var(--color-brand-500)]/50 bg-[var(--brand-soft-bg)]'
                    : 'border-[var(--panel-line)] hover:border-[var(--color-brand-500)]/30',
                ].join(' ')}
              >
                <span className="block font-semibold text-[var(--panel-ink)]">{opt.label}</span>
                <span className="block text-[11px] text-[var(--panel-muted)]">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {meta && meta.needsTarget !== 'none' ? (
        <div>
          <p className="mb-1.5 text-xs font-bold text-[var(--brand-on-soft)]">
            3 · {meta.needsTarget === 'route' ? 'Hangi sayfa?' : 'Hangi müşteri?'}
          </p>
          {meta.needsTarget === 'route' ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--panel-line)] p-2">
              {ROUTES.map((r) => (
                <button
                  key={r.to}
                  type="button"
                  onClick={() => {
                    setTarget(r.to);
                    setTargetLabel(r.label);
                  }}
                  className={[
                    'block w-full rounded-lg px-2.5 py-1.5 text-left text-sm',
                    target === r.to
                      ? 'bg-[var(--brand-soft-bg)] font-semibold text-[var(--brand-on-soft)]'
                      : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--panel-line)] p-2">
              {customers.slice(0, 40).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setTarget(c.id);
                    setTargetLabel(c.title || c.code || c.id);
                  }}
                  className={[
                    'block w-full rounded-lg px-2.5 py-1.5 text-left text-sm',
                    target === c.id
                      ? 'bg-[var(--brand-soft-bg)] font-semibold text-[var(--brand-on-soft)]'
                      : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                  ].join(' ')}
                >
                  {c.title || c.code || c.id}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--panel-ink)]">
          İsim (opsiyonel)
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)]"
          placeholder="Örn. Daire → Özet"
        />
      </label>

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-4 py-2 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          data-km-jump
          className="rounded-xl bg-[var(--color-brand-500)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Kaydet
        </button>
      </div>
    </form>
  );
}

function MiniPath({ path }: { path: Pt[] }) {
  if (path.length < 2) return <span className="h-8 w-11 shrink-0 rounded bg-[var(--panel-hover)]" />;
  const d = path
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 40 + 2).toFixed(1)} ${(p.y * 24 + 2).toFixed(1)}`)
    .join(' ');
  return (
    <svg width="44" height="28" className="shrink-0 text-[var(--color-brand-500)]" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
