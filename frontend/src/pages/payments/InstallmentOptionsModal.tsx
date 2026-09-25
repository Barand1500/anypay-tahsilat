import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  banksForCompare,
  buildInstallments,
  formatMoneyTr, formatMoneyDisplay,
  type BankInfo,
  type CardSegment,
} from './mockBanks';

type Props = {
  amount: number;
  preferredBankId?: string | null;
  onClose: () => void;
  /** null = hepsi; dizi = yalnızca izinli */
  allowedInstallments?: number[] | null;
  /** İleride satır seçimi / alt limit sayfası; şimdilik opsiyonel */
  onPick?: (bank: BankInfo, installment: number) => void;
};

/** Taksit karşılaştırma — Esc / X */
export function InstallmentOptionsModal({
  amount,
  preferredBankId,
  onClose,
  allowedInstallments,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [segment, setSegment] = useState<CardSegment>('tumu');
  const banks = banksForCompare(preferredBankId);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 20, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out' },
    );
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby="taksit-title"
        className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="shrink-0 border-b border-[var(--panel-line)] px-5 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <h2 id="taksit-title" className="text-lg font-bold leading-tight text-[var(--panel-ink)]">
                Taksit Seçenekleri
              </h2>
              <p className="mt-0.5 text-sm text-[var(--panel-muted)]">
                Tutar: <strong className="text-[var(--panel-ink)]">{formatMoneyDisplay(amount)}</strong>
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-1 shadow-sm">
              {(
                [
                  ['tumu', 'Tümü'],
                  ['bireysel', 'Bireysel Kartlar'],
                  ['ticari', 'Ticari Kartlar'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSegment(id)}
                  className={[
                    'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                    segment === id
                      ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                      : 'text-[var(--brand-on-soft)] hover:bg-[var(--brand-soft-bg)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                aria-label="Kapat"
              >
                <span className="text-base leading-none">×</span>
                Esc
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {banks.map((bank) => {
              const rows = buildInstallments(amount, segment, bank.id);
              return (
                <article
                  key={bank.id}
                  className="overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]"
                >
                  <div className="flex items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-2.5">
                    <img
                      src={bank.logo}
                      alt=""
                      className="h-8 w-auto max-w-[120px] shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1 text-right text-sm font-bold leading-snug text-[var(--panel-ink)]">
                      {bank.fullName}
                    </span>
                  </div>
                  <table className="w-full table-fixed text-left text-[11px] sm:text-[12px]">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                      <col className="w-[22%]" />
                      <col className="w-[24%]" />
                      <col className="w-[26%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-[9px] uppercase leading-tight tracking-wide text-[var(--panel-muted)] sm:text-[10px]">
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">Taksit</th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">Komisyon</th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Taksit
                          <br />
                          tutarı
                        </th>
                        <th className="px-2 py-2 text-right font-semibold sm:px-3">
                          Toplam
                          <br />
                          tutar
                        </th>
                        <th
                          className="px-2 py-2 text-right font-semibold sm:px-3"
                          title="Yakında ayarlardan bağlanacak"
                        >
                          Taksit Alt
                          <br />
                          Limiti
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const ok =
                          !allowedInstallments?.length ||
                          allowedInstallments.includes(r.n);
                        return (
                        <tr
                          key={r.n}
                          title={ok ? undefined : 'Size atanmadı'}
                          className={[
                            'border-t border-[var(--panel-line)]/80',
                            ok
                              ? 'hover:bg-[var(--panel-hover)]/50'
                              : 'cursor-not-allowed opacity-45',
                          ].join(' ')}
                        >
                          <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--panel-ink)] sm:px-3">
                            {r.plusN > 0 ? `${r.n}+${r.plusN}` : r.n}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-3">
                            % {formatMoneyTr(r.commissionPct)}
                          </td>
                          <td className="px-2 py-2 text-right font-medium tabular-nums text-[var(--panel-ink)] sm:px-3">
                            {formatMoneyDisplay(r.installmentAmount)}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--panel-ink)] sm:px-3">
                            {formatMoneyDisplay(r.totalAmount)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-[var(--panel-muted)] sm:px-3">
                            {ok ? '—' : 'Size atanmadı'}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
