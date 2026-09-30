import gsap from 'gsap';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { api } from '../../lib/api';
import { ContractModal } from './ContractModal';
import {
  clearLocalContractsCache,
  CONTRACT_LINK_OPTIONS,
  readLocalContractsForMigrate,
  type ContractDef,
} from './mockContracts';

/**
 * Tanımlamalar › Sözleşmeler — API CRUD; sıra sürükle; footer bağlantıları.
 */
export default function ContractsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ContractDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    { type: 'create' } | { type: 'edit'; contract: ContractDef } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractDef | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let list = await api.get<ContractDef[]>('/api/contracts', token);
      const hasBody = list.some((c) => (c.body || '').trim());
      if (!hasBody) {
        const local = readLocalContractsForMigrate();
        if (local?.some((c) => c.body.trim())) {
          list = await api.post<ContractDef[]>(
            '/api/contracts/import',
            {
              items: local.map((c) => ({
                name: c.name,
                body: c.body,
                link: c.link,
                order: c.order,
              })),
            },
            token,
          );
          clearLocalContractsCache();
        }
      } else {
        clearLocalContractsCache();
      }
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => {
      const linkLabel = CONTRACT_LINK_OPTIONS.find((x) => x.id === r.link)?.label ?? '';
      return `${r.name} ${linkLabel}`.toLocaleLowerCase('tr').includes(q);
    });
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-contract-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [safePage, pageSize, query, filtered.length]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function exportCsv() {
    const header = ['Sıra', 'Adı', 'Bağlantı'];
    const lines = filtered.map((r, i) => {
      const link = CONTRACT_LINK_OPTIONS.find((x) => x.id === r.link)?.label ?? '—';
      return [String(i), r.name, link]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';');
    });
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sozlesmeler.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyList() {
    const text = filtered
      .map((r, i) => {
        const link = CONTRACT_LINK_OPTIONS.find((x) => x.id === r.link)?.label ?? '—';
        return `${i}\t${r.name}\t${link}`;
      })
      .join('\n');
    void navigator.clipboard.writeText(text);
  }

  async function saveRow(next: Omit<ContractDef, 'id' | 'order'> & { id?: string }) {
    if (!token) return;
    try {
      if (next.id) {
        await api.patch(
          `/api/contracts/${encodeURIComponent(next.id)}`,
          { name: next.name, body: next.body, link: next.link },
          token,
        );
      } else {
        await api.post(
          '/api/contracts',
          { name: next.name, body: next.body, link: next.link },
          token,
        );
      }
      setModal(null);
      await reload();
    } catch {
      /* */
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !token) return;
    try {
      await api.delete(`/api/contracts/${encodeURIComponent(deleteTarget.id)}`, token);
      setDeleteTarget(null);
      await reload();
    } catch {
      /* */
    }
  }

  async function moveRow(fromId: string, toId: string) {
    if (fromId === toId || !token) return;
    const from = rows.findIndex((r) => r.id === fromId);
    const to = rows.findIndex((r) => r.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const ordered = next.map((r, i) => ({ ...r, order: i }));
    setRows(ordered);
    try {
      const list = await api.post<ContractDef[]>(
        '/api/contracts/reorder',
        { ids: ordered.map((r) => r.id) },
        token,
      );
      setRows(list);
    } catch {
      await reload();
    }
  }

  function onDragStart(e: ReactDragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e: ReactDragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  }

  function onDrop(e: ReactDragEvent, id: string) {
    e.preventDefault();
    const from = e.dataTransfer.getData('text/plain') || dragId;
    if (from) void moveRow(from, id);
    setDragId(null);
    setOverId(null);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, filtered.length);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Sözleşmeler</h1>
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
            <div className="grid grid-cols-[64px_minmax(200px,1fr)_minmax(140px,0.9fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Sıra</span>
              <span>Adı</span>
              <span>Bağlantı</span>
              <span />
            </div>

            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Yükleniyor…
              </p>
            ) : slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı.
              </p>
            ) : (
              slice.map((r, i) => {
                const linkLabel =
                  r.link === 'none'
                    ? '—'
                    : (CONTRACT_LINK_OPTIONS.find((x) => x.id === r.link)?.label ?? r.link);
                const sira = (safePage - 1) * pageSize + i;
                const dragging = dragId === r.id;
                const dropTarget = overId === r.id && dragId !== r.id;
                return (
                  <div
                    key={r.id}
                    data-contract-row
                    data-km-row
                    tabIndex={-1}
                    onDoubleClick={() => setModal({ type: 'edit', contract: r })}
                    onDragOver={(e) => onDragOver(e, r.id)}
                    onDrop={(e) => onDrop(e, r.id)}
                    title="Çift tıkla: düzenle"
                    className={[
                      'grid cursor-pointer grid-cols-[64px_minmax(200px,1fr)_minmax(140px,0.9fr)_44px] items-center gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 transition last:border-b-0',
                      dragging ? 'opacity-45' : 'hover:bg-[var(--panel-hover)]/45',
                      dropTarget
                        ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)] ring-1 ring-inset ring-[var(--color-brand-500)]/35'
                        : '',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      draggable
                      aria-label="Sırayı değiştir — sürükle"
                      title="Sürükleyerek sırayı değiştir"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onDragStart={(e) => onDragStart(e, r.id)}
                      onDragEnd={onDragEnd}
                      className="inline-flex h-8 w-11 cursor-grab items-center justify-center gap-1 rounded-lg text-sm tabular-nums text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] active:cursor-grabbing"
                    >
                      <GripIcon />
                      <span>{sira}</span>
                    </button>
                    <span className="truncate text-sm font-semibold text-[var(--panel-ink)]">
                      {r.name}
                    </span>
                    <span className="truncate text-xs text-[var(--panel-muted)]">{linkLabel}</span>
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
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-line)] px-4 py-3 text-xs text-[var(--panel-muted)] sm:px-5">
          <p>
            {from} ile {to} arasında veri gösteriliyor. Toplam: {filtered.length}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
              İlk
            </PagerBtn>
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Geri
            </PagerBtn>
            <span className="mx-1 inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] px-2 text-xs font-bold text-white">
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
        <ContractModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={(next) => void saveRow(next)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirm
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function DeleteConfirm({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl">
        <p className="text-sm font-bold text-[var(--panel-ink)]">Sözleşme silinsin mi?</p>
        <p className="mt-1 text-xs text-[var(--panel-muted)]">{name}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
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

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2.5" r="1.2" />
      <circle cx="7.5" cy="2.5" r="1.2" />
      <circle cx="2.5" cy="7" r="1.2" />
      <circle cx="7.5" cy="7" r="1.2" />
      <circle cx="2.5" cy="11.5" r="1.2" />
      <circle cx="7.5" cy="11.5" r="1.2" />
    </svg>
  );
}
