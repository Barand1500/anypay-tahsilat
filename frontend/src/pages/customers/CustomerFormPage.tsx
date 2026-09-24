import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { CreatableFilterInput } from '../../components/ui/CreatableFilterInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { usePermission } from '../../permissions/PermissionContext';
import {
  accountTypeExists,
  CUSTOMER_KIND_OPTIONS,
  formatPhoneLive,
  normalizePhoneInput,
  type CustomerKind,
} from './mockCustomers';
import { type ApiCustomer } from './customersApi';
import { openCredentialChannel } from './sendCredentials';
import {
  getDefaultAccountType,
  getDefaultCustomerKind,
  getDefaultTaxOffice,
} from '../settings/defaultsStore';

type MetaResponse = {
  accountTypes: { id: number; value: string; label: string; name: string }[];
  taxOffices: { id: number; value: string; label: string }[];
};

/**
 * Müşteri Ekle — tek kart “Müşteri Bilgileri” (DB: musteriler).
 */
export default function CustomerFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ustFromUrl = searchParams.get('ust');
  const { guard } = usePermission();
  const rootRef = useRef<HTMLDivElement>(null);
  const emailWrap = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const [parents, setParents] = useState<{ value: string; label: string }[]>([]);
  const [taxOffices, setTaxOffices] = useState<{ value: string; label: string }[]>([]);
  const [accountTypes, setAccountTypes] = useState<string[]>([]);

  const kindOptions = useMemo(
    () => CUSTOMER_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const [parentId, setParentId] = useState<string | null>(ustFromUrl);
  const [accountType, setAccountType] = useState(() => getDefaultAccountType());
  const [accountPrompt, setAccountPrompt] = useState(false);
  const [kind, setKind] = useState<CustomerKind>(() => getDefaultCustomerKind());
  const [code, setCode] = useState('');
  const [identityNo, setIdentityNo] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [taxOfficeId, setTaxOfficeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('5');
  const [email, setEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [createUser, setCreateUser] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const suggestions = useMemo(() => emailSuggestions(email), [email]);
  const idMax = kind === 'yabanci' ? 20 : 11;
  const taxMax = 10;
  const nameLabel = kind === 'tuzel' ? 'Ünvan *' : 'Ad Soyad *';

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const [list, meta] = await Promise.all([
          api.get<ApiCustomer[]>('/api/customers', token),
          api.get<MetaResponse>('/api/customers/meta', token),
        ]);
        if (cancelled) return;
        setParents(
          list.map((c) => ({
            value: String(c.id),
            label: `${c.code} — ${c.title}`,
          })),
        );
        setTaxOffices(meta.taxOffices);
        const names = meta.accountTypes.map((t) => t.name).filter(Boolean);
        if (names.length) setAccountTypes(names);
        const defaultOffice = getDefaultTaxOffice();
        if (defaultOffice) {
          const hit = meta.taxOffices.find(
            (t) => t.label.toLocaleLowerCase('tr') === defaultOffice.toLocaleLowerCase('tr'),
          );
          if (hit) setTaxOfficeId(hit.value);
        }
        if (ustFromUrl && list.some((c) => String(c.id) === ustFromUrl)) {
          setParentId(ustFromUrl);
        }
      } catch {
        /* form yine de açılır */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, ustFromUrl]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const parts = el.querySelectorAll('[data-anim]');
    gsap.fromTo(
      parts,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' },
    );
  }, []);

  function validate() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = kind === 'tuzel' ? 'Ünvan gerekli' : 'Ad soyad gerekli';
    const ph = phone.replace(/\D/g, '');
    if (ph.length < 10) next.phone = 'Telefon 10 hane olmalı';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Geçerli e-posta girin';
    }
    if (kind === 'gercek' && identityNo && identityNo.length !== 11) {
      next.identityNo = 'TC 11 hane olmalı';
    }
    if (kind === 'tuzel' && taxNo && taxNo.length !== 10) {
      next.taxNo = 'Vergi no 10 hane olmalı';
    }
    if (createUser && !email.trim()) {
      next.email = 'Kullanıcı göndermek için e-posta gerekli';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function doSave() {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      const created = await api.post<ApiCustomer>(
        '/api/customers',
        {
          code: code.trim() || undefined,
          title: title.trim().toLocaleUpperCase('tr'),
          kind,
          phone: phone.replace(/\D/g, '').slice(0, 10),
          email: email.trim().toLocaleLowerCase('tr'),
          taxNo: kind === 'tuzel' ? taxNo.trim() : '',
          taxOfficeId: kind === 'tuzel' && taxOfficeId ? Number(taxOfficeId) : null,
          identityNo: kind === 'tuzel' ? '' : identityNo.trim(),
          address: address.trim(),
          accountTypeName: accountType.trim() || undefined,
          parentId: parentId ? Number(parentId) : null,
        },
        token,
      );

      let flash = 'Müşteri kaydedildi';
      if (createUser) {
        const user = await api.post<{
          name: string;
          email: string;
          phone: string;
          tempPassword?: string;
        }>(
          `/api/customers/${created.id}/users`,
          {
            name: title.trim().toLocaleUpperCase('tr'),
            email: email.trim().toLocaleLowerCase('tr'),
            phone: phone.replace(/\D/g, '').slice(0, 10),
          },
          token,
        );
        if (user.tempPassword) {
          openCredentialChannel('mail', {
            name: user.name,
            email: user.email,
            phone: user.phone,
            password: user.tempPassword,
          });
          flash = `Müşteri ve kullanıcı oluşturuldu · e-posta taslağı açıldı (${user.email})`;
        } else {
          flash = 'Müşteri ve kullanıcı oluşturuldu';
        }
      }

      navigate('/musteriler', { replace: true, state: { flash } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guard('m-musteriler', 'save', 'Müşteriler')) return;
    if (!validate()) return;

    const trimmed = accountType.trim();
    if (trimmed && !accountTypeExists(trimmed, accountTypes)) {
      setAccountPrompt(true);
      return;
    }
    void doSave();
  }

  function confirmAddAccountAndSave() {
    const trimmed = accountType.trim();
    if (trimmed && !accountTypeExists(trimmed, accountTypes)) {
      setAccountTypes((prev) => [trimmed, ...prev]);
    }
    setAccountPrompt(false);
    void doSave();
  }

  return (
    <div ref={rootRef} className="w-full pb-10">
      <nav data-anim className="mb-4 text-sm text-[var(--panel-ink)]/65">
        <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
          Anasayfa
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <Link to="/musteriler" className="font-medium hover:text-[var(--color-brand-600)]">
          Müşteriler
        </Link>
        <span className="mx-1.5 opacity-50">›</span>
        <span className="font-semibold text-[var(--panel-ink)]">Ekle</span>
      </nav>

      {formError ? (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {formError}
        </div>
      ) : null}

      <form data-anim onSubmit={onSubmit}>
        <section className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
          <div className="border-b border-[var(--panel-line)] px-5 py-4 sm:px-6">
            <h1 className="text-lg font-bold tracking-tight text-[var(--panel-ink)]">
              Müşteri Bilgileri
            </h1>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <CreatableFilterInput
                label="Cari Tipi"
                value={accountType}
                onChange={setAccountType}
                options={accountTypes}
                placeholder="Cari tipi yazın veya seçin"
                kmJump
              />
              <FloatingSearchSelect
                label="Tip *"
                options={kindOptions}
                value={kind}
                onChange={(v) => {
                  if (!v) return;
                  const next = v as CustomerKind;
                  setKind(next);
                  if (next === 'tuzel') setIdentityNo('');
                  else {
                    setTaxNo('');
                    setTaxOfficeId(null);
                  }
                }}
                required
                kmJump
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                data-km-jump
                label="Müşteri Kodu"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {kind === 'tuzel' ? (
                <TextInput
                  data-km-jump
                  label="Vergi Numarası"
                  inputMode="numeric"
                  value={taxNo}
                  onChange={(e) => setTaxNo(e.target.value.replace(/\D/g, '').slice(0, taxMax))}
                  error={errors.taxNo}
                />
              ) : (
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
                  inputMode={kind === 'yabanci' ? 'text' : 'numeric'}
                  error={errors.identityNo}
                />
              )}
            </div>

            {kind === 'tuzel' ? (
              <FloatingSearchSelect
                label="Vergi Dairesi"
                options={taxOffices}
                value={taxOfficeId}
                onChange={setTaxOfficeId}
                kmJump
              />
            ) : null}

            <TextInput
              data-km-jump
              label={nameLabel}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              error={errors.title}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                data-km-jump
                label="Telefon *"
                inputMode="numeric"
                value={formatPhoneLive(phone)}
                onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                required
                error={errors.phone}
                className="font-mono tabular-nums"
              />
              <div ref={emailWrap} className="relative">
                <TextInput
                  data-km-jump
                  label="E-Posta"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.toLowerCase());
                    setEmailOpen(true);
                  }}
                  onFocus={() => setEmailOpen(true)}
                  onBlur={() => window.setTimeout(() => setEmailOpen(false), 120)}
                  autoComplete="off"
                  error={errors.email}
                />
                {emailOpen && suggestions.length > 0 ? (
                  <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                          onMouseDown={(e) => e.preventDefault()}
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

            <TextInput
              data-km-jump
              label="Adres"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-3">
              <input
                type="checkbox"
                checked={createUser}
                onChange={(e) => setCreateUser(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-brand-600)]"
              />
              <span className="text-sm font-medium text-[var(--panel-ink)]">
                Kullanıcı oluştur ve giriş bilgilerini e-posta ile gönder
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="text-sm font-semibold text-[var(--color-brand-600)] hover:underline"
            >
              Bilgi
            </button>
            <div className="flex gap-2">
              <Link
                to="/musteriler"
                className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
              >
                İptal
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)] disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </section>
      </form>

      {accountPrompt
        ? createPortal(
            <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl">
                <p className="text-base font-bold text-[var(--panel-ink)]">Yeni cari tipi</p>
                <p className="mt-2 text-sm text-[var(--panel-muted)]">
                  “{accountType.trim()}” listede yok. Yine de bu isimle kaydedilsin mi?
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountPrompt(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={confirmAddAccountAndSave}
                    className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Evet, kaydet
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {infoOpen
        ? createPortal(
            <div
              ref={infoRef}
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-lg rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-bold text-[var(--panel-ink)]">Müşteri ekleme</p>
                  <button
                    type="button"
                    onClick={() => setInfoOpen(false)}
                    className="rounded-lg px-2 py-1 text-sm text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
                  >
                    Kapat
                  </button>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--panel-muted)]">
                  Zorunlu alanlar ünvan/ad soyad ve telefondur. Tip’e göre TC, pasaport veya vergi
                  bilgileri istenir. Üst müşteri seçerek alt cari oluşturabilirsiniz.
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
