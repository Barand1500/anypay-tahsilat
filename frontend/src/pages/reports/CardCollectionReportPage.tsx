import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { MonthMultiSelect } from '../../components/ui/MonthMultiSelect';
import { api } from '../../lib/api';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import { formatMoneyTr } from './collectionReportTypes';
import { defaultStatYears } from './statisticsTypes';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

type CardCollectionRow = {
  id: string;
  bankId: string;
  bankName: string;
  bankLogo: string;
  count: number;
  total: number;
};

type ApiCardCollection = {
  rows: CardCollectionRow[];
  totalCount: number;
  filters: {
    branches: { value: string; label: string }[];
    users: { value: string; label: string }[];
    years: { value: string; label: string }[];
  };
};

function avgOf(row: CardCollectionRow) {
  return row.count > 0 ? row.total / row.count : 0;
}

function currentMonthStr() {
  return String(new Date().getMonth() + 1);
}

function currentYearStr() {
  return String(new Date().getFullYear());
}

export default function CardCollectionReportPage() {
  const { token } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('kart-tahsilat'));
  const [branch, setBranch] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(() => currentYearStr());
  const [months, setMonths] = useState<string[]>(() => [currentMonthStr()]);
  const [fullYear, setFullYear] = useState(false);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const [rows, setRows] = useState<CardCollectionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [yearOptions, setYearOptions] = useState(() => defaultStatYears());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('year', year || currentYearStr());
      if (!fullYear && months.length) qs.set('months', months.join(','));
      if (branch) qs.set('branchId', branch);
      if (userId) qs.set('userId', userId);
      const data = await api.get<ApiCardCollection>(
        `/api/reports/card-collection?${qs.toString()}`,
        token,
      );
      setRows(data.rows ?? []);
      setTotalCount(data.totalCount ?? data.rows?.length ?? 0);
      if (data.filters?.branches?.length) setBranchOptions(data.filters.branches);
      if (data.filters?.users?.length) setUserOptions(data.filters.users);
      if (data.filters?.years?.length) setYearOptions(data.filters.years);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kart tahsilat raporu yüklenemedi');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [token, year, months, fullYear, branch, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => r.bankName.toLocaleLowerCase('tr').includes(q));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, branch, userId, year, months, fullYear]);

  const filtersActive =
    !!branch ||
    !!userId ||
    year !== currentYearStr() ||
    months.join(',') !== currentMonthStr() ||
    fullYear ||
    !!query.trim();

  function resetFilters() {
    setBranch(null);
    setUserId(null);
    setYear(currentYearStr());
    setMonths([currentMonthStr()]);
    setFullYear(false);
    setQuery('');
  }

  function showFullYear() {
    setFullYear(true);
    setMonths([]);
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
    const header = 'Banka;Tahsilat Adedi;Toplam Tutar;Ortalama Tutar\n';
    const body = filtered
      .map(
        (r) =>
          `${r.bankName};${r.count};${formatMoneyTr(r.total)};${formatMoneyTr(avgOf(r))}`,
      )
      .join('\n');
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'musteri-karti-tahsilat-raporu.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('CSV indirildi');
  }

  function copyList() {
    const text = filtered
      .map(
        (r) =>
          `${r.bankName}\t${r.count}\t${formatMoneyTr(r.total)}\t${formatMoneyTr(avgOf(r))}`,
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-km-jump
              onClick={showFullYear}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
                fullYear
                  ? 'bg-[var(--color-brand-600)] text-white'
                  : 'border border-[var(--panel-line)] bg-[var(--panel-surface)] text-[var(--panel-ink)] hover:border-[var(--color-brand-500)]/50',
              ].join(' ')}
            >
              <CalendarIcon />
              Tüm Yılı Göster
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
              <FloatingSearchSelect
                label="Yıl Seçin"
                options={yearOptions}
                value={year}
                onChange={setYear}
                placeholder="Yıl seçiniz."
                kmJump
              />
              <MonthMultiSelect
                label="Ay Seçin"
                value={months}
                onChange={(v) => {
                  setMonths(v);
                  if (v.length) setFullYear(false);
                }}
                disabled={fullYear}
                placeholder="Bir veya daha fazla ay…"
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
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(0,2fr)_1fr_1.2fr_1.2fr] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>Banka</span>
              <span className="text-right">Tahsilat adedi</span>
              <span className="text-right">Toplam tutar</span>
              <span className="text-right">Ortalama tutar</span>
            </div>

            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Kayıt bulunamadı.</p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[minmax(0,2fr)_1fr_1.2fr_1.2fr] gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 text-sm transition hover:bg-[var(--panel-hover)]/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {r.bankLogo ? (
                      <img
                        src={r.bankLogo}
                        alt=""
                        className="h-8 w-14 shrink-0 rounded-md object-contain bg-white/90 p-1 dark:bg-white/10"
                      />
                    ) : (
                      <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--panel-surface)] text-[10px] font-bold text-[var(--panel-muted)]">
                        —
                      </span>
                    )}
                    <span className="truncate font-medium text-[var(--panel-ink)]">{r.bankName}</span>
                  </div>
                  <span className="text-right tabular-nums text-[var(--panel-ink)]">{r.count}</span>
                  <span className="text-right font-semibold tabular-nums text-[var(--panel-ink)]">
                    {formatMoneyTr(r.total)} ₺
                  </span>
                  <span className="text-right tabular-nums text-[var(--panel-muted)]">
                    {formatMoneyTr(avgOf(r))} ₺
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm text-[var(--panel-muted)]">
          <p>
            {loading
              ? 'Yükleniyor…'
              : filtered.length === 0
                ? '0 kayıt'
                : `${fromIdx} ile ${toIdx} arasında veri gösteriliyor. Toplam: `}
            {!loading && filtered.length > 0 ? (
              <>
                <strong className="text-[var(--panel-ink)]">{filtered.length}</strong>
                {query.trim() ? <> (Filtrelenmemiş toplam: {totalCount})</> : null}
              </>
            ) : null}
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

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[10050] -translate-x-1/2 rounded-xl bg-[var(--panel-ink)] px-4 py-2.5 text-sm font-medium text-[var(--panel-elevated)] shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      <path
        d="M4 5v5h5M20 19v-5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
