import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { notifyCardDesignChange } from '../../components/payments/PaymentCardFields';
import { useTheme } from '../../theme/ThemeProvider';
import {
  CARD_DESIGNS,
  DATE_STYLES,
  MONEY_STYLES,
  PANEL_FONTS,
  applyCardDesign,
  applyDateStyle,
  applyMoneyStyle,
  applyPanelFont,
  getStoredCardDesign,
  getStoredDateStyle,
  getStoredMoneyStyle,
  getStoredNightAuto,
  getStoredPanelFont,
  parseHm,
  saveCardDesign,
  saveDateStyle,
  saveMoneyStyle,
  saveNightAuto,
  savePanelFont,
  getStoredAnimationsEnabled,
  saveAnimationsEnabled,
  applyAnimationsEnabled,
  type CardDesignId,
  type DateStyleId,
  type MoneyStyleId,
  type NightAutoPrefs,
  type PanelFontId,
} from './personalPrefs';

gsap.registerPlugin(useGSAP);

type Draft = {
  fontId: PanelFontId;
  moneyStyle: MoneyStyleId;
  dateStyle: DateStyleId;
  cardDesign: CardDesignId;
  night: NightAutoPrefs;
  animations: boolean;
};

function loadDraft(): Draft {
  return {
    fontId: getStoredPanelFont(),
    moneyStyle: getStoredMoneyStyle(),
    dateStyle: getStoredDateStyle(),
    cardDesign: getStoredCardDesign(),
    night: getStoredNightAuto(),
    animations: getStoredAnimationsEnabled(),
  };
}

function nightEqual(a: NightAutoPrefs, b: NightAutoPrefs) {
  return a.enabled === b.enabled && a.from === b.from && a.to === b.to;
}

/**
 * Ayarlar › Kişisel Ayarlar — bu cihaza özel tercihler.
 */
export default function PersonalSettingsPage() {
  const { refreshNightAuto } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [baseline, setBaseline] = useState<Draft>(loadDraft);
  const [saveOk, setSaveOk] = useState(false);

  const dirty =
    draft.fontId !== baseline.fontId ||
    draft.moneyStyle !== baseline.moneyStyle ||
    draft.dateStyle !== baseline.dateStyle ||
    draft.cardDesign !== baseline.cardDesign ||
    draft.animations !== baseline.animations ||
    !nightEqual(draft.night, baseline.night);

  useGSAP(
    () => {
      const parts = rootRef.current?.querySelectorAll('[data-anim]');
      if (!parts?.length) return;
      gsap.fromTo(
        parts,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power3.out' },
      );
    },
    { scope: rootRef },
  );

  function save(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    if (draft.night.enabled) {
      if (!parseHm(draft.night.from) || !parseHm(draft.night.to)) return;
    }
    savePanelFont(draft.fontId);
    saveMoneyStyle(draft.moneyStyle);
    saveDateStyle(draft.dateStyle);
    saveCardDesign(draft.cardDesign);
    notifyCardDesignChange();
    saveAnimationsEnabled(draft.animations);
    saveNightAuto(draft.night);
    refreshNightAuto();
    setBaseline({ ...draft, night: { ...draft.night } });
    setSaveOk(true);
    window.setTimeout(() => setSaveOk(false), 1600);
  }

  function pickFont(id: PanelFontId) {
    setDraft((d) => ({ ...d, fontId: id }));
    applyPanelFont(id);
  }

  function pickMoney(id: MoneyStyleId) {
    setDraft((d) => ({ ...d, moneyStyle: id }));
    applyMoneyStyle(id);
  }

  function pickDate(id: DateStyleId) {
    setDraft((d) => ({ ...d, dateStyle: id }));
    applyDateStyle(id);
  }

  function pickCard(id: CardDesignId) {
    setDraft((d) => ({ ...d, cardDesign: id }));
    applyCardDesign(id);
  }

  function revertPreview() {
    applyPanelFont(baseline.fontId);
    applyMoneyStyle(baseline.moneyStyle);
    applyDateStyle(baseline.dateStyle);
    applyCardDesign(baseline.cardDesign);
    applyAnimationsEnabled(baseline.animations);
    setDraft({ ...baseline, night: { ...baseline.night } });
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          Kişisel Ayarlar
        </h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Bu tarayıcıya özel tercihler. Diğer kullanıcıları etkilemez.
        </p>
      </div>

      <form
        data-anim
        onSubmit={save}
        className="space-y-8 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6"
      >
        {/* Font */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Yazı tipi</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Panel arayüzünün fontunu seçin. Tıklayınca önizleme açılır; kaydedene kadar kalıcı
              olmaz.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PANEL_FONTS.map((f) => {
              const selected = draft.fontId === f.id;
              return (
                <ChoiceCard
                  key={f.id}
                  selected={selected}
                  title={f.label}
                  onClick={() => pickFont(f.id)}
                >
                  <p
                    className="mt-3 text-[15px] leading-snug text-[var(--panel-ink)]"
                    style={{ fontFamily: f.family }}
                  >
                    {f.sample}
                  </p>
                </ChoiceCard>
              );
            })}
          </div>
        </section>

        {/* Para */}
        <section className="space-y-3 border-t border-[var(--panel-line)] pt-6">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Para birimi gösterimi</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Tutarların panelde nasıl yazılacağını seçin.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MONEY_STYLES.map((s) => (
              <ChoiceCard
                key={s.id}
                selected={draft.moneyStyle === s.id}
                title={s.label}
                onClick={() => pickMoney(s.id)}
              >
                <p className="mt-3 font-mono text-[15px] tabular-nums text-[var(--panel-ink)]">
                  {s.sample}
                </p>
              </ChoiceCard>
            ))}
          </div>
        </section>

        {/* Tarih */}
        <section className="space-y-3 border-t border-[var(--panel-line)] pt-6">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Tarih formatı</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Listeler ve raporlarda görünen tarih düzeni.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DATE_STYLES.map((s) => (
              <ChoiceCard
                key={s.id}
                selected={draft.dateStyle === s.id}
                title={s.label}
                onClick={() => pickDate(s.id)}
              >
                <p className="mt-3 font-mono text-[15px] tabular-nums text-[var(--panel-ink)]">
                  {s.sample}
                </p>
              </ChoiceCard>
            ))}
          </div>
        </section>

        {/* Kart tasarımı */}
        <section className="space-y-3 border-t border-[var(--panel-line)] pt-6">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Kart tasarımı</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Ödeme Al, Hızlı Ödeme ve ortak ödeme linkinde kart girişinin görünümü.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CARD_DESIGNS.map((s) => (
              <ChoiceCard
                key={s.id}
                selected={draft.cardDesign === s.id}
                title={s.label}
                onClick={() => pickCard(s.id)}
              >
                <p className="mt-3 text-xs leading-relaxed text-[var(--panel-muted)]">{s.hint}</p>
                {s.id === 'animated' ? (
                  <div className="mt-3 h-16 overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-2 shadow-inner">
                    <div className="flex h-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2">
                      <span className="font-mono text-[10px] tracking-widest text-white/80">
                        •••• 4242
                      </span>
                      <span className="text-[9px] font-bold uppercase text-white/50">3D</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    <div className="h-2 rounded bg-[var(--panel-line)]" />
                    <div className="h-2 w-2/3 rounded bg-[var(--panel-line)]" />
                    <div className="flex gap-1.5">
                      <div className="h-2 flex-1 rounded bg-[var(--panel-line)]" />
                      <div className="h-2 w-12 rounded bg-[var(--panel-line)]" />
                    </div>
                  </div>
                )}
              </ChoiceCard>
            ))}
          </div>
        </section>

        {/* Animasyon */}
        <section className="space-y-3 border-t border-[var(--panel-line)] pt-6">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Animasyon ayarı</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Kapalıyken mail / şifre gönderiminde drone görünmez; yalnızca toast mesajı çıkar.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={draft.animations}
              data-km-jump
              onClick={() => {
                setDraft((d) => {
                  const next = !d.animations;
                  applyAnimationsEnabled(next);
                  return { ...d, animations: next };
                });
              }}
              className={[
                'relative h-6 w-11 shrink-0 rounded-full transition',
                draft.animations ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                  draft.animations ? 'translate-x-5' : '',
                ].join(' ')}
              />
            </button>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--panel-ink)]">
                {draft.animations ? 'Animasyonlar açık' : 'Animasyonlar kapalı'}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--panel-muted)]">
                {draft.animations
                  ? 'Kurye / drone uçuşu gösterilir'
                  : 'Sadece toast — hızlı ve sade'}
              </span>
            </span>
          </label>
        </section>

        {/* Gece otomatik */}
        <section className="space-y-3 border-t border-[var(--panel-line)] pt-6">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Gece otomatik tema</h2>
            <p className="mt-0.5 text-xs text-[var(--panel-muted)]">
              Belirlediğiniz saat aralığında paneli karanlık temaya alır. Gece yarısını aşan
              pencereler desteklenir (ör. 20:00 → 07:00).
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-bg)] px-4 py-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={draft.night.enabled}
              data-km-jump
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  night: { ...d.night, enabled: !d.night.enabled },
                }))
              }
              className={[
                'relative h-6 w-11 shrink-0 rounded-full transition',
                draft.night.enabled ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                  draft.night.enabled ? 'translate-x-5' : '',
                ].join(' ')}
              />
            </button>
            <span className="text-sm font-semibold text-[var(--panel-ink)]">
              Gece penceresinde otomatik koyu tema
            </span>
          </label>

          <div
            className={[
              'grid gap-3 sm:grid-cols-2',
              draft.night.enabled ? '' : 'pointer-events-none opacity-45',
            ].join(' ')}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--panel-muted)]">Başlangıç</span>
              <input
                type="time"
                data-km-jump
                value={draft.night.from}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    night: { ...d.night, from: e.target.value || '20:00' },
                  }))
                }
                className="h-11 rounded-xl border border-[var(--panel-line)] bg-[var(--input-bg)] px-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--input-border-focus)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--panel-muted)]">Bitiş</span>
              <input
                type="time"
                data-km-jump
                value={draft.night.to}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    night: { ...d.night, to: e.target.value || '07:00' },
                  }))
                }
                className="h-11 rounded-xl border border-[var(--panel-line)] bg-[var(--input-bg)] px-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--input-border-focus)]"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--panel-line)] pt-4">
          <div className="min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]">
            <Button type="submit" disabled={!dirty && !saveOk} success={saveOk}>
              <span className="inline-flex items-center gap-2">
                <SaveIcon />
                Değişiklikleri Kaydet
              </span>
            </Button>
          </div>
          {dirty ? (
            <button
              type="button"
              data-km-jump
              onClick={revertPreview}
              className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              Vazgeç
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function ChoiceCard({
  selected,
  title,
  onClick,
  children,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-km-jump
      onClick={onClick}
      className={[
        'rounded-2xl border px-4 py-4 text-left transition',
        selected
          ? 'border-[var(--color-brand-500)] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--color-brand-500)_35%,transparent)]'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)] hover:border-[var(--color-brand-500)]/40 hover:bg-[var(--panel-hover)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-[var(--panel-ink)]">{title}</span>
        <span
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition',
            selected
              ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white'
              : 'border-[var(--panel-line)] bg-[var(--panel-elevated)]',
          ].join(' ')}
          aria-hidden
        >
          {selected ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 9.5 17 19 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
      </div>
      {children}
    </button>
  );
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
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
