import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { PasswordCourierOverlay } from '../../components/ui/PasswordCourierOverlay';
import {
  initialsOf,
  type CustomerUser,
} from './mockCustomerDetail';
import {
  formatPhoneLive,
  normalizePhoneInput,
  type Customer,
} from './mockCustomers';
import { openCredentialChannel, type CredentialChannel } from './sendCredentials';

type Props = {
  customer: Customer;
  flash: (m: string) => void;
  onCustomerPatched?: (c: Customer) => void;
};

/** Müşteri kullanıcıları — çift tık düzenle, şifre gönder, sil */
export function CustomerUsersTab({ customer, flash, onCustomerPatched }: Props) {
  const { token } = useAuth();
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('5');
  const [saving, setSaving] = useState(false);
  const [passwordUser, setPasswordUser] = useState<CustomerUser | null>(null);
  const [courier, setCourier] = useState<{
    email: string;
    flash: string;
    failed?: boolean;
  } | null>(null);

  async function reload() {
    if (!token) return;
    setLoading(true);
    try {
      const list = await api.get<CustomerUser[]>(
        `/api/customers/${encodeURIComponent(customer.id)}/users`,
        token,
      );
      setUsers(list);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLocaleLowerCase('tr').includes(q) ||
        u.email.toLocaleLowerCase('tr').includes(q) ||
        u.phone.includes(q.replace(/\D/g, '')),
    );
  }, [users, query]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('5');
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(u: CustomerUser) {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone || '5');
    setFormOpen(true);
  }

  async function ensureRealUser(u: CustomerUser): Promise<CustomerUser> {
    if (!token) throw new Error('Oturum gerekli');
    if (!u.id.startsWith('primary-')) return u;
    if (!u.email.trim() || !u.email.includes('@')) {
      throw new Error('Şifre için önce e-posta girin (çift tık → düzenle)');
    }
    if (u.phone.replace(/\D/g, '').length < 10) {
      throw new Error('Şifre için önce telefon girin (çift tık → düzenle)');
    }
    const created = await api.post<CustomerUser>(
      `/api/customers/${encodeURIComponent(customer.id)}/users`,
      {
        name: u.name.trim() || customer.title,
        email: u.email.trim().toLocaleLowerCase('tr'),
        phone: u.phone.replace(/\D/g, '').slice(0, 10),
      },
      token,
    );
    const next = { ...created, isPrimary: true as const };
    setUsers((prev) => [next, ...prev.filter((x) => x.id !== u.id && x.id !== created.id)]);
    return next;
  }

  async function saveUser(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim().toLocaleLowerCase('tr'),
        phone: phone.replace(/\D/g, '').slice(0, 10),
      };
      if (editingId && !editingId.startsWith('primary-')) {
        const updated = await api.patch<CustomerUser>(
          `/api/customers/${encodeURIComponent(customer.id)}/users/${encodeURIComponent(editingId)}`,
          body,
          token,
        );
        const wasPrimary = users.find((u) => u.id === editingId)?.isPrimary;
        setUsers((prev) =>
          prev.map((u) => (u.id === editingId ? { ...updated, isPrimary: u.isPrimary } : u)),
        );
        if (wasPrimary) {
          onCustomerPatched?.({
            ...customer,
            title: body.name,
            email: body.email,
            phone: body.phone,
          });
        }
        flash('Kullanıcı güncellendi');
      } else if (editingId?.startsWith('primary-')) {
        const created = await api.post<CustomerUser & { emailSent?: boolean }>(
          `/api/customers/${encodeURIComponent(customer.id)}/users`,
          { ...body, sendEmail: true },
          token,
        );
        setUsers((prev) => [
          { ...created, isPrimary: true },
          ...prev.filter((u) => u.id !== editingId && u.id !== created.id),
        ]);
        onCustomerPatched?.({
          ...customer,
          title: body.name,
          email: body.email,
          phone: body.phone,
        });
        setFormOpen(false);
        resetForm();
        setCourier({
          email: created.email,
          flash: created.emailSent
            ? `Kullanıcı güncellendi · giriş bilgileri ${created.email} adresine gönderildi`
            : 'Kullanıcı güncellendi · e-posta iletilemedi',
          failed: !created.emailSent,
        });
        return;
      } else {
        const u = await api.post<CustomerUser & { emailSent?: boolean }>(
          `/api/customers/${encodeURIComponent(customer.id)}/users`,
          { ...body, sendEmail: true },
          token,
        );
        setUsers((prev) => [u, ...prev]);
        setFormOpen(false);
        resetForm();
        setCourier({
          email: u.email,
          flash: u.emailSent
            ? `Kullanıcı eklendi · giriş bilgileri ${u.email} adresine gönderildi`
            : 'Kullanıcı eklendi · e-posta iletilemedi',
          failed: !u.emailSent,
        });
        return;
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(uid: string) {
    if (!token || uid.startsWith('primary-')) return;
    const cur = users.find((u) => u.id === uid);
    if (!cur) return;
    try {
      const updated = await api.patch<CustomerUser>(
        `/api/customers/${encodeURIComponent(customer.id)}/users/${encodeURIComponent(uid)}`,
        { active: !cur.active },
        token,
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === uid ? { ...updated, isPrimary: u.isPrimary } : u)),
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Güncellenemedi');
    }
  }

  async function removeUser(uid: string) {
    if (!token) return;
    if (uid.startsWith('primary-')) {
      flash('Cari kaydı silinemez — önce kullanıcı hesabı oluşmalı');
      return;
    }
    try {
      await api.delete(
        `/api/customers/${encodeURIComponent(customer.id)}/users/${encodeURIComponent(uid)}`,
        token,
      );
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      flash('Kullanıcı silindi');
      void reload();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  async function onPasswordClick(u: CustomerUser) {
    try {
      const real = await ensureRealUser(u);
      setPasswordUser(real);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Şifre gönderilemedi');
    }
  }

  return (
    <section
      data-anim
      className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold text-[var(--panel-ink)]">Müşteri Kullanıcıları</h1>
        <button
          type="button"
          data-km-jump
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <span className="text-lg leading-none">+</span>
          Ekle
        </button>
      </div>

      {formOpen ? (
        <form
          onSubmit={(e) => void saveUser(e)}
          className="border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-4 sm:px-6"
        >
          <p className="mb-3 text-sm font-bold text-[var(--panel-ink)]">
            {editingId ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <TextInput
              label="Ad Soyad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-km-jump
            />
            <TextInput
              label="E-posta"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-km-jump
            />
            <TextInput
              label="Telefon"
              value={formatPhoneLive(phone)}
              onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
              className="font-mono"
              data-km-jump
            />
            <div className="flex shrink-0 gap-2 sm:col-span-2 lg:col-span-1 lg:pb-0.5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
              >
                İptal
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <p className="text-sm text-[var(--panel-muted)]">{filtered.length} kayıt</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ara…"
          className="w-full max-w-[220px] rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-500)]"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-y border-[var(--panel-line)] text-[11px] uppercase tracking-wide text-[var(--panel-muted)]">
              <th className="px-5 py-2.5 font-semibold sm:px-6">Kullanıcı</th>
              <th className="px-3 py-2.5 font-semibold">E-posta</th>
              <th className="px-3 py-2.5 font-semibold">Telefon</th>
              <th className="px-3 py-2.5 font-semibold">Son giriş</th>
              <th className="px-5 py-2.5 font-semibold sm:px-6">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-[var(--panel-muted)]">
                  {loading ? 'Yükleniyor…' : 'Kullanıcı yok.'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr
                  key={u.id}
                  onDoubleClick={() => openEdit(u)}
                  title="Çift tıkla düzenle"
                  className="cursor-pointer border-b border-[var(--panel-line)]/80 hover:bg-[var(--panel-hover)]/40"
                >
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft-bg)] text-xs font-bold text-[var(--color-brand-600)]">
                        {initialsOf(u.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold text-[var(--panel-ink)]">{u.name}</span>
                        {u.isPrimary ? (
                          <span className="ml-2 rounded-md bg-[var(--brand-soft-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-600)]">
                            Cari
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--panel-ink)]/80">{u.email || '—'}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">
                    {u.phone ? formatPhoneLive(u.phone) : '—'}
                  </td>
                  <td className="px-3 py-3 text-[var(--panel-muted)]">
                    {u.lastLogin
                      ? new Date(u.lastLogin).toLocaleString('tr-TR')
                      : 'Henüz giriş yapmamış'}
                  </td>
                  <td className="px-5 py-3 sm:px-6" onDoubleClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.active}
                        disabled={u.id.startsWith('primary-')}
                        onClick={() => {
                          void toggleActive(u.id);
                        }}
                        className={[
                          'relative h-6 w-11 rounded-full transition disabled:opacity-40',
                          u.active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                            u.active ? 'translate-x-5' : '',
                          ].join(' ')}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label="Şifre gönder"
                        title="Şifre gönder"
                        onClick={() => {
                          void onPasswordClick(u);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3e8dc] text-[#5c4a3a] transition hover:bg-[#ead9c8]"
                      >
                        <LockIcon />
                      </button>
                      <button
                        type="button"
                        aria-label="Sil"
                        title="Sil"
                        onClick={() => {
                          void removeUser(u.id);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {passwordUser ? (
        <SendPasswordModal
          customerId={customer.id}
          user={passwordUser}
          flash={flash}
          onClose={() => setPasswordUser(null)}
          onMailSent={(email, msg, ok) => {
            setPasswordUser(null);
            setCourier({ email, flash: msg, failed: !ok });
          }}
        />
      ) : null}

      <PasswordCourierOverlay
        open={Boolean(courier)}
        toEmail={courier?.email}
        failed={courier?.failed}
        onDone={() => {
          if (courier?.flash) flash(courier.flash);
          setCourier(null);
        }}
      />
    </section>
  );
}

function SendPasswordModal({
  customerId,
  user,
  flash,
  onClose,
  onMailSent,
}: {
  customerId: string;
  user: CustomerUser;
  flash: (m: string) => void;
  onClose: () => void;
  onMailSent: (email: string, msg: string, ok: boolean) => void;
}) {
  const { token } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<CredentialChannel | null>(null);

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
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const channels = [
    { id: 'mail' as const, label: 'E-posta', hint: user.email, icon: 'mail' as const },
    { id: 'sms' as const, label: 'SMS', hint: formatPhoneLive(user.phone), icon: 'sms' as const },
    { id: 'wp' as const, label: 'WhatsApp', hint: formatPhoneLive(user.phone), icon: 'wp' as const },
  ];

  async function sendVia(channel: CredentialChannel) {
    if (!token || busy) return;
    if (!user.email?.includes('@') && channel === 'mail') {
      flash('E-posta adresi yok');
      return;
    }
    setBusy(channel);
    try {
      const data = await api.post<{
        password?: string;
        name: string;
        email: string;
        phone: string;
        channel: CredentialChannel;
        emailSent?: boolean;
      }>(
        `/api/customers/${encodeURIComponent(customerId)}/users/${encodeURIComponent(user.id)}/password-reset`,
        { channel },
        token,
      );
      if (channel === 'mail') {
        const ok = Boolean(data.emailSent);
        const msg = ok
          ? `Yeni şifre ${data.email} adresine gönderildi`
          : 'Şifre oluşturuldu ama e-posta iletilemedi';
        onMailSent(data.email, msg, ok);
        return;
      }
      if (!data.password) {
        flash('Şifre oluşturulamadı');
        setBusy(null);
        return;
      }
      openCredentialChannel(channel, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });
      flash(
        channel === 'sms'
          ? 'Yeni şifre · SMS taslağı açıldı'
          : 'Yeni şifre · WhatsApp taslağı açıldı',
      );
      onClose();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Şifre gönderilemedi');
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="send-pass-title"
        className="relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <div>
            <h2 id="send-pass-title" className="text-base font-bold text-[var(--panel-ink)]">
              Şifre gönder
            </h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{user.name}</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            disabled={Boolean(busy)}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-50"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="space-y-2 p-4">
          <p className="mb-1 px-1 text-xs text-[var(--panel-muted)]">Kanal seçin</p>
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                void sendVia(ch.id);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3.5 py-3 text-left transition hover:border-[var(--color-brand-500)]/40 hover:bg-[var(--panel-hover)] disabled:opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3e8dc] text-[#5c4a3a]">
                <ChannelIcon kind={ch.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--panel-ink)]">
                  {busy === ch.id ? 'Hazırlanıyor…' : ch.label}
                </span>
                <span className="block truncate text-xs text-[var(--panel-muted)]">
                  {ch.hint || '—'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function ChannelIcon({ kind }: { kind: 'mail' | 'sms' | 'wp' }) {
  if (kind === 'mail') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="m3 7 9 7 9-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'sms') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V6Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12.04 2c-5.5 0-9.96 4.45-9.96 9.94 0 1.75.46 3.46 1.33 4.97L2 22l5.23-1.37a9.93 9.93 0 0 0 4.81 1.23h.01c5.49 0 9.95-4.46 9.95-9.95A9.94 9.94 0 0 0 12.04 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
