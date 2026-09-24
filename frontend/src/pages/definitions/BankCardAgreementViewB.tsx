import { Fragment, useState } from 'react';
import type { BankAgreementInstallment } from './mockPos';
import {
  CellInput,
  CopyIcon,
  DetailIcon,
  Field,
  installmentTitle,
  SEGMENTS,
  StatusSwitch,
  TrashIcon,
  type PatchSegFn,
  type SegmentKey,
} from './bankAgreementUi';

type Props = {
  items: BankAgreementInstallment[];
  segment: SegmentKey;
  setSegment: (s: SegmentKey) => void;
  onPatchSeg: PatchSegFn;
  onCopyFromPrevious: (n: number) => void;
  onRequestDelete: (n: number) => void;
};

/** Görünüm B — spreadsheet: satır=taksit, sütun=kritik alanlar; detay satır içi */
export function BankCardAgreementViewB({
  items,
  segment,
  setSegment,
  onPatchSeg,
  onCopyFromPrevious,
  onRequestDelete,
}: Props) {
  const [detailN, setDetailN] = useState<number | null>(2);

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-elevated)] p-3 shadow-[var(--panel-shadow)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          className="flex gap-1 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface)]/60 p-1"
        >
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={segment === s.key}
              data-km-jump
              onClick={() => setSegment(s.key)}
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4',
                segment === s.key
                  ? 'bg-[var(--panel-elevated)] text-[var(--panel-ink)] shadow-sm'
                  : 'text-[var(--panel-muted)] hover:text-[var(--panel-ink)]',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--panel-muted)]">
          Kritik alanlar tabloda · detay için satırdaki bilgi ikonu
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--panel-line)]">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/60 text-[11px] font-bold uppercase tracking-wide text-[var(--panel-muted)]">
              <th className="px-3 py-2.5">Taksit</th>
              <th className="px-2 py-2.5">Alt limit</th>
              <th className="px-2 py-2.5">Banka % *</th>
              <th className="px-2 py-2.5">Müşteri %</th>
              <th className="px-2 py-2.5">Tahsil *</th>
              <th className="px-2 py-2.5">Bloke</th>
              <th className="px-2 py-2.5 text-center">Durum</th>
              <th className="px-2 py-2.5 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const seg = item[segment];
              const prev = items.filter((x) => x.n < item.n).sort((a, b) => b.n - a.n)[0];
              const open = detailN === item.n;
              return (
                <Fragment key={item.n}>
                  <tr
                    className={[
                      'border-b border-[var(--panel-line)]/70 transition',
                      open ? 'bg-[var(--brand-soft-bg)]/40' : 'hover:bg-[var(--panel-hover)]/50',
                      !seg.active ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-[var(--panel-ink)]">
                      {installmentTitle(item.n)}
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={seg.minLimit}
                        disabled={!seg.active}
                        onChange={(v) => onPatchSeg(item.n, segment, { minLimit: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={seg.bankCommission}
                        disabled={!seg.active}
                        onChange={(v) => onPatchSeg(item.n, segment, { bankCommission: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={seg.customerCommission}
                        disabled={!seg.active}
                        onChange={(v) => onPatchSeg(item.n, segment, { customerCommission: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={seg.collectionDay}
                        disabled={!seg.active}
                        onChange={(v) => onPatchSeg(item.n, segment, { collectionDay: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={seg.blockDay}
                        disabled={!seg.active}
                        onChange={(v) => onPatchSeg(item.n, segment, { blockDay: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-center">
                        <StatusSwitch
                          active={seg.active}
                          onToggle={() => onPatchSeg(item.n, segment, { active: !seg.active })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Detay (puan, ek, not)"
                          aria-label="Detay"
                          data-km-jump
                          onClick={() => setDetailN(open ? null : item.n)}
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-lg transition',
                            open
                              ? 'bg-[var(--color-brand-600)] text-white'
                              : 'text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]',
                          ].join(' ')}
                        >
                          <DetailIcon />
                        </button>
                        {prev ? (
                          <button
                            type="button"
                            title={`${installmentTitle(prev.n)} kopyala`}
                            aria-label="Öncekini kopyala"
                            data-km-jump
                            onClick={() => onCopyFromPrevious(item.n)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-[var(--panel-hover)] hover:text-[var(--panel-ink)]"
                          >
                            <CopyIcon />
                          </button>
                        ) : null}
                        {item.n !== 1 ? (
                          <button
                            type="button"
                            title="Sil"
                            aria-label="Sil"
                            onClick={() => onRequestDelete(item.n)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--panel-muted)] hover:bg-rose-600 hover:text-white"
                          >
                            <TrashIcon />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="border-b border-[var(--panel-line)] bg-[var(--panel-surface)]/40">
                      <td colSpan={8} className="px-4 py-3">
                        <div
                          className={[
                            'grid gap-3 sm:grid-cols-3',
                            !seg.active ? 'opacity-55' : '',
                          ].join(' ')}
                        >
                          <Field
                            label="Puan"
                            value={seg.points}
                            disabled={!seg.active}
                            onChange={(v) => onPatchSeg(item.n, segment, { points: v })}
                          />
                          <Field
                            label="Ek Taksit"
                            value={seg.extraInstallment}
                            disabled={!seg.active}
                            onChange={(v) =>
                              onPatchSeg(item.n, segment, { extraInstallment: v })
                            }
                          />
                          <Field
                            label="Açıklama"
                            value={seg.note}
                            disabled={!seg.active}
                            onChange={(v) => onPatchSeg(item.n, segment, { note: v })}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
