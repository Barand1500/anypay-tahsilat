import { Link, useNavigate, useParams } from 'react-router-dom';
import { findLiveUser, formatPhoneLive, initialsOf } from './mockUsers';

/** Kullanıcı detay — mock iskelet */
export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = findLiveUser(id);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-[var(--panel-muted)]">Kullanıcı bulunamadı.</p>
        <Link
          to="/kullanicilar"
          className="mt-4 inline-block text-sm font-semibold text-[var(--color-brand-600)]"
        >
          Listeye dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <nav className="text-xs text-[var(--panel-muted)]">
        <Link to="/" className="hover:text-[var(--color-brand-600)]">
          Anasayfa
        </Link>
        <span className="mx-1.5">›</span>
        <Link to="/kullanicilar" className="hover:text-[var(--color-brand-600)]">
          Kullanıcılar
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-[var(--panel-ink)]">{user.name}</span>
      </nav>

      <div className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div
          className="h-28"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-brand-500) 50%, #1a2740), var(--panel-surface))',
          }}
        />
        <div className="relative px-6 pb-6">
          <div className="-mt-10 mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--panel-elevated)] bg-brand-100 text-2xl font-bold text-brand-700 shadow-md">
            {initialsOf(user.name)}
          </div>
          <h1 className="text-2xl font-bold text-[var(--panel-ink)]">{user.name}</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">{user.email}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="Telefon" value={formatPhoneLive(user.phone)} />
            <Info label="Rol" value={user.roleName} />
            <Info label="Şube" value={user.branch} />
            <Info label="Durum" value={user.status} />
            <Info
              label="İzinli taksitler"
              value={user.installments.length ? user.installments.join(', ') : '—'}
            />
          </dl>

          <button
            type="button"
            onClick={() => navigate('/kullanicilar')}
            className="mt-6 rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            Listeye dön
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--panel-surface)] px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--panel-ink)]">{value}</dd>
    </div>
  );
}
