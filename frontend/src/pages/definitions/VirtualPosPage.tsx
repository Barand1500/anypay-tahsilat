import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { api } from '../../lib/api';
import type { BankDef } from './bankTypes';
import { setVirtualPosList, type VirtualPosRow } from './mockPos';
import { VirtualPosModal, type VirtualPosModalMode } from './VirtualPosModal';

/** Tanımlamalar › POS › Sanal POS Tanımları — API */
export default function VirtualPosPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<VirtualPosRow[]>([]);
  const [banks, setBanks] = useState<BankDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<VirtualPosModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VirtualPosRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [list, bankList] = await Promise.all([
        api.get<VirtualPosRow[]>('/api/virtual-pos', token),
        api.get<BankDef[]>('/api/banks', token),
      ]);
      setRows(list);
      setVirtualPosList(list);
      setBanks(bankList);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Sanal POS yüklenemedi');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setVirtualPosList(rows);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.bankName} ${r.posName} ${r.securityType}`.toLocaleLowerCase('tr').includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [query, pageSize]);

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

  async function toggleDefault(id: string) {
    if (!token) return;
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    setActionError(null);
    try {
      const updated = await api.patch<VirtualPosRow>(
        `/api/virtual-pos/${id}`,
        { isDefault: !target.isDefault },
        token,
      );
      setRows((list) =>
        list.map((r) => {
          if (r.id === updated.id) return updated;
          return updated.isDefault ? { ...r, isDefault: false } : r;
        }),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Güncellenemedi');
    }
  }

  async function toggleActive(id: string) {
    if (!token) return;
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    setActionError(null);
    try {
      const updated = await api.patch<VirtualPosRow>(
        `/api/virtual-pos/${id}`,
        { active: !target.active },
        token,
      );
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Güncellenemedi');
    }
  }

  async function saveRow(data: {
    bankId: string;
    bankName: string;
    infrastructureId: string;
    posName: string;
    merchantId: string;
    terminalSafeId: string;
    securityKey: string;
    terminalPassword: string;
    securityType: string;
  }) {
    if (!token) throw new Error('Oturum gerekli');
    setActionError(null);
    const body = {
      bankId: data.bankId,
      infrastructureId: data.infrastructureId,
      posName: data.posName,
      merchantId: data.merchantId,
      terminalSafeId: data.terminalSafeId,
      securityKey: data.securityKey,
      terminalPassword: data.terminalPassword,
      securityType: data.securityType,
    };
    if (modal?.type === 'edit') {
      const updated = await api.patch<VirtualPosRow>(
        `/api/virtual-pos/${modal.row.id}`,
        body,
        token,
      );
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      const created = await api.post<VirtualPosRow>('/api/virtual-pos', body, token);
      setRows((list) => [...list, created]);
    }
  }

  async function confirmDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/api/virtual-pos/${deleteTarget.id}`, token);
      setRows((list) => list.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const header = ['Banka', 'Sanal POS', 'Güvenlik Tipi', 'Varsayılan', 'Durum'];
    const lines = filtered.map((r) =>
      [
        r.bankName,
        r.posName,
        r.securityType,
        r.isDefault ? 'Evet' : 'Hayır',
        r.active ? 'Aktif' : 'Pasif',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    downloadCsv('sanal-pos.csv', [header.join(';'), ...lines].join('\n'));
  }

  const existingKeys = rows.map((r) => `${r.bankId}|${r.infrastructureId}`);
  const bankOptions = banks.map((b) => ({
    id: b.id,
    name: b.name,
    securityTypes: b.securityTypes,
  }));

  if (loading && rows.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-[var(--panel-muted)]">
        Sanal POS yükleniyor…
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
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
              placeholder="Ara"
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
                Kayıt bulunamadı. + Ekle ile sanal POS tanımı oluşturun.
              </p>
            ) : (
              slice.map((r) => (
                <VirtualPosRowView
                  key={r.id}
                  row={r}
                  onToggleDefault={() => void toggleDefault(r.id)}
                  onToggleActive={() => void toggleActive(r.id)}
                  onEdit={() => setModal({ type: 'edit', row: r })}
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
          banks={bankOptions}
          existingKeys={existingKeys}
          onClose={() => setModal(null)}
          onSave={saveRow}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.posName}
          busy={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
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
  const logo = row.bankLogoUrl;
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
        <h3 className="text-base font-bold text-[var(--panel-ink)]">Sanal POS sil</h3>
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

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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
        d="M5 7h14M10 11v6M14 11v6M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
