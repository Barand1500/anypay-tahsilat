import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CreatableFilterInput } from '../../components/ui/CreatableFilterInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { usePermission } from '../../permissions/PermissionContext';
import type { PermAction } from '../roles/mockRoles';
import {
  getCustomerAddresses,
  getCustomerUsers,
  initialsOf,
  setCustomerAddresses,
  setCustomerUsers,
  type CustomerAddress,
  type CustomerUser,
} from './mockCustomerDetail';
import {
  COUNTRIES,
  PROVINCES,
  districtsOf,
  neighborhoodsOf,
  quartersOf,
} from './mockLocations';
import {
  accountTypeExists,
  addAccountType,
  CUSTOMER_KIND_OPTIONS,
  formatPhoneLive,
  getAccountTypes,
  getLiveCustomers,
  normalizePhoneInput,
  TAX_OFFICE_OPTIONS,
  updateLiveCustomer,
  type Customer,
  type CustomerKind,
} from './mockCustomers';

type TabId = 'bilgi' | 'kullanicilar' | 'adresler';

const TABS: { id: TabId; label: string }[] = [
  { id: 'bilgi', label: 'Müşteri Bilgileri' },
  { id: 'kullanicilar', label: 'Kullanıcılar' },
  { id: 'adresler', label: 'Adresler' },
];

/** Müşteri detay — düzenleme + kullanıcılar + adresler */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { guard } = usePermission();
  const rootRef = useRef<HTMLDivElement>(null);

  const tabParam = searchParams.get('tab');
  const tab: TabId =
    tabParam === 'kullanicilar' || tabParam === 'adresler' ? tabParam : 'bilgi';

  const [customers, setCustomers] = useState(() => getLiveCustomers());
  const customer = useMemo(
    () => customers.find((c) => c.id === id) ?? null,
    [customers, id],
  );

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
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

  if (!customer) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-8 text-center">
        <p className="text-[var(--panel-ink)]">Müşteri bulunamadı.</p>
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
          allCustomers={customers}
          guard={guard}
          onSaved={(c) => {
            setCustomers(getLiveCustomers());
            flash(`Kaydedildi — ${c.title}`);
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
  guard,
  onSaved,
}: {
  customer: Customer;
  allCustomers: Customer[];
  guard: (mod: string, act: PermAction, label?: string) => boolean;
  onSaved: (c: Customer) => void;
}) {
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

  const [parentId, setParentId] = useState<string | null>(customer.parentId);
  const [accountType, setAccountType] = useState(customer.accountType);
  const [accountTypes, setAccountTypes] = useState(() => getAccountTypes());
  const [kind, setKind] = useState<CustomerKind>(customer.kind);
  const [identityNo, setIdentityNo] = useState(customer.identityNo);
  const [taxNo, setTaxNo] = useState(customer.taxNo);
  const [taxOffice, setTaxOffice] = useState<string | null>(customer.taxOffice);
  const [title, setTitle] = useState(customer.title);
  const [phone, setPhone] = useState(customer.phone || '5');
  const [email, setEmail] = useState(customer.email);
  const [emailOpen, setEmailOpen] = useState(false);
  const [address, setAddress] = useState(customer.address);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    const nextErr: Record<string, string> = {};
    if (!title.trim()) nextErr.title = 'Gerekli';
    if (phone.replace(/\D/g, '').length < 10) nextErr.phone = 'Telefon gerekli';
    if (!email.trim()) nextErr.email = 'E-posta gerekli';
    setErrors(nextErr);
    if (Object.keys(nextErr).length) return;

    const trimmed = accountType.trim();
    if (trimmed && !accountTypeExists(trimmed, accountTypes)) {
      addAccountType(trimmed);
      setAccountTypes(getAccountTypes());
    }

    setSaving(true);
    const updated = updateLiveCustomer(customer.id, {
      parentId,
      accountType: trimmed,
      kind,
      code: customer.code,
      title: title.trim().toLocaleUpperCase('tr'),
      phone: phone.replace(/\D/g, '').slice(0, 10),
      email: email.trim().toLocaleLowerCase('tr'),
      taxNo: kind === 'tuzel' ? taxNo.trim() : identityNo.trim() || taxNo.trim(),
      taxOffice: kind === 'tuzel' ? taxOffice ?? '' : '',
      identityNo: kind === 'tuzel' ? '' : identityNo.trim(),
      address: address.trim(),
    });
    window.setTimeout(() => {
      setSaving(false);
      if (updated) onSaved(updated);
    }, 280);
  }

  return (
    <form data-anim onSubmit={onSubmit}>
      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
          <h1 className="text-lg font-bold tracking-tight text-[var(--panel-ink)]">Müşteri Bilgileri</h1>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          {/* 1 — tam genişlik */}
          <FloatingSearchSelect
            label="Üst Müşteri"
            options={parents}
            value={parentId}
            onChange={setParentId}
            placeholder="Üst Müşteri seçiniz."
            kmJump
          />

          {/* Gerçek/yabancı: 3 kolon | Tüzel: 4 kolon */}
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
                options={TAX_OFFICE_OPTIONS}
                value={taxOffice}
                onChange={setTaxOffice}
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

          {/* 1 — ad / ünvan */}
          <TextInput
            data-km-jump
            label={nameLabel}
            value={title}
            error={errors.title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* 2 — telefon + e-posta */}
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
  const [users, setUsers] = useState(() => getCustomerUsers(customer.id));
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('5');
  const [passwordUser, setPasswordUser] = useState<CustomerUser | null>(null);

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

  function persist(next: CustomerUser[]) {
    setUsers(next);
    setCustomerUsers(customer.id, next);
  }

  function addUser(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const u: CustomerUser = {
      id: `cu-${Date.now()}`,
      customerId: customer.id,
      name: name.trim(),
      email: email.trim().toLocaleLowerCase('tr'),
      phone: phone.replace(/\D/g, '').slice(0, 10),
      active: true,
      lastLogin: null,
    };
    persist([u, ...users]);
    setAddOpen(false);
    setName('');
    setEmail('');
    setPhone('5');
    flash('Kullanıcı eklendi');
  }

  function toggleActive(uid: string) {
    persist(users.map((u) => (u.id === uid ? { ...u, active: !u.active } : u)));
  }

  function removeUser(uid: string) {
    persist(users.filter((u) => u.id !== uid));
    flash('Kullanıcı silindi');
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
          onSubmit={addUser}
          className="border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-5 py-4 sm:px-6"
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
                  Kullanıcı yok.
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
                    {u.lastLogin ?? 'Henüz giriş yapmamış'}
                  </td>
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.active}
                        onClick={() => toggleActive(u.id)}
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
                        onClick={() => removeUser(u.id)}
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
        <SendPasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      ) : null}
    </section>
  );
}

function AddressesTab({ customer, flash }: { customer: Customer; flash: (m: string) => void }) {
  const [list, setList] = useState(() => getCustomerAddresses(customer.id));
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState<string | null>('TR');
  const [province, setProvince] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [quarter, setQuarter] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<string | null>(null);
  const [street, setStreet] = useState('');
  const [directions, setDirections] = useState('');
  const [contactName, setContactName] = useState(customer.title);
  const [formError, setFormError] = useState<string | null>(null);

  const districtOpts = useMemo(() => districtsOf(province), [province]);
  const quarterOpts = useMemo(() => quartersOf(district), [district]);
  const neighborhoodOpts = useMemo(() => neighborhoodsOf(district), [district]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return list;
    return list.filter(
      (a) =>
        a.label.toLocaleLowerCase('tr').includes(q) ||
        a.address.toLocaleLowerCase('tr').includes(q) ||
        a.contactName.toLocaleLowerCase('tr').includes(q),
    );
  }, [list, query]);

  function persist(next: CustomerAddress[]) {
    setList(next);
    setCustomerAddresses(customer.id, next);
  }

  function resetForm() {
    setLabel('');
    setCountry('TR');
    setProvince(null);
    setDistrict(null);
    setQuarter(null);
    setNeighborhood(null);
    setStreet('');
    setDirections('');
    setContactName(customer.title);
    setFormError(null);
  }

  function buildFullAddress() {
    const parts = [
      street.trim(),
      neighborhoodOpts.find((n) => n.value === neighborhood)?.label,
      quarterOpts.find((q) => q.value === quarter)?.label,
      districtOpts.find((d) => d.value === district)?.label,
      PROVINCES.find((p) => p.value === province)?.label,
      COUNTRIES.find((c) => c.value === country)?.label,
    ].filter(Boolean);
    return parts.join(', ');
  }

  function addAddr(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setFormError('Adres adı gerekli');
      return;
    }
    if (!country || !province || !district || !quarter || !neighborhood || !street.trim()) {
      setFormError('Zorunlu adres alanlarını doldurun');
      return;
    }
    const full = buildFullAddress();
    const a: CustomerAddress = {
      id: `ca-${Date.now()}`,
      customerId: customer.id,
      label: label.trim().toLocaleUpperCase('tr'),
      address: directions.trim() ? `${full} — ${directions.trim()}` : full,
      contactName: contactName.trim() || customer.title,
      isDefault: list.length === 0,
      country: country ?? undefined,
      province: province ?? undefined,
      district: district ?? undefined,
      quarter: quarter ?? undefined,
      neighborhood: neighborhood ?? undefined,
      street: street.trim(),
      directions: directions.trim(),
    };
    persist([a, ...list]);
    setAddOpen(false);
    resetForm();
    flash('Adres eklendi');
  }

  function removeAddr(aid: string) {
    persist(list.filter((a) => a.id !== aid));
    flash('Adres silindi');
  }

  return (
    <section data-anim className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
        <h1 className="text-lg font-bold text-[var(--panel-ink)]">Müşteri Adresleri</h1>
        <button
          type="button"
          data-km-jump
          onClick={() => {
            resetForm();
            setAddOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <span className="text-lg leading-none">+</span>
          Ekle
        </button>
      </div>

      {addOpen ? (
        <form
          onSubmit={addAddr}
          className="space-y-4 border-b border-[var(--panel-line)] bg-[var(--panel-surface)] px-5 py-5 sm:px-6 [--input-notch:var(--panel-surface)]"
        >
          <h2 className="text-sm font-bold text-[var(--panel-ink)]">Adres Ekle</h2>
          <TextInput
            label="Adres Adı *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            data-km-jump
          />
          <FloatingSearchSelect
            label="Ülke *"
            options={COUNTRIES}
            value={country}
            onChange={setCountry}
            placeholder="Ülke seçiniz."
            required
            kmJump
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="İl *"
              options={PROVINCES}
              value={province}
              onChange={(v) => {
                setProvince(v);
                setDistrict(null);
                setQuarter(null);
                setNeighborhood(null);
              }}
              placeholder="İl seçiniz."
              required
              kmJump
            />
            <FloatingSearchSelect
              label="İlçe *"
              options={districtOpts}
              value={district}
              onChange={(v) => {
                setDistrict(v);
                setQuarter(null);
                setNeighborhood(null);
              }}
              placeholder="İlçe seçiniz."
              required
              kmJump
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="Semt *"
              options={quarterOpts}
              value={quarter}
              onChange={setQuarter}
              placeholder="Semt seçiniz."
              required
              kmJump
            />
            <FloatingSearchSelect
              label="Mahalle *"
              options={neighborhoodOpts}
              value={neighborhood}
              onChange={setNeighborhood}
              placeholder="Mahalle seçiniz."
              required
              kmJump
            />
          </div>
          <TextInput
            label="Cadde/Sokak *"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            required
            data-km-jump
          />
          <TextInput
            label="Adres Tarifi"
            value={directions}
            onChange={(e) => setDirections(e.target.value)}
            data-km-jump
          />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <TextInput
              label="Yetkililer"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              data-km-jump
            />
            <div className="flex shrink-0 gap-2 sm:pb-0.5">
              <button
                type="submit"
                data-km-jump
                className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)]"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  resetForm();
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)]"
              >
                İptal
              </button>
            </div>
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
                  Adres yok.
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
                  <td className="px-3 py-3 font-medium text-[var(--panel-ink)]">{a.contactName}</td>
                  <td className="px-5 py-3 sm:px-6">
                    <button
                      type="button"
                      onClick={() => removeAddr(a.id)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                    >
                      Sil
                    </button>
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
  user,
  onClose,
}: {
  user: CustomerUser;
  onClose: () => void;
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
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const channels = [
    { id: 'mail', label: 'E-posta', hint: user.email, icon: 'mail' as const },
    { id: 'sms', label: 'SMS', hint: formatPhoneLive(user.phone), icon: 'sms' as const },
    { id: 'wp', label: 'WhatsApp', hint: formatPhoneLive(user.phone), icon: 'wp' as const },
  ];

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
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
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
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3.5 py-3 text-left transition hover:border-[var(--color-brand-500)]/40 hover:bg-[var(--panel-hover)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3e8dc] text-[#5c4a3a]">
                <ChannelIcon kind={ch.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--panel-ink)]">{ch.label}</span>
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
