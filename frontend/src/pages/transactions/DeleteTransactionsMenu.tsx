import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CanRemove } from '../../permissions/CanRemove';
import { usePermission } from '../../permissions/PermissionContext';
import { api } from '../../lib/api';
import { formatMoneyTr } from './transactionTypes';

type Scope = 'day' | 'day2' | 'week' | 'month' | 'range' | 'all';

type Preview = { count: number; paid: number; paidAmount: number };

const MENU: { scope: Scope; label: string; hint: string; danger?: boolean }[] = [
  { scope: 'day', label: 'Son 1 gün', hint: 'Son 24 saatin hareketleri' },
  { scope: 'day2', label: 'Son 2 gün', hint: 'Son 48 saatin hareketleri' },
  { scope: 'week', label: 'Son 1 hafta', hint: 'Son 7 günün hareketleri' },
  { scope: 'month', label: 'Son 1 ay', hint: 'Son 30 günün hareketleri' },
  { scope: 'range', label: 'Tarih aralığı…', hint: 'Başlangıç / bitiş seç' },
  { scope: 'all', label: 'Tümünü sil', hint: 'Geri alınamaz', danger: true },
];

const TITLE: Record<Scope, string> = {
  day: 'Son 1 günün hareketlerini sil?',
  day2: 'Son 2 günün hareketlerini sil?',
  week: 'Son 1 haftanın hareketlerini sil?',
  month: 'Son 1 ayın hareketlerini sil?',
  range: 'Tarih aralığındaki hareketleri sil?',
  all: 'Tüm hareketleri sil?',
};

type Props = {
  token: string | null;
  /** Silme bitince listeyi yenile + bilgi mesajı göster */
  onDeleted: (message: string) => void;
};

/**
 * Hareketler › Dışa Aktar yanındaki küçük silme (çöp kutusu) menüsü.
 * Log Kayıtları'ndaki gibi kapsam seçilir; silmeden önce kaç hareket gideceği (ve kaçının ödenmiş olduğu) gösterilir.
 */
export function DeleteTransactionsMenu({ token, onDeleted }: Props) {
  const { guard } = usePermission();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [scope, setScope] = useState<Scope | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function placeMenu() {
    const btn = rootRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuW = 224;
    const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
    setPos({ top: r.bottom + 6, left });
  }

  useEffect(() => {
    if (!open) return;
    placeMenu();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onMove() {
      placeMenu();
    }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  return (
    <CanRemove>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          data-km-jump
          title="Hareketleri sil"
          aria-label="Hareketleri sil"
          onClick={() => {
            if (!guard('m-hareketler', 'remove', 'Hareketler')) return;
            placeMenu();
            setOpen((v) => !v);
          }}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-600 transition hover:bg-rose-500/15"
        >
          <TrashIcon />
        </button>
      </div>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[12000] min-w-[224px] overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] py-1 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--panel-muted)]">
                Silme kapsamı
              </p>
              {MENU.map((item, i) => (
                <div key={item.scope}>
                  {item.danger && i > 0 ? <div className="my-1 h-px bg-[var(--panel-line)]" /> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setScope(item.scope);
                    }}
                    className={[
                      'flex w-full flex-col px-3 py-2 text-left transition hover:bg-[var(--panel-hover)]',
                      item.danger ? 'text-rose-600' : 'text-[var(--panel-ink)]',
                    ].join(' ')}
                  >
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-[11px] text-[var(--panel-muted)]">{item.hint}</span>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}

      {scope ? (
        <ConfirmModal
          scope={scope}
          token={token}
          onCancel={() => setScope(null)}
          onDone={(message) => {
            setScope(null);
            onDeleted(message);
          }}
        />
      ) : null}
    </CanRemove>
  );
}

function ConfirmModal({
  scope,
  token,
  onCancel,
  onDone,
}: {
  scope: Scope;
  token: string | null;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeReady = scope !== 'range' || (!!from && !!to && from <= to);

  // Kapsam / tarihler değişince etkilenecek sayıyı yeniden hesapla
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setAck(false);
    if (!token || !rangeReady) return;
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ scope });
    if (scope === 'range') {
      q.set('from', from);
      q.set('to', to);
    }
    void api
      .get<Preview>(`/api/payments/delete-preview?${q.toString()}`, token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Hesaplanamadı');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, scope, from, to, rangeReady]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, busy]);

  const hasPaid = (preview?.paid ?? 0) > 0;
  const canConfirm =
    !busy && !loading && !!preview && preview.count > 0 && rangeReady && (!hasPaid || ack);

  async function confirm() {
    if (!token || !canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.delete<{ deleted: number; paid: number }>('/api/payments', token, {
        scope,
        from: scope === 'range' ? from : undefined,
        to: scope === 'range' ? to : undefined,
      });
      onDone(`${result.deleted} hareket silindi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi');
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[12100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" aria-hidden />
      <div
        role="alertdialog"
        aria-modal
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-5 shadow-xl"
      >
        <div className="mb-3 flex justify-center text-rose-500">
          <TrashIcon large />
        </div>
        <h2 className="text-center text-lg font-bold text-[var(--panel-ink)]">{TITLE[scope]}</h2>
        <p className="mt-2 text-center text-sm text-[var(--panel-muted)]">
          Bu işlem geri alınamaz. Hareketler veritabanından tamamen silinir.
        </p>

        {scope === 'range' ? (
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-xs text-[var(--panel-muted)]">
              Başlangıç
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
            </label>
            <label className="text-xs text-[var(--panel-muted)]">
              Bitiş
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2 text-sm text-[var(--panel-ink)] outline-none focus:border-[var(--color-brand-500)]"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] px-3 py-2.5 text-sm">
          {!rangeReady ? (
            <span className="text-[var(--panel-muted)]">Tarih aralığını seçin.</span>
          ) : loading ? (
            <span className="text-[var(--panel-muted)]">Silinecek hareketler hesaplanıyor…</span>
          ) : previewError ? (
            <span className="text-rose-600">{previewError}</span>
          ) : preview ? (
            preview.count === 0 ? (
              <span className="text-[var(--panel-muted)]">Bu kapsamda silinecek hareket yok.</span>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold text-[var(--panel-ink)]">{preview.count} hareket silinecek</p>
                {hasPaid ? (
                  <p className="text-rose-600">
                    {preview.paid} tanesi ödenmiş hareket ({formatMoneyTr(preview.paidAmount)} TL).
                  </p>
                ) : null}
              </div>
            )
          ) : null}
        </div>

        {hasPaid ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-[var(--panel-ink)]">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-600"
            />
            Ödenmiş hareketlerin de silineceğini ve geri alınamayacağını anlıyorum.
          </label>
        ) : null}

        {error ? <p className="mt-3 text-center text-xs text-rose-600">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--panel-line)] py-2.5 text-sm font-semibold text-[var(--panel-ink)] hover:bg-[var(--panel-hover)] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirm()}
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

function TrashIcon({ large }: { large?: boolean }) {
  const s = large ? 28 : 18;
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
