/**
 * Yönetici kullanıcı oluştur / şifresini güncelle — ROLE_YONETICI
 *
 * E-posta ve şifre koda yazılmaz; çalıştırırken verilir:
 *   SEED_ADMIN_EMAIL=ad@firma.com SEED_ADMIN_PASSWORD='en-az-12-karakter' npx tsx scripts/seed-test-user.ts
 * (backend/.env içinde DATABASE_URL gerekli)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const EMAIL = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || '';

if (!/^\S+@\S+\.\S+$/.test(EMAIL)) {
  console.error('SEED_ADMIN_EMAIL geçerli bir e-posta olmalı.');
  process.exit(1);
}
if (PASSWORD.length < 12) {
  console.error('SEED_ADMIN_PASSWORD en az 12 karakter olmalı.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 13);
  const existing = await prisma.user.findFirst({ where: { email: EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hash,
        isVerified: true,
        isPassword: true,
        roles: ['ROLE_YONETICI'],
        adsoyad: existing.adsoyad || 'Yönetici',
        unvan: 'Yönetici',
        remove: null,
        rolId: 2,
        izinliTaksitler: '1,2,3,4,5,6,7,8,9,10,11,12',
      },
    });
    console.log(`Güncellendi: ${EMAIL} (id=${existing.id})`);
  } else {
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        password: hash,
        isVerified: true,
        isPassword: true,
        roles: ['ROLE_YONETICI'],
        adsoyad: 'Yönetici',
        unvan: 'Yönetici',
        telefon: '000 000 00 00',
        rolId: 2,
        izinliTaksitler: '1,2,3,4,5,6,7,8,9,10,11,12',
      },
    });
    console.log(`Oluşturuldu: ${EMAIL} (id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
