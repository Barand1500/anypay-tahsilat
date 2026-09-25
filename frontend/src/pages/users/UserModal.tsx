import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { OptionMultiSelect } from '../../components/ui/OptionMultiSelect';
import { TextInput } from '../../components/ui/TextInput';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import {
  emailSuggestions,
  formatPhoneLive,
  INSTALLMENT_OPTIONS,
  normalizePhoneInput,
  type AppUser,
  type UserStatus,
} from './mockUsers';

export type UserFocusField =
  | 'name'
  | 'email'
  | 'phone'
  | 'role'
  | 'branch'
  | 'status'
  | 'installments';

type Mode = { type: 'create' } | { type: 'edit'; user: AppUser };

type Props = {
  mode: Mode;
  roleOptions: { value: string; label: string }[];
  branchOptions?: { value: string; label: string }[];
  onClose: () => void;
  onSave: (u: Omit<AppUser, 'id'> & { id?: number; password?: string }) => Promise<void> | void;
  /** Çift tıklanan sütuna göre odak */
  focusField?: UserFocusField | null;
};

export function UserModal({
  mode,
  roleOptions,
  branchOptions,
  onClose,
  onSave,
  focusField = null,
}: Props) {
  const isEdit = mode.type === 'edit';
  const [name, setName] = useState(isEdit ? mode.user.name : '');
  const [email, setEmail] = useState(isEdit ? mode.user.email : '');
  const [phone, setPhone] = useState(isEdit ? mode.user.phone : '5');
  const [roleId, setRoleId] = useState(isEdit ? mode.user.roleId : '');
  const [branchIds, setBranchIds] = useState<string[]>(() => {
    if (!isEdit) return [];
    if (mode.user.branchIds?.length) return mode.user.branchIds.map(String);
    if (mode.user.branchId != null) return [String(mode.user.branchId)];
    return [];
  });
  const [status, setStatus] = useState<UserStatus>(isEdit ? mode.user.status : 'Aktif');
  const [installments, setInstallments] = useState<number[]>(
    isEdit ? [...mode.user.installments] : [],
  );
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [taksitOpen, setTaksitOpen] = useState(false);
  const [taksitPos, setTaksitPos] = useState({ top: 0, left: 0, width: 0, up: false });
  const [pulse, setPulse] = useState<UserFocusField | null>(focusField);

  const branchSelectOptions = useMemo(() => {
    if (branchOptions?.length) return branchOptions;
    return [];
  }, [branchOptions]);

  const panelRef = useRef<HTMLDivElement>(null);
  const emailWrap = useRef<HTMLDivElement>(null);
  const taksitBtnRef = useRef<HTMLButtonElement>(null);
  const taksitPanelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => emailSuggestions(email), [email]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power3.out' },
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
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!emailWrap.current?.contains(t)) setEmailOpen(false);
      if (taksitBtnRef.current?.contains(t) || taksitPanelRef.current?.contains(t)) return;
      setTaksitOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const field = focusField ?? 'name';
    setPulse(field);
    const t = window.setTimeout(() => {
      if (field === 'name') nameRef.current?.focus();
      else if (field === 'email') emailRef.current?.focus();
      else if (field === 'phone') phoneRef.current?.focus();
      else if (field === 'installments') {
        setTaksitOpen(true);
        placeTaksit();
      }
    }, 280);
    const clear = window.setTimeout(() => setPulse(null), 1600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [focusField]);

  function placeTaksit() {
    const btn = taksitBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Modal altında kaldığı için her zaman yukarı aç
    setTaksitPos({
      top: r.top - 6,
      left: r.left,
      width: r.width,
      up: true,
    });
  }

  useLayoutEffect(() => {
    if (!taksitOpen) return;
    placeTaksit();
  }, [taksitOpen]);

  useEffect(() => {
    if (!taksitOpen) return;
    function onMove() {
      placeTaksit();
    }
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [taksitOpen]);

  function toggleInst(n: number) {
    setInstallments((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= 12) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || phone.length !== 10 || !roleId) return;
    if (!isEdit && password.trim().length < 6) {
      setFormError('Yeni kullanıcı için şifre en az 6 karakter');
      return;
    }
    const role = roleOptions.find((r) => r.value === roleId);
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        id: isEdit ? mode.user.id : undefined,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone,
        roleId,
        roleName: role?.label || '',
        branchIds: branchIds.map(Number).filter((n) => Number.isFinite(n)),
        branchId: branchIds[0] != null ? Number(branchIds[0]) : null,
        branch: branchSelectOptions
          .filter((o) => branchIds.includes(o.value))
          .map((o) => o.label)
          .join(', '),
        status,
        installments,
        password: password.trim() || undefined,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  const phoneShown = formatPhoneLive(phone);

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 flex max-h-[min(92vh,740px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-brand-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))] px-3 py-2.5 text-xs leading-relaxed text-[var(--panel-ink)]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-[10px] font-bold text-white">
                i
              </span>
              İzinli taksitler girilmesi durumunda direkt olarak belirtilen taksitler kullanıcıda
              görünür.
            </div>

            <div className={pulse === 'name' ? 'field-focus-pulse rounded-xl' : ''}>
              <TextInput
                ref={nameRef}
                data-km-jump
                label="Ad Soyad *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div
              ref={emailWrap}
              className={['relative', pulse === 'email' ? 'field-focus-pulse rounded-xl' : ''].join(
                ' ',
              )}
            >
              <TextInput
                ref={emailRef}
                data-km-jump
                label="E-Posta *"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailOpen(true);
                }}
                onFocus={() => setEmailOpen(true)}
                required
                autoComplete="off"
              />
              {emailOpen && suggestions.length > 0 ? (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
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

            <div className={pulse === 'phone' ? 'field-focus-pulse rounded-xl' : ''}>
              <TextInput
                ref={phoneRef}
                data-km-jump
                label="Telefon *"
                inputMode="numeric"
                value={phoneShown}
                onChange={(e) => setPhone((p) => normalizePhoneInput(e.target.value, p))}
                onFocus={() => {
                  if (!phone) setPhone('5');
                }}
                required
                className="font-mono tabular-nums"
              />
            </div>

            <FloatingSearchSelect
              label="Rol *"
              placeholder="Rol seçiniz."
              options={roleOptions}
              value={roleId || null}
              onChange={(v) => setRoleId(v ?? '')}
              required
              kmJump
              pulse={pulse === 'role'}
            />

            <OptionMultiSelect
              label="Şube / Departman"
              placeholder="Şube / departman seçiniz."
              options={branchSelectOptions}
              value={branchIds}
              onChange={setBranchIds}
              kmJump
              pulse={pulse === 'branch'}
            />

            {!isEdit ? (
              <TextInput
                data-km-jump
                label="Şifre *"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            ) : (
              <TextInput
                data-km-jump
                label="Yeni şifre"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Değiştirmek için doldurun"
              />
            )}

            {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
            <div
              className={[
                'flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-surface)] px-3 py-3',
                pulse === 'status' ? 'field-focus-pulse' : '',
              ].join(' ')}
            >
              <span className="text-sm font-medium text-[var(--panel-ink)]">Durum *</span>
              <button
                type="button"
                data-km-jump
                aria-pressed={status === 'Aktif'}
                onClick={() => setStatus((s) => (s === 'Aktif' ? 'Pasif' : 'Aktif'))}
                className={[
                  'relative h-8 w-14 rounded-full transition',
                  status === 'Aktif' ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
                    status === 'Aktif' ? 'left-7' : 'left-1',
                  ].join(' ')}
                />
              </button>
            </div>

            <div>
              <button
                ref={taksitBtnRef}
                type="button"
                data-km-jump
                onClick={() => setTaksitOpen((v) => !v)}
                className={[
                  'relative flex w-full flex-col rounded-xl border bg-[var(--input-bg)] px-3.5 py-3 text-left transition',
                  taksitOpen || pulse === 'installments'
                    ? 'border-[var(--input-border-focus)]'
                    : 'border-[var(--input-border)]',
                  pulse === 'installments' ? 'field-focus-pulse' : '',
                ].join(' ')}
              >
                <span className="input-label-gap is-gapped absolute left-3 top-0 -translate-y-1/2 px-1.5 text-xs font-medium text-[var(--input-label)]">
                  İzin Verilen Taksitler
                </span>
                <span
                  className={[
                    'pt-1 text-sm',
                    installments.length ? 'text-[var(--panel-ink)]' : 'text-[var(--panel-muted)]',
                  ].join(' ')}
                >
                  {installments.length ? installments.join(', ') : 'Taksitleri seçiniz.'}
                </span>
              </button>

              {taksitOpen
                ? createPortal(
                    <div
                      ref={taksitPanelRef}
                      className="fixed z-[12000] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
                      style={
                        taksitPos.up
                          ? {
                              bottom: window.innerHeight - (taksitBtnRef.current?.getBoundingClientRect().top ?? 0) + 6,
                              left: taksitPos.left,
                              width: taksitPos.width,
                            }
                          : {
                              top: taksitPos.top,
                              left: taksitPos.left,
                              width: taksitPos.width,
                            }
                      }
                    >
                      <ul className="max-h-52 overflow-y-auto p-1">
                        {INSTALLMENT_OPTIONS.map((n) => {
                          const on = installments.includes(n);
                          return (
                            <li key={n}>
                              <button
                                type="button"
                                onClick={() => toggleInst(n)}
                                className={[
                                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                                  on
                                    ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_14%,transparent)] font-semibold text-[var(--color-brand-700)]'
                                    : 'text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
                                ].join(' ')}
                              >
                                {n}
                                {on ? <span className="text-xs">✓</span> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex gap-2 border-t border-[var(--panel-line)] p-2">
                        <button
                          type="button"
                          onClick={() => setInstallments([...INSTALLMENT_OPTIONS])}
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Tümünü Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallments([])}
                          className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                        >
                          Temizle
                        </button>
                      </div>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-5 py-3">
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
              disabled={saving}
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
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
