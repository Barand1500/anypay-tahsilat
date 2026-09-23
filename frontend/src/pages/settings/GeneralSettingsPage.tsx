import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { GrowingValueList } from '../../components/ui/GrowingValueList';
import { TextInput } from '../../components/ui/TextInput';
import { INITIAL_GENERAL_SETTINGS, type GeneralSettings } from './mockSettings';

gsap.registerPlugin(useGSAP);

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

/**
 * Ayarlar › Genel — sistem, marka, bildirim listeleri (mock kayıt).
 */
export default function GeneralSettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<GeneralSettings>(() => ({
    ...INITIAL_GENERAL_SETTINGS,
    notifyEmails: [...INITIAL_GENERAL_SETTINGS.notifyEmails],
    notifyPhones: [...INITIAL_GENERAL_SETTINGS.notifyPhones],
  }));
  const [baseline, setBaseline] = useState(draft);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [faviconName, setFaviconName] = useState<string | null>(null);
  const logoInputId = useId();
  const favInputId = useId();

  const dirty =
    draft.systemName !== baseline.systemName ||
    draft.systemUrl !== baseline.systemUrl ||
    draft.logoUrl !== baseline.logoUrl ||
    draft.faviconUrl !== baseline.faviconUrl ||
    draft.virtualPosTarget !== baseline.virtualPosTarget ||
    draft.appSignup !== baseline.appSignup ||
    draft.binListUrl !== baseline.binListUrl ||
    draft.notifyEmails.join('|') !== baseline.notifyEmails.join('|') ||
    draft.notifyPhones.join('|') !== baseline.notifyPhones.join('|');

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

  function patch<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoName(file.name);
    const url = URL.createObjectURL(file);
    patch('logoUrl', url);
  }

  function onFaviconChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconName(file.name);
    const url = URL.createObjectURL(file);
    patch('faviconUrl', url);
  }

  function save() {
    setBaseline({
      ...draft,
      notifyEmails: [...draft.notifyEmails],
      notifyPhones: [...draft.notifyPhones],
    });
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 1800);
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Ayarlar</h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Ayarlarınızı buradan güncelleyebilirsiniz
        </p>
      </div>

      <form
        data-anim
        className="[--input-notch:var(--panel-elevated)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
          {/* Sol — form */}
          <div className="space-y-6 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <TextInput
                data-km-jump
                label="Sistem Adı *"
                value={draft.systemName}
                onChange={(e) => patch('systemName', e.target.value)}
                required
              />
              <TextInput
                data-km-jump
                label="Sistem Adresi *"
                value={draft.systemUrl}
                onChange={(e) => patch('systemUrl', e.target.value)}
                required
              />
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <ToggleCard
                label="Sanal POS Hedef Kullanımı"
                checked={draft.virtualPosTarget}
                onChange={(v) => patch('virtualPosTarget', v)}
              />
              <ToggleCard
                label="Uygulamadan Kayıt Ol"
                checked={draft.appSignup}
                onChange={(v) => patch('appSignup', v)}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <GrowingValueList
                label="Bildirim E-Posta Adresleri"
                kind="email"
                values={draft.notifyEmails}
                onChange={(next) => patch('notifyEmails', next)}
                placeholder="ornek@firma.com · Enter"
                validate={(v) => (isEmail(v) ? null : 'Geçerli bir e-posta girin')}
                hint="Yazarken domain önerileri çıkar; Enter veya virgül ile eklenir."
                leadingIcon={<MailIcon />}
              />
              <GrowingValueList
                label="Bildirim Sms Numaraları"
                kind="phone"
                values={draft.notifyPhones}
                onChange={(next) => patch('notifyPhones', next)}
                placeholder="5XX XXX XX XX · Enter"
                validate={(v) => (isPhone(v) ? null : 'En az 10 haneli numara girin')}
                hint="Yazarken 5XX XXX XX XX formatına döner; chip’ten silebilirsiniz."
                leadingIcon={<PhoneIcon />}
              />
            </section>

            <section className="space-y-2">
              <TextInput
                data-km-jump
                label="Bin Listesi Linki"
                value={draft.binListUrl}
                onChange={(e) => patch('binListUrl', e.target.value)}
              />
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-xs leading-relaxed text-[var(--panel-ink)]">
                Dikkat: Bu alana yalnızca firmamızca geliştirilmiş yazılımların linklerini giriniz.
                Aksi durumda sistemde hatalar oluşabilir.
              </p>
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
          </div>

          {/* Sağ — logo / favicon (sol form ile eşit yükseklik) */}
          <aside className="flex h-full min-h-0 flex-col gap-5">
            <BrandAssetCard
              id={logoInputId}
              label="Logo"
              fileName={logoName}
              preview={draft.logoUrl}
              wide
              onChange={onLogoChange}
            />
            <BrandAssetCard
              id={favInputId}
              label="Favicon"
              fileName={faviconName}
              preview={draft.faviconUrl}
              onChange={onFaviconChange}
            />
          </aside>
        </div>
      </form>
    </div>
  );
}

function BrandAssetCard({
  id,
  label,
  fileName,
  preview,
  wide = false,
  onChange,
}: {
  id: string;
  label: string;
  fileName: string | null;
  preview: string;
  wide?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3.5 shadow-[var(--panel-shadow)]">
      {/* Üst — dosya seç */}
      <div className="relative mb-3 shrink-0">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 pt-2">
          <label
            htmlFor={id}
            className="shrink-0 cursor-pointer rounded-md bg-[color-mix(in_srgb,var(--color-brand-500)_16%,var(--panel-elevated))] px-2 py-1 text-[11px] font-semibold text-[var(--panel-ink)] transition hover:bg-[color-mix(in_srgb,var(--color-brand-500)_26%,var(--panel-elevated))]"
          >
            Göz at…
          </label>
          <span className="truncate text-[11px] text-[var(--panel-muted)]">
            {fileName ?? 'Dosya seçilmedi'}
          </span>
          <input id={id} type="file" accept="image/*" className="sr-only" onChange={onChange} />
        </div>
        <span className="input-label-gap is-gapped pointer-events-none absolute left-2.5 top-0 z-10 -translate-y-1/2 px-1.5 text-xs font-medium text-[var(--panel-muted)]">
          {label}
        </span>
      </div>

      {/* Alt — önizleme (kartla birlikte uzar) */}
      <div
        className="relative flex min-h-[7rem] flex-1 items-center justify-center overflow-visible rounded-xl border border-dashed border-[var(--panel-line)] bg-[var(--panel-bg)]"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-brand-500)_12%,transparent),transparent_60%)]" />
        <img
          src={preview}
          alt=""
          aria-hidden
          className={[
            'relative z-[1] object-contain transition-opacity',
            wide ? 'h-12 max-w-[88%]' : 'h-12 w-12',
            hover ? 'opacity-30' : 'opacity-95',
          ].join(' ')}
        />

        <AnimatePresence>
          {hover ? (
            <motion.div
              key="preview-pop"
              className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
              initial={{ height: 0, opacity: 0, scale: 0.3 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.3 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
            >
              <img
                src={preview}
                alt={label}
                className={
                  wide ? 'h-36 w-auto max-w-[14rem] object-contain' : 'h-40 w-40 object-contain'
                }
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-km-jump
      onClick={() => onChange(!checked)}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition',
        checked
          ? 'border-[color-mix(in_srgb,var(--color-brand-500)_45%,var(--panel-line))] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)] hover:border-[var(--panel-muted)]/40',
      ].join(' ')}
    >
      <span className="text-sm font-semibold text-[var(--panel-ink)]">{label}</span>
      <span
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : '',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.5 4.5h-2A2 2 0 0 0 4.5 6.5v1a14 14 0 0 0 12 12h1a2 2 0 0 0 2-2v-2l-3.5-1-2 2a11 11 0 0 1-6-6l2-2-1-3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
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
