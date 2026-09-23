import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { BANKS } from '../payments/mockBanks';
import { getVirtualPosList, setVirtualPosList, type VirtualPosRow } from './mockPos';
import { VirtualPosModal, type VirtualPosModalMode } from './VirtualPosModal';

function bankLogo(bankId: string) {
  return BANKS.find((b) => b.id === bankId)?.logo;
}

/** Tanımlamalar › POS › Sanal POS Tanımları */
export default function VirtualPosPage() {
  const [rows, setRows] = useState(() => getVirtualPosList());
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<VirtualPosModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VirtualPosRow | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.bankName} ${r.posName}`.toLocaleLowerCase('tr').includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [query, pageSize]);

  useEffect(() => {
    setVirtualPosList(rows);
  }, [rows]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-vpos-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function toggleDefault(id: string) {
    setRows((list) => {
      const target = list.find((r) => r.id === id);
      if (!target) return list;
      const nextDefault = !target.isDefault;
      return list.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            isDefault: nextDefault,
            // Varsayılan açılınca durum otomatik aktif
            active: nextDefault ? true : r.active,
          };
        }
        return {
          ...r,
          isDefault: nextDefault ? false : r.isDefault,
        };
      });
    });
  }

  function toggleActive(id: string) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  }

  function saveRow(data: {
    bankId: string;
    bankName: string;
    infrastructureId: string;
    posName: string;
  }) {
    if (modal?.type === 'edit') {
      const id = modal.id;
      setRows((list) =>
        list.map((r) =>
          r.id === id
            ? {
                ...r,
                bankId: data.bankId,
                bankName: data.bankName,
                infrastructureId: data.infrastructureId,
                posName: data.posName,
              }
            : r,
        ),
      );
    } else {
      setRows((list) => [
        ...list,
        {
          id: `vpos-${Date.now()}`,
          bankId: data.bankId,
          bankName: data.bankName,
          infrastructureId: data.infrastructureId,
          posName: data.posName,
          isDefault: false,
          active: true,
        },
      ]);
    }
    setModal(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setRows((list) => list.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function exportCsv() {
    const header = ['Banka', 'Sanal POS', 'Varsayılan', 'Durum'];
    const lines = filtered.map((r) =>
      [r.bankName, r.posName, r.isDefault ? 'Evet' : 'Hayır', r.active ? 'Aktif' : 'Pasif']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    downloadCsv('sanal-pos.csv', [header.join(';'), ...lines].join('\n'));
  }

  const existingKeys = rows.map((r) => `${r.bankId}|${r.infrastructureId}`);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          Sanal POS Tanımları
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown onCsv={exportCsv} />
          <button
            type="button"
            data-km-jump
            onClick={() => setModal({ type: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="text-lg leading-none">+</span>
            Ekle
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
          <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
            <input
              type="text"
              inputMode="numeric"
              data-km-jump
              value={pageSizeText}
              onChange={(e) => setPageSizeText(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => applyPageSize(pageSizeText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="w-11 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
            />
            veri göster
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
              <SearchIcon />
            </span>
            <input
              data-km-jump
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara…"
              className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand-500)] sm:w-56"
            />
          </div>
        </div>

        <div ref={tableRef} className="overflow-x-auto">
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[minmax(200px,1.3fr)_minmax(160px,1fr)_88px_88px_minmax(300px,1.5fr)] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Banka</span>
              <span>Sanal POS</span>
              <span>Varsayılan</span>
              <span>Durum</span>
              <span />
            </div>
            {slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı.
              </p>
            ) : (
              slice.map((r) => (
                <VirtualPosRowView
                  key={r.id}
                  row={r}
                  onToggleDefault={() => toggleDefault(r.id)}
                  onToggleActive={() => toggleActive(r.id)}
                  onEdit={() =>
                    setModal({
                      type: 'edit',
                      id: r.id,
                      bankId: r.bankId,
                      infrastructureId: r.infrastructureId,
                    })
                  }
                  onDelete={() => setDeleteTarget(r)}
                />
              ))
            )}
          </div>
        </div>

        <ListFooter
          safePage={safePage}
          pageSize={pageSize}
          sliceLen={slice.length}
          total={filtered.length}
          totalPages={totalPages}
          setPage={setPage}
        />
      </section>

      {modal ? (
        <VirtualPosModal
          mode={modal}
          existingKeys={existingKeys}
          onClose={() => setModal(null)}
          onSave={saveRow}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.posName}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function VirtualPosRowView({
  row,
  onToggleDefault,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  row: VirtualPosRow;
  onToggleDefault: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const logo = bankLogo(row.bankId);
  return (
    <div
      data-vpos-row
      data-km-row
      tabIndex={-1}
      onDoubleClick={onEdit}
      title="Çift tıkla: düzenle"
      className="grid cursor-pointer grid-cols-[minmax(200px,1.3fr)_minmax(160px,1fr)_88px_88px_minmax(300px,1.5fr)] items-center gap-3 border-b border-[var(--panel-line)]/70 px-5 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/45"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {logo ? (
          <img src={logo} alt="" className="h-8 w-auto max-w-[72px] object-contain" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--panel-surface)] text-[10px] font-bold text-[var(--panel-muted)]">
            —
          </span>
        )}
        <span className="truncate text-sm font-semibold text-[var(--panel-ink)]">{row.bankName}</span>
      </div>
      <span className="truncate text-sm text-[var(--panel-ink)]">{row.posName}</span>
      <Toggle on={row.isDefault} onClick={onToggleDefault} label="Varsayılan" />
      <Toggle on={row.active} onClick={onToggleActive} label="Durum" />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Link
          to={`/tanimlamalar/pos-kart/sanal-pos/${row.id}/banka-anlasma`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
        >
          Banka Kart Anlaşması
        </Link>
        <Link
          to={`/tanimlamalar/pos-kart/sanal-pos/${row.id}/musteri-anlasma`}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="rounded-lg border border-emerald-600/50 bg-[var(--panel-elevated)] px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/10"
        >
          Müşteri Kart Anlaşması
        </Link>
        <button
          type="button"
          aria-label="Sil"
          title="Sil"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={[
        'relative h-6 w-11 rounded-full transition',
        on ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
          on ? 'left-[1.35rem]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  );
}

function ListFooter({
  safePage,
  pageSize,
  sliceLen,
  total,
  totalPages,
  setPage,
}: {
  safePage: number;
  pageSize: number;
  sliceLen: number;
  total: number;
  totalPages: number;
  setPage: (n: number | ((p: number) => number)) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
      <p>
        {(safePage - 1) * pageSize + (sliceLen ? 1 : 0)} ile{' '}
        {Math.min(safePage * pageSize, total)} arasında veri gösteriliyor. Toplam: {total}
      </p>
      <div className="flex flex-wrap gap-1">
        <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
          İlk
        </PagerBtn>
        <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Geri
        </PagerBtn>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-2 text-xs font-bold text-white">
          {safePage}
        </span>
        <PagerBtn
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          İleri
        </PagerBtn>
        <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
          Son
        </PagerBtn>
      </div>
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-[var(--panel-line)] px-2.5 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function DeleteModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
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
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">Sanal POS tanımını sil</h2>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">
            <strong className="text-[var(--panel-ink)]">{name}</strong> silinsin mi? Bu işlem geri
            alınamaz.
          </p>
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
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
