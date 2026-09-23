import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import { TextInput } from '../../components/ui/TextInput';
import { BANKS } from '../payments/mockBanks';
import {
  defaultBankInstallment,
  findVirtualPos,
  type BankAgreementInstallment,
  type CardSegmentRates,
} from './mockPos';

const LIST_PATH = '/tanimlamalar/pos-kart/sanal-pos';

/** Banka kart anlaşması — taksit accordion */
export default function BankCardAgreementPage() {
  const { id = '' } = useParams();
  const row = useMemo(() => findVirtualPos(id), [id]);
  const [items, setItems] = useState<BankAgreementInstallment[]>(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(defaultBankInstallment),
  );
  const [openN, setOpenN] = useState<number | null>(2);
  const [addN, setAddN] = useState('11');
  const [deleteN, setDeleteN] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  if (!row) return <Navigate to={LIST_PATH} replace />;

  const bank = BANKS.find((b) => b.id === row.bankId);

  function updateItem(n: number, next: BankAgreementInstallment) {
    setItems((list) => list.map((x) => (x.n === n ? next : x)));
  }

  function addInstallment() {
    const n = Math.min(36, Math.max(1, Number(addN) || 1));
    if (items.some((x) => x.n === n)) return;
    setItems((list) => [...list, defaultBankInstallment(n)].sort((a, b) => a.n - b.n));
    setOpenN(n);
    setAddN(String(n + 1));
  }

  function confirmDelete() {
    if (deleteN == null) return;
    setItems((list) => list.filter((x) => x.n !== deleteN));
    if (openN === deleteN) setOpenN(null);
    setDeleteN(null);
  }

  function save() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={LIST_PATH}
            className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            ← Sanal POS Tanımları
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            {row.bankName} — Banka Kart Anlaşması
          </h1>
        </div>
        {bank?.logo ? (
          <img src={bank.logo} alt="" className="h-10 w-auto max-w-[100px] object-contain" />
        ) : null}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <InstallmentAccordion
            key={item.n}
            item={item}
            open={openN === item.n}
            onToggle={() => setOpenN((cur) => (cur === item.n ? null : item.n))}
            onChange={(next) => updateItem(item.n, next)}
            onDelete={() => setDeleteN(item.n)}
            onSave={save}
            canDelete={item.n !== 1}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-4 shadow-[var(--panel-shadow)]">
            <div className="w-40">
          <TextInput
            label="Kaçıncı Taksit"
            labelMode="placeholder"
            inputMode="numeric"
            value={addN}
            onChange={(e) => setAddN(e.target.value.replace(/\D/g, '').slice(0, 2))}
            data-km-jump
          />
        </div>
        <button
          type="button"
          data-km-jump
          onClick={addInstallment}
          className="inline-flex h-[3.25rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 sm:min-w-[200px] sm:flex-none"
        >
          <span className="text-lg leading-none">+</span>
          Taksit Ekle
        </button>
        <button
          type="button"
          data-km-jump
          onClick={save}
          className="inline-flex h-[3.25rem] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <SaveIcon />
          {savedFlash ? 'Kaydedildi' : 'Kaydet'}
        </button>
      </div>

      {deleteN != null ? (
        <DeleteModal
          name={deleteN === 1 ? 'Tek Çekim' : `${deleteN}. Taksit`}
          onCancel={() => setDeleteN(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

function InstallmentAccordion({
  item,
  open,
  onToggle,
  onChange,
  onDelete,
  onSave,
  canDelete,
}: {
  item: BankAgreementInstallment;
  open: boolean;
  onToggle: () => void;
  onChange: (next: BankAgreementInstallment) => void;
  onDelete: () => void;
  onSave: () => void;
  canDelete: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const title = item.n === 1 ? 'Tek Çekim' : `${item.n}. Taksit`;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      gsap.fromTo(
        el,
        { height: 0, autoAlpha: 0 },
        { height: 'auto', autoAlpha: 1, duration: 0.28, ease: 'power2.out' },
      );
    }
  }, [open]);

  function patchSeg(
    key: 'all' | 'bireysel' | 'ticari',
    patch: Partial<CardSegmentRates>,
  ) {
    onChange({ ...item, [key]: { ...item[key], ...patch } });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center text-left"
        >
          <span className="truncate text-base font-bold text-[var(--panel-ink)]">{title}</span>
        </button>
        {canDelete ? (
          <button
            type="button"
            aria-label="Sil"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-500"
          >
            <TrashIcon />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={open ? 'Daralt' : 'Genişlet'}
          onClick={onToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]"
        >
          <Chevron open={open} />
        </button>
      </div>

      {open ? (
        <div ref={bodyRef} className="border-t border-[var(--panel-line)] px-4 pb-4 pt-3">
          <div className="grid gap-4 lg:grid-cols-3">
            <SegmentColumn
              title="Tüm Kartlar"
              seg={item.all}
              onChange={(p) => patchSeg('all', p)}
            />
            <SegmentColumn
              title="Bireysel Kartlar"
              seg={item.bireysel}
              onChange={(p) => patchSeg('bireysel', p)}
            />
            <SegmentColumn
              title="Ticari Kartlar"
              seg={item.ticari}
              onChange={(p) => patchSeg('ticari', p)}
            />
          </div>
          <button
            type="button"
            onClick={onSave}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <SaveIcon />
            Kaydet
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SegmentColumn({
  title,
  seg,
  onChange,
}: {
  title: string;
  seg: CardSegmentRates;
  onChange: (p: Partial<CardSegmentRates>) => void;
}) {
  const disabled = !seg.active;
  return (
    <div
      className={[
        'space-y-2.5 rounded-xl border border-[var(--panel-line)] p-3',
        !seg.active ? 'opacity-55' : '',
      ].join(' ')}
    >
      <p className="text-sm font-bold text-[var(--color-brand-600)]">{title}</p>
      <Field
        label="Taksit Alt Limiti"
        value={seg.minLimit}
        disabled={disabled}
        onChange={(v) => onChange({ minLimit: v })}
      />
      <Field
        label="Banka Komisyonu *"
        value={seg.bankCommission}
        disabled={disabled}
        onChange={(v) => onChange({ bankCommission: v })}
      />
      <Field
        label="Müşteri Komisyonu"
        value={seg.customerCommission}
        disabled={disabled}
        onChange={(v) => onChange({ customerCommission: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Puan"
          value={seg.points}
          disabled={disabled}
          onChange={(v) => onChange({ points: v })}
        />
        <Field
          label="Ek Taksit"
          value={seg.extraInstallment}
          disabled={disabled}
          onChange={(v) => onChange({ extraInstallment: v })}
        />
        <Field
          label="Tahsil Günü *"
          value={seg.collectionDay}
          disabled={disabled}
          onChange={(v) => onChange({ collectionDay: v })}
        />
        <Field
          label="Bloke Günü"
          value={seg.blockDay}
          disabled={disabled}
          onChange={(v) => onChange({ blockDay: v })}
        />
      </div>
      <Field
        label="Açıklama"
        value={seg.note}
        disabled={disabled}
        onChange={(v) => onChange({ note: v })}
      />
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-[var(--panel-muted)]">Durum</span>
        <button
          type="button"
          role="switch"
          aria-checked={seg.active}
          onClick={() => onChange({ active: !seg.active })}
          className={[
            'relative h-6 w-11 rounded-full transition',
            seg.active ? 'bg-[var(--color-brand-600)]' : 'bg-[var(--panel-line)]',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
              seg.active ? 'left-[1.35rem]' : 'left-0.5',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-[var(--panel-muted)]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] px-2.5 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={['transition', open ? 'rotate-180' : ''].join(' ')}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
