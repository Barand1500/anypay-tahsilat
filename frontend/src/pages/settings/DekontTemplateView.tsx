import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  amountInWordsTr,
  dekontSlipTitle,
  formatMoneyDisplay,
  formatMoneyTr,
  maskCardForDekont,
  maskIdentityForDekont,
  maskPhoneForDekont,
  splitTxDateTime,
  type Transaction,
} from '../transactions/transactionTypes';
import { resolveCardBrandLogoUrl } from './cardBrandLogo';
import {
  paperStyleFor,
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
  cardBrand: string;
  /** Kart markası logo URL (`/payments/…`) */
  cardBrandLogoUrl: string;
  cardSegment: string;
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
  customerTitle: string;
  customerAddress: string;
  customerPhone: string;
};

/** Yeni A4/A5 imza kutuları metni — **...** arası kalın; # karakterleri görünür */
export function sheetLegalTexts(ctx: DekontRenderCtx): { holder: string; firm: string } {
  const firm = ctx.merchantTitle || 'üye işyeri';
  const cust =
    ctx.customerTitle && ctx.customerTitle !== ctx.cardHolderName ? ctx.customerTitle : '';
  const amount = ctx.amountTotal.replace(/ TL$/, ' ₺');
  const words = ctx.amountInWords || '—';
  return {
    holder:
      `Yukarıda bilgilerini vermiş olduğum kredi kartımdan; Rakamla **#${amount}#** Yazıyla **#${words}#** tutarın çekilmesini ve çekilen bu tutarın ` +
      (cust ? `tarafımdan alacaklı olan **${cust}** firması adına ` : '') +
      `**${firm}** firmasına ödenmiş bulunduğumu, ilgili firma ile aramda oluşabilecek anlaşmazlıklardan dolayı **${firm}** firmasını sorumlu tutmayacağımı beyan ve taahhüt ederim.`,
    firm: `Yukarıda bilgileri verilen kredi kartından çekilen; Rakamla **#${amount}#** Yazıyla **#${words}#** tutara kart sahibinin isteği doğrultusunda banka tarafından bloke konulacağını ve **${firm}** firması hesaplarına aktarılmaması durumunda, ilgili tutarı her türlü gecikme faizleri ile birlikte **${firm}** firmasının talep ettiği tarihte nakit olarak **${firm}** firmasına ödeyeceğimi beyan ve taahhüt ederim.`,
  };
}

function renderBold(text: string) {
  return text.split('**').map((seg, i) => (i % 2 === 1 ? <strong key={i}>{seg}</strong> : <span key={i}>{seg}</span>));
}

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
    cardBrand: s.cardBrand,
    cardBrandLogoUrl: resolveCardBrandLogoUrl(s.cardBrand),
    cardSegment: s.cardSegment,
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
    customerTitle: s.customerTitle,
    customerAddress: s.customerAddress,
    customerPhone: s.customerPhone,
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
  const at = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(tx.at));
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
    cardBrand: (d.cardBrand || '').trim() || '—',
    cardBrandLogoUrl: resolveCardBrandLogoUrl(d.cardBrand),
    cardSegment: (d.cardSegment || '').trim() || '—',
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
    customerTitle: d.customerTitle || d.cardHolderName || '',
    customerAddress: d.customerAddress || '',
    customerPhone: d.customerPhone || maskPhoneForDekont(d.cardHolderPhoneMasked || d.cardHolderPhone),
  };
}

type Props = {
  blocks: DekontBlock[];
  ctx: DekontRenderCtx;
  mode: 'edit' | 'print';
  format?: DekontPaperFormat;
  /** Fiş boyu mm — yalnızca format=fis */
  heightMm?: number;
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
          'flex h-full w-full flex-col justify-start overflow-hidden',
          block?.gap ? 'p-2' : 'gap-0.5 p-1.5',
          bordered ? 'border border-[#444]' : '',
        ].join(' ')}
        style={{ ...fs(10), ...(block?.gap ? { gap: `${block.gap * 1.333 * 0.55}px` } : {}) }}
      >
        {fields.map((f) => {
          const line = resolveContentField(f, ctx);
          if (!line.text) return null;
          return (
            <p
              key={f}
              className={['leading-snug', line.bold ? 'font-bold' : '', block?.align === 'center' ? 'text-center' : ''].join(' ')}
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
        <p className="w-full whitespace-pre-line leading-snug text-[#222]" style={fs(9)}>
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
    case 'dateTimeRow': {
      const fisNo = ctx.dekontNo || ctx.transactionNo;
      const row = (label: string, value: string) => (
        <div className="flex w-full gap-2 tabular-nums">
          <span className="w-[4.5rem] shrink-0">{label}</span>
          <span className="shrink-0">:</span>
          <span className="min-w-0 flex-1">{value}</span>
        </div>
      );
      return (
        <div className="w-full space-y-0.5 text-left tracking-tight" style={fs(9)}>
          {row('TARİH', ctx.date)}
          {row('SAAT', ctx.time)}
          {row('FİŞ NO', fisNo)}
        </div>
      );
    }
    case 'txnMeta':
      return (
        <div className="w-full space-y-0.5 text-left tabular-nums tracking-tight" style={fs(8)}>
          <div className="flex justify-between gap-2">
            <span>TARİH:{ctx.date.replace(/\//g, '.')}</span>
            <span>SAAT:{ctx.time}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="min-w-0 break-all">İŞLEM NO:{ctx.transactionNo}</span>
            {ctx.authCode ? <span className="shrink-0">STAN:{ctx.authCode}</span> : null}
          </div>
          {ctx.referenceNo ? (
            <div className="flex justify-between gap-2">
              <span className="min-w-0 break-all">RRN:{ctx.referenceNo}</span>
              <span className="shrink-0">SN:{ctx.dekontNo || ctx.transactionNo}</span>
            </div>
          ) : (
            <p>SN:{ctx.dekontNo || ctx.transactionNo}</p>
          )}
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
        <p className="w-full tracking-wide" style={fs(10)}>
          TAKSİT SAYISI: {ctx.installments}
        </p>
      );
    case 'slipTitle':
      return (
        <p className="w-full font-bold tracking-wide" style={fs(13)}>
          {ctx.slipTitle}
        </p>
      );
    case 'cardMasked':
      return (
        <div className="flex w-full flex-col gap-0.5">
          <p className="tabular-nums tracking-wider" style={fs(11)}>
            {ctx.cardMasked}
          </p>
          {ctx.bankName && ctx.bankName !== '—' ? (
            <p className="tracking-wide text-[#333]" style={fs(9)}>
              {ctx.bankName}
            </p>
          ) : null}
        </div>
      );
    case 'cardBrand':
      return ctx.cardBrandLogoUrl ? (
        <img
          src={ctx.cardBrandLogoUrl}
          alt={ctx.cardBrand && ctx.cardBrand !== '—' ? ctx.cardBrand : 'Kart markası'}
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <p className="w-full tracking-wide" style={fs(10)}>
          {ctx.cardBrand && ctx.cardBrand !== '—' ? ctx.cardBrand : '—'}
        </p>
      );
    case 'cardSegment':
      return (
        <p className="w-full tracking-wide" style={fs(10)}>
          {ctx.cardSegment && ctx.cardSegment !== '—' ? ctx.cardSegment : '—'}
        </p>
      );
    case 'amountBlock':
      return (
        <div className="flex w-full flex-col gap-1">
          <p className="tracking-wide" style={fs(9)}>
            İŞLEM TUTAR
          </p>
          <p className="font-bold tabular-nums leading-none" style={fs(20)}>
            {ctx.amountTotal}
          </p>
          <p className="tabular-nums tracking-wide text-[#222]" style={fs(8)}>
            HARCAMA TUTARI: {ctx.amountTotal}
          </p>
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
        <div className="w-full space-y-0.5 tabular-nums tracking-tight" style={fs(8)}>
          {(ctx.authCode || ctx.referenceNo) ? (
            <div className="flex justify-between gap-2">
              {ctx.authCode ? <span>ONAY KODU:{ctx.authCode}</span> : <span />}
              {ctx.referenceNo ? <span>RRN:{ctx.referenceNo}</span> : null}
            </div>
          ) : null}
          {ctx.referenceNo ? <p>BANKA REFERANS:{ctx.referenceNo}</p> : null}
          {ctx.threeDSecure ? (
            <p className="tracking-wide">İŞLEM 3D SECURE İLE TAMAMLANMIŞTIR</p>
          ) : null}
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
      const plain = block?.border === false;
      const left: [string, string][] = [
        ['ONAY ZAMANI', ctx.atLabel],
        ['REFERANS NO', ctx.referenceNo],
        ['ADI SOYADI', ctx.cardHolderName],
        ['T.C. KİMLİK NO', ctx.identityNo],
        ['TELEFONU', ctx.holderPhone],
        ['AÇIKLAMA', ctx.description],
      ];
      let right: [string, string][] = [
        ['İŞLEM NO', ctx.transactionNo],
        ['ONAY KODU', ctx.authCode],
        ['BANKA', ctx.bankName],
        ['KART', ctx.cardMasked],
        ['KART MARKASI', ctx.cardBrand],
        ['KART TÜRÜ', ctx.cardSegment],
        ['TAKSİT', String(ctx.installments)],
        ['TUTAR', ctx.amountOnly],
        ['KOMİSYON', ctx.commissionOnly],
        ['TOPLAM', ctx.amountTotal],
      ];
      if (plain) {
        right = right
          .filter(([k, v]) => !((k === 'KART MARKASI' || k === 'KART TÜRÜ') && (!v || v === '—')))
          .map(([k, v]): [string, string] => {
            if (k === 'TUTAR' || k === 'KOMİSYON') return [k, `${v} ₺`];
            if (k === 'TOPLAM') return [k, v.replace(/ TL$/, ' ₺')];
            return [k, v];
          });
      }
      if (plain) {
        const rowPct = 100 / Math.max(left.length, right.length);
        const money = new Set(['TUTAR', 'KOMİSYON', 'TOPLAM']);
        const col = (rows: [string, string][]) => (
          <div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center" style={{ height: `${rowPct}%`, minHeight: '1.3em' }}>
                <span className="w-[6.9rem] shrink-0">{k}</span>
                <span className="w-[0.9rem] shrink-0">:</span>
                <span className={['min-w-0 flex-1 break-all tabular-nums', money.has(k) ? 'text-right' : ''].join(' ')}>
                  {k === 'T.C. KİMLİK NO' ? v : v || '—'}
                </span>
              </div>
            ))}
          </div>
        );
        return (
          <div className="h-full w-full overflow-hidden" style={fs(10)}>
            <div className="grid h-full grid-cols-2">
              {col(left)}
              {col(right)}
            </div>
          </div>
        );
      }
      return (
        <div className="h-full w-full overflow-hidden border border-[#444]" style={fs(10)}>
          <div className="grid h-full grid-cols-2">
            <div className="border-r border-[#444]">
              {left.map(([k, v], i) => (
                <div
                  key={k}
                  className={['flex gap-1 px-1.5 py-0.5', i < left.length - 1 ? 'border-b border-[#ddd]' : ''].join(' ')}
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
    case 'legalBoxHolder':
    case 'legalBoxFirm': {
      const t = sheetLegalTexts(ctx);
      const isHolder = type === 'legalBoxHolder';
      const sign = isHolder ? ctx.cardHolderName : ctx.customerTitle || ctx.cardHolderName;
      return (
        <div className="relative flex h-full w-full flex-col justify-between overflow-hidden border border-[#444] p-2.5" style={fs(9)}>
          <p className="mt-1 leading-relaxed text-[#222]">{renderBold(isHolder ? t.holder : t.firm)}</p>
          <div className="mb-2 mt-2 flex items-end justify-between gap-2">
            <span className="font-bold">{sign}</span>
            <span className="absolute left-[81%]">İMZA</span>
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
  heightMm,
  selectedId,
  onSelect,
  onMove,
  onResize,
  className = '',
  style,
}: Props) {
  const paper = paperStyleFor(format, heightMm);
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
      {(ctx.status === 'cancelled' || ctx.status === 'refunded') && (
        <div
          className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center overflow-hidden"
          aria-hidden
        >
          <span
            className={[
              'select-none font-black uppercase tracking-[0.18em]',
              'border-[3px] border-rose-600/75 text-rose-600/70',
              'rounded-md px-[0.35em] py-[0.08em] leading-none',
              format === 'fis' ? 'text-[22px]' : format === 'a5' ? 'text-[52px]' : 'text-[72px]',
            ].join(' ')}
            style={{
              transform: 'rotate(-28deg)',
              boxShadow: 'inset 0 0 0 1px rgba(225, 29, 72, 0.25)',
            }}
          >
            {ctx.status === 'refunded' ? 'İADE' : 'İPTAL'}
          </span>
        </div>
      )}
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
