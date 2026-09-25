import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';

type Source = 'user' | 'cari' | 'sube';

const LABELS: Record<Source, { title: string; desc: string }> = {
  user: {
    title: 'Kullanıcı taksitleri',
    desc: 'Kullanıcılar sayfasında atanan izin verilen taksitler',
  },
  cari: {
    title: 'Cari tip taksitleri',
    desc: 'Müşterinin cari tipinde tanımlı izin verilen taksitler',
  },
  sube: {
    title: 'Şube / departman taksitleri',
    desc: 'Kullanıcının şubesinde tanımlı izin verilen taksitler',
  },
};

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <circle cx="7" cy="5" r="1.35" />
      <circle cx="13" cy="5" r="1.35" />
      <circle cx="7" cy="10" r="1.35" />
      <circle cx="13" cy="10" r="1.35" />
      <circle cx="7" cy="15" r="1.35" />
      <circle cx="13" cy="15" r="1.35" />
    </svg>
  );
}

/**
 * Profil › Sıralama — taksit kaynağı önceliği (1. varsa o, yoksa 2., yoksa 3.).
 */
export default function InstallmentPriorityPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<Source[]>(['user', 'cari', 'sube']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [dragId, setDragId] = useState<Source | null>(null);
  const [overId, setOverId] = useState<Source | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ order: Source[] }>(
        '/api/settings/installment-priority',
        token,
      );
      if (Array.isArray(data.order) && data.order.length === 3) {
        setOrder(data.order);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sıralama yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || loading) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' },
    );
  }, [loading]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  function swap(from: Source, to: Source) {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const i = next.indexOf(from);
      const j = next.indexOf(to);
      if (i < 0 || j < 0) return prev;
      next[i] = to;
      next[j] = from;
      return next;
    });
  }

  function onDragStart(e: ReactDragEvent, id: Source) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e: ReactDragEvent, id: Source) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onDrop(e: ReactDragEvent, id: Source) {
    e.preventDefault();
    const from = (e.dataTransfer.getData('text/plain') as Source) || dragId;
    if (from) swap(from, id);
    setDragId(null);
    setOverId(null);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<{ order: Source[] }>(
        '/api/settings/installment-priority',
        { order },
        token,
      );
      setOrder(data.order);
      setFlash(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center text-sm text-[var(--panel-muted)]">
        Sıralama yükleniyor…
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-3xl">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Sıralama</h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Ödeme ve ödeme isteğinde hangi taksit listesinin önce uygulanacağını belirleyin.
        </p>
      </div>

      <div
        data-anim
        className="mb-5 flex gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-400">Dikkat ediniz</p>
          <p className="mt-0.5 text-sm leading-relaxed text-rose-800/80 dark:text-rose-300/90">
            Sistem önce <strong className="font-semibold">1.</strong> kaynağa bakar; doluysa o
            kullanılır, boşsa sıradaki kaynağa geçilir. Hepsi boşsa kısıt uygulanmaz. Tutamaçtan
            sürükleyip kaydedin.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <section
        data-anim
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
      >
        <div className="border-b border-[var(--panel-line)] px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--panel-ink)]">Öncelik sırası</h2>
          <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
            Soldaki tutamağı tutup sürükleyerek değiştirin
          </p>
        </div>

        <ol className="divide-y divide-[var(--panel-line)] p-2 sm:p-3">
          {order.map((key, i) => {
            const meta = LABELS[key];
            const dragging = dragId === key;
            const dropTarget = overId === key && dragId !== key;
            return (
              <li
                key={key}
                onDragOver={(e) => onDragOver(e, key)}
                onDrop={(e) => onDrop(e, key)}
                className={[
                  'flex items-center gap-3 rounded-xl px-2 py-3 transition-colors sm:gap-4 sm:px-3',
                  dragging ? 'opacity-40' : '',
                  dropTarget
                    ? 'bg-[var(--color-brand-500)]/10 ring-1 ring-[var(--color-brand-500)]/35'
                    : 'hover:bg-[var(--panel-hover)]/50',
                ].join(' ')}
              >
                <button
                  type="button"
                  draggable
                  data-km-jump
                  aria-label={`${meta.title} — sürükle`}
                  title="Basılı tutup sürükle"
                  onDragStart={(e) => onDragStart(e, key)}
                  onDragEnd={onDragEnd}
                  className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-surface)] hover:text-[var(--panel-ink)] active:cursor-grabbing"
                >
                  <GripIcon />
                </button>

                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
                    i === 0 ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-muted)]',
                  ].join(' ')}
                >
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--panel-ink)]">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{meta.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-end border-t border-[var(--panel-line)] px-4 py-3 sm:px-5">
          <Button type="button" loading={saving} success={flash} onClick={() => void save()}>
            Kaydet
          </Button>
        </div>
      </section>
    </div>
  );
}
