import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useBrand } from '../../brand/BrandContext';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import {
  DekontTemplateView,
  DekontVariablePreview,
  ctxFromSample,
} from './DekontTemplateView';
import {
  DEKONT_VARIABLE_META,
  SAMPLE_DEKONT_CTX,
  getDefaultDekontSettings,
  getDefaultFisBlocks,
  newDekontBlock,
  type DekontBlock,
  type DekontBlockType,
  type DekontSettings,
} from './dekontTypes';

gsap.registerPlugin(useGSAP);

type FormatTab = 'fis' | 'a5' | 'a4';

function cloneSettings(s: DekontSettings): DekontSettings {
  return {
    fis: { blocks: s.fis.blocks.map((b) => ({ ...b })) },
    a5: s.a5 ? { blocks: s.a5.blocks.map((b) => ({ ...b })) } : null,
    a4: s.a4 ? { blocks: s.a4.blocks.map((b) => ({ ...b })) } : null,
  };
}

function settingsKey(s: DekontSettings): string {
  return JSON.stringify(s);
}

/**
 * Ayarlar › Dekont — Canva benzeri 80mm fiş editörü.
 */
export default function DekontSettingsPage() {
  const { token } = useAuth();
  const { logoUrl, systemName } = useBrand();
  const rootRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<FormatTab>('fis');
  const [draft, setDraft] = useState<DekontSettings>(() => getDefaultDekontSettings());
  const [baseline, setBaseline] = useState<DekontSettings>(() => getDefaultDekontSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const sampleCtx = useMemo(
    () => ctxFromSample(SAMPLE_DEKONT_CTX(logoUrl), systemName),
    [logoUrl, systemName],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DekontSettings>('/api/settings/dekont', token);
      const next = cloneSettings({
        fis: data.fis?.blocks?.length ? data.fis : { blocks: getDefaultFisBlocks() },
        a5: data.a5 ?? null,
        a4: data.a4 ?? null,
      });
      setDraft(next);
      setBaseline(cloneSettings(next));
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dekont ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = settingsKey(draft) !== settingsKey(baseline);
  const blocks = draft.fis.blocks;
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power3.out' },
      );
    },
    { scope: rootRef, dependencies: [loading] },
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== 'fis') return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selectedId) return;
      e.preventDefault();
      setDraft((prev) => ({
        ...prev,
        fis: { blocks: prev.fis.blocks.filter((b) => b.id !== selectedId) },
      }));
      setSelectedId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, tab]);

  function updateBlock(id: string, patch: Partial<DekontBlock>) {
    setDraft((prev) => ({
      ...prev,
      fis: {
        blocks: prev.fis.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      },
    }));
  }

  function addVariable(type: DekontBlockType) {
    const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);
    const block = newDekontBlock(type, {
      x: 5,
      y: Math.min(70, 8 + (blocks.length % 10) * 6),
      z: maxZ + 1,
    });
    setDraft((prev) => ({
      ...prev,
      fis: { blocks: [...prev.fis.blocks, block] },
    }));
    setSelectedId(block.id);
  }

  function resetFis() {
    setDraft((prev) => ({
      ...prev,
      fis: { blocks: getDefaultFisBlocks() },
    }));
    setSelectedId(null);
  }

  async function save() {
    if (!token || saving || !dirty) return;
    if (!draft.fis.blocks.length) {
      setError('Fiş düzeninde en az bir blok gerekli');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveOk(false);
    try {
      const data = await api.patch<DekontSettings>('/api/settings/dekont', draft, token);
      const next = cloneSettings(data);
      setDraft(next);
      setBaseline(cloneSettings(next));
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="space-y-4">
      <div data-anim className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--panel-ink)]">Dekont Ayarları</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            80mm fiş düzenini sürükleyerek düzenleyin. Değişkenler örnek içerikle gösterilir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={resetFis}
            className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-50"
          >
            Sıfırla
          </button>
          <div className="w-36">
            <Button
              type="button"
              disabled={loading || saving || !dirty}
              loading={saving}
              success={saveOk}
              onClick={() => void save()}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </div>

      <div data-anim className="flex rounded-xl border border-[var(--panel-line)] p-0.5 w-fit">
        {(
          [
            { id: 'fis' as const, label: 'Fiş (80mm)' },
            { id: 'a5' as const, label: 'A5' },
            { id: 'a4' as const, label: 'A4' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              tab === t.id
                ? 'bg-[var(--color-brand-600)] text-white'
                : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
      ) : tab !== 'fis' ? (
        <div
          data-anim
          className="rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-6 py-16 text-center"
        >
          <p className="text-base font-semibold text-[var(--panel-ink)]">Yakında</p>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">
            {tab.toUpperCase()} düzeni henüz Canva editöründe yok — canlı dekontta mevcut kutu düzeni
            kullanılır. Veri modeli hazır.
          </p>
        </div>
      ) : (
        <div data-anim className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-2xl border border-[var(--panel-line)] bg-[#e8eef4] p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Tuval · 80mm
              </p>
              {selected ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--panel-muted)]">
                    Boyut
                    <input
                      type="range"
                      min={0.7}
                      max={1.6}
                      step={0.05}
                      value={selected.fontScale}
                      onChange={(e) =>
                        updateBlock(selected.id, { fontScale: Number(e.target.value) })
                      }
                      className="w-24"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        fis: { blocks: prev.fis.blocks.filter((b) => b.id !== selected.id) },
                      }));
                      setSelectedId(null);
                    }}
                    className="rounded-lg border border-red-300/70 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                    title="Sil (Delete)"
                  >
                    Sil
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--panel-muted)]">Blok seçin veya sağdan ekleyin</p>
              )}
            </div>
            <div className="flex justify-center overflow-auto">
              <DekontTemplateView
                blocks={blocks}
                ctx={sampleCtx}
                mode="edit"
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, x, y) => updateBlock(id, { x, y })}
                onResize={(id, w, h) => updateBlock(id, { w, h })}
                className="shadow-md"
              />
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              Değişkenler
            </p>
            <p className="mb-3 text-[11px] text-[var(--panel-muted)]">
              Tıklayın → tuvale eklenir
            </p>
            <ul className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto pr-1">
              {DEKONT_VARIABLE_META.map((v) => (
                <li key={v.type}>
                  <button
                    type="button"
                    onClick={() => addVariable(v.type)}
                    className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/50 p-2 text-left transition hover:border-[var(--color-brand-500)] hover:bg-[var(--panel-hover)]"
                  >
                    <DekontVariablePreview type={v.type} ctx={sampleCtx} />
                    <span className="mt-1.5 block text-[12px] font-semibold text-[var(--panel-ink)]">
                      {v.label}
                    </span>
                    <span className="block text-[10px] text-[var(--panel-muted)]">{v.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
