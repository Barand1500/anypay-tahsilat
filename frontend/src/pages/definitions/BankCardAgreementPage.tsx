import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { BANKS } from '../payments/mockBanks';
import { BankCardAgreementViewB } from './BankCardAgreementViewB';
import {
  DeleteModal,
  installmentTitle,
  type SegmentKey,
} from './bankAgreementUi';
import {
  defaultBankInstallment,
  findVirtualPos,
  type BankAgreementInstallment,
  type CardSegmentRates,
} from './mockPos';

const LIST_PATH = '/tanimlamalar/pos-kart/sanal-pos';

/** Banka kart anlaşması — tablo görünümü (B) */
export default function BankCardAgreementPage() {
  const { id = '' } = useParams();
  const row = useMemo(() => findVirtualPos(id), [id]);
  const [items, setItems] = useState<BankAgreementInstallment[]>(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(defaultBankInstallment),
  );
  const [segment, setSegment] = useState<SegmentKey>('bireysel');
  const [addN, setAddN] = useState('11');
  const [deleteN, setDeleteN] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const activeSegmentCount = useMemo(
    () =>
      items.reduce((acc, it) => {
        let n = 0;
        if (it.all.active) n += 1;
        if (it.bireysel.active) n += 1;
        if (it.ticari.active) n += 1;
        return acc + n;
      }, 0),
    [items],
  );

  if (!row) return <Navigate to={LIST_PATH} replace />;

  const bank = BANKS.find((b) => b.id === row.bankId);

  function patchSeg(n: number, key: SegmentKey, patch: Partial<CardSegmentRates>) {
    setItems((list) =>
      list.map((x) => (x.n === n ? { ...x, [key]: { ...x[key], ...patch } } : x)),
    );
  }

  function addInstallment() {
    const n = Math.min(36, Math.max(1, Number(addN) || 1));
    if (items.some((x) => x.n === n)) return;
    setItems((list) => [...list, defaultBankInstallment(n)].sort((a, b) => a.n - b.n));
    setAddN(String(Math.min(36, n + 1)));
  }

  function confirmDelete() {
    if (deleteN == null) return;
    setItems((list) => list.filter((x) => x.n !== deleteN));
    setDeleteN(null);
  }

  function copyFromPrevious(n: number) {
    const source = items.filter((x) => x.n < n).sort((a, b) => b.n - a.n)[0];
    if (!source) return;
    setItems((list) =>
      list.map((x) =>
        x.n === n
          ? {
              ...x,
              all: { ...source.all },
              bireysel: { ...source.bireysel },
              ticari: { ...source.ticari },
            }
          : x,
      ),
    );
  }

  function save() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="relative w-full space-y-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={LIST_PATH}
            className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            ← Sanal POS Tanımları
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            {row.bankName} — Banka Kart Anlaşması
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            {items.length} taksit · {activeSegmentCount} aktif segment
          </p>
        </div>
        {bank?.logo ? (
          <div className="flex h-14 items-center rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 shadow-[var(--panel-shadow)]">
            <img src={bank.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
          </div>
        ) : null}
      </div>

      <BankCardAgreementViewB
        items={items}
        segment={segment}
        setSegment={setSegment}
        onPatchSeg={patchSeg}
        onCopyFromPrevious={copyFromPrevious}
        onRequestDelete={setDeleteN}
      />

      {/* Sabit alt çubuk — kompakt ekle + Giriş Yap tarzı kaydet */}
      <div className="sticky bottom-3 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)]/95 px-3 py-2.5 shadow-[0_10px_32px_rgba(0,0,0,0.1)] backdrop-blur-md">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--panel-line)] bg-[var(--panel-surface)] p-0.5 shadow-sm">
            <input
              aria-label="Taksit numarası"
              inputMode="numeric"
              value={addN}
              onChange={(e) => setAddN(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInstallment();
                }
              }}
              data-km-jump
              className="h-8 w-11 rounded-full bg-transparent text-center text-sm font-bold tabular-nums text-[var(--panel-ink)] outline-none"
            />
            <button
              type="button"
              data-km-jump
              onClick={addInstallment}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-brand-600)] px-3 text-xs font-bold text-white transition hover:bg-[var(--color-brand-500)]"
            >
              <span className="text-sm leading-none">+</span>
              Ekle
            </button>
          </div>

          <div className="w-full max-w-[200px] sm:w-[200px]">
            <Button
              type="button"
              success={savedFlash}
              successLabel="Kaydedildi"
              onClick={save}
            >
              Değişiklikleri kaydet
            </Button>
          </div>
        </div>
      </div>

      {deleteN != null ? (
        <DeleteModal
          name={installmentTitle(deleteN)}
          onCancel={() => setDeleteN(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
