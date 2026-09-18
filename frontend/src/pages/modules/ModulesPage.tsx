import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { usePermission } from '../../permissions/PermissionContext';
import {
  DB_TABLE_OPTIONS,
  INITIAL_MODULES,
  ROLE_OPTIONS,
  formatModuleDate,
  type AppModule,
  type ModuleRole,
} from './mockModules';
import { ModulesDblClickHint } from './ModulesDblClickHint';

const DB_SELECT_OPTIONS = DB_TABLE_OPTIONS.map((t) => ({ value: t, label: t }));
const PAGE_MIN = 5;
const PAGE_MAX = 50;

type ModalMode = { type: 'create' } | { type: 'edit'; module: AppModule } | null;

/**
 * Modüller — menü/yetki kayıt defteri (mock).
 * Gelecekte API + sidebar yetkisine bağlanacak.
 */
export default function ModulesPage() {
  const { guard } = usePermission();
  const [modules, setModules] = useState<AppModule[]>(() => [...INITIAL_MODULES]);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalMode>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppModule | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLLIElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.name.toLocaleLowerCase('tr').includes(q) ||
        m.dbTable.toLocaleLowerCase('tr').includes(q) ||
        m.urlPrefix.toLocaleLowerCase('tr').includes(q) ||
        m.roles.some((r) => r.toLocaleLowerCase('tr').includes(q)),
    );
  }, [modules, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function applyPageSize(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setPageSizeText(String(pageSize));
      return;
    }
    const clamped = Math.min(PAGE_MAX, Math.max(PAGE_MIN, n));
    setPageSize(clamped);
    setPageSizeText(String(clamped));
  }

  function upsert(next: Omit<AppModule, 'id' | 'createdAt'> & { id?: string }) {
    if (!guard('m-moduller', 'save', 'Modüller')) return;
    if (next.id) {
      setModules((prev) => prev.map((m) => (m.id === next.id ? { ...m, ...next, id: m.id, createdAt: m.createdAt } : m)));
    } else {
      setModules((prev) => [
        {
          ...next,
          id: `m-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setModal(null);
  }

  function confirmRemove() {
    if (!deleteTarget) return;
    if (!guard('m-moduller', 'remove', 'Modüller')) {
      setDeleteTarget(null);
      return;
    }
    setModules((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function exportCsv() {
    const header = 'Adı;DB Tablo;URL;Roller;Oluşturma\n';
    const body = filtered
      .map(
        (m) =>
          `${m.name};${m.dbTable};${m.urlPrefix};${m.roles.join('|')};${formatModuleDate(m.createdAt)}`,
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moduller.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function copyList() {
    const text = filtered.map((m) => `${m.name}\t${m.urlPrefix}\t${m.roles.join(', ')}`).join('\n');
    void navigator.clipboard.writeText(text);
    setExportOpen(false);
  }

  return (
    <div className="w-full space-y-5">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-[var(--panel-muted)]">
            <Link to="/" className="hover:text-[var(--color-brand-600)]">
              Anasayfa
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-[var(--panel-ink)]">Modüller</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Modüller</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Menü ve yetki kayıtlarını buradan yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div ref={exportRef} className="relative">
            <button
              type="button"
              data-km-jump
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              <ExportIcon />
              Dışa Aktar
              <Chevron open={exportOpen} />
            </button>
            {exportOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)]">
                {[
                  { label: 'Yazdır', fn: () => window.print() },
                  { label: 'Csv', fn: exportCsv },
                  { label: 'Excel', fn: exportCsv },
                  { label: 'Pdf', fn: () => window.print() },
                  { label: 'Kopyala', fn: copyList },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.fn();
                      setExportOpen(false);
                    }}
                    className="flex w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            data-km-jump
            onClick={() => {
              if (!guard('m-moduller', 'save', 'Modüller')) return;
              setModal({ type: 'create' });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="text-lg leading-none">+</span>
            Ekle
          </button>
        </div>
      </div>

      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-3 shadow-[var(--panel-shadow)]">
        <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            data-km-jump
            value={pageSizeText}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 2);
              setPageSizeText(v);
            }}
            onBlur={() => applyPageSize(pageSizeText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            aria-label="Sayfa başına kayıt"
            className="w-10 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none transition focus:border-[var(--color-brand-500)]"
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
            className="w-48 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-64"
          />
        </div>
      </div>

      {/* Liste */}
      <div
        ref={listRef}
        className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
      >
        <div className="hidden grid-cols-[1fr_auto_140px_40px] gap-3 border-b border-[var(--panel-line)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)] sm:grid">
          <span>Adı</span>
          <span className="text-right">Atanan roller</span>
          <span className="text-right">Oluşturma</span>
          <span className="flex justify-end">
            <button
              type="button"
              data-km-page
              aria-label="Sonraki sayfa"
              title="Sonraki sayfa"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-30"
            >
              <ChevronRightIcon />
            </button>
          </span>
        </div>

        {slice.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[var(--panel-muted)]">Kayıt bulunamadı.</p>
        ) : (
          <ul>
            {slice.map((m, i) => (
              <li
                key={m.id}
                ref={i === 0 ? firstRowRef : undefined}
                data-row
                data-km-row
                tabIndex={-1}
                className="modules-row-in group relative grid cursor-pointer grid-cols-1 gap-2 border-b border-[var(--panel-line)] px-4 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/50 sm:grid-cols-[1fr_auto_140px_40px] sm:items-center sm:gap-3"
                style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                onDoubleClick={() => {
                  if (!guard('m-moduller', 'save', 'Modüller')) return;
                  setModal({ type: 'edit', module: m });
                }}
                onClick={(e) => {
                  if (e.detail === 0) {
                    if (!guard('m-moduller', 'save', 'Modüller')) return;
                    setModal({ type: 'edit', module: m });
                  }
                }}
                title="Çift tıkla veya klavye Enter: düzenle"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--panel-ink)]">{m.name}</p>
                  <p className="truncate text-xs text-[var(--panel-muted)]">{m.dbTable}</p>
                  <p className="truncate font-mono text-[11px] text-[var(--panel-muted)]/80">{m.urlPrefix}</p>
                </div>

                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {m.roles.length === 0 ? (
                    <span className="text-xs text-[var(--panel-muted)]">—</span>
                  ) : (
                    m.roles.map((r) => <RoleChip key={r} role={r} />)
                  )}
                </div>

                <p className="text-xs tabular-nums text-[var(--panel-muted)] sm:text-right">
                  {formatModuleDate(m.createdAt)}
                </p>

                <div className="flex justify-end">
                  <button
                    type="button"
                    aria-label="Sil"
                    title="Sil"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!guard('m-moduller', 'remove', 'Modüller')) return;
                      setDeleteTarget(m);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sayfalama */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--panel-muted)]">
        <p>
          {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
          {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
          {filtered.length}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
            İlk
          </PagerBtn>
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Geri
          </PagerBtn>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let n = i + 1;
            if (totalPages > 5) {
              const start = Math.min(Math.max(1, safePage - 2), totalPages - 4);
              n = start + i;
            }
            return (
              <PagerBtn key={n} active={n === safePage} onClick={() => setPage(n)}>
                {n}
              </PagerBtn>
            );
          })}
          <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            İleri
          </PagerBtn>
          <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
            Son
          </PagerBtn>
        </div>
      </div>

      {modal ? (
        <ModuleModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={upsert}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmRemove}
        />
      ) : null}

      <ModulesDblClickHint targetRef={firstRowRef} />
    </div>
  );
}

function RoleChip({ role }: { role: ModuleRole }) {
  return (
    <span className="inline-flex rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
      {role}
    </span>
  );
}

function PagerBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-km-page
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40',
        active
          ? 'bg-[var(--color-brand-600)] text-white'
          : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ModuleModal({
  mode,
  onClose,
  onSave,
}: {
  mode: Exclude<ModalMode, null>;
  onClose: () => void;
  onSave: (m: Omit<AppModule, 'id' | 'createdAt'> & { id?: string }) => void;
}) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.module.name : '');
  const [urlPrefix, setUrlPrefix] = useState(isEdit ? mode.module.urlPrefix : '');
  const [dbTable, setDbTable] = useState(isEdit ? mode.module.dbTable : '');
  const [roles, setRoles] = useState<ModuleRole[]>(isEdit ? [...mode.module.roles] : []);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function toggleRole(r: ModuleRole) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !urlPrefix.trim() || !dbTable.trim()) return;
    onSave({
      id: isEdit ? mode.module.id : undefined,
      name: name.trim(),
      urlPrefix: urlPrefix.trim(),
      dbTable: dbTable.trim(),
      roles,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-4">
      {/* Dış tık kapatmaz — Esc / X / Kapat */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Modül Düzenle' : 'Modül Ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <TextInput data-km-jump label="Adı *" value={name} onChange={(e) => setName(e.target.value)} required />
          <div>
            <TextInput
              data-km-jump
              label="URL Ön Eki *"
              value={urlPrefix}
              onChange={(e) => setUrlPrefix(e.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-[var(--panel-muted)]">
              …com kısmından sonraki url adres ön ekidir.
            </p>
          </div>

          <FloatingSearchSelect
            label="DB Tablo *:"
            placeholder="DB Tablo seçiniz."
            options={DB_SELECT_OPTIONS}
            value={dbTable || null}
            onChange={(v) => setDbTable(v ?? '')}
            required
            kmJump
          />

          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--panel-muted)]">Atanan roller</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      on
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'border-[var(--panel-line)] text-[var(--panel-muted)] hover:border-[var(--color-brand-500)]',
                    ].join(' ')}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
            >
              Kapat
            </button>
            <button
              type="submit"
              className="inline-flex min-w-[100px] items-center justify-center rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={open ? 'rotate-180' : ''} aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteConfirmModal({
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
      { autoAlpha: 0, y: 14, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal
        aria-labelledby="delete-mod-title"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.4)]"
      >
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-500">
            <TrashIcon large />
          </div>
          <h2 id="delete-mod-title" className="text-lg font-bold text-[var(--panel-ink)]">
            Modülü sil?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
            <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kalıcı olarak
            kaldırılacak. Bu işlem geri alınamaz.
          </p>
        </div>
        <div className="flex gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500"
          >
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 26 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
