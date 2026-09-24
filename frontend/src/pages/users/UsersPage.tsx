import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { usePermission } from '../../permissions/PermissionContext';
import { ModulesDblClickHint } from '../modules/ModulesDblClickHint';
import {
  formatPhoneLive,
  initialsOf,
  setLiveUsers,
  type AppUser,
} from './mockUsers';
import { UserModal, type UserFocusField } from './UserModal';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

const COL_FOCUS: Record<string, UserFocusField> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  role: 'role',
  status: 'status',
};

/**
 * Kullanıcılar — user tablosu (API).
 */
export default function UsersPage() {
  const { token } = useAuth();
  const { roles, guard } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'edit'; user: AppUser; focusField?: UserFocusField | null }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLLIElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: String(r.id), label: r.name })),
    [roles],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [list, branches] = await Promise.all([
        api.get<AppUser[]>('/api/users', token),
        api
          .get<{ id: number; name: string }[]>('/api/users/branches', token)
          .catch(() => [] as { id: number; name: string }[]),
      ]);
      setUsers(list);
      setLiveUsers(list);
      setBranchOptions(branches.map((b) => ({ value: b.name, label: b.name })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kullanıcılar yüklenemedi');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLocaleLowerCase('tr').includes(q) ||
        u.email.toLocaleLowerCase('tr').includes(q) ||
        u.phone.includes(q.replace(/\D/g, '')) ||
        u.roleName.toLocaleLowerCase('tr').includes(q) ||
        u.branch.toLocaleLowerCase('tr').includes(q),
    );
  }, [users, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  // Roller avatarından gelen highlight
  useEffect(() => {
    const id = searchParams.get('highlight');
    if (!id) return;
    const idx = filtered.findIndex((u) => String(u.id) === id);
    if (idx >= 0) {
      setPage(Math.floor(idx / pageSize) + 1);
      setHighlightId(id);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, filtered, pageSize, setSearchParams]);

  useEffect(() => {
    if (!highlightId) return;
    const el = rowRefs.current.get(Number(highlightId));
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const t = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(t);
  }, [highlightId, safePage, slice]);

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

  function openCreate() {
    if (!guard('m-kullanicilar', 'save', 'Kullanıcılar')) return;
    setActionError(null);
    setModal({ type: 'create' });
  }

  function openEdit(u: AppUser, focusField?: UserFocusField | null) {
    if (!guard('m-kullanicilar', 'save', 'Kullanıcılar')) return;
    setActionError(null);
    setModal({ type: 'edit', user: u, focusField: focusField ?? 'name' });
  }

  function onRowDoubleClick(u: AppUser, e: ReactMouseEvent) {
    const col = (e.target as HTMLElement).closest('[data-user-col]')?.getAttribute('data-user-col');
    openEdit(u, col ? COL_FOCUS[col] ?? 'name' : 'name');
  }

  function askDelete(u: AppUser) {
    if (!guard('m-kullanicilar', 'remove', 'Kullanıcılar')) return;
    setDeleteTarget(u);
  }

  async function saveUser(next: Omit<AppUser, 'id'> & { id?: number; password?: string }) {
    if (!guard('m-kullanicilar', 'save', 'Kullanıcılar')) return;
    if (!token) throw new Error('Oturum gerekli');
    setActionError(null);
    const payload = {
      name: next.name,
      email: next.email,
      phone: next.phone,
      roleId: next.roleId,
      branch: next.branch,
      branchId: next.branchId ?? undefined,
      status: next.status,
      installments: next.installments,
      password: next.password,
    };
    if (next.id) {
      const updated = await api.patch<AppUser>(`/api/users/${next.id}`, payload, token);
      setUsers((prev) => {
        const list = prev.map((u) => (u.id === updated.id ? updated : u));
        setLiveUsers(list);
        return list;
      });
    } else {
      const created = await api.post<AppUser>('/api/users', payload, token);
      setUsers((prev) => {
        const list = [created, ...prev];
        setLiveUsers(list);
        return list;
      });
    }
    setModal(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!guard('m-kullanicilar', 'remove', 'Kullanıcılar')) {
      setDeleteTarget(null);
      return;
    }
    if (!token) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.delete(`/api/users/${deleteTarget.id}`, token);
      setUsers((prev) => {
        const list = prev.filter((u) => u.id !== deleteTarget.id);
        setLiveUsers(list);
        return list;
      });
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const header = 'Ad;E-posta;Telefon;Rol;Şube;Durum\n';
    const body = filtered
      .map(
        (u) =>
          `${u.name};${u.email};${formatPhoneLive(u.phone)};${u.roleName};${u.branch};${u.status}`,
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kullanicilar.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function copyList() {
    const text = filtered.map((u) => `${u.name}\t${u.email}\t${formatPhoneLive(u.phone)}`).join('\n');
    void navigator.clipboard.writeText(text);
    setExportOpen(false);
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-[var(--panel-muted)]">
            <Link to="/" className="hover:text-[var(--color-brand-600)]">
              Anasayfa
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-[var(--panel-ink)]">Kullanıcılar</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Panel kullanıcılarını buradan yönetin.
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
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="text-lg leading-none">+</span>
            Ekle
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {loadError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-3 shadow-[var(--panel-shadow)]">
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
            className="w-10 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
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

      <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.4fr_1.3fr_1fr_1.2fr_0.7fr_40px] gap-2 border-b border-[var(--panel-line)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
            <span>Kullanıcı</span>
            <span>E-posta</span>
            <span>Telefon</span>
            <span>Rol · Şube</span>
            <span>Durum</span>
            <span className="flex justify-end">
              {totalPages > 1 ? (
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
              ) : null}
            </span>
          </div>

          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
          ) : slice.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--panel-muted)]">Kayıt yok.</p>
          ) : (
            <ul>
              {slice.map((u, i) => (
                <li
                  key={u.id}
                  ref={(el) => {
                    if (i === 0) firstRowRef.current = el;
                    if (el) rowRefs.current.set(u.id, el);
                    else rowRefs.current.delete(u.id);
                  }}
                  data-user-row
                  data-km-row
                  tabIndex={-1}
                  style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                  onDoubleClick={(e) => onRowDoubleClick(u, e)}
                  onClick={(e) => {
                    if (e.detail === 0) openEdit(u, 'name');
                  }}
                  title="Çift tıkla veya klavye Enter: düzenle"
                  className={[
                    'modules-row-in group grid cursor-pointer grid-cols-[1.4fr_1.3fr_1fr_1.2fr_0.7fr_40px] items-center gap-2 border-b border-[var(--panel-line)] px-4 py-3 transition last:border-b-0 hover:bg-[var(--panel-hover)]/50',
                    highlightId === String(u.id) ? 'user-row-highlight' : '',
                  ].join(' ')}
                >
                  <div data-user-col="name" className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {initialsOf(u.name)}
                    </span>
                    <span className="truncate font-semibold text-[var(--panel-ink)]">{u.name}</span>
                  </div>
                  <span data-user-col="email" className="truncate text-sm text-[var(--panel-muted)]">
                    {u.email}
                  </span>
                  <span
                    data-user-col="phone"
                    className="font-mono text-sm tabular-nums text-[var(--panel-ink)]"
                  >
                    {formatPhoneLive(u.phone)}
                  </span>
                  <div data-user-col="role" className="flex min-w-0 flex-wrap gap-1">
                    <span className="user-chip user-chip--role">{u.roleName}</span>
                    {u.branch ? (
                      <span className="user-chip user-chip--branch">{u.branch}</span>
                    ) : null}
                  </div>
                  <span
                    data-user-col="status"
                    className={
                      u.status === 'Aktif'
                        ? 'user-chip user-chip--active'
                        : 'user-chip user-chip--passive'
                    }
                  >
                    {u.status}
                  </span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={(e) => {
                        e.stopPropagation();
                        askDelete(u);
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--panel-muted)]">
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
          <PagerBtn active onClick={() => undefined}>
            {safePage}
          </PagerBtn>
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

      {modal ? (
        <UserModal
          mode={modal.type === 'edit' ? { type: 'edit', user: modal.user } : { type: 'create' }}
          roleOptions={roleOptions}
          branchOptions={branchOptions}
          focusField={modal.type === 'edit' ? modal.focusField : null}
          onClose={() => setModal(null)}
          onSave={saveUser}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteUserModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          busy={deleting}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <ModulesDblClickHint targetRef={firstRowRef} />
    </div>
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

function DeleteUserModal({
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
      { autoAlpha: 0, y: 12, scale: 0.95 },
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
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <div className="mb-3 flex justify-center text-rose-500">
          <TrashIcon large />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">Kullanıcıyı sil?</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kaldırılacak.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={open ? 'rotate-180' : ''}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
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
