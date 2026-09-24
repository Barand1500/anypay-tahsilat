/**
 * Test kullanıcı: 21baran51@gmail.com / 123456 — ROLE_YONETICI
 * Çalıştır: npx tsx scripts/seed-test-user.ts
 * (backend/.env içinde DATABASE_URL gerekli)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const EMAIL = '21baran51@gmail.com';
const PASSWORD = '123456';
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
        adsoyad: existing.adsoyad || 'Baran',
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
        adsoyad: 'Baran',
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
