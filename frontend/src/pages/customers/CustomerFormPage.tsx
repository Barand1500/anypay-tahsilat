import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CreatableFilterInput } from '../../components/ui/CreatableFilterInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { emailSuggestions } from '../../lib/emailSuggestions';
import { usePermission } from '../../permissions/PermissionContext';
import {
  accountTypeExists,
  addAccountType,
  addLiveCustomer,
  CUSTOMER_KIND_OPTIONS,
  formatPhoneLive,
  getAccountTypes,
  getLiveCustomers,
  normalizePhoneInput,
  TAX_OFFICE_OPTIONS,
  type Customer,
  type CustomerKind,
} from './mockCustomers';
import {
  getDefaultAccountType,
  getDefaultCustomerKind,
  getDefaultTaxOffice,
} from '../settings/defaultsStore';

/**
 * Müşteri Ekle — tek kart “Müşteri Bilgileri” (referans düzen).
 */
export default function CustomerFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ustFromUrl = searchParams.get('ust');
  const { guard } = usePermission();
  const rootRef = useRef<HTMLDivElement>(null);
  const emailWrap = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const allCustomers = useMemo(() => getLiveCustomers(), []);

  const parents = useMemo(
    () =>
      allCustomers.map((c) => ({
        value: c.id,
        label: `${c.code} — ${c.title}`,
      })),
    [allCustomers],
  );

  const kindOptions = useMemo(
    () => CUSTOMER_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const [parentId, setParentId] = useState<string | null>(() => {
    if (ustFromUrl && allCustomers.some((c) => c.id === ustFromUrl)) return ustFromUrl;
    return null;
  });
  const [accountType, setAccountType] = useState(() => getDefaultAccountType());
  const [accountTypes, setAccountTypes] = useState<string[]>(() => getAccountTypes());
  const [accountPrompt, setAccountPrompt] = useState(false);
  const [kind, setKind] = useState<CustomerKind>(() => getDefaultCustomerKind());
  const [code, setCode] = useState('');
  const [identityNo, setIdentityNo] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [taxOffice, setTaxOffice] = useState<string | null>(() => getDefaultTaxOffice());
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('5');
  const [email, setEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [createUser, setCreateUser] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => emailSuggestions(email), [email]);
  const idMax = kind === 'yabanci' ? 20 : 11;
  const taxMax = 10;
  const nameLabel = kind === 'tuzel' ? 'Ünvan *' : 'Ad Soyad *';

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const parts = el.querySelectorAll('[data-anim]');
    gsap.fromTo(
      parts,
      { autoAlpha: 0, y: 12 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.38,
        stagger: 0.04,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, []);

  useEffect(() => {
    setIdentityNo('');
    setTaxNo('');
    setTaxOffice('');
    setErrors({});
  }, [kind]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!emailWrap.current?.contains(t)) setEmailOpen(false);
      if (!infoRef.current?.contains(t)) setInfoOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) {
      next.title = kind === 'tuzel' ? 'Ünvan gerekli' : 'Ad soyad gerekli';
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) next.phone = 'Geçerli telefon girin';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Geçerli e-posta girin';
    }
    if (kind === 'gercek' && identityNo && identityNo.length !== 11) {
      next.identityNo = 'TC 11 hane olmalı';
    }
    if (kind === 'tuzel' && taxNo && taxNo.length !== 10) {
      next.taxNo = 'Vergi no 10 hane olmalı';
    }
    if (createUser && (!email.trim() || next.email)) {
      next.email = 'Kullanıcı göndermek için e-posta gerekli';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function doSave() {
    setSaving(true);

    const customer: Customer = {
      id: `c-${Date.now()}`,
      code: code.trim() || `MK-${Date.now().toString().slice(-6)}`,
      title: title.trim().toLocaleUpperCase('tr'),
      phone: phone.replace(/\D/g, '').slice(0, 10),
      email: email.trim().toLocaleLowerCase('tr'),
      taxNo: kind === 'tuzel' ? taxNo.trim() : identityNo.trim() || taxNo.trim(),
      taxOffice: kind === 'tuzel' ? taxOffice ?? '' : '',
      kind,
      accountType: accountType.trim(),
      parentId,
      address: address.trim(),
      identityNo: kind === 'tuzel' ? '' : identityNo.trim(),
    };

    addLiveCustomer(customer);
    if (createUser) {
      console.info('[mock] giriş bilgileri gönderilecek →', customer.email);
    }
    window.setTimeout(() => {
      setSaving(false);
      navigate('/musteriler', {
        replace: true,
        state: {
          flash: createUser
            ? `Müşteri kaydedildi · giriş bilgileri ${customer.email} adresine gönderilecek`
            : 'Müşteri kaydedildi',
        },
      });
    }, 380);
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
    doSave();
  }

  function confirmAddAccountAndSave() {
    const next = addAccountType(accountType);
    setAccountTypes(next);
    setAccountPrompt(false);
    doSave();
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
                label="Cari Tipi *"
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
                placeholder="Seçiniz."
                required
                kmJump
              />
            </div>

            {kind === 'tuzel' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    data-km-jump
                    label="Müşteri Kodu"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <TextInput
                    data-km-jump
                    label="Vergi Numarası"
                    value={taxNo}
                    error={errors.taxNo}
                    onChange={(e) => setTaxNo(e.target.value.replace(/\D/g, '').slice(0, taxMax))}
                    inputMode="numeric"
                    endAdornment={<CharCount current={taxNo.length} max={taxMax} />}
                    className="pr-16 font-mono tabular-nums"
                  />
                </div>
                <FloatingSearchSelect
                  label="Vergi Dairesi"
                  options={TAX_OFFICE_OPTIONS}
                  value={taxOffice}
                  onChange={setTaxOffice}
                  kmJump
                />
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  data-km-jump
                  label="Müşteri Kodu"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <TextInput
                  data-km-jump
                  label={kind === 'yabanci' ? 'Pasaport No' : 'TC Kimlik No'}
                  value={identityNo}
                  error={errors.identityNo}
                  onChange={(e) =>
                    setIdentityNo(
                      kind === 'yabanci'
                        ? e.target.value.toUpperCase().slice(0, idMax)
                        : e.target.value.replace(/\D/g, '').slice(0, idMax),
                    )
                  }
                  inputMode={kind === 'yabanci' ? 'text' : 'numeric'}
                  endAdornment={<CharCount current={identityNo.length} max={idMax} />}
                  className="pr-16 font-mono tabular-nums"
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
                required
                endAdornment={<CharCount current={phone.replace(/\D/g, '').length} max={10} />}
                className="pr-16 font-mono tabular-nums"
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
                  required
                  autoComplete="off"
                />
                {emailOpen && suggestions.length > 0 ? (
                  <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
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

            <div className="relative">
              <textarea
                data-km-jump
                id="customer-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder=" "
                rows={4}
                className="peer w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 pb-2.5 pt-5 text-sm text-[var(--panel-ink)] outline-none transition-colors focus:border-[var(--input-border-focus)]"
              />
              <label
                htmlFor="customer-address"
                className={[
                  'input-label-gap pointer-events-none absolute left-3 top-4 z-10 origin-left',
                  'px-1.5 text-sm text-[var(--panel-muted)] transition-all duration-200',
                  'peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-[var(--input-label)]',
                  'peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium',
                ].join(' ')}
              >
                Adres
              </label>
            </div>
          </div>

          {/* Kart altı aksiyonlar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/60 px-5 py-4 sm:px-6">
            <div
              ref={infoRef}
              className="relative inline-flex items-center gap-2.5"
            >
              <button
                type="button"
                role="switch"
                aria-checked={createUser}
                data-km-jump
                onClick={() => setCreateUser((v) => !v)}
                className={[
                  'relative h-6 w-11 shrink-0 rounded-full transition',
                  createUser ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                    createUser ? 'translate-x-5' : '',
                  ].join(' ')}
                />
              </button>
              <span className="text-sm font-medium text-[var(--panel-ink)]">
                Kullanıcı oluştur ve gönder
              </span>
              <button
                type="button"
                aria-label="Açıklama"
                onClick={() => setInfoOpen((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--panel-line)] text-[10px] font-bold text-[var(--panel-muted)] transition hover:border-[var(--color-brand-600)] hover:text-[var(--color-brand-600)]"
              >
                i
              </button>
              {infoOpen ? (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-64 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 text-xs leading-relaxed text-[var(--panel-muted)] shadow-[var(--panel-shadow)]">
                  Aktifken bu e-posta adresine panel giriş bilgileri (kullanıcı adı ve geçici şifre)
                  gönderilir.
                  {createUser && email.trim() ? (
                    <p className="mt-2 font-medium text-[var(--color-brand-600)]">→ {email.trim()}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/musteriler"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
              >
                Vazgeç
              </Link>
              <button
                type="submit"
                data-km-jump
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-brand-500)] disabled:opacity-60"
              >
                <SaveIcon />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </section>
      </form>

      {accountPrompt ? (
        <AccountTypePromptModal
          name={accountType.trim()}
          onAddAndSave={confirmAddAccountAndSave}
          onFix={() => setAccountPrompt(false)}
        />
      ) : null}
    </div>
  );
}

function AccountTypePromptModal({
  name,
  onAddAndSave,
  onFix,
}: {
  name: string;
  onAddAndSave: () => void;
  onFix: () => void;
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
      if (e.key === 'Escape') {
        e.preventDefault();
        onFix();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onFix]);

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <button
          type="button"
          aria-label="Kapat"
          onClick={onFix}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
        >
          <span className="text-lg leading-none">×</span>
        </button>
        <h2 className="pr-8 text-lg font-bold text-[var(--panel-ink)]">Cari tipi bulunamadı</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">“{name}”</span> listede yok. Hızlı
          eklemek ister misiniz?
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            data-km-jump
            onClick={onAddAndSave}
            className="flex-1 rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-brand-500)]"
          >
            Ekle ve Kaydet
          </button>
          <button
            type="button"
            data-km-jump
            onClick={onFix}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
          >
            Hayır, düzelteceğim
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  const full = current >= max && max > 0;
  return (
    <span
      className={[
        'pointer-events-none select-none text-[11px] font-semibold tabular-nums',
        full ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--panel-muted)]',
      ].join(' ')}
      aria-hidden
    >
      {full ? 'Dolu' : `${current}/${max}`}
    </span>
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
