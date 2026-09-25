import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { api } from '../../lib/api';
import { AccountTypeModal, type AccountTypeFocusField } from './AccountTypeModal';
import {
  formatInstallmentsLabel,
  type AccountTypeDef,
} from './accountTypeTypes';

const COL_FOCUS: Record<string, AccountTypeFocusField> = {
  name: 'name',
  installments: 'installments',
};

/**
 * Tanımlamalar › Cari Tipleri — cari_tipleri (API).
 */
export default function AccountTypesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AccountTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'edit'; accountType: AccountTypeDef; focusField?: AccountTypeFocusField | null }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountTypeDef | null>(null);
  const [deleting, setDeleting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.get<AccountTypeDef[]>('/api/account-types', token);
      setRows(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Cari tipleri yüklenemedi');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(q));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-account-type-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function exportCsv() {
    const header = ['Adı', 'İzin Verilen Taksitler'];
    const lines = filtered.map((r) =>
      [r.name, formatInstallmentsLabel(r.installments)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cari-tipleri.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyList() {
    const text = filtered
      .map((r) => `${r.name}\t${formatInstallmentsLabel(r.installments)}`)
      .join('\n');
    void navigator.clipboard.writeText(text);
  }

  async function saveRow(next: Omit<AccountTypeDef, 'id'> & { id?: string }) {
    if (!token) return;
    setActionError(null);
    const payload = { name: next.name, installments: next.installments };
    try {
      if (next.id) {
        const updated = await api.patch<AccountTypeDef>(
          `/api/account-types/${encodeURIComponent(next.id)}`,
          payload,
          token,
        );
        setRows((prev) => prev.map((r) => (r.id === next.id ? updated : r)));
      } else {
        const created = await api.post<AccountTypeDef>('/api/account-types', payload, token);
        setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
      }
      setModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kayıt başarısız');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/api/account-types/${encodeURIComponent(deleteTarget.id)}`, token);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(row: AccountTypeDef, focusField?: AccountTypeFocusField | null) {
    setModal({ type: 'edit', accountType: row, focusField: focusField ?? 'name' });
  }

  function onRowDoubleClick(row: AccountTypeDef, e: ReactMouseEvent) {
    const col = (e.target as HTMLElement)
      .closest('[data-account-type-col]')
      ?.getAttribute('data-account-type-col');
    openEdit(row, col ? COL_FOCUS[col] ?? 'name' : 'name');
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center text-sm text-[var(--panel-muted)]">
        Cari tipleri yükleniyor…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
        <p className="text-sm text-rose-500">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-sm font-semibold text-[var(--color-brand-600)]"
        >
          Yeniden dene
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {actionError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {actionError}
        </p>
      ) : null}
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
                <SearchIcon />
              </span>
              <input
                data-km-jump
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara…"
                className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-56"
              />
            </div>
            <ExportDropdown onCsv={exportCsv} onCopy={copyList} />
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

        <div ref={tableRef} className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-[minmax(160px,1fr)_minmax(140px,1.2fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Adı</span>
              <span>İzin verilen taksitler</span>
              <span />
            </div>

            {slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı.
              </p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  data-account-type-row
                  data-km-row
                  tabIndex={-1}
                  onDoubleClick={(e) => onRowDoubleClick(r, e)}
                  title="Çift tıkla: düzenle"
                  className="grid cursor-pointer grid-cols-[minmax(160px,1fr)_minmax(140px,1.2fr)_44px] items-center gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/45"
                >
                  <span
                    data-account-type-col="name"
                    className="truncate font-semibold text-[var(--panel-ink)]"
                  >
                    {r.name}
                  </span>
                  <span
                    data-account-type-col="installments"
                    className="truncate text-sm text-[var(--panel-muted)]"
                  >
                    {formatInstallmentsLabel(r.installments)}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(r);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
          <p>
            {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
            {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
            {filtered.length}
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
      </section>

      {modal ? (
        <AccountTypeModal
          mode={modal}
          existingNames={rows.map((r) => r.name)}
          onClose={() => setModal(null)}
          onSave={saveRow}
          focusField={modal.type === 'edit' ? modal.focusField : 'name'}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.name}
          busy={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[var(--panel-line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function DeleteModal({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy?: boolean;
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
        if (!busy) onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, busy]);

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
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">Cari tipini sil</h2>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">
            <strong className="text-[var(--panel-ink)]">{name}</strong> silinsin mi? Bu işlem geri
            alınamaz.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
