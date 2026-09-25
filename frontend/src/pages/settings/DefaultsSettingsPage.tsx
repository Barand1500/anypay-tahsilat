import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { api } from '../../lib/api';
import { useTheme } from '../../theme/ThemeProvider';
import type { AccountTypeDef } from '../definitions/accountTypeTypes';
import type { CurrencyDef } from '../definitions/currencyTypes';
import {
  applyDisplayMode,
  CUSTOMER_KIND_DEFAULT_OPTIONS,
  DISPLAY_MODE_OPTIONS,
  FILTER_PAGE_KEYS,
  FILTER_STATE_OPTIONS,
  LANDING_OPTIONS,
  LOGIN_THEME_OPTIONS,
  PANEL_THEME_OPTIONS,
  PAY_TYPE_OPTIONS,
  setAppDefaults,
  VIRTUAL_POS_OPTIONS,
  COUNTRY_OPTIONS,
  type AppDefaults,
  type FilterPageKey,
  defaultAppDefaults,
} from './defaultsStore';

gsap.registerPlugin(useGSAP);

/**
 * Ayarlar › Varsayılanlar — DB (ayarlar.varsayilanlar).
 */
export default function DefaultsSettingsPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const { applyTheme } = useTheme();
  const [draft, setDraft] = useState<AppDefaults | null>(null);
  const [baseline, setBaseline] = useState<AppDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [accountOptions, setAccountOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Belirtilmemiş' },
  ]);
  const [currencyOptions, setCurrencyOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Belirtilmemiş' },
  ]);
  const [taxOptions, setTaxOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Belirtilmemiş' },
  ]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [saved, accounts, currencies, contact] = await Promise.all([
        api.get<AppDefaults>('/api/settings/defaults', token),
        api.get<AccountTypeDef[]>('/api/account-types', token).catch(() => [] as AccountTypeDef[]),
        api
          .get<CurrencyDef[]>('/api/currencies?active=1', token)
          .catch(() => [] as CurrencyDef[]),
        api
          .get<{ taxOffices?: { value: string; label: string }[] }>('/api/settings/contact', token)
          .catch(() => ({ taxOffices: [] as { value: string; label: string }[] })),
      ]);

      const next: AppDefaults = {
        ...defaultAppDefaults(),
        ...saved,
        filterOpen: {
          ...defaultAppDefaults().filterOpen,
          ...(saved.filterOpen ?? {}),
        },
      };
      setDraft(next);
      setBaseline({ ...next, filterOpen: { ...next.filterOpen } });
      setAppDefaults(next);

      setAccountOptions([
        { value: '', label: 'Belirtilmemiş' },
        ...accounts.map((a) => ({ value: a.name, label: a.name })),
      ]);
      setCurrencyOptions([
        { value: '', label: 'Belirtilmemiş' },
        ...currencies.map((c) => ({
          value: c.id,
          label: `${c.symbol} — ${c.name} (${c.shortName})`,
        })),
      ]);
      setTaxOptions([
        { value: '', label: 'Belirtilmemiş' },
        ...(contact.taxOffices || []).map((t) => ({ value: t.label, label: t.label })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Varsayılanlar yüklenemedi');
      setDraft(null);
      setBaseline(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

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
    { scope: rootRef, dependencies: [draft] },
  );

  function patch<K extends keyof AppDefaults>(key: K, value: AppDefaults[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function patchFilter(key: FilterPageKey, open: boolean) {
    setDraft((d) =>
      d
        ? {
            ...d,
            filterOpen: { ...d.filterOpen, [key]: open },
          }
        : d,
    );
  }

  function setAllFilters(open: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.filterOpen };
      for (const p of FILTER_PAGE_KEYS) next[p.key] = open;
      return { ...d, filterOpen: next };
    });
  }

  async function save() {
    if (!token || !draft || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.patch<AppDefaults>('/api/settings/defaults', draft, token);
      const next: AppDefaults = {
        ...defaultAppDefaults(),
        ...saved,
        filterOpen: {
          ...defaultAppDefaults().filterOpen,
          ...(saved.filterOpen ?? {}),
        },
      };
      setDraft(next);
      setBaseline({ ...next, filterOpen: { ...next.filterOpen } });
      setAppDefaults(next);
      applyTheme(next.panelTheme);
      await applyDisplayMode(next.displayMode);
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) {
    return (
      <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-10 text-center text-sm text-[var(--panel-muted)]">
        Varsayılanlar yükleniyor…
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
        {error || 'Varsayılanlar yüklenemedi'}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 block text-sm font-semibold text-[var(--color-brand-600)]"
        >
          Yeniden dene
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Varsayılanlar</h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Panelde yeni işlemlerde ve listelerde kullanılacak varsayılan değerleri seçin.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-5 [--input-notch:var(--panel-elevated)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) void save();
        }}
      >
        <Section
          dataAnim
          title="Görünüm & Giriş"
          hint="Tema, giriş ekranı, açılış sayfası ve pencere modu"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="Varsayılan Giriş Ekranı"
              options={LOGIN_THEME_OPTIONS}
              value={draft.loginTheme}
              onChange={(v) => v && patch('loginTheme', v as AppDefaults['loginTheme'])}
              kmJump
            />
            <FloatingSearchSelect
              label="Varsayılan Panel Teması"
              options={PANEL_THEME_OPTIONS}
              value={draft.panelTheme}
              onChange={(v) => v && patch('panelTheme', v as AppDefaults['panelTheme'])}
              kmJump
            />
            <FloatingSearchSelect
              label="Varsayılan Açılış Ekranı"
              options={LANDING_OPTIONS}
              value={draft.landingPath}
              onChange={(v) => v && patch('landingPath', v)}
              kmJump
            />
            <FloatingSearchSelect
              label="Varsayılan Pencere Modu"
              options={DISPLAY_MODE_OPTIONS}
              value={draft.displayMode}
              onChange={(v) => v && patch('displayMode', v as AppDefaults['displayMode'])}
              kmJump
            />
          </div>
        </Section>

        <Section dataAnim title="Müşteri Varsayılanları" hint="Yeni müşteri formunda ön seçimler">
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingSearchSelect
              label="Cari Tipi"
              options={accountOptions}
              value={draft.accountType}
              onChange={(v) => patch('accountType', v ?? '')}
              kmJump
            />
            <FloatingSearchSelect
              label="Müşteri Tipi"
              options={CUSTOMER_KIND_DEFAULT_OPTIONS}
              value={draft.customerKind}
              onChange={(v) => v && patch('customerKind', v as AppDefaults['customerKind'])}
              kmJump
            />
            <FloatingSearchSelect
              label="Vergi Dairesi"
              options={taxOptions}
              value={draft.taxOffice}
              onChange={(v) => patch('taxOffice', v ?? '')}
              kmJump
            />
            <FloatingSearchSelect
              label="Ülke"
              options={COUNTRY_OPTIONS}
              value={draft.country}
              onChange={(v) => v && patch('country', v)}
              kmJump
            />
          </div>
        </Section>

        <Section dataAnim title="Ödeme Varsayılanları" hint="Tahsilat ve ödeme isteklerinde ön seçimler">
          <div className="grid gap-4 md:grid-cols-3">
            <FloatingSearchSelect
              label="Ödeme Tipi"
              options={PAY_TYPE_OPTIONS}
              value={draft.payType}
              onChange={(v) => v && patch('payType', v as AppDefaults['payType'])}
              kmJump
            />
            <FloatingSearchSelect
              label="Para Birimi"
              options={currencyOptions}
              value={draft.currency}
              onChange={(v) => patch('currency', v ?? '')}
              kmJump
            />
            <FloatingSearchSelect
              label="Sanal POS Seçimi *"
              options={VIRTUAL_POS_OPTIONS}
              value={draft.virtualPos}
              onChange={(v) => v && patch('virtualPos', v as AppDefaults['virtualPos'])}
              required
              kmJump
            />
          </div>
        </Section>

        <Section
          dataAnim
          title="Liste Filtreleri"
          hint="Sayfa açıldığında filtre paneli varsayılan açık mı kapalı mı"
          action={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-km-jump
                onClick={() => setAllFilters(true)}
                className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/40 hover:bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]"
              >
                Tümünü aç
              </button>
              <button
                type="button"
                data-km-jump
                onClick={() => setAllFilters(false)}
                className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--panel-ink)] transition hover:border-[var(--color-brand-500)]/40 hover:bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]"
              >
                Tümünü kapat
              </button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {FILTER_PAGE_KEYS.map((p) => (
              <FloatingSearchSelect
                key={p.key}
                label={p.label}
                options={FILTER_STATE_OPTIONS}
                value={draft.filterOpen[p.key] ? 'open' : 'closed'}
                onChange={(v) => {
                  if (v) patchFilter(p.key, v === 'open');
                }}
                kmJump
              />
            ))}
          </div>
        </Section>

        <div data-anim className="flex flex-wrap items-center justify-end gap-3 pt-1">
          {dirty && !saveSuccess ? (
            <span className="mr-auto text-xs font-medium text-[var(--panel-muted)]">
              Kaydedilmemiş değişiklikler var
            </span>
          ) : null}
          <div className="w-full max-w-[12rem] sm:w-auto sm:min-w-[10rem]">
            <Button
              type="submit"
              disabled={(!dirty && !saveSuccess) || saving}
              loading={saving}
              success={saveSuccess}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
  dataAnim,
  action,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  dataAnim?: boolean;
  action?: ReactNode;
}) {
  return (
    <section
      {...(dataAnim ? { 'data-anim': true } : {})}
      className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--panel-ink)]">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-[var(--panel-muted)]">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
