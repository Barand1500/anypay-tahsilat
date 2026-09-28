import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { TextInput } from '../../components/ui/TextInput';
import { VIRTUAL_POS_INFRASTRUCTURES, type VirtualPosRow } from './mockPos';
import { resolvePosFieldProfile } from './posFieldProfiles';

export type VirtualPosModalMode =
  | { type: 'create' }
  | { type: 'edit'; row: VirtualPosRow };

type BankOption = { id: string; name: string; securityTypes: string };

type Props = {
  mode: VirtualPosModalMode;
  banks: BankOption[];
  /** Aynı banka+altyapı çifti engeli */
  existingKeys: string[];
  onClose: () => void;
  onSave: (data: {
    bankId: string;
    bankName: string;
    infrastructureId: string;
    posName: string;
    merchantId: string;
    terminalSafeId: string;
    securityKey: string;
    terminalPassword: string;
    securityType: string;
  }) => Promise<void>;
};

const FALLBACK_SECURITY = ['3D', '3D_PAY', '3D_HOST', '3DModel', '3DPay'];

/** Sanal POS ekle / düzenle — Esc / X / Kapat; bankaya göre alan etiketleri */
export function VirtualPosModal({ mode, banks, existingKeys, onClose, onSave }: Props) {
  const isEdit = mode.type === 'edit';
  const row = isEdit ? mode.row : null;

  const [bankId, setBankId] = useState<string | null>(row?.bankId ?? null);
  const [infraId, setInfraId] = useState<string | null>(row?.infrastructureId ?? null);
  const [merchantId, setMerchantId] = useState(row?.merchantId ?? '');
  const [terminalSafeId, setTerminalSafeId] = useState(row?.terminalSafeId ?? '');
  const [securityKey, setSecurityKey] = useState(row?.securityKey ?? '');
  const [terminalPassword, setTerminalPassword] = useState(row?.terminalPassword ?? '');
  const [securityType, setSecurityType] = useState<string | null>(row?.securityType || null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const bankOptions = useMemo(
    () => banks.map((b) => ({ value: b.id, label: b.name })),
    [banks],
  );
  const infraOptions = useMemo(
    () => VIRTUAL_POS_INFRASTRUCTURES.map((x) => ({ value: x.id, label: x.label })),
    [],
  );

  const selectedBankName = banks.find((b) => b.id === bankId)?.name ?? row?.bankName ?? '';
  const profile = useMemo(
    () => resolvePosFieldProfile(infraId, selectedBankName),
    [infraId, selectedBankName],
  );

  const securityOptions = useMemo(() => {
    const bank = banks.find((b) => b.id === bankId);
    const fromBank = (bank?.securityTypes || '')
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const list = fromBank.length ? fromBank : FALLBACK_SECURITY;
    return [...new Set(list)].map((v) => ({ value: v, label: v }));
  }, [banks, bankId]);

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
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!securityType) return;
    if (!securityOptions.some((o) => o.value === securityType)) {
      setSecurityType(null);
    }
  }, [securityOptions, securityType]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!bankId) {
      setError('Banka seçiniz');
      return;
    }
    if (!infraId) {
      setError('Sanal POS alt yapısı seçiniz');
      return;
    }
    if (!merchantId.trim()) {
      setError(`${profile.merchantLabel} gerekli`);
      return;
    }
    if (!terminalSafeId.trim()) {
      setError(`${profile.terminalLabel} gerekli`);
      return;
    }
    if (!securityKey.trim()) {
      setError(`${profile.keyLabel} gerekli`);
      return;
    }
    if (profile.showTerminalPassword && !terminalPassword.trim()) {
      setError(`${profile.terminalPasswordLabel} gerekli`);
      return;
    }
    if (profile.securityTypeRequired && !securityType) {
      setError('Güvenlik tipi seçiniz');
      return;
    }

    const key = `${bankId}|${infraId}`;
    const selfKey = isEdit ? `${row!.bankId}|${row!.infrastructureId}` : '';
    if (key !== selfKey && existingKeys.includes(key)) {
      setError('Bu banka ve alt yapı zaten tanımlı');
      return;
    }

    const bank = banks.find((b) => b.id === bankId);
    const infra = VIRTUAL_POS_INFRASTRUCTURES.find((x) => x.id === infraId);
    if (!bank || !infra) {
      setError('Geçersiz seçim');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        bankId: bank.id,
        bankName: bank.name,
        infrastructureId: infra.id,
        posName: infra.label,
        merchantId: merchantId.trim(),
        terminalSafeId: terminalSafeId.trim(),
        securityKey: securityKey.trim(),
        terminalPassword: profile.showTerminalPassword ? terminalPassword.trim() : '',
        securityType:
          securityType ||
          (profile.id === 'garanti'
            ? securityOptions[0]?.value || '3D_OOS_PAY'
            : '3D_PAY'),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="vpos-modal-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl [--input-notch:var(--panel-elevated)]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--panel-line)] px-5 py-3.5">
          <h2 id="vpos-modal-title" className="text-lg font-bold text-[var(--panel-ink)]">
            {isEdit ? 'Sanal POS Tanımı Düzenle' : 'Sanal POS Tanımı Ekle'}
          </h2>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
          >
            ✕
          </button>
        </header>

        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <FloatingSearchSelect
              label="Banka"
              required
              kmJump
              options={bankOptions}
              value={bankId}
              onChange={(v) => {
                setBankId(v);
                setError('');
              }}
              placeholder="Banka seçiniz."
            />
            <FloatingSearchSelect
              label="Sanal POS Alt Yapısı"
              required
              kmJump
              options={infraOptions}
              value={infraId}
              onChange={(v) => {
                setInfraId(v);
                setError('');
              }}
              placeholder="Alt yapı seçiniz."
            />
            <TextInput
              data-km-jump
              label={`${profile.merchantLabel} *`}
              value={merchantId}
              onChange={(e) => {
                setMerchantId(e.target.value);
                setError('');
              }}
              required
              autoComplete="off"
            />
            <TextInput
              data-km-jump
              label={`${profile.terminalLabel} *`}
              value={terminalSafeId}
              onChange={(e) => {
                setTerminalSafeId(e.target.value);
                setError('');
              }}
              required
              autoComplete="off"
            />
            <TextInput
              data-km-jump
              label={`${profile.keyLabel} *`}
              value={securityKey}
              onChange={(e) => {
                setSecurityKey(e.target.value);
                setError('');
              }}
              required
              autoComplete="off"
            />
            {profile.showTerminalPassword ? (
              <TextInput
                data-km-jump
                label={`${profile.terminalPasswordLabel} *`}
                value={terminalPassword}
                onChange={(e) => {
                  setTerminalPassword(e.target.value);
                  setError('');
                }}
                required
                autoComplete="off"
              />
            ) : null}
            {profile.showSecurityType ? (
              <FloatingSearchSelect
                label="Güvenlik Tipi"
                required={profile.securityTypeRequired}
                kmJump
                options={securityOptions}
                value={securityType}
                onChange={(v) => {
                  setSecurityType(v);
                  setError('');
                }}
                placeholder="Seçiniz"
              />
            ) : null}
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
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
              className="rounded-xl bg-[var(--color-brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
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
