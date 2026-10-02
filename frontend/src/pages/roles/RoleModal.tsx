import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { TextInput } from '../../components/ui/TextInput';
import {
  allFullPermissions,
  emptyPerm,
  normalizePerm,
  type AppRole,
  type PagePerm,
  type PermPage,
} from './mockRoles';

type Mode = { type: 'create' } | { type: 'edit'; role: AppRole };

type Props = {
  mode: Mode;
  pages: PermPage[];
  onClose: () => void;
  onSave: (role: {
    id?: number;
    name: string;
    isAdmin: boolean;
    permissions: Record<string, PagePerm>;
  }) => Promise<void>;
};

type PermissionGroup = {
  key: string;
  label: string;
  pages: PermPage[];
  children?: PermissionGroup[];
};

function normalizedPath(page: PermPage): string {
  return (page.urlPrefix || '/').replace(/\/+$/, '') || '/';
}

function isPosCardPage(page: PermPage): boolean {
  const path = normalizedPath(page);
  if (path.startsWith('/tanimlamalar/pos-kart')) return true;
  return [
    '/tanimlamalar/bankalar/sanal-pos-tanimlari',
    '/tanimlamalar/bankalar/ortak-sanalpos',
    '/tanimlamalar/bankalar/kart-anlasmalari',
    '/tanimlamalar/bankalar/kart-tipleri',
    '/tanimlamalar/bankalar/kart-turleri',
    '/tanimlamalar/bankalar/kart-markalari',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildPermissionGroups(pages: PermPage[]): PermissionGroup[] {
  const reports: PermPage[] = [];
  const definitions: PermPage[] = [];
  const posCard: PermPage[] = [];
  const settings: PermPage[] = [];
  const management: PermPage[] = [];
  const general: PermPage[] = [];
  const managementRoots = ['/moduller', '/roller', '/kullanicilar', '/surum-gecmisi', '/log-kayitlari', '/sistem-sifirlama', '/siralama'];

  for (const page of pages) {
    const path = normalizedPath(page);
    if (path === '/raporlar' || path.startsWith('/raporlar/')) reports.push(page);
    else if (isPosCardPage(page)) posCard.push(page);
    else if (path === '/tanimlamalar' || path.startsWith('/tanimlamalar/')) definitions.push(page);
    else if (path === '/ayarlar' || path.startsWith('/ayarlar/')) settings.push(page);
    else if (managementRoots.some((root) => path === root || path.startsWith(`${root}/`))) management.push(page);
    else general.push(page);
  }

  const result: PermissionGroup[] = [];
  if (general.length) result.push({ key: 'general', label: 'Genel Sayfalar', pages: general });
  if (reports.length) result.push({ key: 'reports', label: 'Raporlar', pages: reports });
  if (definitions.length || posCard.length) {
    result.push({
      key: 'definitions',
      label: 'Tanımlamalar',
      pages: definitions,
      children: posCard.length ? [{ key: 'definitions-pos-card', label: 'POS ve Kart', pages: posCard }] : [],
    });
  }
  if (settings.length) result.push({ key: 'settings', label: 'Ayarlar', pages: settings });
  if (management.length) result.push({ key: 'management', label: 'Yönetim', pages: management });
  return result;
}

function groupPages(group: PermissionGroup): PermPage[] {
  return [...group.pages, ...(group.children ?? []).flatMap(groupPages)];
}

function canonicalPath(page: PermPage): string {
  const path = normalizedPath(page);
  const aliases: Array<[string, string]> = [
    ['/tanimlamalar/bankalar/sanal-pos-tanimlari', '/tanimlamalar/pos-kart/sanal-pos'],
    ['/tanimlamalar/bankalar/ortak-sanalpos', '/tanimlamalar/pos-kart/ortak-sanal-pos'],
    ['/tanimlamalar/bankalar/kart-anlasmalari', '/tanimlamalar/pos-kart/anlasmalar'],
    ['/tanimlamalar/bankalar/kart-tipleri', '/tanimlamalar/pos-kart/tipler'],
    ['/tanimlamalar/bankalar/kart-turleri', '/tanimlamalar/pos-kart/turler'],
    ['/tanimlamalar/bankalar/kart-markalari', '/tanimlamalar/pos-kart/markalar'],
  ];
  for (const [legacy, modern] of aliases) {
    if (path === legacy || path.startsWith(`${legacy}/`)) return path.replace(legacy, modern);
  }
  return path;
}

/**
 * Rol ekle / düzenle — sayfa bazlı Görüntüle · Kaydet · Sil
 * Görüntüle kapalı → Kaydet/Sil pasif
 */
export function RoleModal({ mode, pages, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.role.name : '');
  const [isAdmin, setIsAdmin] = useState(isEdit ? mode.role.isAdmin : false);
  const [perms, setPerms] = useState<Record<string, PagePerm>>(() => {
    if (isEdit) {
      if (mode.role.isAdmin) return allFullPermissions(pages);
      const copy: Record<string, PagePerm> = {};
      for (const p of pages) {
        copy[p.id] = normalizePerm(mode.role.permissions[p.id] ?? emptyPerm());
      }
      return copy;
    }
    const empty: Record<string, PagePerm> = {};
    for (const p of pages) empty[p.id] = emptyPerm();
    return empty;
  });
  useEffect(() => {
    if (pages.length === 0) return;
    setPerms((previous) => {
      const next = { ...previous };
      for (const page of pages) {
        if (next[page.id]) continue;
        next[page.id] = mode.type === 'edit'
          ? normalizePerm(mode.role.permissions[page.id] ?? emptyPerm())
          : emptyPerm();
      }
      return next;
    });
  }, [pages, isEdit, mode]);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(['general']));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  const groups = useMemo(() => buildPermissionGroups(pages), [pages]);
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return groups;
    const filterGroup = (group: PermissionGroup): PermissionGroup | null => {
      const groupMatches = group.label.toLocaleLowerCase('tr').includes(q);
      const matchingPages = groupMatches
        ? group.pages
        : group.pages.filter((page) =>
            page.name.toLocaleLowerCase('tr').includes(q)
            || page.urlPrefix.toLocaleLowerCase('tr').includes(q));
      const children = (group.children ?? [])
        .map(filterGroup)
        .filter((child): child is PermissionGroup => child !== null);
      if (!groupMatches && matchingPages.length === 0 && children.length === 0) return null;
      return {
        ...group,
        pages: groupMatches ? group.pages : matchingPages,
        children: groupMatches ? group.children : children,
      };
    };
    return groups.map(filterGroup).filter((group): group is PermissionGroup => group !== null);
  }, [query, groups]);

  const allSelected = useMemo(() => {
    if (isAdmin) return true;
    return pages.every((p) => {
      const x = perms[p.id];
      return x?.view && x?.save && x?.remove;
    });
  }, [isAdmin, perms, pages]);

  function setAdmin(on: boolean) {
    setIsAdmin(on);
    if (on) setPerms(allFullPermissions(pages));
  }

  function toggleAll(on: boolean) {
    if (on) {
      setIsAdmin(true);
      setPerms(allFullPermissions(pages));
      return;
    }
    setIsAdmin(false);
    const next: Record<string, PagePerm> = {};
    for (const p of pages) next[p.id] = emptyPerm();
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
      const updated = { ...prev, [id]: normalizePerm(next) };
      if (value) {
        const selected = pages.find((page) => page.id === id);
        if (selected) {
          const childPath = canonicalPath(selected);
          for (const candidate of pages) {
            const parentPath = canonicalPath(candidate);
            if (parentPath === '/' || parentPath === childPath) continue;
            if (childPath.startsWith(`${parentPath}/`)) {
              const parent = updated[candidate.id] ?? emptyPerm();
              updated[candidate.id] = { ...parent, view: true };
            }
          }
        }
      }
      return updated;
    });
  }

  function toggleGroup(group: PermissionGroup, on: boolean) {
    if (isAdmin) setIsAdmin(false);
    setPerms((previous) => {
      const next = { ...previous };
      const changedPages = groupPages(group);
      for (const page of changedPages) {
        const current = next[page.id] ?? emptyPerm();
        next[page.id] = on ? { ...current, view: true } : emptyPerm();
      }
      if (on) {
        for (const selected of changedPages) {
          const childPath = canonicalPath(selected);
          for (const candidate of pages) {
            const parentPath = canonicalPath(candidate);
            if (parentPath === '/' || parentPath === childPath) continue;
            if (childPath.startsWith(`${parentPath}/`)) {
              const parent = next[candidate.id] ?? emptyPerm();
              next[candidate.id] = { ...parent, view: true };
            }
          }
        }
      }
      return next;
    });
  }

  function toggleAccordion(key: string) {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || pages.length === 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        id: isEdit ? mode.role.id : undefined,
        name: name.trim(),
        isAdmin,
        permissions: isAdmin ? allFullPermissions(pages) : perms,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(94vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
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

        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
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
            {pages.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--panel-muted)]">
                Modül listesi yüklenemedi.
              </p>
            ) : filteredGroups.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--panel-muted)]">Aramayla eşleşen sayfa bulunamadı.</p>
            ) : (
              <div className="space-y-2 py-1">
                {filteredGroups.map((group) => (
                  <PermissionAccordion
                    key={group.key}
                    group={group}
                    depth={0}
                    forceOpen={Boolean(query.trim())}
                    openGroups={openGroups}
                    perms={perms}
                    onToggleOpen={toggleAccordion}
                    onToggleGroup={toggleGroup}
                    onPatch={patch}
                  />
                ))}
              </div>
            )}
          </div>

          {formError ? (
            <p className="px-5 text-sm text-rose-500 sm:px-6">{formError}</p>
          ) : null}

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
              disabled={saving || pages.length === 0}
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function PermissionAccordion({
  group,
  depth,
  forceOpen,
  openGroups,
  perms,
  onToggleOpen,
  onToggleGroup,
  onPatch,
}: {
  group: PermissionGroup;
  depth: number;
  forceOpen: boolean;
  openGroups: Set<string>;
  perms: Record<string, PagePerm>;
  onToggleOpen: (key: string) => void;
  onToggleGroup: (group: PermissionGroup, on: boolean) => void;
  onPatch: (id: string, key: keyof PagePerm, value: boolean) => void;
}) {
  const allPages = groupPages(group);
  const selected = allPages.filter((page) => perms[page.id]?.view).length;
  const all = allPages.length > 0 && selected === allPages.length;
  const partial = selected > 0 && selected < allPages.length;
  const open = forceOpen || openGroups.has(group.key);
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partial;
  }, [partial]);

  return (
    <section
      className={[
        'overflow-hidden rounded-xl border',
        depth > 0
          ? 'ml-3 border-amber-400/35 bg-amber-500/[0.035]'
          : 'border-[var(--panel-line)] bg-[var(--panel-elevated)]',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center gap-3 px-3 py-2.5 transition',
          partial
            ? 'bg-amber-400/12'
            : all
              ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_12%,transparent)]'
              : 'bg-[var(--panel-surface)]/65',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => onToggleOpen(group.key)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronIcon open={open} />
          <span className="truncate text-sm font-semibold text-[var(--panel-ink)]">{group.label}</span>
          <span className={[
            'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
            partial
              ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300'
              : all
                ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] text-[var(--brand-on-soft)]'
                : 'bg-[var(--panel-elevated)] text-[var(--panel-muted)]',
          ].join(' ')}>
            {selected}/{allPages.length} açık
          </span>
        </button>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-[var(--panel-muted)]">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={all}
            onChange={(event) => onToggleGroup(group, event.target.checked)}
            className="h-4 w-4 rounded border-[var(--panel-line)] text-[var(--color-brand-600)]"
          />
          Tümü
        </label>
      </div>

      {open ? (
        <div className={depth > 0 ? 'border-l-2 border-amber-400/35 pl-2' : ''}>
          {group.pages.map((page) => (
            <PermissionRow key={page.id} page={page} permission={perms[page.id] ?? emptyPerm()} onPatch={onPatch} />
          ))}
          {(group.children ?? []).map((child) => (
            <div key={child.key} className="px-2 pb-2 pt-1">
              <PermissionAccordion
                group={child}
                depth={depth + 1}
                forceOpen={forceOpen}
                openGroups={openGroups}
                perms={perms}
                onToggleOpen={onToggleOpen}
                onToggleGroup={onToggleGroup}
                onPatch={onPatch}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PermissionRow({
  page,
  permission,
  onPatch,
}: {
  page: PermPage;
  permission: PagePerm;
  onPatch: (id: string, key: keyof PagePerm, value: boolean) => void;
}) {
  return (
    <div
      data-perm-row
      className="grid grid-cols-1 gap-2 border-t border-[var(--panel-line)] px-3 py-2.5 first:border-t-0 sm:grid-cols-[1fr_72px_72px_56px] sm:items-center sm:gap-2"
    >
      <div className="min-w-0 pl-1">
        <p className="truncate text-sm font-medium text-[var(--panel-ink)]">{page.name}</p>
        <p className="truncate font-mono text-[10px] text-[var(--panel-muted)]">{page.urlPrefix}</p>
      </div>
      <PermCheck label="Görüntüle" checked={permission.view} onChange={(value) => onPatch(page.id, 'view', value)} />
      <PermCheck label="Kaydet" checked={permission.save} disabled={!permission.view} onChange={(value) => onPatch(page.id, 'save', value)} />
      <PermCheck label="Sil" checked={permission.remove} disabled={!permission.view} onChange={(value) => onPatch(page.id, 'remove', value)} />
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
