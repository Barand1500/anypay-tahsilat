import gsap from 'gsap';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';

type ProfileDraft = {
  adsoyad: string;
  email: string;
  telefon: string;
  sifre: string;
  twoFa: 'KAPALI' | 'ACIK';
};

type EditKey = 'adsoyad' | 'email' | 'telefon' | null;

/**
 * Profil — çift tıkla düzenle, soft animasyon.
 * Kayıt şimdilik lokal (API sonra).
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    adsoyad: user?.adsoyad || '',
    email: user?.email || '',
    telefon: '',
    sifre: '',
    twoFa: 'KAPALI',
  }));
  const [baseline, setBaseline] = useState(draft);
  const [editing, setEditing] = useState<EditKey>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const dirty =
    draft.adsoyad !== baseline.adsoyad ||
    draft.email !== baseline.email ||
    draft.telefon !== baseline.telefon ||
    draft.sifre !== '' ||
    draft.twoFa !== baseline.twoFa;

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

  function save() {
    setBaseline({ ...draft, sifre: '' });
    setDraft((d) => ({ ...d, sifre: '' }));
    setEditing(null);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
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
            <InlineField
              label="Telefon"
              value={draft.telefon || 'Eklenmedi'}
              empty={!draft.telefon}
              editing={editing === 'telefon'}
              onStartEdit={() => setEditing('telefon')}
              onChange={(v) => setDraft((d) => ({ ...d, telefon: v }))}
              onDone={() => setEditing(null)}
              displayClass="text-sm font-medium text-[var(--panel-ink)]"
              inputLabel="Telefon"
              type="tel"
              kmJump
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

        {/* Kaydet */}
        <div
          data-anim
          className={[
            'sticky bottom-4 transition duration-300',
            dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
          ].join(' ')}
        >
          <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]/95 p-3 shadow-[var(--panel-shadow)] backdrop-blur">
            <Button onClick={save} className="!w-full sm:!w-auto sm:min-w-[200px]">
              Değişikliği kaydet
            </Button>
          </div>
        </div>

        {savedFlash ? (
          <p className="mt-3 text-center text-sm font-medium text-emerald-600 animate-[fade_0.3s_ease]">
            Kaydedildi (şimdilik lokal)
          </p>
        ) : null}
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

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onDone();
    if (e.key === 'Escape') onDone();
  }

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        label={inputLabel}
        type={type}
        value={empty && value === 'Eklenmedi' ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDone}
        onKeyDown={onKey}
        {...(kmJump ? { 'data-km-jump': true } : {})}
      />
    );
  }

  return (
    <button
      type="button"
      {...(kmJump ? { 'data-km-jump': true } : {})}
      onDoubleClick={onStartEdit}
      onClick={(e) => {
        // Klavye modu / programmatic click (detail === 0)
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
