import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { DateField } from '../../components/ui/DateField';
import { ExportDropdown } from '../../components/ui/ExportDropdown';
import { FloatingSearchSelect } from '../../components/ui/FloatingSearchSelect';
import { api } from '../../lib/api';
import { getDefaultFiltersOpen } from '../settings/defaultsStore';
import {
  formatSendDate,
  SEND_TYPE_LABEL,
  SEND_TYPE_OPTIONS,
  type SendHistoryRow,
  type SendType,
} from './sendHistoryTypes';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

type ApiSendHistory = {
  rows: SendHistoryRow[];
  totalCount: number;
  filters: {
    customers: { value: string; label: string }[];
  };
};

export default function SendHistoryPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<SendHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [customerOptions, setCustomerOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => getDefaultFiltersOpen('gonderim-gecmisi'));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sendType, setSendType] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      if (sendType) qs.set('type', sendType);
      if (customerId) qs.set('customerId', customerId);
      if (query.trim()) qs.set('q', query.trim());
      const data = await api.get<ApiSendHistory>(
        `/api/reports/send-history?${qs.toString()}`,
        token,
      );
      setRows(data.rows ?? []);
      setTotalCount(data.totalCount ?? data.rows?.length ?? 0);
      if (data.filters?.customers?.length) setCustomerOptions(data.filters.customers);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gönderim geçmişi yüklenemedi');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [token, dateFrom, dateTo, sendType, customerId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromIdx = rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toIdx = Math.min(safePage * pageSize, rows.length);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, sendType, customerId, dateFrom, dateTo]);

  const filtersActive =
    !!dateFrom || !!dateTo || !!sendType || !!customerId || !!query.trim();

  function resetFilters() {
    setDateFrom('');
    setDateTo('');
    setSendType(null);
    setCustomerId(null);
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
    const header = 'ID;Müşteri;Gönderim Tipi;Alıcı;İçerik;Gönderim Tarihi\n';
    const body = rows
      .map(
        (r) =>
          `${r.id};${r.customerTitle};${SEND_TYPE_LABEL[r.type]};${r.recipient};"${r.content.replace(/"/g, '""').replace(/\n/g, ' ')}";${formatSendDate(r.sentAt)}`,
      )
      .join('\n');
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gonderim-gecmisi.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    flash('CSV indirildi');
  }

  function copyList() {
    const text = rows
      .map(
        (r) =>
          `${r.id}\t${r.customerTitle}\t${SEND_TYPE_LABEL[r.type]}\t${r.recipient}\t${r.content.replace(/\n/g, ' ')}\t${formatSendDate(r.sentAt)}`,
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DateField label="Başlangıç Tarihi" value={dateFrom} onChange={setDateFrom} kmJump />
              <DateField label="Bitiş Tarihi" value={dateTo} onChange={setDateTo} kmJump />
              <FloatingSearchSelect
                label="Gönderim Tipi"
                options={[...SEND_TYPE_OPTIONS]}
                value={sendType}
                onChange={setSendType}
                placeholder="Tip seçiniz."
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
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[56px_minmax(160px,1.2fr)_100px_minmax(140px,1fr)_minmax(220px,1.6fr)_150px] gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-ink)]/50">
              <span>ID</span>
              <span>Müşteri</span>
              <span>Gönderim tipi</span>
              <span>Alıcı</span>
              <span>İçerik</span>
              <span>Gönderim tarihi</span>
            </div>

            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
            ) : slice.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--panel-muted)]">
                Kayıt bulunamadı. Yeni e-posta gönderimleri burada listelenir.
              </p>
            ) : (
              slice.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[56px_minmax(160px,1.2fr)_100px_minmax(140px,1fr)_minmax(220px,1.6fr)_150px] items-start gap-3 border-b border-[var(--panel-line)] px-5 py-3.5 text-sm transition hover:bg-[var(--panel-hover)]/50"
                >
                  <span className="tabular-nums text-[var(--panel-muted)]">{r.id}</span>
                  <span className="min-w-0 truncate font-medium text-[var(--panel-ink)]" title={r.customerTitle}>
                    {r.customerTitle}
                  </span>
                  <span>
                    <TypeBadge type={r.type} />
                  </span>
                  <span className="min-w-0 break-all text-[var(--panel-ink)]">{r.recipient}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-[12px] leading-snug text-[var(--panel-muted)]">
                    {r.content}
                  </span>
                  <span className="tabular-nums text-[12px] text-[var(--panel-ink)]">
                    {formatSendDate(r.sentAt)}
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
              : rows.length === 0
                ? '0 kayıt'
                : `${fromIdx} ile ${toIdx} arasında veri gösteriliyor. Toplam: `}
            {!loading && rows.length > 0 ? (
              <strong className="text-[var(--panel-ink)]">{totalCount}</strong>
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

function TypeBadge({ type }: { type: SendType }) {
  const email = type === 'email';
  return (
    <span
      className={[
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold',
        email
          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400'
          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      ].join(' ')}
    >
      {SEND_TYPE_LABEL[type]}
    </span>
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
