import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CopyLine } from '../../components/ui/CopyLine';
import { DateField } from '../../components/ui/DateField';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { usePermission } from '../../permissions/PermissionContext';
import { getLiveCustomers } from '../customers/mockCustomers';
import { BANKS } from '../payments/mockBanks';
import { getBranchOptions, INITIAL_USERS } from '../users/mockUsers';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import { DekontModal } from './DekontModal';
import {
  formatMoneyTr,
  formatTxDate,
  INITIAL_TRANSACTIONS,
  isVoidWindowOpen,
  TX_STATUS_LABEL,
  type Transaction,
  type TxStatus,
} from './mockTransactions';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

const STATUS_OPTIONS = (Object.keys(TX_STATUS_LABEL) as TxStatus[]).map((id) => ({
  value: id,
  label: TX_STATUS_LABEL[id],
}));

const ARCHIVE_OPTIONS = [
  { value: 'no', label: 'Hayır' },
  { value: 'yes', label: 'Evet' },
];

/**
 * Hareketler — filtreler + liste + Dekont (mock).
 */
export default function TransactionsPage() {
  const { guard } = usePermission();
  const rootRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<Transaction[]>(() => [...INITIAL_TRANSACTIONS]);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [dekontTx, setDekontTx] = useState<Transaction | null>(null);
  const [reverseTx, setReverseTx] = useState<Transaction | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('hareketler'));

  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('2026-09-01');
  const [dateTo, setDateTo] = useState('2026-09-30');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bankId, setBankId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('paid');
  const [archive, setArchive] = useState<string | null>('no');

  const branchOptions = useMemo(
    () => getBranchOptions().map((b) => ({ value: b, label: b })),
    [],
  );
  const userOptions = useMemo(
    () => INITIAL_USERS.map((u) => ({ value: u.id, label: u.name })),
    [],
  );
  const customerOptions = useMemo(
    () => getLiveCustomers().map((c) => ({ value: c.id, label: c.title })),
    [],
  );
  const bankOptions = useMemo(
    () =>
      BANKS.filter((b) => b.bins.length > 0 || b.id === 'qnb').map((b) => ({
        value: b.id,
        label: b.name,
      })),
    [],
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (branch) list = list.filter((t) => t.branch === branch);
    if (userId) list = list.filter((t) => t.userId === userId);
    if (customerId) list = list.filter((t) => t.customerId === customerId);
    if (bankId) list = list.filter((t) => t.bankId === bankId);
    if (status) list = list.filter((t) => t.status === status);
    if (archive === 'yes') list = list.filter((t) => t.archived);
    if (archive === 'no') list = list.filter((t) => !t.archived);
    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0, 0, 0, 0);
      list = list.filter((t) => new Date(t.at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.at).getTime() <= to);
    }
    const q = query.trim().toLocaleLowerCase('tr');
    if (q) {
      list = list.filter(
        (t) =>
          t.id.toLocaleLowerCase('tr').includes(q) ||
          t.customerTitle.toLocaleLowerCase('tr').includes(q) ||
          t.bankName.toLocaleLowerCase('tr').includes(q) ||
          t.dekont.cardHolderName.toLocaleLowerCase('tr').includes(q),
      );
    }
    return [...list].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [rows, branch, userId, customerId, bankId, status, archive, dateFrom, dateTo, query]);

  const unfilteredTotal = rows.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, branch, userId, customerId, bankId, status, archive, dateFrom, dateTo]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    gsap.fromTo(
      el.querySelectorAll('[data-anim]'),
      { autoAlpha: 0, y: 10 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        stagger: 0.04,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      },
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function flash(msg: string) {
    setToast(msg);
  }

  function applyPageSize(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setPageSizeText(String(pageSize));
      return;
    }
    const clamped = Math.min(PAGE_MAX, Math.max(PAGE_MIN, n));
    setPageSize(clamped);
    setPageSizeText(String(clamped));
  }

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setDateFrom('2026-09-01');
    setDateTo('2026-09-30');
    setCustomerId(null);
    setBankId(null);
    setStatus('paid');
    setArchive('no');
    setQuery('');
  }

  function exportCsv() {
    const header = [
      'No',
      'Tarih',
      'Durum',
      'Banka',
      'Taksit',
      'Müşteri',
      'Tutar',
      'Komisyon',
      'Toplam',
      'Arşiv',
    ];
    const body = filtered.map((t) => [
      t.id,
      formatTxDate(t.at),
      TX_STATUS_LABEL[t.status],
      t.bankName,
      String(t.installments),
      t.customerTitle,
      formatMoneyTr(t.amount),
      formatMoneyTr(t.commission),
      formatMoneyTr(t.amount + t.commission),
      t.archived ? 'Evet' : 'Hayır',
    ]);
    const csv = [header, ...body]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hareketler.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyList() {
    const text = filtered
      .map(
        (t) =>
          `${t.id}\t${formatTxDate(t.at)}\t${TX_STATUS_LABEL[t.status]}\t${t.bankName}\t${t.customerTitle}\t${formatMoneyTr(t.amount + t.commission)}`,
      )
      .join('\n');
    void navigator.clipboard.writeText(text);
    flash('Liste panoya kopyalandı');
  }

  function askReverse(tx: Transaction) {
    if (!guard('m-hareketler', 'remove', 'Hareketler')) return;
    if (tx.status === 'cancelled' || tx.status === 'refunded') {
      flash(tx.status === 'cancelled' ? 'Bu hareket zaten iptal' : 'Bu hareket zaten iade');
      return;
    }
    if (tx.status !== 'paid') {
      flash('Yalnızca ödenmiş hareketler iptal/iade edilebilir');
      return;
    }
    setReverseTx(tx);
  }

  function confirmReverse() {
    if (!reverseTx) return;
    if (!guard('m-hareketler', 'remove', 'Hareketler')) {
      setReverseTx(null);
      return;
    }
    const asVoid = isVoidWindowOpen(reverseTx.at);
    const nextStatus: TxStatus = asVoid ? 'cancelled' : 'refunded';
    setRows((prev) =>
      prev.map((r) => (r.id === reverseTx.id ? { ...r, status: nextStatus } : r)),
    );
    flash(asVoid ? `İptal edildi — ${reverseTx.id}` : `İade edildi — ${reverseTx.id}`);
    setReverseTx(null);
  }

  function onArchive(tx: Transaction) {
    if (!guard('m-hareketler', 'save', 'Hareketler')) return;
    setRows((prev) => prev.map((r) => (r.id === tx.id ? { ...r, archived: !r.archived } : r)));
    flash(tx.archived ? `Arşivden çıkarıldı — ${tx.id}` : `Arşivlendi — ${tx.id}`);
  }

  function openDekont(tx: Transaction) {
    if (!guard('m-hareketler', 'view', 'Hareketler')) return;
    setDekontTx(tx);
  }

  const filtersActive =
    !!branch ||
    !!userId ||
    !!customerId ||
    !!bankId ||
    status !== 'paid' ||
    archive !== 'no' ||
    dateFrom !== '2026-09-01' ||
    dateTo !== '2026-09-30' ||
    !!query.trim();

  return (
    <div ref={rootRef} className="w-full space-y-4 pb-8">
      <div data-anim>
        <nav className="mb-1 text-sm text-[var(--panel-ink)]/65">
          <Link to="/" className="font-medium hover:text-[var(--color-brand-600)]">
            Anasayfa
          </Link>
          <span className="mx-1.5 opacity-50">›</span>
          <span className="font-semibold text-[var(--panel-ink)]">Hareketler</span>
        </nav>
      </div>

      <section
        data-anim
        className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] [--input-notch:var(--panel-elevated)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 text-[var(--panel-ink)] transition hover:text-[var(--color-brand-600)]"
            aria-expanded={filtersOpen}
          >
            <FilterIcon />
            <h2 className="text-base font-bold">Filtreler</h2>
            <span
              className={[
                'ml-0.5 text-[var(--panel-muted)] transition',
                filtersOpen ? 'rotate-180' : '',
              ].join(' ')}
            >
              <ChevronSm />
            </span>
          </button>
          <button
            type="button"
            data-km-jump
            onClick={resetFilters}
            disabled={!filtersActive}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ResetIcon />
            Sıfırla
          </button>
        </div>

        {filtersOpen ? (
          <div className="border-t border-[var(--panel-line)] px-4 pb-4 pt-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <FloatingSearchSelect
                label="Şube/Departman Seçin"
                options={branchOptions}
                value={branch}
                onChange={setBranch}
                placeholder="Şube seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Kullanıcı Seçin"
                options={userOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Kullanıcı seçiniz."
                kmJump
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DateField
                label="Başlangıç Tarihi"
                value={dateFrom}
                onChange={setDateFrom}
                kmJump
              />
              <DateField
                label="Bitiş Tarihi"
                value={dateTo}
                onChange={setDateTo}
                kmJump
              />
              <FloatingSearchSelect
                label="Müşteri"
                options={customerOptions}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Müşteri seçiniz."
                kmJump
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <FloatingSearchSelect
                label="Banka"
                options={bankOptions}
                value={bankId}
                onChange={setBankId}
                placeholder="Banka seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Durum"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                placeholder="Durum seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Arşiv"
                options={ARCHIVE_OPTIONS}
                value={archive}
                onChange={setArchive}
                placeholder="Seçiniz."
                kmJump
              />
            </div>
          </div>
        ) : null}
      </section>

      <section
        data-anim
        className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-bold text-[var(--panel-ink)]">Hareketler</h2>
            <label className="flex items-center gap-2 text-sm text-[var(--panel-muted)]">
              <input
                type="text"
                inputMode="numeric"
                data-km-jump
                value={pageSizeText}
                onChange={(e) => setPageSizeText(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onBlur={() => applyPageSize(pageSizeText)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className="w-11 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
              veri göster
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
                <SearchIcon />
              </span>
              <input
                data-km-jump
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara…"
                className="w-44 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)] sm:w-56"
              />
            </div>
            <ExportDropdown onCsv={exportCsv} onCopy={copyList} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[minmax(140px,1fr)_minmax(160px,1.1fr)_minmax(180px,1.3fr)_minmax(130px,0.9fr)_120px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>No / Tarih</span>
              <span>Durum / Sanalpos</span>
              <span>Müşteri Ünvanı</span>
              <span>Toplam</span>
              <span className="text-right">İşlem</span>
            </div>

            {slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı.
              </p>
            ) : (
              slice.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-[minmax(140px,1fr)_minmax(160px,1.1fr)_minmax(180px,1.3fr)_minmax(130px,0.9fr)_120px] gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 transition hover:bg-[var(--panel-hover)]/50"
                >
                  <div className="min-w-0">
                    <CopyLine
                      value={tx.id}
                      onCopied={flash}
                      className="font-mono text-[13px] font-semibold tabular-nums text-[var(--panel-ink)]"
                    />
                    <CopyLine
                      value={formatTxDate(tx.at)}
                      onCopied={flash}
                      className="text-[12px] tabular-nums text-[var(--panel-muted)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <StatusBadge status={tx.status} />
                    <CopyLine
                      value={tx.bankName}
                      onCopied={flash}
                      className="mt-1 text-[13px] font-semibold text-[var(--color-brand-600)]"
                    />
                    <p className="text-[12px] font-medium text-sky-600/90 dark:text-sky-400">
                      {tx.installments} Taksit
                    </p>
                  </div>

                  <div className="min-w-0">
                    <CopyLine
                      value={tx.customerTitle}
                      onCopied={flash}
                      className="text-sm font-medium leading-snug text-[var(--panel-ink)]"
                    />
                  </div>

                  <div className="min-w-0 text-[12px] tabular-nums text-[var(--panel-muted)]">
                    <CopyLine
                      value={`${formatMoneyTr(tx.amount)} ₺`}
                      raw={formatMoneyTr(tx.amount)}
                      onCopied={flash}
                      className="text-[var(--panel-ink)]"
                    />
                    <CopyLine
                      value={`Komisyon: ${formatMoneyTr(tx.commission)} ₺`}
                      raw={formatMoneyTr(tx.commission)}
                      onCopied={flash}
                    />
                    <CopyLine
                      value={`Toplam: ${formatMoneyTr(tx.amount + tx.commission)} ₺`}
                      raw={formatMoneyTr(tx.amount + tx.commission)}
                      onCopied={flash}
                      className="text-[13px] font-bold text-[var(--panel-ink)]"
                    />
                  </div>

                  <div className="flex items-start justify-end gap-1.5">
                    {tx.status === 'paid' ? (
                      isVoidWindowOpen(tx.at) ? (
                        <IconBtn
                          title="İptal Et"
                          bg="bg-rose-100 dark:bg-rose-500/20"
                          fg="text-rose-600 dark:text-rose-400"
                          onClick={() => askReverse(tx)}
                        >
                          <CancelIcon />
                        </IconBtn>
                      ) : (
                        <IconBtn
                          title="İade Et"
                          bg="bg-amber-100 dark:bg-amber-500/20"
                          fg="text-amber-800 dark:text-amber-400"
                          onClick={() => askReverse(tx)}
                        >
                          <RefundIcon />
                        </IconBtn>
                      )
                    ) : null}
                    <IconBtn
                      title="Dekont"
                      bg="bg-orange-100 dark:bg-orange-500/20"
                      fg="text-orange-700 dark:text-orange-400"
                      onClick={() => openDekont(tx)}
                    >
                      <ReceiptIcon />
                    </IconBtn>
                    <IconBtn
                      title="Arşivle"
                      bg="bg-sky-100 dark:bg-sky-500/20"
                      fg="text-sky-600 dark:text-sky-400"
                      onClick={() => onArchive(tx)}
                    >
                      <ArchiveIcon />
                    </IconBtn>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-[var(--panel-muted)]">
          <p>
            {fromIdx} ile {toIdx} arasında veri gösteriliyor. Toplam:{' '}
            <strong className="text-[var(--panel-ink)]">{filtered.length}</strong> (Filtrelenmemiş
            toplam: {unfilteredTotal})
          </p>
          <div className="flex items-center gap-1">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
              İlk
            </PagerBtn>
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Geri
            </PagerBtn>
            <span className="rounded-lg bg-[var(--color-brand-600)] px-2.5 py-1 text-xs font-bold text-white">
              {safePage}
            </span>
            <PagerBtn
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              İleri
            </PagerBtn>
            <PagerBtn disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
              Son
            </PagerBtn>
          </div>
        </div>
      </section>

      {dekontTx ? <DekontModal tx={dekontTx} onClose={() => setDekontTx(null)} /> : null}
      {reverseTx ? (
        <ReverseTxModal
          id={reverseTx.id}
          title={reverseTx.customerTitle}
          mode={isVoidWindowOpen(reverseTx.at) ? 'void' : 'refund'}
          onCancel={() => setReverseTx(null)}
          onConfirm={confirmReverse}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[10050] -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2.5 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ReverseTxModal({
  id,
  title,
  mode,
  onCancel,
  onConfirm,
}: {
  id: string;
  title: string;
  mode: 'void' | 'refund';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const asVoid = mode === 'void';

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 12, scale: 0.95 },
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
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <button
          type="button"
          aria-label="Kapat"
          onClick={onCancel}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
        >
          <XSm />
        </button>
        <div
          className={[
            'mb-3 flex justify-center',
            asVoid ? 'text-rose-500' : 'text-amber-600',
          ].join(' ')}
        >
          {asVoid ? <CancelIcon large /> : <RefundIcon large />}
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">
          {asVoid ? 'Hareketi iptal et?' : 'Hareketi iade et?'}
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{id}</span>
          <br />
          {title}
        </p>
        <p className="mt-2 text-center text-[12px] leading-snug text-[var(--panel-muted)]">
          {asVoid
            ? 'Aynı gün (gün sonu öncesi) işlemler iptal edilir; kart ekstresinde görünmez.'
            : 'Gün sonu geçmiş işlemler iade edilir; tutar kartına birkaç iş gününde yansır.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white',
              asVoid ? 'bg-rose-600' : 'bg-amber-600',
            ].join(' ')}
          >
            {asVoid ? 'İptal Et' : 'İade Et'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusBadge({ status }: { status: TxStatus }) {
  const map: Record<TxStatus, string> = {
    paid: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    refunded: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    failed: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  };
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        map[status],
      ].join(' ')}
    >
      {status === 'paid' ? <CheckMini /> : null}
      {TX_STATUS_LABEL[status].toLocaleUpperCase('tr')}
    </span>
  );
}

function IconBtn({
  title,
  bg,
  fg,
  onClick,
  children,
}: {
  title: string;
  bg: string;
  fg: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={[
        'flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition hover:scale-110 hover:shadow-md active:scale-95 dark:ring-white/10',
        bg,
        fg,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function PagerBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[var(--panel-line)] px-2.5 py-1 text-xs font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-brand-600)]" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 0113.7-5.6M20 12a8 8 0 01-13.7 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 4v4h-4M6 20v-4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CancelIcon({ large }: { large?: boolean }) {
  const s = large ? 36 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RefundIcon({ large }: { large?: boolean }) {
  const s = large ? 36 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2"
        y="7"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M22 12H16.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.5 9l-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h8l4 4v14H7V3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15 3v4h4M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V8z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 5h18v3H3V5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XSm() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
