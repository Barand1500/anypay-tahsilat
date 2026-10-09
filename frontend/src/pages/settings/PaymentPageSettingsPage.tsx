import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import {
  DEFAULT_PAYMENT_PAGE,
  type PaymentPageBadge,
  type PaymentPageLayout,
  type PaymentPageSettings,
} from './paymentPageTypes';

gsap.registerPlugin(useGSAP);

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Dosya okunamadı'));
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}

function cloneSettings(s: PaymentPageSettings): PaymentPageSettings {
  return {
    layout: s.layout,
    brandLogoHeightPx: s.brandLogoHeightPx,
    badges: s.badges.map((b) => ({ ...b })),
  };
}

function settingsKey(s: PaymentPageSettings): string {
  return JSON.stringify({
    layout: s.layout,
    brandLogoHeightPx: s.brandLogoHeightPx,
    badges: s.badges.map((b) => ({
      id: b.id,
      name: b.name,
      src: b.src,
      heightPx: b.heightPx,
      active: b.active,
      sortOrder: b.sortOrder,
    })),
  });
}

function newTempId() {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Ayarlar › Ödeme sayfası — public /pay görünümü.
 */
export default function PaymentPageSettingsPage() {
  const { token } = useAuth();
  const { logoUrl } = useBrand();
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<PaymentPageSettings>(cloneSettings(DEFAULT_PAYMENT_PAGE));
  const [baseline, setBaseline] = useState<PaymentPageSettings>(cloneSettings(DEFAULT_PAYMENT_PAGE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PaymentPageSettings>('/api/settings/payment-page', token);
      const next = cloneSettings({
        layout: data.layout === 'fullscreen' ? 'fullscreen' : 'compact',
        brandLogoHeightPx: data.brandLogoHeightPx || 40,
        badges: Array.isArray(data.badges) && data.badges.length ? data.badges : DEFAULT_PAYMENT_PAGE.badges,
      });
      setDraft(next);
      setBaseline(cloneSettings(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ödeme sayfası ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = settingsKey(draft) !== settingsKey(baseline);

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: rootRef, dependencies: [loading] },
  );

  function setLayout(layout: PaymentPageLayout) {
    setDraft((d) => ({ ...d, layout }));
  }

  function setLogoHeight(n: number) {
    setDraft((d) => ({ ...d, brandLogoHeightPx: Math.min(80, Math.max(24, Math.round(n))) }));
  }

  function patchBadge(id: string, patch: Partial<PaymentPageBadge>) {
    setDraft((d) => ({
      ...d,
      badges: d.badges.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function removeBadge(id: string) {
    setDraft((d) => ({
      ...d,
      badges: d.badges
        .filter((b) => b.id !== id)
        .map((b, i) => ({ ...b, sortOrder: i })),
    }));
  }

  function moveBadge(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const list = [...d.badges].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = list.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const j = idx + dir;
      if (j < 0 || j >= list.length) return d;
      const tmp = list[idx]!;
      list[idx] = list[j]!;
      list[j] = tmp;
      return { ...d, badges: list.map((b, i) => ({ ...b, sortOrder: i })) };
    });
  }

  async function onBadgeFile(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Yalnızca görsel dosyaları yüklenebilir');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Rozet görseli en fazla 2 MB olabilir');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      patchBadge(id, { src: dataUrl });
      setError(null);
    } catch {
      setError('Görsel okunamadı');
    }
  }

  function addBadge() {
    if (draft.badges.length >= 24) {
      setError('En fazla 24 ödeme logosu eklenebilir');
      return;
    }
    const id = newTempId();
    setDraft((d) => ({
      ...d,
      badges: [
        ...d.badges,
        {
          id,
          name: 'Yeni logo',
          src: '/payments/visa.png',
          heightPx: 28,
          active: true,
          sortOrder: d.badges.length,
        },
      ],
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || !dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaveOk(false);
    try {
      const payload = {
        layout: draft.layout,
        brandLogoHeightPx: draft.brandLogoHeightPx,
        badges: draft.badges.map((b, i) => ({
          id: b.id.startsWith('tmp_') ? undefined : b.id,
          name: b.name.trim(),
          src: b.src,
          heightPx: b.heightPx,
          active: b.active,
          sortOrder: i,
        })),
      };
      const data = await api.patch<PaymentPageSettings>('/api/settings/payment-page', payload, token);
      const next = cloneSettings(data);
      setDraft(next);
      setBaseline(cloneSettings(next));
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-sm text-[var(--panel-muted)]">
        Ödeme sayfası ayarları yükleniyor…
      </div>
    );
  }

  const sorted = [...draft.badges].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div ref={rootRef} className="space-y-5">
      <form onSubmit={(e) => void save(e)} className="space-y-5">
        <div
          data-anim
          className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-4 shadow-[var(--panel-shadow)]"
        >
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Ödeme sayfası</h2>
            <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
              Müşteriye giden <span className="font-medium text-[var(--panel-ink)]">/pay</span> linkinin
              düzeni, logo boyutu ve üstteki ödeme rozetleri.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saveOk ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Kaydedildi</span>
            ) : null}
            <Button type="submit" disabled={!dirty || saving} loading={saving}>
              Kaydet
            </Button>
          </div>
        </div>

        {error ? (
          <div
            data-anim
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
          >
            {error}
          </div>
        ) : null}

        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]"
        >
          <h3 className="text-sm font-bold text-[var(--panel-ink)]">Sayfa düzeni</h3>
          <p className="mt-1 text-xs text-[var(--panel-muted)]">
            Kompakt: mevcut kart düzeni. Tam ekran: sol güven şeridi + sağ ödeme sahnesi.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LayoutCard
              active={draft.layout === 'compact'}
              title="Kompakt"
              desc="Ortalı, dar içerik — mevcut görünüm."
              onClick={() => setLayout('compact')}
              preview="compact"
            />
            <LayoutCard
              active={draft.layout === 'fullscreen'}
              title="Tam ekran"
              desc="Sol marka paneli, sağda tutar şeridi ve form."
              onClick={() => setLayout('fullscreen')}
              preview="fullscreen"
            />
          </div>
        </section>

        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]"
        >
          <h3 className="text-sm font-bold text-[var(--panel-ink)]">Firma logosu boyutu</h3>
          <p className="mt-1 text-xs text-[var(--panel-muted)]">
            Sol üstteki marka logosu yüksekliği (px). Genel ayarlardaki logo dosyası kullanılır.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div className="min-w-[14rem] flex-1">
              <label className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--panel-muted)]">
                <span>Yükseklik</span>
                <span className="tabular-nums text-[var(--panel-ink)]">{draft.brandLogoHeightPx} px</span>
              </label>
              <input
                type="range"
                min={24}
                max={80}
                step={2}
                value={draft.brandLogoHeightPx}
                onChange={(e) => setLogoHeight(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--panel-line)] accent-[var(--color-brand-500)]"
              />
              <div className="mt-1 flex justify-between text-[10px] text-[var(--panel-muted)]">
                <span>Küçük</span>
                <span>Büyük</span>
              </div>
            </div>
            <div className="flex h-24 min-w-[10rem] items-center justify-center rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-bg)] px-4">
              <img
                src={logoUrl}
                alt="Önizleme"
                style={{ height: draft.brandLogoHeightPx }}
                className="w-auto max-w-[11rem] object-contain object-left"
              />
            </div>
          </div>
        </section>

        <section
          data-anim
          className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--panel-ink)]">Ödeme logoları</h3>
              <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
                Header sağındaki rozetler. Aktif olanlar public sayfada görünür.
              </p>
            </div>
            <button
              type="button"
              onClick={addBadge}
              className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-3.5 py-2 text-xs font-bold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/45 hover:bg-[var(--brand-soft-bg)]"
            >
              Logo ekle
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--panel-line)] bg-[var(--panel-bg)]/60 text-[11px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  <th className="px-4 py-3 font-semibold">Önizleme</th>
                  <th className="px-3 py-3 font-semibold">Ad</th>
                  <th className="px-3 py-3 font-semibold">Yükseklik</th>
                  <th className="px-3 py-3 font-semibold">Aktif</th>
                  <th className="px-3 py-3 font-semibold">Sıra</th>
                  <th className="px-4 py-3 text-right font-semibold">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((badge, idx) => (
                  <BadgeRow
                    key={badge.id}
                    badge={badge}
                    isFirst={idx === 0}
                    isLast={idx === sorted.length - 1}
                    onPatch={(p) => patchBadge(badge.id, p)}
                    onFile={(e) => void onBadgeFile(badge.id, e)}
                    onMove={(dir) => moveBadge(badge.id, dir)}
                    onRemove={() => removeBadge(badge.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {!sorted.length ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--panel-muted)]">
              Henüz logo yok. «Logo ekle» ile başlayın.
            </p>
          ) : null}
        </section>

        <section
          data-anim
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]"
        >
          <h3 className="text-sm font-bold text-[var(--panel-ink)]">Canlı önizleme (header)</h3>
          <p className="mt-1 text-xs text-[var(--panel-muted)]">Kaydetmeden önce üst şeridin nasıl görüneceği.</p>
          <div
            className={[
              'mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-3',
              draft.layout === 'fullscreen' ? 'min-h-[4.5rem]' : '',
            ].join(' ')}
          >
            <img
              src={logoUrl}
              alt=""
              style={{ height: draft.brandLogoHeightPx }}
              className="w-auto max-w-[200px] object-contain object-left"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {sorted
                .filter((b) => b.active)
                .map((b) => (
                  <span
                    key={b.id}
                    title={b.name}
                    className="flex h-10 items-center justify-center rounded-xl border border-[var(--panel-line)] bg-white px-2.5 shadow-sm"
                  >
                    <img
                      src={b.src}
                      alt={b.name}
                      style={{ height: b.heightPx }}
                      className="w-auto max-w-[6rem] object-contain"
                    />
                  </span>
                ))}
              <span className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2 text-xs font-semibold text-[var(--panel-ink)]">
                Sözleşmeler
              </span>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

function LayoutCard({
  active,
  title,
  desc,
  onClick,
  preview,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
  preview: 'compact' | 'fullscreen';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border p-4 text-left transition',
        active
          ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))] shadow-sm'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)] hover:border-[var(--color-brand-500)]/40',
      ].join(' ')}
    >
      <div
        className={[
          'mb-3 overflow-hidden rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)]',
          preview === 'fullscreen' ? 'flex h-[72px] p-0' : 'mx-auto max-w-[70%] p-1.5',
        ].join(' ')}
      >
        {preview === 'fullscreen' ? (
          <>
            <span className="w-[28%] shrink-0 bg-[color-mix(in_srgb,var(--color-brand-500)_55%,#0f172a)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 p-1.5">
              <span className="h-3 rounded bg-[var(--panel-bg)]" />
              <span className="h-4 rounded bg-[color-mix(in_srgb,var(--color-brand-500)_18%,var(--panel-bg))]" />
              <div className="mt-auto grid grid-cols-2 gap-1">
                <span className="h-5 rounded bg-[var(--panel-line)]/70" />
                <span className="h-5 rounded bg-[var(--panel-line)]/70" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-8 items-center justify-between gap-1 rounded bg-[var(--panel-bg)] px-1.5">
              <span className="h-2.5 w-8 rounded bg-[var(--panel-line)]" />
              <span className="flex gap-0.5">
                <span className="h-2 w-3 rounded bg-[var(--panel-line)]" />
                <span className="h-2 w-3 rounded bg-[var(--panel-line)]" />
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              <span className="h-6 rounded bg-[var(--panel-line)]/70" />
              <span className="h-6 rounded bg-[var(--panel-line)]/70" />
              <span className="h-6 rounded bg-[var(--panel-line)]/70" />
            </div>
          </>
        )}
      </div>
      <p className="text-sm font-bold text-[var(--panel-ink)]">{title}</p>
      <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{desc}</p>
    </button>
  );
}

function BadgeRow({
  badge,
  isFirst,
  isLast,
  onPatch,
  onFile,
  onMove,
  onRemove,
}: {
  badge: PaymentPageBadge;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (p: Partial<PaymentPageBadge>) => void;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const inputId = `badge-file-${badge.id}`;

  return (
    <tr className="border-b border-[var(--panel-line)]/80 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="relative flex h-12 w-16 items-center justify-center overflow-visible rounded-lg border border-[var(--panel-line)] bg-white"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <img
              src={badge.src}
              alt=""
              style={{ height: Math.min(badge.heightPx, 36) }}
              className="w-auto max-w-[3.5rem] object-contain"
            />
            <AnimatePresence>
              {hover ? (
                <motion.div
                  key="pop"
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', duration: 0.28, bounce: 0.15 }}
                >
                  <img src={badge.src} alt={badge.name} className="h-16 w-auto max-w-[8rem] object-contain" />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-md bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))] px-2 py-1 text-[10px] font-semibold text-[var(--panel-ink)] transition hover:bg-[color-mix(in_srgb,var(--color-brand-500)_24%,var(--panel-elevated))]"
          >
            Değiştir
          </label>
          <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={onFile} />
        </div>
      </td>
      <td className="px-3 py-3">
        <TextInput
          id={`badge-name-${badge.id}`}
          label="Ad"
          labelMode="placeholder"
          value={badge.name}
          onChange={(e) => onPatch({ name: e.target.value.slice(0, 64) })}
          className="!h-10 min-w-[8rem] !py-2 !pt-2"
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={16}
            max={56}
            step={2}
            value={badge.heightPx}
            onChange={(e) => onPatch({ heightPx: Number(e.target.value) })}
            className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-[var(--panel-line)] accent-[var(--color-brand-500)]"
          />
          <span className="w-8 text-xs tabular-nums text-[var(--panel-muted)]">{badge.heightPx}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={badge.active}
          onClick={() => onPatch({ active: !badge.active })}
          className={[
            'relative h-6 w-11 rounded-full transition',
            badge.active ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--panel-line)]',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
              badge.active ? 'left-[1.35rem]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className="rounded-md border border-[var(--panel-line)] px-2 py-1 text-xs disabled:opacity-35"
            title="Yukarı"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove(1)}
            className="rounded-md border border-[var(--panel-line)] px-2 py-1 text-xs disabled:opacity-35"
            title="Aşağı"
          >
            ↓
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
        >
          Sil
        </button>
      </td>
    </tr>
  );
}
