import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  amountInWordsTr,
  dekontSlipTitle,
  formatMoneyDisplay,
  formatMoneyTr,
  formatTxDate,
  maskCardForDekont,
  maskIdentityForDekont,
  maskPhoneForDekont,
  splitTxDateTime,
  type Transaction,
} from '../transactions/transactionTypes';
import {
  PAPER_CSS,
  resolveContentField,
  type DekontBlock,
  type DekontBlockType,
  type DekontPaperFormat,
  type DekontSampleContext,
} from './dekontTypes';

export type DekontRenderCtx = {
  brandLogoUrl: string;
  brandName: string;
  bankLogoUrl: string;
  bankName: string;
  merchantTitle: string;
  merchantAddress: string;
  merchantPhone: string;
  date: string;
  time: string;
  atLabel: string;
  transactionNo: string;
  authCode: string;
  referenceNo: string;
  cardHolderName: string;
  cardMasked: string;
  installments: number;
  status: 'paid' | 'cancelled' | 'refunded' | string;
  slipTitle: string;
  amountLabel: string;
  amountTotal: string;
  amountDetail: string | null;
  legalLine: string;
  threeDSecure?: boolean;
  amountInWords?: string;
  dekontNo: string;
  identityNo: string;
  holderPhone: string;
  description: string;
  amountOnly: string;
  commissionOnly: string;
  legalBox1: string;
  legalBox2: string;
};

export function ctxFromSample(s: DekontSampleContext, brandName = 'Güzel Teknoloji'): DekontRenderCtx {
  return {
    brandLogoUrl: s.brandLogoUrl,
    brandName,
    bankLogoUrl: s.bankLogoUrl,
    bankName: s.bankName,
    merchantTitle: s.merchantTitle,
    merchantAddress: s.merchantAddress,
    merchantPhone: s.merchantPhone,
    date: s.date,
    time: s.time,
    atLabel: `${s.date} ${s.time}`,
    transactionNo: s.transactionNo,
    authCode: s.authCode,
    referenceNo: s.referenceNo,
    cardHolderName: s.cardHolderName,
    cardMasked: s.cardMasked,
    installments: s.installments,
    status: s.status,
    slipTitle: s.slipTitle,
    amountLabel: s.amountLabel,
    amountTotal: s.amountTotal,
    amountDetail: s.amountDetail || null,
    legalLine: s.legalLine,
    threeDSecure: true,
    amountInWords: 'BİN ELLİ ÜÇ TÜRK LİRASI KIRK KURUŞ',
    dekontNo: s.dekontNo,
    identityNo: s.identityNo,
    holderPhone: s.holderPhone,
    description: s.description,
    amountOnly: s.amountOnly,
    commissionOnly: s.commissionOnly,
    legalBox1: s.legalBox1,
    legalBox2: s.legalBox2,
  };
}

export function ctxFromTransaction(
  tx: Transaction,
  logoUrl: string,
  systemName: string,
): DekontRenderCtx {
  const d = tx.dekont;
  const total = tx.amount + tx.commission;
  const money = formatMoneyTr(total);
  const { date, time } = splitTxDateTime(tx.at);
  const at = formatTxDate(tx.at);
  const isCancelOrRefund = tx.status === 'cancelled' || tx.status === 'refunded';
  const legal1 = `Kredi kartımdan / banka kartımdan ${money} ₺ tutarın ${d.merchantTitle} adına çekilmesini ve ilgili tutarın üye işyerine aktarılmasını kabul ederim.`;
  const legal2 = `Banka veya kart kuruluşunun ödemeyi bloke etmesi, iade etmesi veya üye işyerine aktarmaması halinde ${money} ₺ tutarı ${d.merchantTitle}’ne bizzat ödemeyi taahhüt ederim.`;
  return {
    brandLogoUrl: logoUrl,
    brandName: systemName || 'Firma',
    bankLogoUrl: tx.bankLogo || '',
    bankName: tx.bankName,
    merchantTitle: d.merchantTitle,
    merchantAddress: d.merchantAddress || '',
    merchantPhone: d.merchantPhone || '',
    date,
    time,
    atLabel: at,
    transactionNo: d.transactionNo || tx.id,
    authCode: d.authCode || '',
    referenceNo: d.referenceNo || '',
    cardHolderName: d.cardHolderName || '',
    cardMasked: maskCardForDekont(d.cardMasked),
    installments: tx.installments,
    status: tx.status,
    slipTitle: dekontSlipTitle(tx),
    amountLabel: 'İŞLEM TUTARI',
    amountTotal: `${money} TL`,
    amountDetail:
      tx.commission > 0
        ? `Tutar ${formatMoneyDisplay(tx.amount)} · Komisyon ${formatMoneyDisplay(tx.commission)}`
        : null,
    legalLine: isCancelOrRefund
      ? tx.status === 'refunded'
        ? 'TUTAR KARŞILIĞI İŞLEM İADE EDİLMİŞTİR'
        : 'TUTAR KARŞILIĞI İŞLEM İPTAL EDİLMİŞTİR'
      : 'TUTAR KARŞILIĞI MAL VEYA HİZMET ALDIM',
    threeDSecure: Boolean(d.threeDSecure),
    amountInWords: amountInWordsTr(total),
    dekontNo: tx.id,
    identityNo: maskIdentityForDekont(d.identityNo),
    holderPhone: maskPhoneForDekont(d.cardHolderPhoneMasked || d.cardHolderPhone),
    description: d.description || '-',
    amountOnly: formatMoneyDisplay(tx.amount),
    commissionOnly: formatMoneyDisplay(tx.commission),
    legalBox1: legal1,
    legalBox2: legal2,
  };
}

type Props = {
  blocks: DekontBlock[];
  ctx: DekontRenderCtx;
  mode: 'edit' | 'print';
  format?: DekontPaperFormat;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, w: number, h: number) => void;
  className?: string;
  style?: CSSProperties;
};

const SNAP = 1;

function snap(n: number): number {
  return Math.round(n / SNAP) * SNAP;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function alignClass(align: DekontBlock['align']): string {
  if (align === 'left') return 'text-left items-start';
  if (align === 'right') return 'text-right items-end';
  return 'text-center items-center';
}

function BlockContent({
  type,
  ctx,
  fontScale,
  block,
}: {
  type: DekontBlockType;
  ctx: DekontRenderCtx;
  fontScale: number;
  block?: DekontBlock;
}) {
  const fs = (base: number) => ({ fontSize: `${base * fontScale}px` });
  const showInstallment = ctx.installments > 1 && ctx.status === 'paid';

  if (type === 'emptyBox') {
    const bordered = block?.border !== false;
    return (
      <div
        className={[
          'h-full w-full',
          bordered ? 'border border-[#444]' : 'border border-dashed border-[#bbb]',
        ].join(' ')}
      />
    );
  }

  if (type === 'customText') {
    const bordered = block?.border === true;
    const text = (block?.text || '').trim() || 'İstek metin';
    return (
      <div
        className={[
          'flex h-full w-full items-start overflow-hidden whitespace-pre-wrap break-words p-1 leading-snug',
          bordered ? 'border border-[#444]' : '',
        ].join(' ')}
        style={fs(10)}
      >
        {text}
      </div>
    );
  }

  if (type === 'contentBox') {
    const bordered = block?.border !== false;
    const fields = block?.fields?.length
      ? block.fields
      : (['merchantTitle', 'merchantAddress', 'merchantPhone'] as const);
    return (
      <div
        className={[
          'flex h-full w-full flex-col justify-start gap-0.5 overflow-hidden p-1.5',
          bordered ? 'border border-[#444]' : '',
        ].join(' ')}
        style={fs(10)}
      >
        {fields.map((f) => {
          const line = resolveContentField(f, ctx);
          if (!line.text) return null;
          return (
            <p
              key={f}
              className={['leading-snug', line.bold ? 'font-bold' : ''].join(' ')}
            >
              {line.text}
            </p>
          );
        })}
        {!fields.length ? (
          <p className="text-[10px] italic text-[#888]">Boş kutu — alan ekleyin</p>
        ) : null}
      </div>
    );
  }

  switch (type) {
    case 'brandLogo':
      return ctx.brandLogoUrl ? (
        <img src={ctx.brandLogoUrl} alt={ctx.brandName} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <span className="font-bold" style={fs(11)}>
          {ctx.brandName}
        </span>
      );
    case 'bankLogo':
      return ctx.bankLogoUrl ? (
        <img src={ctx.bankLogoUrl} alt={ctx.bankName} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <span className="font-bold" style={fs(11)}>
          {ctx.bankName}
        </span>
      );
    case 'keepSlip':
      return (
        <p className="w-full font-semibold tracking-wide" style={fs(9)}>
          BU BELGEYİ SAKLAYINIZ
        </p>
      );
    case 'merchantTitle':
      return (
        <p className="w-full break-words font-bold uppercase leading-tight" style={fs(12)}>
          {ctx.merchantTitle}
        </p>
      );
    case 'merchantAddress':
      return (
        <p className="w-full leading-relaxed text-[#222]" style={fs(9)}>
          {ctx.merchantAddress}
        </p>
      );
    case 'merchantPhone':
      return (
        <p className="w-full tabular-nums text-[#222]" style={fs(9)}>
          {ctx.merchantPhone}
        </p>
      );
    case 'bankName':
      return (
        <p className="w-full break-words font-bold" style={fs(11)}>
          {ctx.bankName}
        </p>
      );
    case 'dateTimeRow':
      return (
        <div className="flex w-full justify-between gap-2 tabular-nums" style={fs(9)}>
          <span>TARİH: {ctx.date}</span>
          <span>SAAT: {ctx.time}</span>
        </div>
      );
    case 'txnMeta':
      return (
        <div className="w-full space-y-0.5 text-left tabular-nums" style={fs(9)}>
          <div className="flex justify-between gap-2">
            <span className="min-w-0 break-all">İŞLEM NO: {ctx.transactionNo}</span>
            {ctx.authCode ? <span className="shrink-0">ONAY: {ctx.authCode}</span> : null}
          </div>
          {ctx.referenceNo ? <p>REF: {ctx.referenceNo}</p> : null}
          {ctx.cardHolderName && ctx.cardHolderName !== '—' ? (
            <p>KART SAHİBİ: {ctx.cardHolderName}</p>
          ) : null}
        </div>
      );
    case 'installmentLine':
      if (!showInstallment) {
        return (
          <span className="opacity-40" style={fs(10)}>
            TAKSİT SAYISI: —
          </span>
        );
      }
      return (
        <p className="w-full font-bold" style={fs(10)}>
          TAKSİT SAYISI: {ctx.installments}
        </p>
      );
    case 'slipTitle':
      return (
        <p className="w-full font-bold tracking-wide" style={fs(14)}>
          {ctx.slipTitle}
        </p>
      );
    case 'cardMasked':
      return (
        <p className="w-full tabular-nums tracking-wider" style={fs(11)}>
          {ctx.cardMasked}
        </p>
      );
    case 'amountBlock':
      return (
        <div className="flex w-full flex-col gap-0.5">
          <p className="font-semibold tracking-wide" style={fs(9)}>
            {ctx.amountLabel}
          </p>
          <p className="font-bold tabular-nums leading-none" style={fs(18)}>
            {ctx.amountTotal}
          </p>
          {ctx.amountDetail ? (
            <p className="tabular-nums text-[#333]" style={fs(9)}>
              {ctx.amountDetail}
            </p>
          ) : null}
        </div>
      );
    case 'approvedLine':
      return (
        <p className="w-full font-bold tracking-wide" style={fs(11)}>
          İŞLEM ONAYLANDI
        </p>
      );
    case 'authRef':
      return (
        <div className="w-full space-y-0.5 tabular-nums" style={fs(9)}>
          {ctx.authCode ? <p>ONAY KODU: {ctx.authCode}</p> : null}
          {ctx.referenceNo ? <p>BANKA REFERANS: {ctx.referenceNo}</p> : null}
          {ctx.threeDSecure ? <p className="italic text-[#444]">3D Secure ile tamamlanmıştır.</p> : null}
        </div>
      );
    case 'legalLine':
      return (
        <p className="w-full leading-relaxed text-[#222]" style={fs(8)}>
          {ctx.legalLine}
        </p>
      );
    case 'maliDeger':
      return (
        <p className="w-full font-bold tracking-wide" style={fs(9)}>
          MALİ DEĞERİ YOKTUR
        </p>
      );
    case 'musteriNushasi':
      return (
        <p className="w-full font-semibold" style={fs(9)}>
          MÜŞTERİ NÜSHASI
        </p>
      );
    case 'docTitle':
      return (
        <div
          className="flex h-full w-full items-center justify-center border border-[#222] px-2 font-bold tracking-wide"
          style={fs(13)}
        >
          SANAL POS E-DEKONT
        </div>
      );
    case 'dekontNoDate':
      return (
        <div className="flex w-full justify-between gap-2" style={fs(11)}>
          <span>
            Dekont No: <strong>{ctx.dekontNo}</strong>
          </span>
          <span className="tabular-nums">{ctx.atLabel}</span>
        </div>
      );
    case 'partiesCards':
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1.5" style={fs(10)}>
          <div className="overflow-hidden border border-[#444] p-1.5">
            <p className="font-bold leading-snug">{ctx.merchantTitle}</p>
            <p className="mt-1 leading-relaxed text-[#222]">{ctx.merchantAddress}</p>
            <p className="mt-1 tabular-nums">{ctx.merchantPhone}</p>
          </div>
          <div className="overflow-hidden border border-[#444] p-1.5">
            <p className="font-bold leading-snug">{ctx.cardHolderName}</p>
            <p className="mt-1">-</p>
            <p className="mt-1 tabular-nums">{ctx.holderPhone}</p>
          </div>
        </div>
      );
    case 'detailTable': {
      const left: [string, string][] = [
        ['ONAY ZAMANI', ctx.atLabel],
        ['REFERANS NO', ctx.referenceNo],
        ['ADI SOYADI', ctx.cardHolderName],
        ['T.C. KİMLİK NO', ctx.identityNo],
        ['TELEFONU', ctx.holderPhone],
        ['AÇIKLAMA', ctx.description],
      ];
      const right: [string, string][] = [
        ['İŞLEM NO', ctx.transactionNo],
        ['ONAY KODU', ctx.authCode],
        ['BANKA', ctx.bankName],
        ['KART', ctx.cardMasked],
        ['TAKSİT', String(ctx.installments)],
        ['TUTAR', ctx.amountOnly],
        ['KOMİSYON', ctx.commissionOnly],
        ['TOPLAM', ctx.amountTotal],
      ];
      return (
        <div className="h-full w-full overflow-hidden border border-[#444]" style={fs(10)}>
          <div className="grid h-full grid-cols-2">
            <div className="border-r border-[#444]">
              {left.map(([k, v], i) => (
                <div
                  key={k}
                  className={[
                    'flex gap-1 px-1.5 py-0.5',
                    i < left.length - 1 ? 'border-b border-[#ddd]' : '',
                  ].join(' ')}
                >
                  <span className="w-[5.5rem] shrink-0 font-semibold">{k}</span>
                  <span>:</span>
                  <span className="min-w-0 flex-1 break-all tabular-nums">{v || '—'}</span>
                </div>
              ))}
            </div>
            <div>
              {right.map(([k, v], i) => (
                <div
                  key={k}
                  className={[
                    'flex gap-1 px-1.5 py-0.5',
                    i < right.length - 1 ? 'border-b border-[#ddd]' : '',
                    k === 'TOPLAM' ? 'font-bold' : '',
                  ].join(' ')}
                >
                  <span className="w-[5rem] shrink-0 font-semibold">{k}</span>
                  <span>:</span>
                  <span className="min-w-0 flex-1 break-all tabular-nums">{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case 'legalBox':
      return (
        <div className="flex h-full w-full flex-col justify-between overflow-hidden border border-[#444] p-1.5" style={fs(9)}>
          <p className="leading-relaxed text-[#222]">{ctx.legalBox1}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="font-semibold">{ctx.cardHolderName}</span>
            <span className="min-w-[3.5rem] border-t border-[#666] pt-0.5 text-center text-[10px] font-bold">
              İMZA
            </span>
          </div>
        </div>
      );
    case 'amountWords':
      return (
        <p className="w-full font-bold uppercase" style={fs(11)}>
          Yalnız; {ctx.amountInWords || '—'}
        </p>
      );
    default:
      return null;
  }
}

/**
 * Şablon — edit (tuval) veya print. Bloklar yüzde konumlu.
 */
export function DekontTemplateView({
  blocks,
  ctx,
  mode,
  format = 'fis',
  selectedId,
  onSelect,
  onMove,
  onResize,
  className = '',
  style,
}: Props) {
  const paper = PAPER_CSS[format];
  const sorted = [...blocks].sort((a, b) => a.z - b.z || a.y - b.y);
  const maxH = format === 'fis' ? 40 : 55;

  function startDrag(e: ReactPointerEvent<HTMLDivElement>, block: DekontBlock) {
    if (mode !== 'edit' || !onMove) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(block.id);
    const canvas = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = block.x;
    const origY = block.y;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    function onMovePtr(ev: PointerEvent) {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      const nx = clamp(snap(origX + dx), 0, 100 - block.w);
      const ny = clamp(snap(origY + dy), 0, 100 - block.h);
      onMove!(block.id, nx, ny);
    }
    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMovePtr);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMovePtr);
    window.addEventListener('pointerup', onUp);
  }

  function startResize(e: ReactPointerEvent<HTMLSpanElement>, block: DekontBlock) {
    if (mode !== 'edit' || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(block.id);
    const canvas = (e.currentTarget as HTMLElement).closest('[data-dekont-canvas]') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = block.w;
    const origH = block.h;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    function onMovePtr(ev: PointerEvent) {
      const dw = ((ev.clientX - startX) / rect.width) * 100;
      const dh = ((ev.clientY - startY) / rect.height) * 100;
      const nw = clamp(snap(origW + dw), 8, 100 - block.x);
      const nh = clamp(snap(origH + dh), 2, Math.min(maxH, 100 - block.y));
      onResize!(block.id, nw, nh);
    }
    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMovePtr);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMovePtr);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div
      data-dekont-canvas
      className={[
        'relative mx-auto overflow-hidden bg-white text-black',
        format === 'fis' ? 'font-mono' : 'font-sans',
        mode === 'edit' ? 'select-none touch-none' : '',
        className,
      ].join(' ')}
      style={{
        width: paper.width,
        aspectRatio: paper.aspectRatio,
        maxWidth: '100%',
        colorScheme: 'light',
        ...style,
      }}
      onPointerDown={mode === 'edit' ? () => onSelect?.(null) : undefined}
    >
      {sorted.map((block) => {
        const selected = mode === 'edit' && selectedId === block.id;
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            className={[
              'absolute flex overflow-hidden',
              alignClass(block.align),
              mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : '',
              selected ? 'ring-2 ring-sky-500 ring-offset-1' : '',
            ].join(' ')}
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.w}%`,
              height: `${block.h}%`,
              zIndex: block.z + (selected ? 50 : 0),
            }}
            onPointerDown={(e) => {
              if (mode !== 'edit') return;
              startDrag(e, block);
            }}
          >
            <div className={`flex h-full w-full flex-col justify-center ${alignClass(block.align)}`}>
              <BlockContent type={block.type} ctx={ctx} fontScale={block.fontScale} block={block} />
            </div>
            {selected ? (
              <span
                className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm bg-sky-500"
                onPointerDown={(e) => startResize(e, block)}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
      {mode === 'print' && format === 'fis' && ctx.amountInWords ? (
        <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[8px] text-[#555]">
          Yalnız; {ctx.amountInWords}
        </p>
      ) : null}
    </div>
  );
}

/** Palet chip önizlemesi */
export function DekontVariablePreview({
  type,
  ctx,
}: {
  type: DekontBlockType;
  ctx: DekontRenderCtx;
}): ReactNode {
  return (
    <div className="flex h-10 w-full items-center justify-center overflow-hidden rounded-md bg-white px-1 text-black">
      <div className="max-h-full max-w-full origin-center scale-[0.85]">
        <BlockContent
          type={type}
          ctx={ctx}
          fontScale={0.85}
          block={
            type === 'emptyBox' || type === 'contentBox' || type === 'customText'
              ? {
                  id: 'preview',
                  type,
                  x: 0,
                  y: 0,
                  w: 100,
                  h: 100,
                  fontScale: 1,
                  align: 'left',
                  z: 1,
                  border: type !== 'customText',
                  fields:
                    type === 'contentBox'
                      ? ['merchantTitle', 'merchantAddress', 'merchantPhone']
                      : [],
                  text: type === 'customText' ? 'Örnek istek metin' : undefined,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
