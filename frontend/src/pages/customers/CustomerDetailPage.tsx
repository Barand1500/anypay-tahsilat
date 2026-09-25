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
  accountTypeExists,
  CUSTOMER_KIND_OPTIONS,
  formatPhoneLive,
  normalizePhoneInput,
  type Customer,
  type CustomerKind,
} from './mockCustomers';
import { mapCustomer, type ApiCustomer, type CustomerMeta } from './customersApi';
import { CustomerAddressesTab } from './CustomerAddressesTab';
import { CustomerUsersTab } from './CustomerUsersTab';
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

      <div data-anim className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/musteriler/${encodeURIComponent(customer.id)}/odeme-al`}
              className="inline-flex items-center rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Ödeme Al
            </Link>
            <Link
              to={`/musteriler/${encodeURIComponent(customer.id)}/odeme-istegi`}
              className="inline-flex items-center rounded-xl bg-[var(--color-brand-600)] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-brand-500)]"
            >
              Ödeme İsteği
            </Link>
          </div>
        ) : null}
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
      {tab === 'kullanicilar' ? (
        <CustomerUsersTab customer={customer} flash={flash} onCustomerPatched={setCustomer} />
      ) : null}
      {tab === 'adresler' ? (
        <CustomerAddressesTab customer={customer} flash={flash} onCustomerPatched={setCustomer} />
      ) : null}

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
