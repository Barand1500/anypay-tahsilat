import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { TextInput } from '../../components/ui/TextInput';
import { BANKS } from '../payments/mockBanks';
import {
  defaultAgreementBanks,
  findCardAgreement,
  upsertCardAgreement,
  type CardAgreementBankPanel,
  type CardAgreementInstallment,
} from './mockKart';

const LIST_PATH = '/tanimlamalar/pos-kart/anlasmalar';

/** Kart Anlaşması ekle / düzenle — banka panelleri + taksit tablosu */
export default function CardAgreementDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'yeni';
  const existing = useMemo(() => (isNew ? null : findCardAgreement(id)), [id, isNew]);

  const [name, setName] = useState(() => (isNew ? '' : (findCardAgreement(id)?.name ?? '')));
  const [banks, setBanks] = useState<CardAgreementBankPanel[]>(() => {
    if (isNew) return defaultAgreementBanks();
    const found = findCardAgreement(id);
    return (
      found?.banks.map((b) => ({
        ...b,
        installments: b.installments.map((r) => ({ ...r })),
      })) ?? defaultAgreementBanks()
    );
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    bankId: string;
    index: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  if (!isNew && !existing) {
    return <Navigate to={LIST_PATH} replace />;
  }
  function patchBank(bankId: string, patch: Partial<CardAgreementBankPanel>) {
    setBanks((list) => list.map((b) => (b.bankId === bankId ? { ...b, ...patch } : b)));
  }

  function patchRow(bankId: string, index: number, patch: Partial<CardAgreementInstallment>) {
    setBanks((list) =>
      list.map((b) =>
        b.bankId !== bankId
          ? b
          : {
              ...b,
              installments: b.installments.map((r, i) => (i === index ? { ...r, ...patch } : r)),
            },
      ),
    );
  }

  function addInstallment(bankId: string) {
    setBanks((list) =>
      list.map((b) => {
        if (b.bankId !== bankId) return b;
        const nextN = b.installments.length
          ? Math.max(...b.installments.map((r) => r.n)) + 1
          : 1;
        return {
          ...b,
          installments: [
            ...b.installments,
            {
              n: nextN,
              minLimit: '',
              allRate: '',
              bireyselRate: '0,00',
              ticariRate: '0,00',
            },
          ],
        };
      }),
    );
  }

  function confirmDeleteRow() {
    if (!deleteTarget) return;
    const { bankId, index } = deleteTarget;
    setBanks((list) =>
      list.map((b) =>
        b.bankId !== bankId
          ? b
          : { ...b, installments: b.installments.filter((_, i) => i !== index) },
      ),
    );
    setDeleteTarget(null);
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Kart anlaşması adı zorunlu');
      return;
    }
    const detail = {
      id: isNew ? `ca-${Date.now()}` : id,
      name: trimmed,
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      banks,
    };
    upsertCardAgreement(detail);
    setError('');
    setSavedFlash(true);
    window.setTimeout(() => {
      setSavedFlash(false);
      navigate(LIST_PATH);
    }, 500);
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
        >
          ← Kart Anlaşmaları
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          {isNew ? 'Kart Anlaşması Ekle' : 'Kart Anlaşması Düzenle'}
        </h1>
      </div>

      <TextInput
        label="Kart Anlaşması Adı"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        data-km-jump
        error={error}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {banks.map((bank) => (
          <BankPanel
            key={bank.bankId}
            bank={bank}
            onNameChange={(v) => patchBank(bank.bankId, { name: v })}
            onLogoChange={(logo, logoFileName) =>
              patchBank(bank.bankId, { logo, logoFileName })
            }
            onPatchRow={(i, p) => patchRow(bank.bankId, i, p)}
            onAdd={() => addInstallment(bank.bankId)}
            onDeleteRow={(i, label) =>
              setDeleteTarget({ bankId: bank.bankId, index: i, label })
            }
          />
        ))}
      </div>

      <div className="flex justify-center pb-2">
        <button
          type="button"
          data-km-jump
          onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500"
        >
          <SaveIcon />
          {savedFlash ? 'Kaydedildi' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      {deleteTarget ? (
        <DeleteModal
          name={deleteTarget.label}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteRow}
        />
      ) : null}
    </div>
  );
}

function BankPanel({
  bank,
  onNameChange,
  onLogoChange,
  onPatchRow,
  onAdd,
  onDeleteRow,
}: {
  bank: CardAgreementBankPanel;
  onNameChange: (v: string) => void;
  onLogoChange: (logo: string | undefined, logoFileName: string | undefined) => void;
  onPatchRow: (i: number, p: Partial<CardAgreementInstallment>) => void;
  onAdd: () => void;
  onDeleteRow: (i: number, label: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fallbackLogo = BANKS.find((b) => b.id === bank.bankId)?.logo;
  const displayLogo = bank.logo || fallbackLogo;
  const fileLabel = bank.logoFileName
    ? bank.logoFileName
    : displayLogo
      ? 'Varsayılan logo'
      : 'Dosya seçilmedi.';

  function onFile(file: File | null) {
    if (!file) {
      onLogoChange(fallbackLogo, undefined);
      return;
    }
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    onLogoChange(url, file.name);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="relative">
          <div className="flex h-[3.25rem] items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5">
            <button
              type="button"
              data-km-jump
              onClick={() => fileRef.current?.click()}
              className="shrink-0 rounded-lg border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
            >
              Göz at…
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--panel-muted)]">
              {fileLabel}
            </span>
            {displayLogo ? (
              <img
                src={displayLogo}
                alt=""
                className="h-7 w-auto max-w-[64px] shrink-0 object-contain"
              />
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <span className="input-label-gap pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-[var(--panel-elevated)] px-1.5 text-xs font-medium text-[var(--panel-muted)]">
            Logo
          </span>
        </div>
        <TextInput
          label="Adı"
          required
          value={bank.name}
          onChange={(e) => onNameChange(e.target.value)}
          data-km-jump
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--panel-line)]">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[64px_1fr_1fr_1fr_1fr_40px] gap-1.5 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
            <span>Taksit</span>
            <span>Alt Limit</span>
            <span>T. Kartlar</span>
            <span>Bireysel</span>
            <span>Ticari</span>
            <span />
          </div>
          {bank.installments.map((r, i) => (
            <div
              key={`${bank.bankId}-${r.n}-${i}`}
              className="grid grid-cols-[64px_1fr_1fr_1fr_1fr_40px] items-center gap-1.5 border-b border-[var(--panel-line)]/70 px-2 py-1.5 last:border-b-0"
            >
              <input
                value={r.n}
                onChange={(e) =>
                  onPatchRow(i, { n: Number(e.target.value.replace(/\D/g, '')) || 1 })
                }
                className="h-9 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-1.5 text-center text-sm tabular-nums outline-none focus:border-[var(--color-brand-500)]"
              />
              <Cell
                value={r.minLimit}
                placeholder="Alt Limit"
                onChange={(v) => onPatchRow(i, { minLimit: v })}
              />
              <Cell
                value={r.allRate}
                placeholder="Oran"
                onChange={(v) => onPatchRow(i, { allRate: v })}
              />
              <Cell value={r.bireyselRate} onChange={(v) => onPatchRow(i, { bireyselRate: v })} />
              <Cell value={r.ticariRate} onChange={(v) => onPatchRow(i, { ticariRate: v })} />
              <button
                type="button"
                aria-label="Sil"
                onClick={() => onDeleteRow(i, `${r.n}. Taksit`)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-500/10"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        data-km-jump
        onClick={onAdd}
        className="w-full rounded-xl bg-[var(--color-brand-600)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-500)]"
      >
        Yeni Taksit Ekle
      </button>
    </section>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2 text-sm tabular-nums text-[var(--panel-ink)] outline-none placeholder:text-[var(--panel-muted)] focus:border-[var(--color-brand-500)]"
    />
  );
}

function DeleteModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
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
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <div className="px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--panel-ink)]">Taksiti sil</h2>
          <p className="mt-2 text-sm text-[var(--panel-muted)]">
            <strong className="text-[var(--panel-ink)]">{name}</strong> silinsin mi? Bu işlem geri
            alınamaz.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--panel-line)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 3h11l3 3v15H5V3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 3v6h8V3M8 21v-7h8v7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
