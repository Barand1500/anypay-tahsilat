import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { api } from '../../lib/api';
import { EMPTY_ERP, type ErpSettings } from './erpTypes';

gsap.registerPlugin(useGSAP);

type ErpApi = ErpSettings & { passwordSet: boolean; apiSecretSet: boolean };

/**
 * Ayarlar › ERP Entegrasyon — Vega (erp_entegrasyon_bilgileri).
 */
export default function ErpSettingsPage() {
  const { token } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<ErpSettings>({ ...EMPTY_ERP });
  const [baseline, setBaseline] = useState<ErpSettings>({ ...EMPTY_ERP });
  const [passwordSet, setPasswordSet] = useState(false);
  const [apiSecretSet, setApiSecretSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ErpApi>('/api/settings/erp', token);
      const next: ErpSettings = {
        active: Boolean(data.active),
        apiUrl: data.apiUrl || '',
        apiSecret: '',
        server: data.server || '',
        database: data.database || '',
        username: data.username || '',
        password: '',
        company: data.company || '',
        period: data.period || '',
        branch: data.branch || '',
        warehouse: data.warehouse || '',
        cashRegister: data.cashRegister || '',
        inventory: Boolean(data.inventory),
      };
      setDraft(next);
      setBaseline({ ...next });
      setPasswordSet(Boolean(data.passwordSet));
      setApiSecretSet(Boolean(data.apiSecretSet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ERP ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    draft.active !== baseline.active ||
    draft.apiUrl !== baseline.apiUrl ||
    draft.apiSecret !== '' ||
    draft.server !== baseline.server ||
    draft.database !== baseline.database ||
    draft.username !== baseline.username ||
    draft.password !== '' ||
    draft.company !== baseline.company ||
    draft.period !== baseline.period ||
    draft.branch !== baseline.branch ||
    draft.warehouse !== baseline.warehouse ||
    draft.cashRegister !== baseline.cashRegister ||
    draft.inventory !== baseline.inventory;

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

  function patch<K extends keyof ErpSettings>(key: K, value: ErpSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || !dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.patch<ErpApi>(
        '/api/settings/erp',
        {
          active: draft.active,
          apiUrl: draft.apiUrl,
          apiSecret: draft.apiSecret,
          server: draft.server,
          database: draft.database,
          username: draft.username,
          password: draft.password,
          company: draft.company,
          period: draft.period,
          branch: draft.branch,
          warehouse: draft.warehouse,
          cashRegister: draft.cashRegister,
          inventory: draft.inventory,
        },
        token,
      );
      const next: ErpSettings = {
        active: data.active,
        apiUrl: data.apiUrl || '',
        apiSecret: '',
        server: data.server || '',
        database: data.database || '',
        username: data.username || '',
        password: '',
        company: data.company || '',
        period: data.period || '',
        branch: data.branch || '',
        warehouse: data.warehouse || '',
        cashRegister: data.cashRegister || '',
        inventory: Boolean(data.inventory),
      };
      setDraft(next);
      setBaseline({ ...next });
      setPasswordSet(Boolean(data.passwordSet));
      setApiSecretSet(Boolean(data.apiSecretSet));
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await api.delete<ErpApi>('/api/settings/erp', token);
      const next: ErpSettings = {
        active: Boolean(data.active),
        apiUrl: data.apiUrl || '',
        apiSecret: '',
        server: data.server || '',
        database: data.database || '',
        username: data.username || '',
        password: '',
        company: data.company || '',
        period: data.period || '',
        branch: data.branch || '',
        warehouse: data.warehouse || '',
        cashRegister: data.cashRegister || '',
        inventory: Boolean(data.inventory),
      };
      setDraft(next);
      setBaseline({ ...next });
      setPasswordSet(Boolean(data.passwordSet));
      setApiSecretSet(Boolean(data.apiSecretSet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sıfırlanamadı');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="w-full">
      <div data-anim className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          ERP Entegrasyon Bilgileri
        </h1>
        <p className="mt-1 text-sm text-[var(--panel-muted)]">
          Vega ERP entegrasyonunu bu sayfadan yönetin.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <form
        data-anim
        onSubmit={(e) => void save(e)}
        className="space-y-5 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)] sm:p-6 [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--panel-ink)]">Bağlantı</h2>
            {loading ? (
              <p className="mt-0.5 text-xs text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[var(--panel-muted)]">Durum</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.active}
              data-km-jump
              title={draft.active ? 'Aktif' : 'Pasif'}
              onClick={() => patch('active', !draft.active)}
              className={[
                'relative h-7 w-12 shrink-0 rounded-full transition',
                draft.active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold shadow transition',
                  draft.active
                    ? 'translate-x-5 text-[var(--color-brand-600)]'
                    : 'text-[var(--panel-muted)]',
                ].join(' ')}
              >
                {draft.active ? '✓' : '✕'}
              </span>
            </button>
          </div>
        </div>

        <TextInput
          data-km-jump
          label="Api Url *"
          value={draft.apiUrl}
          onChange={(e) => patch('apiUrl', e.target.value)}
          placeholder="https://…"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            data-km-jump
            label="Sunucu *"
            value={draft.server}
            onChange={(e) => patch('server', e.target.value)}
          />
          <TextInput
            data-km-jump
            label="Veritabanı *"
            value={draft.database}
            onChange={(e) => patch('database', e.target.value)}
          />
          <TextInput
            data-km-jump
            label="Kullanıcı Adı *"
            value={draft.username}
            onChange={(e) => patch('username', e.target.value)}
            autoComplete="username"
          />
          <TextInput
            data-km-jump
            label={passwordSet ? 'Şifre (değiştirmek için yazın)' : 'Şifre *'}
            type={showPass ? 'text' : 'password'}
            value={draft.password}
            placeholder={passwordSet ? '••••••••••' : ''}
            onChange={(e) => patch('password', e.target.value)}
            autoComplete="current-password"
            endAdornment={
              <button
                type="button"
                className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? 'Gizle' : 'Göster'}
              </button>
            }
          />
          <TextInput
            data-km-jump
            label={apiSecretSet ? 'API Secret (değiştirmek için yazın)' : 'API Secret'}
            type={showSecret ? 'text' : 'password'}
            value={draft.apiSecret}
            placeholder={apiSecretSet ? '••••••••••' : ''}
            onChange={(e) => patch('apiSecret', e.target.value)}
            autoComplete="off"
            endAdornment={
              <button
                type="button"
                className="text-xs font-semibold text-[var(--panel-muted)] hover:text-[var(--panel-ink)]"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? 'Gizle' : 'Göster'}
              </button>
            }
          />
        </div>

        <div className="border-t border-[var(--panel-line)] pt-5">
          <h3 className="mb-4 text-sm font-bold text-[var(--panel-ink)]">Vega parametreleri</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              data-km-jump
              label="Firma"
              value={draft.company}
              onChange={(e) => patch('company', e.target.value)}
            />
            <TextInput
              data-km-jump
              label="Dönem"
              value={draft.period}
              onChange={(e) => patch('period', e.target.value)}
            />
            <TextInput
              data-km-jump
              label="Şube"
              value={draft.branch}
              onChange={(e) => patch('branch', e.target.value)}
            />
            <TextInput
              data-km-jump
              label="Depo"
              value={draft.warehouse}
              onChange={(e) => patch('warehouse', e.target.value)}
            />
            <TextInput
              data-km-jump
              label="Kasa"
              value={draft.cashRegister}
              onChange={(e) => patch('cashRegister', e.target.value)}
            />
            <ToggleRow
              label="Envanter"
              checked={draft.inventory}
              onChange={(v) => patch('inventory', v)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="min-w-[11rem] flex-1 sm:flex-none sm:min-w-[12rem]">
            <Button
              type="submit"
              disabled={(!dirty && !saveOk) || saving || loading}
              success={saveOk}
            >
              <span className="inline-flex items-center gap-2">
                <SaveIcon />
                {saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
              </span>
            </Button>
          </div>
          <button
            type="button"
            data-km-jump
            title="Sıfırla"
            aria-label="Sıfırla"
            disabled={saving}
            onClick={() => void reset()}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/8 text-rose-500 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            <TrashIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

function ToggleRow({
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
        'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition',
        checked
          ? 'border-[color-mix(in_srgb,var(--color-brand-500)_45%,var(--panel-line))] bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--panel-elevated))]'
          : 'border-[var(--panel-line)] bg-[var(--panel-bg)]',
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
