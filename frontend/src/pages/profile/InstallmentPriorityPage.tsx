import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';

type Source = 'user' | 'cari';

const LABELS: Record<Source, { title: string; desc: string }> = {
  user: {
    title: 'Kullanıcı taksitleri',
    desc: 'Kullanıcılar sayfasında atanan izin verilen taksitler',
  },
  cari: {
    title: 'Cari tip taksitleri',
    desc: 'Müşterinin cari tipinde tanımlı izin verilen taksitler',
  },
};

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
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out' },
    );
  }, [loading]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(t);
  }, [flash]);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setOrder(next);
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
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center text-sm text-[var(--panel-muted)]">
        Sıralama yükleniyor…
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-xl space-y-4">
      {flash ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <section
        data-anim
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6"
      >
        <h1 className="text-xl font-bold text-[var(--panel-ink)]">Sıralama</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
          Ödeme alırken / ödeme isteği oluştururken hangi taksit listesinin geçerli olacağını
          belirleyin. <strong className="text-[var(--panel-ink)]">1</strong> numaralı kaynak doluysa
          o kabul edilir; yoksa <strong className="text-[var(--panel-ink)]">2</strong>’ye bakılır.
        </p>

        <ol className="mt-5 space-y-3">
          {order.map((key, i) => {
            const meta = LABELS[key];
            return (
              <li
                key={key}
                data-anim
                className="flex items-stretch gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-sm font-black text-white">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--panel-ink)]">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{meta.desc}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    data-km-jump
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded-lg border border-[var(--panel-line)] px-2 py-1 text-xs font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-30"
                    title="Yukarı"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    data-km-jump
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded-lg border border-[var(--panel-line)] px-2 py-1 text-xs font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-30"
                    title="Aşağı"
                  >
                    ▼
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            data-km-jump
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </section>
    </div>
  );
}
