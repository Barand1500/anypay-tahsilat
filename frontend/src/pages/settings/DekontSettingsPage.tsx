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
  DEKONT_PREVIEW_SLIP_OPTIONS,
  DEKONT_VARIABLE_META,
  PAPER_CSS,
  SAMPLE_DEKONT_CTX,
  applyPreviewSlipKind,
  getDefaultDekontSettings,
  getDefaultFisBlocks,
  getDefaultSheetBlocks,
  newDekontBlock,
  type DekontBlock,
  type DekontBlockType,
  type DekontPaperFormat,
  type DekontPreviewSlipKind,
  type DekontSettings,
} from './dekontTypes';

gsap.registerPlugin(useGSAP);

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

function layoutBlocks(s: DekontSettings, tab: DekontPaperFormat): DekontBlock[] {
  if (tab === 'fis') return s.fis.blocks;
  if (tab === 'a5') return s.a5?.blocks ?? [];
  return s.a4?.blocks ?? [];
}

function ensureLayout(s: DekontSettings, tab: DekontPaperFormat): DekontFormatSafe {
  if (tab === 'fis') return { blocks: s.fis.blocks.length ? s.fis.blocks : getDefaultFisBlocks() };
  const cur = tab === 'a5' ? s.a5 : s.a4;
  return { blocks: cur?.blocks?.length ? cur.blocks : getDefaultSheetBlocks() };
}

type DekontFormatSafe = { blocks: DekontBlock[] };

/**
 * Ayarlar › Dekont — Canva benzeri Fiş / A5 / A4 editörü.
 */
export default function DekontSettingsPage() {
  const { token } = useAuth();
  const { logoUrl, systemName } = useBrand();
  const rootRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<DekontPaperFormat>('fis');
  const [previewKind, setPreviewKind] = useState<DekontPreviewSlipKind>('installment');
  const [draft, setDraft] = useState<DekontSettings>(() => getDefaultDekontSettings());
  const [baseline, setBaseline] = useState<DekontSettings>(() => getDefaultDekontSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const sampleCtx = useMemo(() => {
    const base = SAMPLE_DEKONT_CTX(logoUrl);
    return ctxFromSample(applyPreviewSlipKind(base, previewKind), systemName);
  }, [logoUrl, systemName, previewKind]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DekontSettings>('/api/settings/dekont', token);
      const next = cloneSettings({
        fis: data.fis?.blocks?.length ? data.fis : { blocks: getDefaultFisBlocks() },
        a5: data.a5?.blocks?.length ? data.a5 : { blocks: getDefaultSheetBlocks() },
        a4: data.a4?.blocks?.length ? data.a4 : { blocks: getDefaultSheetBlocks() },
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
  const blocks = layoutBlocks(draft, tab);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const palette = useMemo(
    () =>
      DEKONT_VARIABLE_META.filter((v) => {
        if (tab === 'fis') return !v.sheetOnly;
        return !v.fisOnly;
      }),
    [tab],
  );

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
    setSelectedId(null);
  }, [tab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selectedId) return;
      e.preventDefault();
      patchLayout(tab, (prev) => prev.filter((b) => b.id !== selectedId));
      setSelectedId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, tab]);

  function patchLayout(format: DekontPaperFormat, fn: (blocks: DekontBlock[]) => DekontBlock[]) {
    setDraft((prev) => {
      const cur = ensureLayout(prev, format);
      const nextBlocks = fn(cur.blocks);
      if (format === 'fis') return { ...prev, fis: { blocks: nextBlocks } };
      if (format === 'a5') return { ...prev, a5: { blocks: nextBlocks } };
      return { ...prev, a4: { blocks: nextBlocks } };
    });
  }

  function updateBlock(id: string, patch: Partial<DekontBlock>) {
    patchLayout(tab, (list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function addVariable(type: DekontBlockType) {
    const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);
    const block = newDekontBlock(type, {
      x: 5,
      y: Math.min(70, 8 + (blocks.length % 10) * 6),
      z: maxZ + 1,
    });
    patchLayout(tab, (list) => [...list, block]);
    setSelectedId(block.id);
  }

  function resetCurrent() {
    if (tab === 'fis') {
      setDraft((prev) => ({ ...prev, fis: { blocks: getDefaultFisBlocks() } }));
    } else if (tab === 'a5') {
      setDraft((prev) => ({ ...prev, a5: { blocks: getDefaultSheetBlocks() } }));
    } else {
      setDraft((prev) => ({ ...prev, a4: { blocks: getDefaultSheetBlocks() } }));
    }
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
      const payload: DekontSettings = {
        fis: draft.fis,
        a5: draft.a5?.blocks?.length ? draft.a5 : { blocks: getDefaultSheetBlocks() },
        a4: draft.a4?.blocks?.length ? draft.a4 : { blocks: getDefaultSheetBlocks() },
      };
      const data = await api.patch<DekontSettings>('/api/settings/dekont', payload, token);
      const next = cloneSettings({
        fis: data.fis,
        a5: data.a5 ?? { blocks: getDefaultSheetBlocks() },
        a4: data.a4 ?? { blocks: getDefaultSheetBlocks() },
      });
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
    <div ref={rootRef} className="space-y-4 pb-8">
      <div data-anim className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--panel-ink)]">Dekont Ayarları</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Fiş, A5 ve A4 düzenlerini sürükleyerek düzenleyin. Önizleme örnek içerik gösterir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={resetCurrent}
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

      <div data-anim className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-[var(--panel-line)] p-0.5 w-fit">
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

        <label className="flex items-center gap-2 text-xs text-[var(--panel-muted)]">
          <span className="font-semibold">Önizleme tipi</span>
          <select
            value={previewKind}
            onChange={(e) => setPreviewKind(e.target.value as DekontPreviewSlipKind)}
            className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          >
            {DEKONT_PREVIEW_SLIP_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
      ) : (
        <div data-anim className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[var(--panel-line)] bg-[#e8eef4] p-4 sm:p-5">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Tuval · {PAPER_CSS[tab].label}
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
                      patchLayout(tab, (list) => list.filter((b) => b.id !== selected.id));
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
            <div className="flex flex-1 justify-center">
              <DekontTemplateView
                blocks={blocks}
                ctx={sampleCtx}
                mode="edit"
                format={tab}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, x, y) => updateBlock(id, { x, y })}
                onResize={(id, w, h) => updateBlock(id, { w, h })}
                className="shadow-md"
              />
            </div>
          </div>

          {/* lg:h-0 lg:min-h-full → yan yana iken yükseklik tuvale eşit; taşınca iç scroll */}
          <aside className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 lg:h-0 lg:max-h-none lg:min-h-full">
            <div className="shrink-0">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--panel-muted)]">
                Değişkenler
              </p>
              <p className="mb-3 text-[11px] text-[var(--panel-muted)]">Tıklayın → tuvale eklenir</p>
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {palette.map((v) => (
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
