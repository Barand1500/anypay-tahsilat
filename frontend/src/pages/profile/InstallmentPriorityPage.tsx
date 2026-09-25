import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

type Source = 'user' | 'cari';

const LABELS: Record<Source, { title: string; desc: string; hint: string }> = {
  user: {
    title: 'Kullanıcı taksitleri',
    desc: 'Kullanıcılar sayfasında atanan izin verilen taksitler',
    hint: 'Giriş yapan personelin kendi taksit izni',
  },
  cari: {
    title: 'Cari tip taksitleri',
    desc: 'Müşterinin cari tipinde tanımlı izin verilen taksitler',
    hint: 'Seçilen müşterinin cari tipine bağlı liste',
  },
};

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  );
}

/**
 * Profil › Sıralama — taksit kaynağı önceliği (1. varsa o, yoksa 2.).
 */
export default function InstallmentPriorityPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<Source[]>(['user', 'cari']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
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
      if (Array.isArray(data.order) && data.order.length === 2) {
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
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power3.out' },
    );
  }, [loading]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2200);
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
      setFlash('Sıralama kaydedildi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-10 text-center text-base text-[var(--panel-muted)]">
        Sıralama yükleniyor…
      </div>
    );
  }

  const first = order[0]!;
  const second = order[1]!;

  return (
    <div ref={rootRef} className="flex w-full flex-col gap-5">
      {/* Sticky kırmızı uyarı — sayfa üstünde hep görünür */}
      <div
        data-anim
        className="sticky top-0 z-20 rounded-2xl border border-rose-500/50 bg-rose-600 px-5 py-4 text-white shadow-[0_8px_28px_rgba(225,29,72,0.35)] sm:px-6 sm:py-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-black uppercase tracking-wide">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            Dikkat ediniz
          </span>
          <p className="text-[15px] leading-relaxed sm:text-base">
            Ödeme alırken ve ödeme isteği oluştururken sistem önce{' '}
            <strong className="font-black">1. sıradaki</strong> kaynağa bakar. Bu kaynakta izin
            tanımlıysa o liste kullanılır; boşsa <strong className="font-black">2. sıraya</strong>{' '}
            geçilir. Her iki kaynak da boşsa taksit kısıtı uygulanmaz. Sıralamayı soldaki tutamaçtan
            sürükleyerek değiştirin; kaydetmeyi unutmayın.
          </p>
        </div>
      </div>

      {flash ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-3 text-base font-semibold text-emerald-800 dark:text-emerald-300">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-5 py-3 text-base font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        {/* Sol: sıralama */}
        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-7"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-black tracking-tight text-[var(--panel-ink)] sm:text-3xl">
              Sıralama
            </h1>
            <p className="mt-2 text-base text-[var(--panel-muted)]">
              Soldaki tutamağı tutup sürükleyerek önceliği değiştirin.
            </p>
          </div>

          <ol className="space-y-4">
            {order.map((key, i) => {
              const meta = LABELS[key];
              const dragging = dragId === key;
              const dropTarget = overId === key && dragId !== key;
              return (
                <li
                  key={key}
                  data-anim
                  onDragOver={(e) => onDragOver(e, key)}
                  onDrop={(e) => onDrop(e, key)}
                  className={[
                    'flex items-stretch gap-4 rounded-2xl border-2 bg-[var(--panel-surface)] p-4 transition-all sm:p-5',
                    dragging
                      ? 'opacity-45 border-[var(--color-brand-500)]'
                      : dropTarget
                        ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]'
                        : 'border-[var(--panel-line)] hover:border-[var(--color-brand-500)]/40',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    draggable
                    data-km-jump
                    aria-label={`${meta.title} — basılı tutup sürükle`}
                    title="Basılı tutup sürükleyerek sırayı değiştir"
                    onDragStart={(e) => onDragStart(e, key)}
                    onDragEnd={onDragEnd}
                    className="flex w-11 shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-1 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-muted)] transition hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)] active:cursor-grabbing"
                  >
                    <GripIcon />
                  </button>

                  <div
                    className={[
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white shadow-md',
                      i === 0 ? 'bg-[var(--color-brand-600)]' : 'bg-slate-500',
                    ].join(' ')}
                  >
                    {i + 1}
                  </div>

                  <div className="min-w-0 flex-1 self-center">
                    <p className="text-lg font-bold text-[var(--panel-ink)] sm:text-xl">
                      {meta.title}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-[var(--panel-muted)] sm:text-[15px]">
                      {meta.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              data-km-jump
              disabled={saving}
              onClick={() => void save()}
              className="rounded-xl bg-[var(--color-brand-600)] px-6 py-3 text-base font-bold text-white shadow-md hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </section>

        {/* Sağ: anlam / örnek */}
        <aside
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-7 lg:sticky lg:top-[7.5rem]"
        >
          <h2 className="text-xl font-black text-[var(--panel-ink)] sm:text-2xl">Ne anlama geliyor?</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--panel-muted)] sm:text-base">
            Öncelik sırası, ödeme ekranında hangi taksit listesinin geçerli olacağını belirler.
            Boş kaynak atlanır; dolu olan ilk kaynak kullanılır.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-500)]/8 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-sm font-black text-white">
                  1
                </span>
                <div>
                  <p className="text-base font-bold text-[var(--panel-ink)]">{LABELS[first].title}</p>
                  <p className="text-sm text-[var(--panel-muted)]">{LABELS[first].hint}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--color-brand-700)] dark:text-[var(--color-brand-400)]">
                Önce buraya bakılır — doluysa bu liste geçerlidir.
              </p>
            </div>

            <div className="flex justify-center">
              <span className="rounded-full bg-[var(--panel-surface)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--panel-muted)]">
                yoksa ↓
              </span>
            </div>

            <div className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500 text-sm font-black text-white">
                  2
                </span>
                <div>
                  <p className="text-base font-bold text-[var(--panel-ink)]">{LABELS[second].title}</p>
                  <p className="text-sm text-[var(--panel-muted)]">{LABELS[second].hint}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--panel-muted)]">
                1. kaynak boşsa buraya bakılır.
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-2.5 text-[15px] text-[var(--panel-muted)]">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
              Değişiklik yalnızca <strong className="text-[var(--panel-ink)]">Kaydet</strong> sonrası
              geçerli olur.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
              İki kaynak da boşsa tüm taksitler serbesttir.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
