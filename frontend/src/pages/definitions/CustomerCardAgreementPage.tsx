import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TextInput } from '../../components/ui/TextInput';
import { BANKS } from '../payments/mockBanks';
import { defaultCustomerRows, findVirtualPos, type CustomerAgreementRow } from './mockPos';

const LIST_PATH = '/tanimlamalar/pos-kart/sanal-pos';

/** Müşteri kart anlaşması — taksit oran tablosu */
export default function CustomerCardAgreementPage() {
  const { id = '' } = useParams();
  const row = useMemo(() => findVirtualPos(id), [id]);
  const [name, setName] = useState(row?.bankName ?? '');
  const [rows, setRows] = useState<CustomerAgreementRow[]>(() => defaultCustomerRows());
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  if (!row) return <Navigate to={LIST_PATH} replace />;

  const bank = BANKS.find((b) => b.id === row.bankId);

  function patch(i: number, patch: Partial<CustomerAgreementRow>) {
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const nextN = rows.length ? Math.max(...rows.map((r) => r.n)) + 1 : 1;
    setRows((list) => [
      ...list,
      { n: nextN, minLimit: '0,00', allRate: '', bireyselRate: '0,00', ticariRate: '0,00' },
    ]);
  }

  function confirmDelete() {
    if (deleteIdx == null) return;
    setRows((list) => list.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  }

  function save() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <Link
          to={LIST_PATH}
          className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
        >
          ← Sanal POS Tanımları
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
          {row.bankName} — Müşteri Kart Anlaşması
        </h1>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-[var(--panel-shadow)]">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <div className="relative">
            <div className="flex h-[3.25rem] items-center gap-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5">
              <span className="truncate text-sm text-[var(--panel-muted)]">Dosya seçilmedi</span>
              {bank?.logo ? (
                <img
                  src={bank.logo}
                  alt=""
                  className="ml-auto h-7 w-auto max-w-[72px] shrink-0 object-contain"
                />
              ) : null}
            </div>
            <span className="input-label-gap pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 bg-[var(--panel-elevated)] px-1.5 text-xs font-medium text-[var(--panel-muted)]">
              Logo
            </span>
          </div>
          <TextInput
            label="Adı"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-km-jump
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--panel-line)]">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[72px_1fr_1fr_1fr_1fr_44px] gap-2 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Taksit</span>
              <span>Alt Limit</span>
              <span>T. Kartlar</span>
              <span>Bireysel</span>
              <span>Ticari</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div
                key={`${r.n}-${i}`}
                className="grid grid-cols-[72px_1fr_1fr_1fr_1fr_44px] items-center gap-2 border-b border-[var(--panel-line)]/70 px-3 py-2 last:border-b-0"
              >
                <input
                  value={r.n}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, '')) || 1;
                    patch(i, { n });
                  }}
                  className="h-9 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2 text-center text-sm tabular-nums outline-none focus:border-[var(--color-brand-500)]"
                />
                <CellInput value={r.minLimit} onChange={(v) => patch(i, { minLimit: v })} />
                <CellInput
                  value={r.allRate}
                  placeholder="Oran"
                  onChange={(v) => patch(i, { allRate: v })}
                />
                <CellInput value={r.bireyselRate} onChange={(v) => patch(i, { bireyselRate: v })} />
                <CellInput value={r.ticariRate} onChange={(v) => patch(i, { ticariRate: v })} />
                <button
                  type="button"
                  aria-label="Sil"
                  onClick={() => setDeleteIdx(i)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-500"
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
          onClick={addRow}
          className="w-full rounded-xl bg-[var(--color-brand-600)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-500)]"
        >
          Yeni Taksit Ekle
        </button>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          data-km-jump
          onClick={save}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500"
        >
          <SaveIcon />
          {savedFlash ? 'Kaydedildi' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      {deleteIdx != null ? (
        <DeleteModal
          name={`${rows[deleteIdx]?.n ?? ''}. Taksit`}
          onCancel={() => setDeleteIdx(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function CellInput({
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
