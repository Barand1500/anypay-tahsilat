import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CreatableFilterInput } from '../../components/ui/CreatableFilterInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { usePermission } from '../../permissions/PermissionContext';
import type { PermAction } from '../roles/mockRoles';
import {
  initialsOf,
  type CustomerAddress,
  type CustomerUser,
} from './mockCustomerDetail';
import {
  accountTypeExists,
  CUSTOMER_KIND_OPTIONS,
  formatPhoneLive,
  normalizePhoneInput,
  type Customer,
  type CustomerKind,
} from './mockCustomers';
import { mapCustomer, type ApiCustomer, type CustomerMeta } from './customersApi';
import { openCredentialChannel, type CredentialChannel } from './sendCredentials';
import { useCustomer } from './useCustomer';

type TabId = 'bilgi' | 'kullanicilar' | 'adresler';

const TABS: { id: TabId; label: string }[] = [
  { id: 'bilgi', label: 'Müşteri Bilgileri' },
  { id: 'kullanicilar', label: 'Kullanıcılar' },
  { id: 'adresler', label: 'Adresler' },
];

/** Müşteri detay — düzenleme + kullanıcılar + adresler */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { guard } = usePermission();
  const rootRef = useRef<HTMLDivElement>(null);

  const tabParam = searchParams.get('tab');
  const tab: TabId =
    tabParam === 'kullanicilar' || tabParam === 'adresler' ? tabParam : 'bilgi';

  const { customer, setCustomer, loading, error, reload } = useCustomer(id);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<CustomerMeta | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const [list, m] = await Promise.all([
          api.get<ApiCustomer[]>('/api/customers', token),
          api.get<CustomerMeta>('/api/customers/meta', token),
        ]);
        if (cancelled) return;
        setAllCustomers(list.map(mapCustomer));
        setMeta(m);
      } catch {
        /* üst müşteri / vergi daireleri opsiyonel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !customer) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.36,
        stagger: 0.04,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, [customer?.id, tab]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function setTab(next: TabId) {
    setSearchParams(next === 'bilgi' ? {} : { tab: next }, { replace: true });
  }

  function flash(msg: string) {
    setToast(msg);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center text-sm text-[var(--panel-muted)]">
        Müşteri yükleniyor…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
        <p className="text-[var(--panel-ink)]">{error || 'Müşteri bulunamadı.'}</p>
        <Link to="/musteriler" className="mt-3 inline-block text-sm font-semibold text-[var(--color-brand-600)]">
          Listeye dön
        </Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-full pb-10">
      <nav data-anim className="mb-3 text-sm text-[var(--panel-ink)]/65">
        <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
          Anasayfa
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link to="/musteriler" className="font-medium hover:text-[var(--color-brand-600)]">
          Müşteriler
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">{customer.title}</span>
        {tab !== 'bilgi' ? (
          <>
            <span className="mx-1.5 opacity-50">›</span>
            <span className="font-semibold text-[var(--panel-ink)]">
              {tab === 'kullanicilar' ? 'Kullanıcılar' : 'Adresler'}
            </span>
          </>
        ) : null}
      </nav>

      <div data-anim className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-km-jump
              onClick={() => setTab(t.id)}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                active
                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                  : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
              ].join(' ')}
            >
              <TabIcon id={t.id} active={active} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'bilgi' ? (
        <InfoTab
          customer={customer}
          allCustomers={allCustomers}
          taxOffices={meta?.taxOffices ?? []}
          accountTypeOptions={meta?.accountTypes.map((t) => t.name) ?? []}
          guard={guard}
          onSaved={(c) => {
            setCustomer(c);
            setAllCustomers((prev) => {
              const i = prev.findIndex((x) => x.id === c.id);
              if (i < 0) return [...prev, c];
              const next = [...prev];
              next[i] = c;
              return next;
            });
            flash(`Kaydedildi — ${c.title}`);
            void reload();
          }}
        />
      ) : null}
      {tab === 'kullanicilar' ? <UsersTab customer={customer} flash={flash} /> : null}
      {tab === 'adresler' ? <AddressesTab customer={customer} flash={flash} /> : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[10040] -translate-x-1/2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--panel-ink)] shadow-[var(--panel-shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function InfoTab({
  customer,
  allCustomers,
  taxOffices,
  accountTypeOptions,
  guard,
  onSaved,
}: {
  customer: Customer;
  allCustomers: Customer[];
  taxOffices: { id: number; value: string; label: string }[];
  accountTypeOptions: string[];
  guard: (mod: string, act: PermAction, label?: string) => boolean;
  onSaved: (c: Customer) => void;
}) {
  const { token } = useAuth();
  const emailWrap = useRef<HTMLDivElement>(null);
  const parents = useMemo(
    () =>
      allCustomers
        .filter((c) => c.id !== customer.id)
        .map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })),
    [allCustomers, customer.id],
  );
  const kindOptions = useMemo(
    () => CUSTOMER_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );
  const taxOfficeOptions = useMemo(
    () => taxOffices.map((t) => ({ value: t.value, label: t.label })),
    [taxOffices],
  );

  const [parentId, setParentId] = useState<string | null>(customer.parentId);
  const [accountType, setAccountType] = useState(customer.accountType);
  const [accountTypes, setAccountTypes] = useState(accountTypeOptions);
  const [kind, setKind] = useState<CustomerKind>(customer.kind);
  const [identityNo, setIdentityNo] = useState(customer.identityNo);
  const [taxNo, setTaxNo] = useState(customer.taxNo);
  const [taxOfficeId, setTaxOfficeId] = useState<string | null>(
    customer.taxOfficeId != null ? String(customer.taxOfficeId) : null,
  );
  const [title, setTitle] = useState(customer.title);
  const [phone, setPhone] = useState(customer.phone || '5');
  const [email, setEmail] = useState(customer.email);
  const [emailOpen, setEmailOpen] = useState(false);
  const [address, setAddress] = useState(customer.address);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setAccountTypes(accountTypeOptions);
  }, [accountTypeOptions]);

  const suggestions = useMemo(() => emailSuggestions(email), [email]);
  const idMax = kind === 'yabanci' ? 20 : 11;
  const nameLabel = kind === 'tuzel' ? 'Ünvan *' : 'Ad Soyad *';

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!emailWrap.current?.contains(e.target as Node)) setEmailOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    if (!token) return;
    const nextErr: Record<string, string> = {};
    if (!title.trim()) nextErr.title = 'Gerekli';
    if (phone.replace(/\D/g, '').length < 10) nextErr.phone = 'Telefon gerekli';
    if (!email.trim()) nextErr.email = 'E-posta gerekli';
    setErrors(nextErr);
    if (Object.keys(nextErr).length) return;

    const trimmed = accountType.trim();
    if (trimmed && !accountTypeExists(trimmed, accountTypes)) {
      setAccountTypes((prev) => [trimmed, ...prev]);
    }

    setSaving(true);
    setSaveError(null);
    try {
      const raw = await api.patch<ApiCustomer>(
        `/api/customers/${encodeURIComponent(customer.id)}`,
        {
          code: customer.code,
          title: title.trim().toLocaleUpperCase('tr'),
          kind,
          phone: phone.replace(/\D/g, '').slice(0, 10),
          email: email.trim().toLocaleLowerCase('tr'),
          taxNo: kind === 'tuzel' ? taxNo.trim() : '',
          taxOfficeId: kind === 'tuzel' && taxOfficeId ? Number(taxOfficeId) : null,
          identityNo: kind === 'tuzel' ? '' : identityNo.trim(),
          address: address.trim(),
          accountTypeName: trimmed || undefined,
          parentId: parentId ? Number(parentId) : null,
        },
        token,
      );
      onSaved(mapCustomer(raw));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form data-anim onSubmit={(e) => void onSubmit(e)}>
      {saveError ? (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      ) : null}
      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight text-[var(--panel-ink)]">Müşteri Bilgileri</h1>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <FloatingSearchSelect
            label="Üst Müşteri"
            options={parents}
            value={parentId}
            onChange={setParentId}
            placeholder="Üst Müşteri seçiniz."
            kmJump
          />

          {kind === 'tuzel' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CreatableFilterInput
                label="Cari Tipi"
                value={accountType}
                onChange={setAccountType}
                options={accountTypes}
                placeholder="Belirtilmemiş"
                kmJump
              />
              <FloatingSearchSelect
                label="Müşteri Tipi *"
                options={kindOptions}
                value={kind}
                onChange={(v) => setKind((v as CustomerKind) || 'gercek')}
                required
                kmJump
              />
              <TextInput
                data-km-jump
                label="Vergi Numarası"
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                className="font-mono tabular-nums"
              />
              <FloatingSearchSelect
                label="Vergi Dairesi"
                options={taxOfficeOptions}
                value={taxOfficeId}
                onChange={setTaxOfficeId}
                kmJump
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <CreatableFilterInput
                label="Cari Tipi"
                value={accountType}
                onChange={setAccountType}
                options={accountTypes}
                placeholder="Belirtilmemiş"
                kmJump
              />
              <FloatingSearchSelect
                label="Müşteri Tipi *"
                options={kindOptions}
                value={kind}
                onChange={(v) => setKind((v as CustomerKind) || 'gercek')}
                required
                kmJump
              />
              <TextInput
                data-km-jump
                label={kind === 'yabanci' ? 'Pasaport No' : 'TC Kimlik No'}
                value={identityNo}
                onChange={(e) =>
                  setIdentityNo(
                    kind === 'yabanci'
                      ? e.target.value.toUpperCase().slice(0, idMax)
                      : e.target.value.replace(/\D/g, '').slice(0, idMax),
                  )
                }
                className="font-mono tabular-nums"
              />
            </div>
          )}

          <TextInput
            data-km-jump
            label={nameLabel}
            value={title}
            error={errors.title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              data-km-jump
              label="Telefon *"
              value={formatPhoneLive(phone)}
              error={errors.phone}
              onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
              inputMode="tel"
              className="font-mono tabular-nums"
            />
            <div ref={emailWrap} className="relative">
              <TextInput
                data-km-jump
                label="E-Posta *"
                type="email"
                value={email}
                error={errors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailOpen(true);
                }}
                onFocus={() => setEmailOpen(true)}
                autoComplete="off"
              />
              {emailOpen && suggestions.length > 0 ? (
                <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel-hover)]"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setEmail(s);
                          setEmailOpen(false);
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="relative">
            <textarea
              data-km-jump
              id="detail-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder=" "
              rows={3}
              className="peer w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 text-sm outline-none focus:border-[var(--input-border-focus)]"
            />
            <label
              htmlFor="detail-address"
              className="input-label-gap pointer-events-none absolute left-3 top-4 z-10 origin-left px-1.5 text-sm text-[var(--panel-muted)] transition-all peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[var(--input-label)] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium"
            >
              Adres
            </label>
          </div>
        </div>
        <div className="border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-5 py-4 sm:px-6">
          <button
            type="submit"
            data-km-jump
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
          >
            <SaveIcon />
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </section>
    </form>
  );
}

function UsersTab({ customer, flash }: { customer: Customer; flash: (m: string) => void }) {
  const { token } = useAuth();
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('5');
  const [passwordUser, setPasswordUser] = useState<CustomerUser | null>(null);

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

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !email.trim()) return;
    try {
      const u = await api.post<CustomerUser>(
        `/api/customers/${encodeURIComponent(customer.id)}/users`,
        {
          name: name.trim(),
          email: email.trim().toLocaleLowerCase('tr'),
          phone: phone.replace(/\D/g, '').slice(0, 10),
        },
        token,
      );
      setUsers((prev) => [u, ...prev]);
      setAddOpen(false);
      setName('');
      setEmail('');
      setPhone('5');
      flash('Kullanıcı eklendi');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Kullanıcı eklenemedi');
    }
  }

  async function toggleActive(uid: string) {
    if (!token) return;
    const cur = users.find((u) => u.id === uid);
    if (!cur) return;
    try {
      const updated = await api.patch<CustomerUser>(
        `/api/customers/${encodeURIComponent(customer.id)}/users/${encodeURIComponent(uid)}`,
        { active: !cur.active },
        token,
      );
      setUsers((prev) => prev.map((u) => (u.id === uid ? updated : u)));
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Güncellenemedi');
    }
  }

  async function removeUser(uid: string) {
    if (!token) return;
    try {
      await api.delete(
        `/api/customers/${encodeURIComponent(customer.id)}/users/${encodeURIComponent(uid)}`,
        token,
      );
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      flash('Kullanıcı silindi');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  return (
    <section data-anim className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold text-[var(--panel-ink)]">Müşteri Kullanıcıları</h1>
        <button
          type="button"
          data-km-jump
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <span className="text-lg leading-none">+</span>
          Ekle
        </button>
      </div>

      {addOpen ? (
        <form
          onSubmit={(e) => void addUser(e)}
          className="border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-4 sm:px-6"
        >
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
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)]"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
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
                <tr key={u.id} className="border-b border-[var(--panel-line)]/80">
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft-bg)] text-xs font-bold text-[var(--color-brand-600)]">
                        {initialsOf(u.name)}
                      </span>
                      <span className="font-semibold text-[var(--panel-ink)]">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--panel-ink)]/80">{u.email}</td>
                  <td className="px-3 py-3 font-mono tabular-nums">{formatPhoneLive(u.phone)}</td>
                  <td className="px-3 py-3 text-[var(--panel-muted)]">
                    {u.lastLogin
                      ? new Date(u.lastLogin).toLocaleString('tr-TR')
                      : 'Henüz giriş yapmamış'}
                  </td>
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.active}
                        onClick={() => {
                          void toggleActive(u.id);
                        }}
                        className={[
                          'relative h-6 w-11 rounded-full transition',
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
                        onClick={() => setPasswordUser(u)}
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
        />
      ) : null}
    </section>
  );
}

function AddressesTab({ customer, flash }: { customer: Customer; flash: (m: string) => void }) {
  const { token } = useAuth();
  type LocOpt = { value: string; label: string };
  type ApiAddress = CustomerAddress & {
    contactNames?: string[];
    ulkeId?: number;
    ilId?: number;
    ilceId?: number;
    semtId?: number;
    mahalleId?: number;
    sokakId?: number;
  };

  const [list, setList] = useState<ApiAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [directions, setDirections] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [countries, setCountries] = useState<LocOpt[]>([]);
  const [provinces, setProvinces] = useState<LocOpt[]>([]);
  const [districts, setDistricts] = useState<LocOpt[]>([]);
  const [towns, setTowns] = useState<LocOpt[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<LocOpt[]>([]);
  const [streets, setStreets] = useState<LocOpt[]>([]);

  async function reload() {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await api.get<ApiAddress[]>(
        `/api/customers/${encodeURIComponent(customer.id)}/addresses`,
        token,
      );
      setList(rows);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Adresler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, token]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const rows = await api.get<LocOpt[]>('/api/customers/locations/countries', token);
        setCountries(rows);
        const tr = rows.find((r) => r.label.toLocaleLowerCase('tr').includes('türkiye'));
        if (tr) setCountry((c) => c ?? tr.value);
      } catch {
        /* loc opsiyonel */
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !country) {
      setProvinces([]);
      return;
    }
    void (async () => {
      try {
        setProvinces(
          await api.get<LocOpt[]>(
            `/api/customers/locations/provinces?ulkeId=${encodeURIComponent(country)}`,
            token,
          ),
        );
      } catch {
        setProvinces([]);
      }
    })();
  }, [token, country]);

  useEffect(() => {
    if (!token || !province) {
      setDistricts([]);
      return;
    }
    void (async () => {
      try {
        setDistricts(
          await api.get<LocOpt[]>(
            `/api/customers/locations/districts?ilId=${encodeURIComponent(province)}`,
            token,
          ),
        );
      } catch {
        setDistricts([]);
      }
    })();
  }, [token, province]);

  useEffect(() => {
    if (!token || !district) {
      setTowns([]);
      return;
    }
    void (async () => {
      try {
        setTowns(
          await api.get<LocOpt[]>(
            `/api/customers/locations/towns?ilceId=${encodeURIComponent(district)}`,
            token,
          ),
        );
      } catch {
        setTowns([]);
      }
    })();
  }, [token, district]);

  useEffect(() => {
    if (!token || !town) {
      setNeighborhoods([]);
      return;
    }
    void (async () => {
      try {
        setNeighborhoods(
          await api.get<LocOpt[]>(
            `/api/customers/locations/neighborhoods?semtId=${encodeURIComponent(town)}`,
            token,
          ),
        );
      } catch {
        setNeighborhoods([]);
      }
    })();
  }, [token, town]);

  useEffect(() => {
    if (!token || !neighborhood) {
      setStreets([]);
      return;
    }
    void (async () => {
      try {
        setStreets(
          await api.get<LocOpt[]>(
            `/api/customers/locations/streets?mahalleId=${encodeURIComponent(neighborhood)}`,
            token,
          ),
        );
      } catch {
        setStreets([]);
      }
    })();
  }, [token, neighborhood]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return list;
    return list.filter(
      (a) =>
        a.label.toLocaleLowerCase('tr').includes(q) ||
        a.address.toLocaleLowerCase('tr').includes(q) ||
        a.contactName.toLocaleLowerCase('tr').includes(q) ||
        (a.contactNames || []).some((n) => n.toLocaleLowerCase('tr').includes(q)),
    );
  }, [list, query]);

  function resetForm() {
    setEditingId(null);
    setLabel('');
    setProvince(null);
    setDistrict(null);
    setTown(null);
    setNeighborhood(null);
    setStreet(null);
    setDirections('');
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(a: ApiAddress) {
    setEditingId(a.id);
    setLabel(a.label);
    setCountry(a.ulkeId != null ? String(a.ulkeId) : null);
    setProvince(a.ilId != null ? String(a.ilId) : null);
    setDistrict(a.ilceId != null ? String(a.ilceId) : null);
    setTown(a.semtId != null ? String(a.semtId) : null);
    setNeighborhood(a.mahalleId != null ? String(a.mahalleId) : null);
    setStreet(a.sokakId != null ? String(a.sokakId) : null);
    setDirections(a.directions || '');
    setFormError(null);
    setFormOpen(true);
  }

  async function saveAddr(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!label.trim()) {
      setFormError('Adres adı gerekli');
      return;
    }
    if (!country || !province || !district || !town || !neighborhood || !street) {
      setFormError('Zorunlu adres alanlarını doldurun');
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      label: label.trim(),
      ulkeId: Number(country),
      ilId: Number(province),
      ilceId: Number(district),
      semtId: Number(town),
      mahalleId: Number(neighborhood),
      sokakId: Number(street),
      directions: directions.trim(),
    };
    try {
      if (editingId) {
        const row = await api.patch<ApiAddress>(
          `/api/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(editingId)}`,
          body,
          token,
        );
        setList((prev) => prev.map((a) => (a.id === editingId ? row : a)));
        flash('Adres güncellendi');
      } else {
        const row = await api.post<ApiAddress>(
          `/api/customers/${encodeURIComponent(customer.id)}/addresses`,
          body,
          token,
        );
        setList((prev) => [row, ...prev]);
        flash('Adres eklendi');
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Adres kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function removeAddr(aid: string) {
    if (!token) return;
    try {
      await api.delete(
        `/api/customers/${encodeURIComponent(customer.id)}/addresses/${encodeURIComponent(aid)}`,
        token,
      );
      setList((prev) => prev.filter((a) => a.id !== aid));
      flash('Adres silindi');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  return (
    <section data-anim className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold text-[var(--panel-ink)]">Müşteri Adresleri</h1>
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
          onSubmit={(e) => void saveAddr(e)}
          className="space-y-4 border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-5 py-5 sm:px-6 [--input-notch:var(--panel-elevated)]"
        >
          <h2 className="text-sm font-bold text-[var(--panel-ink)]">
            {editingId ? 'Adres Düzenle' : 'Adres Ekle'}
          </h2>
          <TextInput
            label="Adres Adı *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            data-km-jump
          />
          <FloatingSearchSelect
            label="Ülke *"
            options={countries}
            value={country}
            onChange={(v) => {
              setCountry(v);
              setProvince(null);
              setDistrict(null);
              setTown(null);
              setNeighborhood(null);
              setStreet(null);
            }}
            placeholder="Ülke seçiniz."
            required
            kmJump
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="İl *"
              options={provinces}
              value={province}
              onChange={(v) => {
                setProvince(v);
                setDistrict(null);
                setTown(null);
                setNeighborhood(null);
                setStreet(null);
              }}
              placeholder="İl seçiniz."
              required
              kmJump
            />
            <FloatingSearchSelect
              label="İlçe *"
              options={districts}
              value={district}
              onChange={(v) => {
                setDistrict(v);
                setTown(null);
                setNeighborhood(null);
                setStreet(null);
              }}
              placeholder="İlçe seçiniz."
              required
              kmJump
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="Semt *"
              options={towns}
              value={town}
              onChange={(v) => {
                setTown(v);
                setNeighborhood(null);
                setStreet(null);
              }}
              placeholder="Semt seçiniz."
              required
              kmJump
            />
            <FloatingSearchSelect
              label="Mahalle *"
              options={neighborhoods}
              value={neighborhood}
              onChange={(v) => {
                setNeighborhood(v);
                setStreet(null);
              }}
              placeholder="Mahalle seçiniz."
              required
              kmJump
            />
          </div>
          <FloatingSearchSelect
            label="Cadde/Sokak *"
            options={streets}
            value={street}
            onChange={setStreet}
            placeholder="Sokak seçiniz."
            required
            kmJump
          />
          <TextInput
            label="Adres Tarifi"
            value={directions}
            onChange={(e) => setDirections(e.target.value)}
            data-km-jump
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="submit"
              disabled={saving}
              data-km-jump
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
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
            >
              İptal
            </button>
          </div>
          {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
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
              <th className="px-5 py-2.5 font-semibold sm:px-6">Adı</th>
              <th className="px-3 py-2.5 font-semibold">Adres</th>
              <th className="px-3 py-2.5 font-semibold">Yetkililer</th>
              <th className="px-5 py-2.5 font-semibold sm:px-6" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[var(--panel-muted)]">
                  {loading ? 'Yükleniyor…' : 'Adres yok.'}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="border-b border-[var(--panel-line)]/80">
                  <td className="px-5 py-3 font-bold text-[var(--panel-ink)] sm:px-6">
                    {a.label}
                    {a.isDefault ? (
                      <span className="ml-2 rounded-md bg-[var(--brand-soft-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-600)]">
                        Varsayılan
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-[var(--panel-ink)]/80">{a.address}</td>
                  <td className="px-3 py-3 font-medium text-[var(--panel-ink)]">
                    {(a.contactNames && a.contactNames.length
                      ? a.contactNames.join(', ')
                      : a.contactName) || '—'}
                  </td>
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-brand-600)] hover:bg-[var(--brand-soft-bg)]"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void removeAddr(a.id);
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const cls = active ? 'text-white' : 'text-[var(--panel-muted)]';
  if (id === 'bilgi') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 16.5c1.1-1.8 2.4-2.6 4-2.6s2.9.8 4 2.6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === 'kullanicilar') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
        <circle cx="9" cy="8" r="2.8" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3.5 18c1.3-2.6 3.3-3.8 5.5-3.8s4.2 1.2 5.5 3.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M13.5 18c.7-1.4 1.8-2.2 3-2.2s2.2.7 2.8 2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={cls}>
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SendPasswordModal({
  customerId,
  user,
  flash,
  onClose,
}: {
  customerId: string;
  user: CustomerUser;
  flash: (m: string) => void;
  onClose: () => void;
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
    setBusy(channel);
    try {
      const data = await api.post<{
        password: string;
        name: string;
        email: string;
        phone: string;
      }>(
        `/api/customers/${encodeURIComponent(customerId)}/users/${encodeURIComponent(user.id)}/password-reset`,
        {},
        token,
      );
      openCredentialChannel(channel, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });
      const label =
        channel === 'mail' ? 'e-posta' : channel === 'sms' ? 'SMS' : 'WhatsApp';
      flash(`Yeni şifre oluşturuldu · ${label} taslağı açıldı`);
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
                <span className="block truncate text-xs text-[var(--panel-muted)]">{ch.hint || '—'}</span>
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
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 9.5c.3-.6.5-.6.8-.6h.6c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.2.6l-.5.4c-.2.1-.2.3 0 .5.5.7 1.2 1.3 2 1.7.2.1.4.1.5-.1l.4-.5c.2-.2.4-.2.6-.1l1.7.7c.3.1.4.3.4.5v.6c0 .3 0 .5-.6.8A6 6 0 0 1 9.2 9.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 3v6h8V3M8 21v-7h8v7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
