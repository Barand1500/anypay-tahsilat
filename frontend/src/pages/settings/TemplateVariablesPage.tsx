import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { TemplateVariableModal } from './TemplateVariableModal';
import {
  INITIAL_TEMPLATE_VARIABLES,
  formatTemplateVarKey,
  templateVarTypeLabel,
  type TemplateVariableSet,
} from './mockTemplateVariables';

/**
 * Ayarlar › Şablon Değişkenleri — çarşaf liste; çift tık düzenle, sil ikonu.
 */
export default function TemplateVariablesPage() {
  const tableRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<TemplateVariableSet[]>(() =>
    INITIAL_TEMPLATE_VARIABLES.map((r) => ({
      ...r,
      variables: r.variables.map((v) => ({ ...v })),
    })),
  );
  const [query, setQuery] = useState('');
  const [pageSizeText, setPageSizeText] = useState('10');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    { type: 'create' } | { type: 'edit'; row: TemplateVariableSet } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateVariableSet | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        String(r.displayId),
        r.name,
        r.module,
        templateVarTypeLabel(r.type),
        ...r.variables.map((v) => `${v.key} ${v.dbColumn}`),
      ]
        .join(' ')
        .toLocaleLowerCase('tr');
      return hay.includes(q);
    });
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => setPage(1), [query, pageSize]);

  useEffect(() => {
    const els = tableRef.current?.querySelectorAll('[data-tvar-row]');
    if (!els?.length) return;
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: 6 },
      { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [slice.map((r) => r.id).join('|')]);

  useEffect(() => {
    if (!deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteTarget(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  function applyPageSize(raw: string) {
    const n = Math.min(99, Math.max(1, Number(raw) || 10));
    setPageSize(n);
    setPageSizeText(String(n));
  }

  function exportCsv() {
    const header = ['ID', 'Adı', 'Modül', 'Tip', 'Değişkenler'];
    const lines = filtered.map((r) =>
      [
        r.displayId,
        r.name,
        r.module,
        templateVarTypeLabel(r.type),
        r.variables.map((v) => formatTemplateVarKey(v.key)).join(' '),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sablon-degiskenleri.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyList() {
    void navigator.clipboard.writeText(
      filtered
        .map(
          (r) =>
            `${r.displayId}\t${r.name}\t${r.module}\t${templateVarTypeLabel(r.type)}\t${r.variables.map((v) => formatTemplateVarKey(v.key)).join(' ')}`,
        )
        .join('\n'),
    );
  }

  function nextDisplayId() {
    return rows.reduce((m, r) => Math.max(m, r.displayId), 0) + 1;
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            Şablon Değişkenleri
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            E-posta ve SMS şablonlarında kullanılan değişkenleri yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-56"
            />
          </div>
        </div>

        <div ref={tableRef} className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[52px_minmax(140px,1fr)_minmax(110px,0.8fr)_88px_minmax(200px,1.4fr)_44px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>ID</span>
              <span>Adı</span>
              <span>Modül</span>
              <span>Tip</span>
              <span>Değişkenler</span>
              <span className="sr-only">Sil</span>
            </div>

            {slice.length ? (
              slice.map((r) => (
                <div
                  key={r.id}
                  data-tvar-row
                  title="Çift tıkla: düzenle"
                  onDoubleClick={() => setModal({ type: 'edit', row: r })}
                  className="grid cursor-default grid-cols-[52px_minmax(140px,1fr)_minmax(110px,0.8fr)_88px_minmax(200px,1.4fr)_44px] items-center gap-3 border-b border-[var(--panel-line)]/70 px-5 py-3 transition hover:bg-[var(--panel-hover)]"
                >
                  <span className="tabular-nums text-sm text-[var(--panel-muted)]">
                    {r.displayId}
                  </span>
                  <span className="truncate text-sm font-medium text-[var(--panel-ink)]">
                    {r.name}
                  </span>
                  <span className="truncate text-sm text-[var(--panel-muted)]">{r.module}</span>
                  <span className="text-sm text-[var(--panel-ink)]">
                    {templateVarTypeLabel(r.type)}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.variables.length ? (
                      r.variables.map((v) => (
                        <span key={`${r.id}-${v.key}`} className="user-chip user-chip--active">
                          {formatTemplateVarKey(v.key)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--panel-muted)]">—</span>
                    )}
                  </div>
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
            ) : (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı
              </p>
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
        <TemplateVariableModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={(row) => {
            if (row.id) {
              setRows((list) =>
                list.map((r) =>
                  r.id === row.id
                    ? {
                        ...r,
                        name: row.name,
                        module: row.module,
                        type: row.type,
                        variables: row.variables,
                      }
                    : r,
                ),
              );
            } else {
              setRows((list) => [
                ...list,
                {
                  id: `tv-${Date.now()}`,
                  displayId: nextDisplayId(),
                  name: row.name,
                  module: row.module,
                  type: row.type,
                  variables: row.variables,
                },
              ]);
            }
            setModal(null);
          }}
        />
      ) : null}

      {deleteTarget
        ? createPortal(
            <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
              <div
                role="dialog"
                aria-modal
                className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
              >
                <h3 className="text-lg font-bold text-[var(--panel-ink)]">Değişken setini sil</h3>
                <p className="mt-2 text-sm text-[var(--panel-muted)]">
                  <span className="font-semibold text-[var(--panel-ink)]">{deleteTarget.name}</span>{' '}
                  silinsin mi?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-[var(--panel-line)] px-3 py-2 text-sm font-semibold"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRows((list) => list.filter((r) => r.id !== deleteTarget.id));
                      setDeleteTarget(null);
                    }}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Sil
                  </button>
                </div>
              </div>
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
