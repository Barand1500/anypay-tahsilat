import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { api } from '../../lib/api';
import { usePermission } from '../../permissions/PermissionContext';
import {
  daysAgo,
  formatLogDate,
  initialsOf,
  LOG_KIND_LABEL,
  type AppLog,
  type LogActionKind,
} from './mockLogs';
import { LogThanosSnap } from './LogThanosSnap';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

type KindFilter = 'all' | LogActionKind;
type DeleteScope = 'day' | 'week' | 'month' | 'all' | 'range';

const KIND_CHIPS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'login', label: 'Giriş' },
  { id: 'logout', label: 'Çıkış' },
  { id: 'create', label: 'Ekleme' },
  { id: 'update', label: 'Güncelleme' },
  { id: 'delete', label: 'Silme' },
  { id: 'export', label: 'Dışa aktar' },
];

/**
 * Log Kayıtları — log tablosu (API).
 */
export default function LogsPage() {
  const { token } = useAuth();
  const { guard } = usePermission();
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [queryDebounced, setQueryDebounced] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteScope | null>(null);
  const [snapIds, setSnapIds] = useState<string[] | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQueryDebounced(query.trim()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (kind !== 'all') qs.set('kind', kind);
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      if (queryDebounced) qs.set('q', queryDebounced);
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      const data = await api.get<{ items: AppLog[]; total: number }>(
        `/api/logs?${qs.toString()}`,
        token,
      );
      setLogs(data.items);
      setTotal(data.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Loglar yüklenemedi');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, kind, dateFrom, dateTo, queryDebounced, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [queryDebounced, pageSize, kind, dateFrom, dateTo]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
      if (!deleteRef.current?.contains(e.target as Node)) setDeleteOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

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
    setKind('all');
    setDateFrom('');
    setDateTo('');
    setQuery('');
  }

  async function exportCsv() {
    if (!token) return;
    setExportOpen(false);
    try {
      const qs = new URLSearchParams();
      if (kind !== 'all') qs.set('kind', kind);
      if (dateFrom) qs.set('from', dateFrom);
      if (dateTo) qs.set('to', dateTo);
      if (queryDebounced) qs.set('q', queryDebounced);
      qs.set('page', '1');
      qs.set('pageSize', '50');
      const data = await api.get<{ items: AppLog[]; total: number }>(
        `/api/logs?${qs.toString()}`,
        token,
      );
      const header = 'Kullanıcı;E-posta;Tarih;Tür;İşlem;Detay\n';
      const body = data.items
        .map(
          (l) =>
            `${l.userName};${l.userEmail};${formatLogDate(l.at)};${LOG_KIND_LABEL[l.kind]};${l.actionLabel};${l.detail}`,
        )
        .join('\n');
      const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'log-kayitlari.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Dışa aktarma başarısız');
    }
  }

  function askDelete(scope: DeleteScope) {
    if (!guard('m-log', 'remove', 'Log Kayıtları')) return;
    setDeleteOpen(false);
    if (scope === 'range' && (!rangeFrom || !rangeTo)) {
      setDeleteConfirm('range');
      return;
    }
    setDeleteConfirm(scope);
  }

  async function confirmDelete() {
    if (!deleteConfirm || !token) return;
    if (!guard('m-log', 'remove', 'Log Kayıtları')) {
      setDeleteConfirm(null);
      return;
    }
    const scope = deleteConfirm;
    setDeleteConfirm(null);
    setActionError(null);
    try {
      const result = await api.delete<{ deleted: number; ids: number[] }>(
        '/api/logs',
        token,
        {
          scope,
          from: scope === 'range' ? rangeFrom : undefined,
          to: scope === 'range' ? rangeTo : undefined,
        },
      );
      setRangeFrom('');
      setRangeTo('');
      if (!result.ids.length) {
        await load();
        return;
      }
      const idStrs = result.ids.map(String);
      const visibleHit = idStrs.some((id) =>
        document.querySelector(`[data-log-id="${CSS.escape(id)}"]`),
      );
      if (!visibleHit) {
        await load();
        return;
      }
      setSnapIds(idStrs);
      setSnapping(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  function finishSnap() {
    setSnapIds(null);
    setSnapping(false);
    void load();
  }

  const filtersActive = kind !== 'all' || !!dateFrom || !!dateTo || !!query.trim();
  const slice = logs;
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-[var(--panel-muted)]">
            <Link to="/" className="hover:text-[var(--color-brand-600)]">
              Anasayfa
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-[var(--panel-ink)]">Log Kayıtları</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">Log Kayıtları</h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Paneldeki kritik işlemlerin iz kaydı.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div ref={deleteRef} className="relative">
            <button
              type="button"
              data-km-jump
              disabled={snapping}
              onClick={() => {
                if (!guard('m-log', 'remove', 'Log Kayıtları')) return;
                setDeleteOpen((v) => !v);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/15 disabled:opacity-50"
            >
              <TrashIcon />
              Kayıtları Sil
              <Chevron open={deleteOpen} />
            </button>
            {deleteOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[220px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)]">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                  Silme kapsamı
                </p>
                <DeleteMenuItem
                  label="Son 1 gün"
                  hint="Son 24 saatin kayıtları"
                  onClick={() => askDelete('day')}
                />
                <DeleteMenuItem
                  label="Son 1 hafta"
                  hint="Son 7 günün kayıtları"
                  onClick={() => askDelete('week')}
                />
                <DeleteMenuItem
                  label="Son 1 ay"
                  hint="Son 30 günün kayıtları"
                  onClick={() => askDelete('month')}
                />
                <DeleteMenuItem
                  label="Tarih aralığı…"
                  hint="Başlangıç / bitiş seç"
                  onClick={() => askDelete('range')}
                />
                <div className="my-1 h-px bg-[var(--panel-line)]" />
                <DeleteMenuItem
                  label="Tümünü sil"
                  hint="Geri alınamaz"
                  danger
                  onClick={() => askDelete('all')}
                />
              </div>
            ) : null}
          </div>

          <div ref={exportRef} className="relative">
            <button
              type="button"
              data-km-jump
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
            >
              <ExportIcon />
              Dışa Aktar
              <Chevron open={exportOpen} />
            </button>
            {exportOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)]">
                {[
                  { label: 'Yazdır', fn: () => window.print() },
                  { label: 'Csv', fn: () => void exportCsv() },
                  { label: 'Excel', fn: () => void exportCsv() },
                  {
                    label: 'Kopyala',
                    fn: () => {
                      void navigator.clipboard.writeText(
                        logs
                          .map((l) => `${formatLogDate(l.at)}\t${l.userName}\t${l.detail}`)
                          .join('\n'),
                      );
                      setExportOpen(false);
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.fn();
                      setExportOpen(false);
                    }}
                    className="flex w-full px-3 py-2 text-left text-sm text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {loadError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Yeniden dene
          </button>
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-center gap-2 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-2.5 py-2 shadow-[var(--panel-shadow)] sm:grid-cols-[auto_1fr_auto]">
        <label className="flex shrink-0 items-center gap-2 px-1 text-sm text-[var(--panel-muted)]">
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
            className="w-10 border-0 border-b-2 border-[var(--panel-line)] bg-transparent px-0.5 py-0.5 text-center text-sm font-semibold tabular-nums text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
          veri göster
        </label>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {KIND_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-km-jump
              onClick={() => setKind(c.id)}
              className={[
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                kind === c.id
                  ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                  : 'bg-[var(--panel-surface)] text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
              ].join(' ')}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => {
              setDateFrom(f);
              setDateTo(t);
            }}
          />
          <div className="relative w-[160px] sm:w-[180px]">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
              <SearchIcon />
            </span>
            <input
              data-km-jump
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara…"
              className="h-9 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-0 pl-8 pr-2 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
            />
          </div>
          {filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-500/10"
            >
              Sıfırla
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="hidden grid-cols-[minmax(160px,1.1fr)_140px_minmax(0,2fr)] gap-3 border-b border-[var(--panel-line)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)] sm:grid">
          <span>Kullanıcı</span>
          <span>Tarih</span>
          <span>Yapılan işlem</span>
        </div>

        {loading ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
        ) : slice.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--panel-muted)]">
            Filtreye uyan kayıt yok.
          </p>
        ) : (
          <ul>
            {slice.map((l, i) => (
              <li
                key={l.id}
                data-log-id={String(l.id)}
                data-km-row
                tabIndex={-1}
                style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                className="modules-row-in grid grid-cols-1 gap-2 border-b border-[var(--panel-line)] px-4 py-3.5 transition last:border-b-0 hover:bg-[var(--panel-hover)]/50 sm:grid-cols-[minmax(160px,1.1fr)_140px_minmax(0,2fr)] sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                    {initialsOf(l.userName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--panel-ink)]">{l.userName}</p>
                    <p className="truncate text-xs text-[var(--panel-muted)]">{l.userEmail}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm tabular-nums text-[var(--panel-ink)]">{formatLogDate(l.at)}</p>
                  <p className="text-[11px] text-[var(--panel-muted)]">{daysAgo(l.at)}</p>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`log-chip log-chip--${l.kind}`}>{LOG_KIND_LABEL[l.kind]}</span>
                    <span className="text-xs font-medium text-[var(--panel-muted)]">{l.actionLabel}</span>
                  </div>
                  <p className="text-sm leading-snug text-[var(--panel-ink)]">{l.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--panel-muted)]">
        <p>
          {rangeStart} ile {rangeEnd} arasında. Toplam: {total}
        </p>
        <div className="flex flex-wrap gap-1">
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
            İlk
          </PagerBtn>
          <PagerBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Geri
          </PagerBtn>
          <PagerBtn active onClick={() => undefined}>
            {safePage}
          </PagerBtn>
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

      {deleteConfirm ? (
        <DeleteLogsModal
          scope={deleteConfirm}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          onRangeFrom={setRangeFrom}
          onRangeTo={setRangeTo}
          onCancel={() => {
            setDeleteConfirm(null);
            setRangeFrom('');
            setRangeTo('');
          }}
          onConfirm={() => void confirmDelete()}
          canConfirm={
            !snapping &&
            (deleteConfirm !== 'range' || (!!rangeFrom && !!rangeTo && rangeFrom <= rangeTo))
          }
        />
      ) : null}

      {snapping && snapIds ? (
        <LogThanosSnap targetIds={snapIds} onDone={finishSnap} />
      ) : null}
    </div>
  );
}

function DeleteMenuItem({
  label,
  hint,
  onClick,
  danger,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full flex-col px-3 py-2 text-left transition hover:bg-[var(--panel-hover)]',
        danger ? 'text-rose-600' : 'text-[var(--panel-ink)]',
      ].join(' ')}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] text-[var(--panel-muted)]">{hint}</span>
    </button>
  );
}

function DeleteLogsModal({
  scope,
  rangeFrom,
  rangeTo,
  onRangeFrom,
  onRangeTo,
  onCancel,
  onConfirm,
  canConfirm,
}: {
  scope: DeleteScope;
  rangeFrom: string;
  rangeTo: string;
  onRangeFrom: (v: string) => void;
  onRangeTo: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
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

  const title =
    scope === 'day'
      ? 'Son 1 günü sil?'
      : scope === 'week'
        ? 'Son 1 haftayı sil?'
        : scope === 'month'
          ? 'Son 1 ayı sil?'
          : scope === 'all'
            ? 'Tüm kayıtları sil?'
            : 'Tarih aralığını sil?';

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="alertdialog"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <div className="mb-3 flex justify-center text-rose-500">
          <TrashIcon large />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">{title}</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          Bu işlem geri alınamaz. Seçilen kapsamdaki loglar silinir.
        </p>
        {scope === 'range' ? (
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-xs text-[var(--panel-muted)]">
              Başlangıç
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => onRangeFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
            </label>
            <label className="text-xs text-[var(--panel-muted)]">
              Bitiş
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => onRangeTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
            </label>
          </div>
        ) : null}
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
            disabled={!canConfirm}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Sil
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PagerBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-km-page
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-40',
        active
          ? 'bg-[var(--color-brand-600)] text-white'
          : 'border border-[var(--panel-line)] bg-[var(--panel-elevated)] text-[var(--panel-ink)] hover:bg-[var(--panel-hover)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={open ? 'rotate-180' : ''}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
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
