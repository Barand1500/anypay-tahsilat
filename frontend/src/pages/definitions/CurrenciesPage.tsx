import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { CurrencyModal, type CurrencyFocusField } from './CurrencyModal';
import {
  formatRate,
  INITIAL_CURRENCIES,
  resolveMockRate,
  type CurrencyDef,
} from './mockCurrencies';

const COL_FOCUS: Record<string, CurrencyFocusField> = {
  name: 'name',
  shortName: 'shortName',
  symbol: 'symbol',
  rateType: 'rateType',
  rate: 'rate',
  autoUpdate: 'autoUpdate',
  status: 'status',
};

/**
 * Tanımlamalar › Para Birimleri — liste + ekle/düzenle (mock).
 */
export default function CurrenciesPage() {
  const [rows, setRows] = useState<CurrencyDef[]>(() => [...INITIAL_CURRENCIES]);
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'edit'; currency: CurrencyDef; focusField?: CurrencyFocusField | null }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CurrencyDef | null>(null);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.shortName, r.symbol, r.rateType, r.status]
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
    const els = tableRef.current?.querySelectorAll('[data-currency-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('[data-currency-menu]') || t.closest('[data-currency-menu-btn]')) return;
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
    const header = ['Adı', 'Kısa Adı', 'Sembol', 'Kur Tipi', 'Kur', 'Oto Güncelleme', 'Durum'];
    const lines = filtered.map((r) =>
      [r.name, r.shortName, r.symbol, r.rateType, formatRate(r.rate), r.autoUpdate ? 'Açık' : 'Kapalı', r.status]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'para-birimleri.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyList() {
    const text = filtered
      .map(
        (r) =>
          `${r.name}\t${r.shortName}\t${r.symbol}\t${r.rateType}\t${formatRate(r.rate)}\t${r.autoUpdate ? 'Açık' : 'Kapalı'}\t${r.status}`,
      )
      .join('\n');
    void navigator.clipboard.writeText(text);
  }

  function saveCurrency(next: Omit<CurrencyDef, 'id'> & { id?: string }) {
    if (next.id) {
      setRows((prev) => prev.map((r) => (r.id === next.id ? { ...r, ...next, id: next.id } : r)));
    } else {
      setRows((prev) => [
        ...prev,
        {
          ...next,
          id: `cur-${Date.now()}`,
        },
      ]);
    }
    setModal(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function refreshRate(row: CurrencyDef) {
    setRefreshingId(row.id);
    window.setTimeout(() => {
      const next = resolveMockRate(row.shortName, row.rateType);
      if (next != null) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, rate: next } : r)));
      }
      setRefreshingId(null);
    }, 520);
  }

  function openEdit(row: CurrencyDef, focusField?: CurrencyFocusField | null) {
    setModal({ type: 'edit', currency: row, focusField: focusField ?? 'name' });
  }

  function onRowDoubleClick(row: CurrencyDef, e: ReactMouseEvent) {
    const col = (e.target as HTMLElement)
      .closest('[data-currency-col]')
      ?.getAttribute('data-currency-col');
    openEdit(row, col ? COL_FOCUS[col] ?? 'name' : 'name');
  }

  function openMenu(e: ReactMouseEvent, id: string) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      id,
      top: rect.bottom + 6,
      left: Math.min(rect.right - 160, window.innerWidth - 176),
    });
  }

  return (
    <div className="w-full space-y-4">
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
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[minmax(140px,1.2fr)_80px_72px_minmax(120px,1fr)_100px_140px_88px_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Adı</span>
              <span>Kısa adı</span>
              <span>Sembol</span>
              <span>Kur tipi</span>
              <span className="text-right">Kur</span>
              <span>Oto güncelleme</span>
              <span>Durum</span>
              <span />
            </div>

            {slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Kayıt bulunamadı.</p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  data-currency-row
                  data-km-row
                  tabIndex={-1}
                  onDoubleClick={(e) => onRowDoubleClick(r, e)}
                  title="Çift tıkla: düzenle"
                  className="grid cursor-pointer grid-cols-[minmax(140px,1.2fr)_80px_72px_minmax(120px,1fr)_100px_140px_88px_44px] items-center gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/45"
                >
                  <span
                    data-currency-col="name"
                    className="truncate font-semibold text-[var(--panel-ink)]"
                  >
                    {r.name}
                  </span>
                  <span
                    data-currency-col="shortName"
                    className="font-mono text-sm font-semibold tracking-wide text-[var(--panel-ink)]"
                  >
                    {r.shortName}
                  </span>
                  <span data-currency-col="symbol" className="text-sm text-[var(--panel-muted)]">
                    {r.symbol}
                  </span>
                  <span
                    data-currency-col="rateType"
                    className="truncate text-sm text-[var(--panel-ink)]"
                  >
                    {r.rateType}
                  </span>
                  <span
                    data-currency-col="rate"
                    className="text-right font-mono text-sm font-semibold tabular-nums text-[var(--panel-ink)]"
                  >
                    {formatRate(r.rate)}
                  </span>
                  <div data-currency-col="autoUpdate" className="flex items-center gap-1.5">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        r.autoUpdate
                          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {r.autoUpdate ? 'Açık' : 'Kapalı'}
                    </span>
                    <button
                      type="button"
                      title="Kuru yenile"
                      aria-label="Kuru yenile"
                      disabled={refreshingId === r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshRate(r);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-50"
                    >
                      <RefreshIcon spin={refreshingId === r.id} />
                    </button>
                  </div>
                  <span
                    data-currency-col="status"
                    className={[
                      'inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      r.status === 'Aktif'
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                    ].join(' ')}
                  >
                    {r.status}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-currency-menu-btn
                      aria-label="İşlemler"
                      onClick={(e) => openMenu(e, r.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
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
        <CurrencyModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={saveCurrency}
          focusField={modal.type === 'edit' ? modal.focusField : 'name'}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}

      {menu
        ? createPortal(
            <div
              data-currency-menu
              className="fixed z-[12000] min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
              style={{ top: menu.top, left: menu.left }}
            >
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                onClick={() => {
                  const row = rows.find((x) => x.id === menu.id);
                  setMenu(null);
                  if (row) openEdit(row, 'name');
                }}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-500/10"
                onClick={() => {
                  const row = rows.find((x) => x.id === menu.id);
                  setMenu(null);
                  if (row) setDeleteTarget(row);
                }}
              >
                Sil
              </button>
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
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-[1] w-full max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      >
        <h3 className="text-lg font-bold text-[var(--panel-ink)]">Para birimini sil</h3>
        <p className="mt-2 text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kaydı silinsin mi?
          Bu işlem geri alınamaz.
        </p>
        <div className="mt-5 flex justify-end gap-2">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function RefreshIcon({ spin }: { spin?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={spin ? 'animate-spin' : undefined}
    >
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
