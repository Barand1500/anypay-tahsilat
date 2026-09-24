import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsError';
  }
}

export type CreatePaymentInput = {
  musteriId: number | null;
  payType: 'ch' | 'fatura';
  amount: number;
  commissionIncluded: boolean;
  holder: string;
  tc?: string;
  phone: string;
  cardDigits: string;
  installment: number;
  note?: string;
  kullaniciId: number;
};

/** Dump: 0=C/H, 2=fatura */
function tipFromPayType(payType: 'ch' | 'fatura'): number {
  return payType === 'fatura' ? 2 : 0;
}

function maskCard(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length < 10) return d;
  const groups = [
    d.slice(0, 4),
    d.slice(4, 6) + '**',
    '****',
    d.slice(-4),
  ];
  return groups.join(' ');
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

function makeOdemeNo(): string {
  const y = new Date().getFullYear();
  const rnd = randomBytes(3).toString('hex').toUpperCase();
  return `${y}T${rnd}`;
}

export type PublicPayment = {
  id: number;
  odemeNo: string;
  musteriId: number | null;
  amount: number;
  durum: number;
  tarih: string | null;
};

export async function createPayment(input: CreatePaymentInput): Promise<PublicPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new PaymentsError('Geçerli tutar gerekli');
  }
  if (input.musteriId != null) {
    const musteri = await prisma.musteri.findFirst({
      where: {
        id: input.musteriId,
        OR: [{ remove: null }, { remove: false }],
      },
      select: { id: true },
    });
    if (!musteri) throw new PaymentsError('Müşteri bulunamadı');
  }

  const digits = input.cardDigits.replace(/\D/g, '');
  if (digits.length < 15 || digits.length > 16) {
    throw new PaymentsError('Kart numarası geçersiz');
  }

  const now = new Date();
  const odemeNo = makeOdemeNo();
  const row = await prisma.odeme.create({
    data: {
      parabirimiId: 1,
      musteriId: input.musteriId,
      tutar: input.amount,
      gercekTutar: input.amount,
      komisyonDahil: input.commissionIncluded,
      aciklama: (input.note || '').trim() || null,
      adsoyad: input.holder.trim().slice(0, 255),
      tc: (input.tc || '').trim() || null,
      telefon: formatPhone(input.phone).slice(0, 255),
      kartNo: maskCard(digits).slice(0, 255),
      taksit: input.installment > 0 ? input.installment : 1,
      odemeNo,
      durum: 1,
      bankaCevabi: 'Panel kaydı — sanal POS 3D Secure banka çağrısı sonraki adım',
      odemeTipi: tipFromPayType(input.payType),
      tarih: now,
      kullaniciId: input.kullaniciId,
      arsiv: false,
    },
  });

  return {
    id: row.id,
    odemeNo: row.odemeNo,
    musteriId: row.musteriId,
    amount: row.tutar,
    durum: row.durum,
    tarih: row.tarih ? row.tarih.toISOString() : null,
  };
}
