import { CanRemove } from '../../permissions/CanRemove';
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
import { BankModal } from './BankModal';
import type { BankDef, BankFocusField } from './bankTypes';

const COL_FOCUS: Record<string, BankFocusField> = {
  name: 'name',
  shortName: 'shortName',
  logo: 'logo',
};

/**
 * Tanımlamalar › Bankalar — bankalar tablosu (API).
 */
export default function BanksPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<BankDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'edit'; bank: BankDef; focusField?: BankFocusField | null }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BankDef | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.get<BankDef[]>('/api/banks', token);
      setRows(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Bankalar yüklenemedi');
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
    return rows.filter((r) =>
      [r.name, r.shortName, r.securityTypes, r.gateway3dUrl, r.apiUrl]
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-bank-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('[data-bank-menu]') || t.closest('[data-bank-menu-btn]')) return;
      setMenu(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function exportCsv() {
    const header = [
      'Adı',
      'Kısa Adı',
      'Güvenlik Tipleri',
      '3D Geçit Url',
      'Api Url',
      'Xml Url',
    ];
    const lines = filtered.map((r) =>
      [r.name, r.shortName, r.securityTypes, r.gateway3dUrl, r.apiUrl, r.xmlUrl]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bankalar.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyList() {
    const text = filtered.map((r) => `${r.name}\t${r.shortName}`).join('\n');
    await navigator.clipboard.writeText(text);
  }

  async function refreshBanks() {
    if (!token || refreshing) return;
    setRefreshing(true);
    setActionError(null);
    try {
      const list = await api.post<BankDef[]>('/api/banks/refresh', {}, token);
      setRows(list);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Güncellenemedi');
    } finally {
      setRefreshing(false);
    }
  }

  async function saveRow(payload: {
    id?: string;
    name: string;
    shortName: string;
    securityTypes: string;
    gateway3dUrl: string;
    apiUrl: string;
    xmlUrl: string;
    logoDataUrl?: string | null;
    logo?: string | null;
  }) {
    if (!token) throw new Error('Oturum gerekli');
    setActionError(null);
    const body = {
      name: payload.name,
      shortName: payload.shortName,
      securityTypes: payload.securityTypes,
      gateway3dUrl: payload.gateway3dUrl,
      apiUrl: payload.apiUrl,
      xmlUrl: payload.xmlUrl,
      logoDataUrl: payload.logoDataUrl ?? undefined,
      logo: payload.logo ?? undefined,
    };
    if (payload.id) {
      const updated = await api.patch<BankDef>(`/api/banks/${payload.id}`, body, token);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      const created = await api.post<BankDef>('/api/banks', body, token);
      setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/api/banks/${deleteTarget.id}`, token);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  }

  function onRowDoubleClick(r: BankDef, e: ReactMouseEvent) {
    const col = (e.target as HTMLElement).closest('[data-bank-col]')?.getAttribute('data-bank-col');
    const focus = col ? COL_FOCUS[col] : 'name';
    setModal({ type: 'edit', bank: r, focusField: focus ?? 'name' });
  }

  function openMenu(e: ReactMouseEvent, id: string) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ id, top: rect.bottom + 4, left: Math.min(rect.right - 160, window.innerWidth - 172) });
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--panel-muted)]">
        Bankalar yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {actionError}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
          <h1 className="text-lg font-bold text-[var(--panel-ink)]">Bankalar</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-km-jump
              disabled={refreshing}
              onClick={() => void refreshBanks()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            >
              <RefreshIcon />
              {refreshing ? 'Güncelleniyor…' : 'Bankaları Güncelle'}
            </button>
            <ExportDropdown onCsv={exportCsv} onCopy={() => void copyList()} />
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
            <input
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
              placeholder="Ara"
              className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-56"
            />
          </div>
        </div>

        <div ref={tableRef} className="overflow-x-auto">
          <div className="min-w-[480px]">
            <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Adı</span>
              <span>Kısa Adı</span>
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
                  data-bank-row
                  data-km-row
                  tabIndex={-1}
                  onDoubleClick={(e) => onRowDoubleClick(r, e)}
                  title="Çift tıkla: düzenle"
                  className="grid cursor-pointer grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_44px] items-center gap-3 border-b border-[var(--panel-line)] px-5 py-3 transition last:border-b-0 hover:bg-[var(--panel-hover)]/45"
                >
                  <div data-bank-col="name" className="flex min-w-0 items-center gap-3">
                    {r.logoUrl ? (
                      <img
                        src={r.logoUrl}
                        alt=""
                        className="h-8 w-16 shrink-0 object-contain"
                      />
                    ) : (
                      <span className="flex h-8 w-16 shrink-0 items-center justify-center rounded bg-[var(--panel-surface)] text-[10px] text-[var(--panel-muted)]">
                        —
                      </span>
                    )}
                    <span className="truncate font-semibold text-[var(--panel-ink)]">{r.name}</span>
                  </div>
                  <span
                    data-bank-col="shortName"
                    className="truncate text-sm font-medium uppercase tracking-wide text-[var(--panel-muted)]"
                  >
                    {r.shortName}
                  </span>
                  <div className="relative flex justify-end">
                    <button
                      type="button"
                      data-bank-menu-btn
                      aria-label="Menü"
                      onClick={(e) => openMenu(e, r.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                    >
                      <DotsIcon />
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
        <BankModal mode={modal} onClose={() => setModal(null)} onSave={saveRow} />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.name}
          busy={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {menu
        ? createPortal(
            <div
              data-bank-menu
              className="fixed z-[9000] min-w-[10rem] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-lg"
              style={{ top: menu.top, left: menu.left }}
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                onClick={() => {
                  const row = rows.find((r) => r.id === menu.id);
                  setMenu(null);
                  if (row) setModal({ type: 'edit', bank: row });
                }}
              >
                Düzenle
              </button>
              <CanRemove><button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-500/10"
                onClick={() => {
                  const row = rows.find((r) => r.id === menu.id);
                  setMenu(null);
                  if (row) setDeleteTarget(row);
                }}
              >
                Sil
              </button></CanRemove>
            </div>,
            document.body,
          )
        : null}
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
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, busy]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <h3 className="text-base font-bold text-[var(--panel-ink)]">Bankayı sil</h3>
        <p className="mt-2 text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kaydı silinecek. Emin
          misiniz?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-4 py-2 text-sm font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 13.5-5.8M20 12a8 8 0 0 1-13.5 5.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M17.5 4v4.5H13M6.5 20v-4.5H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
