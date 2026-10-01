import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { BankCardAgreementViewB } from './BankCardAgreementViewB';
import {
  DeleteModal,
  installmentTitle,
  type SegmentKey,
} from './bankAgreementUi';
import {
  defaultBankInstallment,
  findVirtualPos,
  setVirtualPosList,
  type BankAgreementInstallment,
  type CardSegmentRates,
  type VirtualPosRow,
} from './mockPos';

const LIST_PATH = '/tanimlamalar/pos-kart/sanal-pos';

type BankAgreementApi = {
  posId: string;
  bankId: string;
  bankName: string;
  agreementCode: string;
  items: BankAgreementInstallment[];
};

/** Banka kart anlaşması — API kalıcı + ödeme oranlarına bağlı */
export default function BankCardAgreementPage() {
  const { token } = useAuth();
  const { id = '' } = useParams();
  const [row, setRow] = useState<VirtualPosRow | null>(() => findVirtualPos(id));
  const [booting, setBooting] = useState(true);
  const [items, setItems] = useState<BankAgreementInstallment[]>(() =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(defaultBankInstallment),
  );
  const [agreementCode, setAgreementCode] = useState('');
  const [segment, setSegment] = useState<SegmentKey>('bireysel');
  const [addN, setAddN] = useState('11');
  const [deleteN, setDeleteN] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) {
      setBooting(false);
      return;
    }
    setBooting(true);
    setError('');
    try {
      let pos = findVirtualPos(id);
      if (!pos) {
        const list = await api.get<VirtualPosRow[]>('/api/virtual-pos', token);
        setVirtualPosList(list);
        pos = list.find((r) => r.id === id) ?? null;
      }
      setRow(pos);
      if (!pos) return;

      const data = await api.get<BankAgreementApi>(
        `/api/virtual-pos/${encodeURIComponent(id)}/bank-agreement`,
        token,
      );
      setAgreementCode(data.agreementCode);
      setItems(
        data.items?.length
          ? data.items.map((it) => ({
              n: it.n,
              all: { ...defaultBankInstallment(it.n).all, ...it.all },
              bireysel: { ...defaultBankInstallment(it.n).bireysel, ...it.bireysel },
              ticari: { ...defaultBankInstallment(it.n).ticari, ...it.ticari },
            }))
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(defaultBankInstallment),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
      setRow(null);
    } finally {
      setBooting(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (booting) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-[var(--panel-muted)]">
        Yükleniyor…
      </div>
    );
  }

  if (!row) return <Navigate to={LIST_PATH} replace />;

  const bankLogo = row.bankLogoUrl;

  function patchSeg(n: number, key: SegmentKey, patch: Partial<CardSegmentRates>) {
    setItems((list) =>
      list.map((x) => {
        if (x.n !== n) return x;
        const next = { ...x, [key]: { ...x[key], ...patch } };
        if (patch.active === true) {
          if (key === 'all') {
            next.bireysel = { ...next.bireysel, active: false };
            next.ticari = { ...next.ticari, active: false };
          } else {
            next.all = { ...next.all, active: false };
          }
        }
        return next;
      }),
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

  async function save() {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const data = await api.put<BankAgreementApi>(
        `/api/virtual-pos/${encodeURIComponent(id)}/bank-agreement`,
        { items },
        token,
      );
      setAgreementCode(data.agreementCode);
      setItems(data.items);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
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
            {agreementCode ? (
              <span className="ml-2 text-[var(--panel-muted)]">· kod: {agreementCode}</span>
            ) : null}
          </p>
        </div>
        {bankLogo ? (
          <div className="flex h-14 items-center rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 shadow-[var(--panel-shadow)]">
            <img src={bankLogo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <BankCardAgreementViewB
        items={items}
        segment={segment}
        setSegment={setSegment}
        onPatchSeg={patchSeg}
        onCopyFromPrevious={copyFromPrevious}
        onRequestDelete={setDeleteN}
      />

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
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
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
