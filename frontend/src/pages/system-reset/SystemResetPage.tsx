import gsap from 'gsap';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { usePermission } from '../../permissions/PermissionContext';
import { formatRowCount, type ResetTable } from './mockResetTables';

const PAGE_MIN = 5;
const PAGE_MAX = 50;

/**
 * Sistem Sıfırlama — yedek + tablo boşaltma (API).
 */
export default function SystemResetPage() {
  const { token } = useAuth();
  const { guard } = usePermission();
  const [tables, setTables] = useState<ResetTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeText, setPageSizeText] = useState('10');
  const [page, setPage] = useState(1);
  const [backedUpAt, setBackedUpAt] = useState<Date | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ResetTable | null>(null);
  const [needBackupHint, setNeedBackupHint] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const unlocked = !!backedUpAt && !!unlockToken;
  const showLockIcon = !unlocked && !unlocking;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.get<ResetTable[]>('/api/system-reset/tables', token);
      setTables(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tablolar yüklenemedi');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.module.toLocaleLowerCase('tr').includes(q) ||
        t.table.toLocaleLowerCase('tr').includes(q) ||
        (t.mysqlTable || '').toLocaleLowerCase('tr').includes(q),
    );
  }, [tables, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
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

  function breakLocksThenUnlock(doneAt: Date, tokenValue: string) {
    const locks = listRef.current
      ? Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-reset-lock]'))
      : [];

    if (locks.length === 0) {
      setUnlockToken(tokenValue);
      setBackedUpAt(doneAt);
      setUnlocking(false);
      setBackingUp(false);
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'pointer-events-none fixed inset-0 z-[9000]';
    document.body.appendChild(layer);

    const clones: HTMLElement[] = [];
    for (const el of locks) {
      const r = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-reset-lock');
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        color: getComputedStyle(el).color,
        zIndex: '9001',
      });
      layer.appendChild(clone);
      clones.push(clone);
    }

    setUnlocking(true);
    setBackingUp(false);

    const tl = gsap.timeline({
      onComplete: () => {
        layer.remove();
        setUnlockToken(tokenValue);
        setBackedUpAt(doneAt);
        setUnlocking(false);
      },
    });

    clones.forEach((c, i) => {
      const t = i * 0.13;
      tl.to(
        c,
        {
          rotate: -14,
          x: -2,
          duration: 0.05,
          yoyo: true,
          repeat: 5,
          ease: 'power1.inOut',
        },
        t,
      );
      tl.to(
        c,
        {
          y: 90 + Math.random() * 50,
          x: (Math.random() - 0.5) * 48,
          rotate: (Math.random() - 0.5) * 90,
          opacity: 0,
          duration: 0.52,
          ease: 'power3.in',
        },
        t + 0.32,
      );
    });
  }

  async function runBackup() {
    if (!guard('m-sistem', 'save', 'Sistem Sıfırlama')) return;
    if (!token || backingUp || unlocking) return;
    setBackingUp(true);
    setNeedBackupHint(false);
    setActionError(null);

    try {
      const res = await fetch('/api/system-reset/backup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        let msg = 'Yedek oluşturulamadı';
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const unlock = res.headers.get('X-Reset-Unlock-Token');
      if (!unlock) throw new Error('Yedek anahtarı alınamadı');

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const fileName = match?.[1] || `anypay-yedek-${Date.now()}.sql`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      const doneAt = new Date();
      if (backedUpAt) {
        setUnlockToken(unlock);
        setBackedUpAt(doneAt);
        setBackingUp(false);
        return;
      }
      breakLocksThenUnlock(doneAt, unlock);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Yedek başarısız');
      setBackingUp(false);
    }
  }

  function askDelete(row: ResetTable) {
    if (!guard('m-sistem', 'remove', 'Sistem Sıfırlama')) return;
    if (row.cleared || unlocking || clearing) return;
    if (!unlocked) {
      setNeedBackupHint(true);
      return;
    }
    setPendingDelete(row);
  }

  async function confirmDelete() {
    if (!pendingDelete || !token || !unlockToken) return;
    if (!guard('m-sistem', 'remove', 'Sistem Sıfırlama')) {
      setPendingDelete(null);
      return;
    }
    const target = pendingDelete;
    setPendingDelete(null);
    setClearing(true);
    setActionError(null);
    try {
      const updated = await api.post<ResetTable>(
        '/api/system-reset/clear',
        { moduleId: target.id, unlockToken },
        token,
      );
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setClearing(false);
    }
  }

  function exportCsv() {
    const header = 'Modül;Tablo;MySQL;Kayıt\n';
    const body = filtered
      .map(
        (t) =>
          `${t.module};${t.table};${t.mysqlTable || ''};${t.cleared ? 0 : t.rows}`,
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sistem-sifirlama.csv';
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function copyList() {
    const text = filtered
      .map((t) => `${t.module}\t${t.table}\t${t.cleared ? 0 : t.rows}`)
      .join('\n');
    void navigator.clipboard.writeText(text);
    setExportOpen(false);
  }

  const backupLabel = backedUpAt
    ? backedUpAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <nav className="mb-1 text-xs text-[var(--panel-muted)]">
            <Link to="/" className="hover:text-[var(--color-brand-600)]">
              Anasayfa
            </Link>
            <span className="mx-1.5">›</span>
            <span className="text-[var(--panel-ink)]">Sistem Sıfırlama</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--panel-ink)]">
            Sistem Sıfırlama
          </h1>
          <p className="mt-1 text-sm text-[var(--panel-muted)]">
            Modül verilerini temizlemeden önce yedek alın.
          </p>
        </div>

        <div
          className={[
            'reset-warn-card w-full max-w-[320px] rounded-2xl border px-4 py-3 sm:w-[300px]',
            unlocked
              ? 'reset-warn-card--ok border-emerald-500/40 bg-emerald-500/12'
              : needBackupHint
                ? 'reset-warn-card--hint border-amber-500/55 bg-amber-500/18'
                : 'reset-warn-card--pulse border-amber-500/40 bg-amber-500/12',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <span
              className={[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                unlocked ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/25 text-amber-700',
              ].join(' ')}
            >
              {unlocked ? <CheckIcon /> : <LockIcon />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--panel-ink)]">
                {unlocked
                  ? `Yedek alındı · ${backupLabel}`
                  : needBackupHint
                    ? 'Önce yedek alın'
                    : unlocking
                      ? 'Kilitler açılıyor…'
                      : 'Silme kilitli'}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--panel-muted)]">
                {unlocked
                  ? 'Silme açık (2 saat). İsterseniz yeniden yedekleyin.'
                  : unlocking
                    ? 'Satır kilitleri sırayla kırılıyor.'
                    : 'Silmeden önce veritabanını yedekleyin.'}
              </p>
            </div>
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

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] px-3 py-2.5 shadow-[var(--panel-shadow)] sm:gap-3 sm:px-4">
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--panel-muted)]">
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

        <div className="mx-0.5 hidden h-6 w-px bg-[var(--panel-line)] sm:block" />

        <button
          type="button"
          data-km-jump
          disabled={backingUp || unlocking}
          onClick={() => void runBackup()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--color-brand-600)] px-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
        >
          {backingUp ? <Spinner /> : <BackupIcon />}
          <span className="hidden xs:inline sm:inline">
            {backingUp
              ? 'Yedekleniyor…'
              : unlocked || unlocking
                ? 'Yeniden yedekle'
                : 'Veritabanını yedekle'}
          </span>
          <span className="sm:hidden">
            {backingUp ? '…' : unlocked || unlocking ? 'Yedekle' : 'Yedekle'}
          </span>
        </button>

        <div ref={exportRef} className="relative">
          <button
            type="button"
            data-km-jump
            onClick={() => setExportOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 text-sm font-semibold text-[var(--panel-ink)] transition hover:bg-[var(--panel-hover)]"
          >
            <ExportIcon />
            <span className="hidden sm:inline">Dışa Aktar</span>
            <Chevron open={exportOpen} />
          </button>
          {exportOpen ? (
            <div className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[160px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[var(--panel-shadow)] sm:left-auto sm:right-0">
              {[
                { label: 'Yazdır', fn: () => window.print() },
                { label: 'Csv', fn: exportCsv },
                { label: 'Excel', fn: exportCsv },
                { label: 'Pdf', fn: () => window.print() },
                { label: 'Kopyala', fn: copyList },
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

        <div className="relative ml-auto min-w-[10rem] flex-1 sm:max-w-xs sm:flex-none">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-muted)]">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara…"
            className="h-9 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] py-2 pl-9 pr-3 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
          />
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-[var(--panel-shadow)]">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5.5rem_40px] gap-2 border-b border-[var(--panel-line)] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
            <span>Modül</span>
            <span>Tablo</span>
            <span className="text-right">İşlem</span>
            <span className="flex justify-end">
              {totalPages > 1 ? (
                <button
                  type="button"
                  data-km-page
                  aria-label="Sonraki sayfa"
                  title="Sonraki sayfa"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-30"
                >
                  <ChevronRightIcon />
                </button>
              ) : null}
            </span>
          </div>

          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--panel-muted)]">Yükleniyor…</p>
          ) : slice.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[var(--panel-muted)]">Eşleşen tablo yok.</p>
          ) : (
            <ul ref={listRef}>
              {slice.map((row, i) => (
                <li
                  key={row.id}
                  data-km-row
                  style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                  className={[
                    'panel-row-in grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5.5rem_40px] items-center gap-2 border-b border-[var(--panel-line)] px-4 py-3 transition last:border-b-0',
                    row.cleared ? 'opacity-55' : 'hover:bg-[var(--panel-hover)]/50',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--panel-ink)]">
                      {row.module}
                    </p>
                    <p className="text-[11px] tabular-nums text-[var(--panel-muted)]">
                      {row.cleared ? 'Boş' : `${formatRowCount(row.rows)} kayıt`}
                    </p>
                  </div>
                  <code className="truncate text-[12px] text-[var(--panel-muted)]">
                    {row.mysqlTable || row.table}
                  </code>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={row.cleared || unlocking || clearing}
                      title={
                        row.cleared
                          ? 'Zaten temiz'
                          : unlocked
                            ? 'Verileri sil'
                            : 'Önce yedek alın'
                      }
                      onClick={() => askDelete(row)}
                      className={[
                        'inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                        unlocked && !row.cleared
                          ? 'text-rose-600 hover:bg-rose-500/10'
                          : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)]',
                      ].join(' ')}
                    >
                      {showLockIcon ? (
                        <span data-reset-lock className="inline-flex text-amber-600">
                          <LockIcon small />
                        </span>
                      ) : unlocking && !row.cleared ? (
                        <span className="inline-block w-[13px]" aria-hidden />
                      ) : (
                        <TrashIcon />
                      )}
                      Sil
                    </button>
                  </div>
                  <span />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--panel-muted)]">
        <p>
          {(safePage - 1) * pageSize + (slice.length ? 1 : 0)} ile{' '}
          {Math.min(safePage * pageSize, filtered.length)} arasında veri gösteriliyor. Toplam:{' '}
          {filtered.length}
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

      {pendingDelete ? (
        <ConfirmDeleteModal
          module={pendingDelete.module}
          table={pendingDelete.mysqlTable || pendingDelete.table}
          busy={clearing}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
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

function ConfirmDeleteModal({
  module,
  table,
  busy,
  onCancel,
  onConfirm,
}: {
  module: string;
  table: string;
  busy?: boolean;
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
          disabled={busy}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)] disabled:opacity-40"
        >
          ×
        </button>
        <div className="mb-3 flex justify-center text-rose-500">
          <TrashIcon large />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">Verileri sil?</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          <span className="font-semibold text-[var(--panel-ink)]">{module}</span>
          <br />
          <code className="text-xs">{table}</code> tablosu boşaltılacak. Geri alınamaz.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            data-km-jump
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            Vazgeç
          </button>
          <button
            type="button"
            data-km-jump
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BackupIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M5 17.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ small }: { small?: boolean }) {
  const s = small ? 13 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12 5 5L20 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 14;
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

function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
