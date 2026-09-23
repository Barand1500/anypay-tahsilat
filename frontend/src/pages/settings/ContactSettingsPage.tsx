import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextArea } from '../../components/ui/TextArea';
import { TextInput } from '../../components/ui/TextInput';
import { emailSuggestions } from '../../lib/emailSuggestions';
import {
  CONTACT_KIND_OPTIONS,
  CONTACT_TAX_OFFICE_OPTIONS,
  formatContactPhone,
  INITIAL_CONTACT_SETTINGS,
  normalizeContactPhone,
  type ContactEntityKind,
  type ContactSettings,
} from './mockSettings';

gsap.registerPlugin(useGSAP);

/**
 * Ayarlar › İletişim Bilgileri — tip’e göre alanlar (müşteri formu gibi).
 */
export default function ContactSettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const kindFieldsRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ContactSettings>(() => ({ ...INITIAL_CONTACT_SETTINGS }));
  const [baseline, setBaseline] = useState(draft);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const dirty =
    draft.title !== baseline.title ||
    draft.kind !== baseline.kind ||
    draft.taxNo !== baseline.taxNo ||
    draft.taxOffice !== baseline.taxOffice ||
    draft.identityNo !== baseline.identityNo ||
    draft.address !== baseline.address ||
    draft.email !== baseline.email ||
    draft.phone !== baseline.phone ||
    draft.gsm !== baseline.gsm ||
    draft.fax !== baseline.fax;

  const suggestions = useMemo(() => emailSuggestions(draft.email), [draft.email]);
  const idMax = draft.kind === 'yabanci' ? 20 : 11;
  const taxMax = 10;
  const nameLabel = draft.kind === 'tuzel' ? 'Ünvan *' : 'Ad Soyad *';

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.06, ease: 'power3.out' },
      );
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      const el = kindFieldsRef.current;
      if (!el) return;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out' },
      );
    },
    { scope: kindFieldsRef, dependencies: [draft.kind] },
  );

  function patch<K extends keyof ContactSettings>(key: K, value: ContactSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setKind(next: ContactEntityKind) {
    setDraft((d) => ({
      ...d,
      kind: next,
      // Tip değişince kimlik alanlarını temizle — karışmasın
      taxNo: next === 'tuzel' ? d.taxNo : '',
      taxOffice: next === 'tuzel' ? d.taxOffice : '',
      identityNo: next === 'tuzel' ? '' : d.identityNo,
    }));
  }

  function save() {
    setBaseline({ ...draft });
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 1800);
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          İletişim Bilgileri
        </h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          İletişim bilgilerinizi buradan güncelleyebilirsiniz.
        </p>
      </div>

      <form
        data-anim
        className="space-y-5 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        <TextInput
          data-km-jump
          label={nameLabel}
          value={draft.title}
          onChange={(e) => patch('title', e.target.value)}
          required
        />

        <div ref={kindFieldsRef}>
          {draft.kind === 'tuzel' ? (
            <section className="grid gap-4 md:grid-cols-3">
              <FloatingSearchSelect
                label="Tip *"
                options={CONTACT_KIND_OPTIONS}
                value={draft.kind}
                onChange={(v) => {
                  if (v) setKind(v as ContactEntityKind);
                }}
                required
                kmJump
              />
              <TextInput
                data-km-jump
                label="Vergi Numarası"
                inputMode="numeric"
                value={draft.taxNo}
                onChange={(e) => patch('taxNo', e.target.value.replace(/\D/g, '').slice(0, taxMax))}
                endAdornment={<CharCount current={draft.taxNo.length} max={taxMax} />}
                className="pr-16 font-mono tabular-nums"
              />
              <FloatingSearchSelect
                label="Vergi Dairesi"
                options={CONTACT_TAX_OFFICE_OPTIONS}
                value={draft.taxOffice}
                onChange={(v) => patch('taxOffice', v ?? '')}
                kmJump
              />
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-3">
              <FloatingSearchSelect
                label="Tip *"
                options={CONTACT_KIND_OPTIONS}
                value={draft.kind}
                onChange={(v) => {
                  if (v) setKind(v as ContactEntityKind);
                }}
                required
                kmJump
              />
              <div className="md:col-span-2">
                <TextInput
                  data-km-jump
                  label={draft.kind === 'yabanci' ? 'Pasaport No' : 'TC Kimlik No'}
                  value={draft.identityNo}
                  onChange={(e) =>
                    patch(
                      'identityNo',
                      draft.kind === 'yabanci'
                        ? e.target.value.toUpperCase().slice(0, idMax)
                        : e.target.value.replace(/\D/g, '').slice(0, idMax),
                    )
                  }
                  inputMode={draft.kind === 'yabanci' ? 'text' : 'numeric'}
                  endAdornment={<CharCount current={draft.identityNo.length} max={idMax} />}
                  className="pr-16 font-mono tabular-nums"
                />
              </div>
            </section>
          )}
        </div>

        <TextArea
          data-km-jump
          label="Adres *"
          rows={3}
          value={draft.address}
          onChange={(e) => patch('address', e.target.value)}
          required
          className="min-h-[5.5rem]"
        />

        <div className="relative">
          <TextInput
            data-km-jump
            label="E-Posta *"
            type="email"
            value={draft.email}
            onChange={(e) => {
              patch('email', e.target.value.toLowerCase());
              setEmailOpen(true);
            }}
            onFocus={() => setEmailOpen(true)}
            onBlur={() => window.setTimeout(() => setEmailOpen(false), 120)}
            autoComplete="off"
            required
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
                      patch('email', s);
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

        <section className="grid gap-4 md:grid-cols-3">
          <TextInput
            data-km-jump
            label="Telefon *"
            inputMode="numeric"
            value={formatContactPhone(draft.phone)}
            onChange={(e) => patch('phone', normalizeContactPhone(e.target.value))}
            required
            className="font-mono tabular-nums"
          />
          <TextInput
            data-km-jump
            label="Gsm"
            inputMode="numeric"
            value={formatContactPhone(draft.gsm)}
            onChange={(e) => patch('gsm', normalizeContactPhone(e.target.value))}
            className="font-mono tabular-nums"
          />
          <TextInput
            data-km-jump
            label="Fax"
            inputMode="numeric"
            value={formatContactPhone(draft.fax)}
            onChange={(e) => patch('fax', normalizeContactPhone(e.target.value))}
            className="font-mono tabular-nums"
          />
        </section>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="w-full max-w-xs sm:w-auto sm:min-w-[14rem]">
            <Button type="submit" disabled={!dirty && !saveSuccess} success={saveSuccess}>
              <span className="inline-flex items-center gap-2">
                <SaveIcon />
                Değişiklikleri Kaydet
              </span>
            </Button>
          </div>
          {dirty && !saveSuccess ? (
            <span className="text-xs font-medium text-[var(--panel-muted)]">
              Kaydedilmemiş değişiklikler var
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span className="pointer-events-none text-[10px] tabular-nums text-[var(--panel-muted)]">
      {current}/{max}
    </span>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5a2 2 0 0 1 2-2h9l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 4.5v5h7v-5M8 19v-5h8v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
