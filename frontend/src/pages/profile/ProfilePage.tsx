import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { emailSuggestions } from '../../lib/emailSuggestions';
import {
  formatPhoneLive,
  normalizePhoneInput,
} from '../customers/mockCustomers';
import {
  getLoginTheme,
  setLoginTheme,
  getLoginBrandWords,
  setLoginBrandWords,
  type LoginTheme,
  type LoginBrandWords,
} from '../login/loginTheme';

type ProfileDraft = {
  adsoyad: string;
  email: string;
  telefon: string; // sadece rakam, max 10
  sifre: string;
  twoFa: 'KAPALI' | 'ACIK';
};

type EditKey = 'adsoyad' | 'email' | 'telefon' | null;

function draftFromUser(user: {
  adsoyad: string | null;
  email: string;
  telefon: string;
  twoFactor: boolean;
} | null): ProfileDraft {
  return {
    adsoyad: user?.adsoyad || '',
    email: user?.email || '',
    telefon: user?.telefon || '',
    sifre: '',
    twoFa: user?.twoFactor ? 'ACIK' : 'KAPALI',
  };
}

/**
 * Profil — çift tıkla düzenle; kayıt API + DB.
 */
export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromUser(user));
  const [baseline, setBaseline] = useState(() => draftFromUser(user));
  const [editing, setEditing] = useState<EditKey>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [loginTheme, setLoginThemeDraft] = useState<LoginTheme>(() => getLoginTheme());
  const [loginThemeBase, setLoginThemeBase] = useState<LoginTheme>(() => getLoginTheme());
  const [brandWords, setBrandWordsDraft] = useState<LoginBrandWords>(() => getLoginBrandWords());
  const [brandWordsBase, setBrandWordsBase] = useState<LoginBrandWords>(() => getLoginBrandWords());

  // /me veya login sonrası user gelince formu doldur
  useEffect(() => {
    if (!user) return;
    const next = draftFromUser(user);
    setDraft((d) => ({ ...next, sifre: d.sifre }));
    setBaseline(next);
  }, [user]);

  const dirty =
    draft.adsoyad !== baseline.adsoyad ||
    draft.email !== baseline.email ||
    draft.telefon !== baseline.telefon ||
    draft.sifre !== '' ||
    draft.twoFa !== baseline.twoFa ||
    loginTheme !== loginThemeBase ||
    brandWords.word1 !== brandWordsBase.word1 ||
    brandWords.word2 !== brandWordsBase.word2;

  const showSaveBar = dirty || saveSuccess || !!saveError;

  const initials = (draft.adsoyad || draft.email || 'U')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const role =
    user?.roles?.includes('ROLE_SUPERAPP') || user?.roles?.includes('ROLE_ADMIN')
      ? 'Yönetici'
      : user?.roles?.includes('ROLE_YONETICI')
        ? 'Yönetici'
        : 'Kullanıcı';

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const parts = el.querySelectorAll('[data-anim]');
    gsap.fromTo(
      parts,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out' },
    );
  }, []);

  async function save() {
    setSaveError(null);

    if (draft.telefon && (draft.telefon.length !== 10 || !draft.telefon.startsWith('5'))) {
      setSaveError('Telefon 5 ile başlayan 10 haneli olmalıdır');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        adsoyad: draft.adsoyad.trim(),
        email: draft.email.trim(),
        telefon: draft.telefon,
        password: draft.sifre || undefined,
        twoFactor: draft.twoFa === 'ACIK',
      });

      const next = draftFromUser(updated);
      setBaseline(next);
      setDraft({ ...next, sifre: '' });
      setEditing(null);

      setLoginTheme(loginTheme);
      setLoginThemeBase(loginTheme);
      setLoginBrandWords(brandWords);
      setBrandWordsBase({ ...brandWords });

      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-2xl pb-10">
      {/* Cover */}
      <div
        data-anim
        className="relative mb-[-64px] h-36 overflow-hidden rounded-3xl sm:h-44"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-brand-500) 55%, #1a2740), color-mix(in srgb, var(--color-brand-600) 40%, transparent) 55%, var(--panel-surface))',
        }}
      >
        <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white, transparent 50%)' }} />
      </div>

      <div data-anim className="relative px-4 sm:px-6">
        {/* Avatar */}
        <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <button
            type="button"
            title="Fotoğraf yükle (yakında)"
            className="group relative -mt-2 flex h-28 w-28 items-center justify-center rounded-full border-4 border-[var(--panel-bg)] bg-brand-100 text-3xl font-bold text-brand-700 shadow-[var(--panel-shadow)] transition hover:scale-[1.03] sm:h-32 sm:w-32"
          >
            {initials}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              Fotoğraf
            </span>
            <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-white shadow-md">
              <CameraIcon />
            </span>
          </button>

          <div className="flex flex-wrap gap-2 pb-1">
            <span className="rounded-full border border-[color-mix(in_srgb,var(--color-brand-500)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-500)_22%,var(--panel-elevated))] px-3 py-1 text-xs font-semibold text-[var(--panel-ink)]">
              {role}
            </span>
            <span className="rounded-full border border-emerald-500/35 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
              Çevrimiçi
            </span>
          </div>
        </div>

        {/* İsim — çift tık */}
        <div className="mb-1">
          <InlineField
            label="Ad Soyad"
            value={draft.adsoyad}
            editing={editing === 'adsoyad'}
            onStartEdit={() => setEditing('adsoyad')}
            onChange={(v) => setDraft((d) => ({ ...d, adsoyad: v }))}
            onDone={() => setEditing(null)}
            displayClass="text-2xl font-bold tracking-tight text-[var(--panel-ink)] sm:text-3xl"
            inputLabel="Ad Soyad"
            kmJump
          />
        </div>
        <p className="mb-6 text-sm text-[var(--panel-muted)]">Çift tıkla düzenle</p>

        {/* Bio satırları */}
        <div
          data-anim
          className="mb-6 space-y-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-5"
        >
          <Row label="E-posta">
            <InlineField
              label="E-posta"
              value={draft.email}
              editing={editing === 'email'}
              onStartEdit={() => setEditing('email')}
              onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
              onDone={() => setEditing(null)}
              displayClass="text-sm font-medium text-[var(--panel-ink)]"
              inputLabel="E-posta"
              type="email"
              kmJump
            />
          </Row>
          <div className="h-px bg-[var(--panel-line)]" />
          <Row label="Telefon">
            <PhoneInlineField
              digits={draft.telefon}
              editing={editing === 'telefon'}
              onStartEdit={() => setEditing('telefon')}
              onChange={(digits) => setDraft((d) => ({ ...d, telefon: digits }))}
              onDone={() => setEditing(null)}
            />
          </Row>
        </div>

        {/* Güvenlik */}
        <div
          data-anim
          className="mb-6 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-5"
        >
          <h2 className="mb-4 text-sm font-semibold text-[var(--panel-ink)]">Güvenlik</h2>
          <div className="space-y-4">
            <TextInput
              label="Yeni şifre"
              type={showPass ? 'text' : 'password'}
              value={draft.sifre}
              onChange={(e) => setDraft((d) => ({ ...d, sifre: e.target.value }))}
              autoComplete="new-password"
              data-km-jump
              endAdornment={
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? 'Gizle' : 'Göster'}
                </button>
              }
            />
            <p className="text-xs text-[var(--panel-muted)]">Değiştirmek istemiyorsanız boş bırakın.</p>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-surface)] px-3 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--panel-ink)]">2 aşamalı doğrulama</p>
                <p className="text-xs text-[var(--panel-muted)]">Ek güvenlik katmanı</p>
              </div>
              <button
                type="button"
                data-km-jump
                onClick={() =>
                  setDraft((d) => ({ ...d, twoFa: d.twoFa === 'ACIK' ? 'KAPALI' : 'ACIK' }))
                }
                className={[
                  'relative h-8 w-14 rounded-full transition',
                  draft.twoFa === 'ACIK' ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
                ].join(' ')}
                aria-pressed={draft.twoFa === 'ACIK'}
              >
                <span
                  className={[
                    'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
                    draft.twoFa === 'ACIK' ? 'left-7' : 'left-1',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Giriş teması — sonra Ayarlar’a taşınacak */}
        <div
          data-anim
          className="mb-6 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-5"
        >
          <h2 className="mb-1 text-sm font-semibold text-[var(--panel-ink)]">Giriş ekranı teması</h2>
          <p className="mb-4 text-xs text-[var(--panel-muted)]">
            Çıkış sonrası giriş sayfasında görünür. Şimdilik bu cihazda saklanır.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'classic' as const, title: 'Klasik', hint: 'Maskotlu açık tema' },
                { id: 'globe' as const, title: 'Dünya', hint: 'Canlı 3D küre' },
              ] as const
            ).map((opt) => {
              const active = loginTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-km-jump
                  onClick={() => setLoginThemeDraft(opt.id)}
                  className={[
                    'rounded-xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_14%,var(--panel-elevated))]'
                      : 'border-[var(--panel-line)] bg-[var(--panel-surface)] hover:border-[var(--color-brand-500)]/40',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-[var(--panel-ink)]">{opt.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{opt.hint}</p>
                </button>
              );
            })}
          </div>

          {loginTheme === 'globe' ? (
            <div className="mt-4 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-3 sm:p-4">
              <p className="mb-1 text-sm font-semibold text-[var(--panel-ink)]">Yan şerit yazısı</p>
              <p className="mb-3 text-xs text-[var(--panel-muted)]">
                Girişte solda kayan iki kelime. Kaydet’e basınca uygulanır.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="1. kelime"
                  name="brand-word-1"
                  value={brandWords.word1}
                  maxLength={16}
                  data-km-jump
                  onChange={(e) =>
                    setBrandWordsDraft((prev) => ({ ...prev, word1: e.target.value.slice(0, 16) }))
                  }
                />
                <TextInput
                  label="2. kelime"
                  name="brand-word-2"
                  value={brandWords.word2}
                  maxLength={16}
                  data-km-jump
                  onChange={(e) =>
                    setBrandWordsDraft((prev) => ({ ...prev, word2: e.target.value.slice(0, 16) }))
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Kaydet */}
        <div
          data-anim
          className={[
            'sticky bottom-4 transition duration-300',
            showSaveBar ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
          ].join(' ')}
        >
          <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]/95 p-3 shadow-[var(--panel-shadow)] backdrop-blur">
            {saveError ? (
              <p className="mb-2 text-sm text-red-500">{saveError}</p>
            ) : null}
            <Button
              onClick={() => void save()}
              disabled={saving || (!dirty && !saveSuccess)}
              success={saveSuccess}
              successLabel="Kaydedildi"
              className="!w-full sm:!w-auto sm:min-w-[200px]"
            >
              {saving ? 'Kaydediliyor…' : 'Değişikliği kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Telefon: 0 yok, 5 ile başlar, canlı 5XX XXX XX XX */
function PhoneInlineField({
  digits,
  editing,
  onStartEdit,
  onChange,
  onDone,
}: {
  digits: string;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (digits: string) => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const empty = !digits;

  useEffect(() => {
    if (editing) {
      if (!digits) onChange('5');
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sadece edit açılışında
  }, [editing]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Escape') onDone();
  }

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        label="Telefon"
        type="tel"
        inputMode="numeric"
        value={formatPhoneLive(digits)}
        onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
        onFocus={() => {
          if (!digits) onChange('5');
        }}
        onBlur={() => {
          // sadece "5" kaldıysa boş kabul et
          if (digits === '5') onChange('');
          onDone();
        }}
        onKeyDown={onKey}
        className="font-mono tabular-nums"
        data-km-jump
      />
    );
  }

  return (
    <button
      type="button"
      data-km-jump
      onDoubleClick={onStartEdit}
      onClick={(e) => {
        if (e.detail === 0) onStartEdit();
      }}
      title="Düzenlemek için çift tıkla"
      className={[
        'w-full rounded-lg text-left font-mono tabular-nums text-sm font-medium transition hover:bg-[var(--panel-hover)]/60',
        empty ? 'italic text-[var(--panel-muted)]' : 'text-[var(--panel-ink)]',
      ].join(' ')}
    >
      {empty ? 'Eklenmedi' : formatPhoneLive(digits)}
    </button>
  );
}

function InlineField({
  value,
  empty,
  editing,
  onStartEdit,
  onChange,
  onDone,
  displayClass,
  inputLabel,
  type = 'text',
  kmJump,
}: {
  label: string;
  value: string;
  empty?: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onDone: () => void;
  displayClass: string;
  inputLabel: string;
  type?: string;
  kmJump?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const suggestions = useMemo(
    () => (type === 'email' ? emailSuggestions(empty && value === 'Eklenmedi' ? '' : value) : []),
    [type, value, empty],
  );

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (type === 'email') setEmailOpen(true);
    } else {
      setEmailOpen(false);
    }
  }, [editing, type]);

  useEffect(() => {
    if (!editing || type !== 'email') return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setEmailOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editing, type]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onDone();
    if (e.key === 'Escape') onDone();
  }

  if (editing) {
    const shown = empty && value === 'Eklenmedi' ? '' : value;
    return (
      <div ref={wrapRef} className="relative">
        <TextInput
          ref={inputRef}
          label={inputLabel}
          type={type}
          value={shown}
          onChange={(e) => {
            onChange(e.target.value);
            if (type === 'email') setEmailOpen(true);
          }}
          onFocus={() => {
            if (type === 'email') setEmailOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!wrapRef.current?.contains(document.activeElement)) onDone();
            }, 120);
          }}
          onKeyDown={onKey}
          autoComplete={type === 'email' ? 'off' : undefined}
          {...(kmJump ? { 'data-km-jump': true } : {})}
        />
        {type === 'email' && emailOpen && suggestions.length > 0 ? (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s);
                    setEmailOpen(false);
                    onDone();
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      {...(kmJump ? { 'data-km-jump': true } : {})}
      onDoubleClick={onStartEdit}
      onClick={(e) => {
        if (e.detail === 0) onStartEdit();
      }}
      title="Düzenlemek için çift tıkla"
      className={[
        'w-full rounded-lg text-left transition hover:bg-[var(--panel-hover)]/60',
        empty ? 'text-[var(--panel-muted)] italic' : '',
        displayClass,
      ].join(' ')}
    >
      {value || '—'}
    </button>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l2-2h6l2 2h3v11H4V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
