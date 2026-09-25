import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { DateField } from '../../components/ui/DateField';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { StatCard } from '../../components/widgets/StatCard';
import { api } from '../../lib/api';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import {
  defaultMonthRange,
  formatDateTr,
  formatMoneyTr, formatMoneyDisplay,
  netOf,
  REPORT_TYPE_OPTIONS,
  type CollectionRow,
} from './collectionReportTypes';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

type ApiCollection = {
  rows: CollectionRow[];
  totals: { amount: number; commission: number; net: number };
  filters: {
    branches: { value: string; label: string }[];
    users: { value: string; label: string }[];
    banks: { value: string; label: string }[];
  };
};

export default function CollectionReportPage() {
  const { token } = useAuth();
  const monthDefaults = useMemo(() => defaultMonthRange(), []);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [totals, setTotals] = useState({ amount: 0, commission: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('tahsilat-raporu'));
  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(monthDefaults.from);
  const [dateTo, setDateTo] = useState(monthDefaults.to);
  const [bankId, setBankId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<string | null>('detay');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [bankOptions, setBankOptions] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      if (branch) qs.set('branchId', branch);
      if (userId) qs.set('userId', userId);
      if (bankId) qs.set('bankId', bankId);
      if (reportType) qs.set('reportType', reportType);
      const data = await api.get<ApiCollection>(`/api/reports/collection?${qs.toString()}`, token);
      setRows(data.rows ?? []);
      setTotals(data.totals ?? { amount: 0, commission: 0, net: 0 });
      if (data.filters?.branches?.length) setBranchOptions(data.filters.branches);
      if (data.filters?.users?.length) setUserOptions(data.filters.users);
      if (data.filters?.banks?.length) setBankOptions(data.filters.banks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tahsilat raporu yüklenemedi');
      setRows([]);
      setTotals({ amount: 0, commission: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  }, [token, dateFrom, dateTo, branch, userId, bankId, reportType]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.bankName} ${r.userName} ${r.branch} ${formatMoneyTr(r.amount)}`.toLocaleLowerCase(
        'tr',
      );
      return hay.includes(q);
    });
  }, [rows, query]);

  const displayTotals = useMemo(() => {
    if (!query.trim()) return totals;
    const amount = filtered.reduce((s, r) => s + r.amount, 0);
    const commission = filtered.reduce((s, r) => s + r.commission, 0);
    return { amount, commission, net: amount - commission };
  }, [filtered, query, totals]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, branch, userId, bankId, dateFrom, dateTo, reportType]);

  const filtersActive =
    !!branch ||
    !!userId ||
    !!bankId ||
    dateFrom !== monthDefaults.from ||
    dateTo !== monthDefaults.to ||
    reportType !== 'detay' ||
    !!query.trim();

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setDateFrom(monthDefaults.from);
    setDateTo(monthDefaults.to);
    setBankId(null);
    setReportType('detay');
    setQuery('');
  }

  function applyPageSize(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < PAGE_MIN) {
      setPageSizeText(String(pageSize));
      return;
    }
    const clamped = Math.min(PAGE_MAX, Math.max(PAGE_MIN, n));
    setPageSize(clamped);
    setPageSizeText(String(clamped));
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function exportCsv() {
    const header = 'Ödeme Tarihi;Tahsilat Tarihi;Banka;Tutar;Komisyon;Net\n';
    const body = filtered
      .map(
        (r) =>
          `${formatDateTr(r.paymentDate)};${formatDateTr(r.collectionDate)};${r.bankName};${formatMoneyTr(r.amount)};${formatMoneyTr(r.commission)};${formatMoneyTr(netOf(r))}`,
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tahsilat-raporu-${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash('CSV indirildi');
  }

  function copyList() {
    const text = filtered
      .map(
        (r) =>
          `${formatDateTr(r.paymentDate)}\t${formatDateTr(r.collectionDate)}\t${r.bankName}\t${formatMoneyTr(r.amount)}\t${formatMoneyTr(r.commission)}\t${formatMoneyTr(netOf(r))}`,
      )
      .join('\n');
    void navigator.clipboard.writeText(text);
    flash('Liste panoya kopyalandı');
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)] [--input-notch:var(--panel-elevated)]">
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
              className={['ml-0.5 text-[var(--panel-muted)] transition', filtersOpen ? 'rotate-180' : ''].join(
                ' ',
              )}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FloatingSearchSelect
                label="Şube/Departman"
                options={branchOptions}
                value={branch}
                onChange={setBranch}
                placeholder="Şube seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Kullanıcı"
                options={userOptions}
                value={userId}
                onChange={setUserId}
                placeholder="Kullanıcı seçiniz."
                kmJump
              />
              <DateField label="Başlangıç Tarihi" value={dateFrom} onChange={setDateFrom} kmJump />
              <DateField label="Bitiş Tarihi" value={dateTo} onChange={setDateTo} kmJump />
              <FloatingSearchSelect
                label="Banka"
                options={bankOptions}
                value={bankId}
                onChange={setBankId}
                placeholder="Banka seçiniz."
                kmJump
              />
              <FloatingSearchSelect
                label="Rapor"
                options={[...REPORT_TYPE_OPTIONS]}
                value={reportType}
                onChange={setReportType}
                placeholder="Rapor tipi"
                kmJump
              />
            </div>
          </div>
        ) : null}
      </section>

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title="Toplam tutar"
          value={`${formatMoneyDisplay(displayTotals.amount)}`}
          meta="Filtrelenen kayıtlar"
          tone="blue"
        />
        <StatCard
          title="Toplam komisyon"
          value={`${formatMoneyDisplay(displayTotals.commission)}`}
          meta="Banka komisyonları"
          tone="orange"
        />
        <StatCard
          title="Toplam net tutar"
          value={`${formatMoneyDisplay(displayTotals.net)}`}
          meta="Tutar − komisyon"
          tone="green"
        />
      </div>

      <section className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-line)] px-4 py-3 sm:px-5">
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
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[1fr_1fr_1.4fr_1fr_1.1fr_1fr] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Ödeme tarihi</span>
              <span>Tahsilat tarihi</span>
              <span>Banka</span>
              <span className="text-right">Tutar</span>
              <span className="text-right">Banka komisyonu</span>
              <span className="text-right">Net tutar</span>
            </div>

            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Kayıt bulunamadı.</p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_1fr_1.4fr_1fr_1.1fr_1fr] gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 text-sm transition hover:bg-[var(--panel-hover)]/50"
                >
                  <span className="tabular-nums text-[var(--panel-ink)]">{formatDateTr(r.paymentDate)}</span>
                  <span className="tabular-nums text-[var(--panel-ink)]">
                    {formatDateTr(r.collectionDate)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-[var(--panel-ink)]">
                    {r.bankLogo ? (
                      <img src={r.bankLogo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                    ) : null}
                    <span className="truncate font-medium">{r.bankName}</span>
                  </span>
                  <span className="text-right tabular-nums font-semibold text-[var(--panel-ink)]">
                    {formatMoneyDisplay(r.amount)}
                  </span>
                  <span className="text-right tabular-nums text-[var(--panel-muted)]">
                    {formatMoneyDisplay(r.commission)}
                  </span>
                  <span className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoneyDisplay(netOf(r))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-[var(--panel-muted)] sm:px-5">
          <span>
            {filtered.length === 0
              ? '0 kayıt'
              : `${fromIdx}–${toIdx} / ${filtered.length} kayıt`}
          </span>
          <div className="flex items-center gap-1">
            <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹
            </PagerBtn>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <PagerBtn
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </PagerBtn>
          </div>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
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
      className="flex size-8 items-center justify-center rounded-lg border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0113.66-5.66M20 12a8 8 0 01-13.66 5.66"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 5v5h5M20 19v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
