import gsap from 'gsap';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { defaultCustomerRows, findVirtualPos, type CustomerAgreementRow } from './mockPos';

const LIST_PATH = '/tanimlamalar/pos-kart/sanal-pos';

type CustomerCardBlock = {
  id: string;
  name: string;
  /** Seçilen dosya adı (mock) */
  logoFileName?: string;
  rows: CustomerAgreementRow[];
};

const SAMPLE_ALL = [
  '2,69',
  '5,75',
  '8,06',
  '10,36',
  '12,67',
  '14,97',
  '17,28',
  '19,58',
  '21,89',
  '24,44',
  '24,44',
  '24,44',
];

function seededRows(): CustomerAgreementRow[] {
  return defaultCustomerRows().map((r, i) => ({
    ...r,
    allRate: SAMPLE_ALL[i] ?? '',
    bireyselRate: '',
    ticariRate: '',
  }));
}

function newBlock(name: string): CustomerCardBlock {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    rows: seededRows(),
  };
}

/** Müşteri kart anlaşması — birden fazla kompakt kart bloğu */
export default function CustomerCardAgreementPage() {
  const { id = '' } = useParams();
  const row = useMemo(() => findVirtualPos(id), [id]);
  const [blocks, setBlocks] = useState<CustomerCardBlock[]>(() => [
    newBlock('Axess Kart'),
    newBlock('Bonus Kart'),
  ]);
  const [deleteTarget, setDeleteTarget] = useState<
    null | { kind: 'row'; blockId: string; rowIdx: number } | { kind: 'block'; blockId: string }
  >(null);
  const [savedFlash, setSavedFlash] = useState(false);

  if (!row) return <Navigate to={LIST_PATH} replace />;

  function patchRow(blockId: string, rowIdx: number, patch: Partial<CustomerAgreementRow>) {
    setBlocks((list) =>
      list.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              rows: b.rows.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)),
            },
      ),
    );
  }

  function patchBlock(blockId: string, patch: Partial<Pick<CustomerCardBlock, 'name' | 'logoFileName'>>) {
    setBlocks((list) => list.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  }

  function addRow(blockId: string) {
    setBlocks((list) =>
      list.map((b) => {
        if (b.id !== blockId) return b;
        const nextN = b.rows.length ? Math.max(...b.rows.map((r) => r.n)) + 1 : 1;
        return {
          ...b,
          rows: [
            ...b.rows,
            { n: nextN, minLimit: '0,00', allRate: '', bireyselRate: '', ticariRate: '' },
          ],
        };
      }),
    );
  }

  function addBlock() {
    setBlocks((list) => [...list, newBlock(`Yeni Kart ${list.length + 1}`)]);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'block') {
      setBlocks((list) => list.filter((b) => b.id !== deleteTarget.blockId));
    } else {
      const { blockId, rowIdx } = deleteTarget;
      setBlocks((list) =>
        list.map((b) =>
          b.id !== blockId ? b : { ...b, rows: b.rows.filter((_, i) => i !== rowIdx) },
        ),
      );
    }
    setDeleteTarget(null);
  }

  function save() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  const deleteLabel =
    deleteTarget?.kind === 'block'
      ? blocks.find((b) => b.id === deleteTarget.blockId)?.name ?? 'Kart bloğu'
      : deleteTarget
        ? `${blocks.find((b) => b.id === deleteTarget.blockId)?.rows[deleteTarget.rowIdx]?.n ?? ''}. Taksit`
        : '';

  return (
    <div className="relative w-full space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to={LIST_PATH}
            className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            ← Sanal POS Tanımları
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            {row.bankName} — Müşteri Kart Anlaşması
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            {blocks.length} kart bloğu · her biri bağımsız taksit oranları
          </p>
        </div>
        <button
          type="button"
          data-km-jump
          onClick={addBlock}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3.5 text-xs font-bold text-[var(--panel-ink)] shadow-sm transition hover:border-[var(--color-brand-500)]/45 hover:text-[var(--color-brand-600)]"
        >
          <span className="text-sm leading-none">+</span>
          Kart bloğu ekle
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {blocks.map((block) => (
          <CardBlock
            key={block.id}
            block={block}
            onPatchMeta={(p) => patchBlock(block.id, p)}
            onPatchRow={(i, p) => patchRow(block.id, i, p)}
            onAddRow={() => addRow(block.id)}
            onDeleteRow={(i) => setDeleteTarget({ kind: 'row', blockId: block.id, rowIdx: i })}
            onRemoveBlock={() => setDeleteTarget({ kind: 'block', blockId: block.id })}
            canRemoveBlock={blocks.length > 1}
          />
        ))}
      </div>

      <div className="sticky bottom-3 z-20">
        <div className="flex justify-end rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]/95 px-3 py-2.5 shadow-[0_10px_32px_rgba(0,0,0,0.1)] backdrop-blur-md">
          <div className="w-full max-w-[200px] sm:w-[200px]">
            <Button type="button" success={savedFlash} successLabel="Kaydedildi" onClick={save}>
              Değişiklikleri kaydet
            </Button>
          </div>
        </div>
      </div>

      {deleteTarget ? (
        <ConfirmModal
          title={deleteTarget.kind === 'block' ? 'Kart bloğunu kaldır' : 'Taksiti sil'}
          body={
            deleteTarget.kind === 'block' ? (
              <>
                <strong className="text-[var(--panel-ink)]">{deleteLabel}</strong> bloğu ve tüm
                taksitleri silinsin mi?
              </>
            ) : (
              <>
                <strong className="text-[var(--panel-ink)]">{deleteLabel}</strong> silinsin mi? Bu
                işlem geri alınamaz.
              </>
            )
          }
          confirmLabel={deleteTarget.kind === 'block' ? 'Bloğu kaldır' : 'Sil'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function CardBlock({
  block,
  onPatchMeta,
  onPatchRow,
  onAddRow,
  onDeleteRow,
  onRemoveBlock,
  canRemoveBlock,
}: {
  block: CustomerCardBlock;
  onPatchMeta: (p: Partial<Pick<CustomerCardBlock, 'name' | 'logoFileName'>>) => void;
  onPatchRow: (i: number, p: Partial<CustomerAgreementRow>) => void;
  onAddRow: () => void;
  onDeleteRow: (i: number) => void;
  onRemoveBlock: () => void;
  canRemoveBlock: boolean;
}) {
  const fileId = useId();

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="space-y-2.5 border-b border-[var(--panel-line)] p-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor={fileId}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-2.5 py-1.5 transition hover:border-[var(--color-brand-500)]/40"
          >
            <span className="shrink-0 rounded-md border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--panel-muted)]">
              Logo
            </span>
            <span className="truncate text-[11px] text-[var(--panel-muted)]">
              {block.logoFileName ?? 'Dosya seçilmedi'}
            </span>
            <input
              id={fileId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                onPatchMeta({ logoFileName: f?.name });
              }}
            />
          </label>
          <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-line)] bg-white px-1 dark:bg-[var(--panel-surface)]">
            <span className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              {block.name.slice(0, 8) || '—'}
            </span>
          </div>
        </div>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-semibold text-[var(--panel-muted)]">
            Adı <span className="text-rose-500">*</span>
          </span>
          <input
            value={block.name}
            onChange={(e) => onPatchMeta({ name: e.target.value })}
            data-km-jump
            className="h-8 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 text-sm font-semibold text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              <th className="w-12 px-1.5 py-1.5">Taksit</th>
              <th className="px-1.5 py-1.5">Alt limit</th>
              <th className="px-1.5 py-1.5">T. Kartlar</th>
              <th className="px-1.5 py-1.5">Bireysel</th>
              <th className="px-1.5 py-1.5">Ticari</th>
              <th className="w-8 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr
                key={`${block.id}-${i}`}
                className="border-b border-[var(--panel-line)]/60 last:border-b-0"
              >
                <td className="px-1 py-0.5">
                  <input
                    value={r.n}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, '')) || 1;
                      onPatchRow(i, { n });
                    }}
                    className="h-7 w-full rounded-md border border-[var(--panel-line)] bg-[var(--panel-surface)] px-1 text-center text-[11px] font-semibold tabular-nums outline-none focus:border-[var(--color-brand-500)]"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <Cell value={r.minLimit} onChange={(v) => onPatchRow(i, { minLimit: v })} />
                </td>
                <td className="px-1 py-0.5">
                  <Cell
                    value={r.allRate}
                    placeholder="Oran"
                    onChange={(v) => onPatchRow(i, { allRate: v })}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <Cell
                    value={r.bireyselRate}
                    placeholder="Oran"
                    onChange={(v) => onPatchRow(i, { bireyselRate: v })}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <Cell
                    value={r.ticariRate}
                    placeholder="Oran"
                    onChange={(v) => onPatchRow(i, { ticariRate: v })}
                  />
                </td>
                <td className="px-0.5 py-0.5">
                  <button
                    type="button"
                    aria-label="Sil"
                    onClick={() => onDeleteRow(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--panel-muted)] transition hover:bg-rose-600 hover:text-white"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--panel-line)] p-2">
        <button
          type="button"
          data-km-jump
          onClick={onAddRow}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--color-brand-600)] px-2.5 text-[11px] font-bold text-white transition hover:bg-[var(--color-brand-500)]"
        >
          <span className="text-sm leading-none">+</span>
          Yeni taksit
        </button>
        <button
          type="button"
          data-km-jump
          disabled={!canRemoveBlock}
          onClick={onRemoveBlock}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400"
        >
          Bloğu kaldır
        </button>
      </div>
    </section>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full rounded-md border border-[var(--panel-line)] bg-[var(--panel-surface)] px-1.5 text-right text-[11px] tabular-nums text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)]"
    />
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
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
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">{title}</h2>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">{body}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
