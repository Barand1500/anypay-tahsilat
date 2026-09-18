import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import {
  allFullPermissions,
  emptyPerm,
  normalizePerm,
  PERM_PAGES,
  type AppRole,
  type PagePerm,
} from './mockRoles';

type Mode = { type: 'create' } | { type: 'edit'; role: AppRole };

type Props = {
  mode: Mode;
  onClose: () => void;
  onSave: (role: Omit<AppRole, 'id' | 'users'> & { id?: string; users?: AppRole['users'] }) => void;
};

/**
 * Rol ekle / düzenle — sayfa bazlı Görüntüle · Kaydet · Sil
 * Görüntüle kapalı → Kaydet/Sil pasif
 */
export function RoleModal({ mode, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.role.name : '');
  const [isAdmin, setIsAdmin] = useState(isEdit ? mode.role.isAdmin : false);
  const [perms, setPerms] = useState<Record<string, PagePerm>>(() => {
    if (isEdit) {
      if (mode.role.isAdmin) return allFullPermissions();
      const copy: Record<string, PagePerm> = {};
      for (const p of PERM_PAGES) {
        copy[p.id] = normalizePerm(mode.role.permissions[p.id] ?? emptyPerm());
      }
      return copy;
    }
    const empty: Record<string, PagePerm> = {};
    for (const p of PERM_PAGES) empty[p.id] = emptyPerm();
    return empty;
  });
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 18, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
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

  useEffect(() => {
    const rows = listRef.current?.querySelectorAll('[data-perm-row]');
    if (!rows?.length) return;
    gsap.fromTo(
      rows,
      { autoAlpha: 0, x: -6 },
      { autoAlpha: 1, x: 0, duration: 0.25, stagger: 0.02, ease: 'power2.out', overwrite: 'auto' },
    );
  }, [query, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return PERM_PAGES;
    return PERM_PAGES.filter((p) => p.name.toLocaleLowerCase('tr').includes(q));
  }, [query]);

  const allSelected = useMemo(() => {
    if (isAdmin) return true;
    return PERM_PAGES.every((p) => {
      const x = perms[p.id];
      return x?.view && x?.save && x?.remove;
    });
  }, [isAdmin, perms]);

  function setAdmin(on: boolean) {
    setIsAdmin(on);
    if (on) setPerms(allFullPermissions());
  }

  function toggleAll(on: boolean) {
    if (on) {
      setIsAdmin(true);
      setPerms(allFullPermissions());
      return;
    }
    setIsAdmin(false);
    const next: Record<string, PagePerm> = {};
    for (const p of PERM_PAGES) next[p.id] = emptyPerm();
    setPerms(next);
  }

  function patch(id: string, key: keyof PagePerm, value: boolean) {
    if (isAdmin) setIsAdmin(false);
    setPerms((prev) => {
      const cur = prev[id] ?? emptyPerm();
      let next: PagePerm = { ...cur, [key]: value };
      if (key === 'view' && !value) {
        next = { view: false, save: false, remove: false };
      }
      if ((key === 'save' || key === 'remove') && value && !cur.view) {
        next = { ...next, view: true };
      }
      return { ...prev, [id]: normalizePerm(next) };
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: isEdit ? mode.role.id : undefined,
      name: name.trim(),
      isAdmin,
      permissions: isAdmin ? allFullPermissions() : perms,
      users: isEdit ? mode.role.users : [],
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Rol Düzenle' : 'Rol Ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-4 px-5 pt-4 sm:px-6">
            <TextInput
              data-km-jump
              label="Adı *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--panel-ink)]">Modül İzinleri</p>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--panel-surface)] px-3 py-2.5">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--panel-ink)]">
                  <input
                    type="checkbox"
                    data-km-jump
                    checked={isAdmin}
                    onChange={(e) => setAdmin(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--panel-line)] text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
                  />
                  <span className="font-medium">Yönetici erişimi</span>
                  <span
                    title="Tüm sayfalarda görüntüle, kaydet ve sil yetkisi"
                    className="text-[var(--panel-muted)]"
                  >
                    ⓘ
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--panel-muted)]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--panel-line)] text-[var(--color-brand-600)]"
                  />
                  Tümünü seç
                </label>
              </div>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
                <SearchIcon />
              </span>
              <input
                data-km-jump
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sayfa ara…"
                className="w-full rounded-xl border border-transparent bg-[var(--panel-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] focus:bg-[var(--panel-elevated)]"
              />
            </div>

            <div className="hidden grid-cols-[1fr_72px_72px_56px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)] sm:grid">
              <span>Sayfa</span>
              <span className="text-center">Görüntüle</span>
              <span className="text-center">Kaydet</span>
              <span className="text-center">Sil</span>
            </div>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
            <ul className="divide-y divide-[var(--panel-line)] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]">
              {filtered.map((page) => {
                const p = perms[page.id] ?? emptyPerm();
                const locked = !p.view;
                return (
                  <li
                    key={page.id}
                    data-perm-row
                    className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[1fr_72px_72px_56px] sm:items-center sm:gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--panel-ink)]">{page.name}</p>
                      <p className="truncate font-mono text-[10px] text-[var(--panel-muted)]">{page.urlPrefix}</p>
                    </div>
                    <PermCheck
                      label="Görüntüle"
                      checked={p.view}
                      onChange={(v) => patch(page.id, 'view', v)}
                    />
                    <PermCheck
                      label="Kaydet"
                      checked={p.save}
                      disabled={locked}
                      onChange={(v) => patch(page.id, 'save', v)}
                    />
                    <PermCheck
                      label="Sil"
                      checked={p.remove}
                      disabled={locked}
                      onChange={(v) => patch(page.id, 'remove', v)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
            >
              Kapat
            </button>
            <button
              type="submit"
              data-km-jump
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
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

function PermCheck({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={[
        'flex items-center gap-2 sm:justify-center',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--panel-line)] text-[var(--color-brand-600)] focus:ring-[var(--color-brand-500)]"
      />
      <span className="text-xs text-[var(--panel-muted)] sm:sr-only">{label}</span>
    </label>
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
