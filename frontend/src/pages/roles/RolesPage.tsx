import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AvatarStack } from '../../components/ui/AvatarStack';
import { usePermission } from '../../permissions/PermissionContext';
import { countGranted, type AppRole } from './mockRoles';
import { RoleModal } from './RoleModal';
import { ROLE_HERO_SRC, prefetchRoleHero } from './roleHero';

/**
 * Roller — kart grid + izin modalı (mock).
 */
export default function RolesPage() {
  const { roles, setRoles, guard } = usePermission();
  const [modal, setModal] = useState<
    { type: 'create' } | { type: 'edit'; role: AppRole } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<AppRole | null>(null);

  function saveRole(
    next: Omit<AppRole, 'id' | 'users'> & { id?: string; users?: AppRole['users'] },
  ) {
    if (!guard('m-roller', 'save', 'Roller')) return;
    if (next.id) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === next.id
            ? {
                ...r,
                name: next.name,
                isAdmin: next.isAdmin,
                permissions: next.permissions,
              }
            : r,
        ),
      );
    } else {
      setRoles((prev) => [
        ...prev,
        {
          id: `role-${Date.now()}`,
          name: next.name,
          isAdmin: next.isAdmin,
          permissions: next.permissions,
          users: [],
        },
      ]);
    }
    setModal(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (!guard('m-roller', 'remove', 'Roller')) {
      setDeleteTarget(null);
      return;
    }
    setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function openEdit(role: AppRole) {
    if (!guard('m-roller', 'save', 'Roller')) return;
    setModal({ type: 'edit', role });
  }

  function openCreate() {
    if (!guard('m-roller', 'save', 'Roller')) return;
    setModal({ type: 'create' });
  }

  function askDelete(role: AppRole) {
    if (!guard('m-roller', 'remove', 'Roller')) return;
    setDeleteTarget(role);
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <nav className="mb-1 text-xs text-[var(--panel-muted)]">
          <Link to="/" className="hover:text-[var(--color-brand-600)]">
            Anasayfa
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-[var(--panel-ink)]">Roller</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Roller</h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Sayfa bazlı görüntüle, kaydet ve sil yetkilerini yönetin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((role, i) => (
          <RoleCard
            key={role.id}
            role={role}
            index={i}
            onEdit={() => openEdit(role)}
            onDelete={() => askDelete(role)}
          />
        ))}

        <button
          type="button"
          data-km-jump
          data-role-card
          onClick={openCreate}
          className="panel-card-in group relative flex min-h-[200px] flex-col overflow-hidden rounded-2xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-elevated)] text-left shadow-[var(--panel-shadow)] transition hover:border-[var(--color-brand-500)] hover:shadow-[var(--panel-shadow)]"
        >
          <div className="flex flex-1 items-stretch overflow-hidden">
            <div className="relative hidden w-[42%] overflow-hidden bg-[var(--panel-surface)] sm:block">
              <RoleHeroImage />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--panel-elevated)]" />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-3 p-5 sm:pl-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition group-hover:brightness-110">
                <span className="text-lg leading-none">+</span>
                Rol Ekle
              </span>
              <p className="text-xs text-[var(--panel-muted)]">Mevcut değilse rol ekleyin</p>
            </div>
          </div>
        </button>
      </div>

      {modal ? (
        <RoleModal mode={modal} onClose={() => setModal(null)} onSave={saveRole} />
      ) : null}

      {deleteTarget ? (
        <DeleteRoleModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function RoleCard({
  role,
  index,
  onEdit,
  onDelete,
}: {
  role: AppRole;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { pages, total } = countGranted(role);

  return (
    <article
      data-role-card
      data-km-row
      tabIndex={-1}
      onDoubleClick={onEdit}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="panel-card-in flex flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] transition hover:border-[color-mix(in_srgb,var(--color-brand-500)_35%,var(--panel-line))]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs text-[var(--panel-muted)]">
          Toplam {role.users.length} kullanıcı
          {role.isAdmin ? (
            <span className="ml-2 inline-block rounded-full bg-[color-mix(in_srgb,var(--color-brand-500)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-on-soft)]">
              Yönetici
            </span>
          ) : (
            <span className="ml-2 text-[10px] tabular-nums opacity-80">
              {pages}/{total} sayfa
            </span>
          )}
        </p>
        <AvatarStack people={role.users} />
      </div>

      <h2 className="mb-6 text-xl font-bold tracking-tight text-[var(--panel-ink)]">{role.name}</h2>

      <div className="mt-auto flex items-center justify-between gap-2">
        <button
          type="button"
          data-km-jump
          onClick={onEdit}
          className="text-sm font-semibold text-[var(--color-brand-600)] transition hover:text-[var(--brand-on-soft)]"
        >
          Rolü Düzenle
        </button>
        <button
          type="button"
          aria-label="Rolü sil"
          title="Sil"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/12 hover:text-rose-500"
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

function DeleteRoleModal({
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
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.4)]"
      >
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-500">
            <TrashIcon large />
          </div>
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">Rolü sil?</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
            <span className="font-semibold text-[var(--panel-ink)]">{name}</span> kalıcı olarak
            kaldırılacak.
          </p>
        </div>
        <div className="flex gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
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

/** Rol Ekle hero — WebP + hızlı yükleme / soft fade */
function RoleHeroImage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefetchRoleHero();
    const img = new Image();
    img.src = ROLE_HERO_SRC;
    if (img.complete) {
      setReady(true);
      return;
    }
    img.onload = () => setReady(true);
  }, []);

  return (
    <img
      src={ROLE_HERO_SRC}
      alt=""
      width={1024}
      height={1024}
      decoding="async"
      fetchPriority="high"
      className={[
        'absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-105',
        ready ? 'opacity-90' : 'opacity-0',
      ].join(' ')}
      onLoad={() => setReady(true)}
    />
  );
}
