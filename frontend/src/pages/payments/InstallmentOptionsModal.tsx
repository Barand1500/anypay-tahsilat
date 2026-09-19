import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  banksForCompare,
  buildInstallments,
  formatMoneyTr,
  type BankInfo,
  type CardSegment,
} from './mockBanks';

type Props = {
  amount: number;
  preferredBankId?: string | null;
  onClose: () => void;
  onPick: (bank: BankInfo, installment: number) => void;
};

/** Taksit karşılaştırma — Esc / X */
export function InstallmentOptionsModal({ amount, preferredBankId, onClose, onPick }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [segment, setSegment] = useState<CardSegment>('bireysel');
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
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--panel-line)] px-5 py-4">
          <div>
            <h2 id="taksit-title" className="text-lg font-bold text-[var(--panel-ink)]">
              Taksit Seçenekleri
            </h2>
            <p className="text-sm text-[var(--panel-muted)]">
              Tutar: <strong className="text-[var(--panel-ink)]">{formatMoneyTr(amount)} ₺</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--panel-muted)] transition hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
            aria-label="Kapat"
          >
            <span className="text-base leading-none">×</span>
            Esc
          </button>
        </header>

        <div className="flex justify-center border-b border-[var(--panel-line)] px-5 py-3">
          <div className="inline-flex rounded-full border border-[var(--panel-line)] bg-[var(--panel-surface)] p-1">
            {(
              [
                ['bireysel', 'Bireysel Kartlar'],
                ['ticari', 'Ticari Kartlar'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSegment(id)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  segment === id
                    ? 'bg-[var(--color-brand-600)] text-white shadow-sm'
                    : 'text-[var(--color-brand-600)] hover:bg-[var(--brand-soft-bg)]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {banks.map((bank) => {
              const rows = buildInstallments(amount, segment, bank.id);
              return (
                <article
                  key={bank.id}
                  className="overflow-hidden rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]"
                >
                  <div className="flex items-center gap-3 border-b border-[var(--panel-line)] bg-[var(--panel-elevated)] px-4 py-3">
                    <img
                      src={bank.logo}
                      alt=""
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                    <span className="text-sm font-bold text-[var(--panel-ink)]">{bank.name}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-[var(--panel-muted)]">
                          <th className="px-3 py-2 font-semibold">Taksit</th>
                          <th className="px-3 py-2 font-semibold">Komisyon</th>
                          <th className="px-3 py-2 font-semibold">Taksit tutarı</th>
                          <th className="px-3 py-2 font-semibold">Toplam</th>
                          <th className="px-3 py-2 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.n}
                            className="border-t border-[var(--panel-line)]/80 hover:bg-[var(--panel-hover)]/50"
                          >
                            <td className="px-3 py-2 font-semibold tabular-nums text-[var(--panel-ink)]">
                              {r.n}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-[var(--panel-muted)]">
                              % {formatMoneyTr(r.commissionPct)}
                            </td>
                            <td className="px-3 py-2 font-medium tabular-nums text-[var(--panel-ink)]">
                              {formatMoneyTr(r.installmentAmount)} ₺
                            </td>
                            <td className="px-3 py-2 font-semibold tabular-nums text-[var(--panel-ink)]">
                              {formatMoneyTr(r.totalAmount)} ₺
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => onPick(bank, r.n)}
                                className="rounded-lg bg-[var(--color-brand-600)] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[var(--color-brand-500)]"
                              >
                                Seç
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
