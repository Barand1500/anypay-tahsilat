import { prisma } from '../lib/prisma.js';

/**
 * Dump’tan gelen odeme_istekleri.dosya VARCHAR kalmış olabilir.
 * Çoklu dosya JSON’u LONGTEXT ister — yoksa create 500 verir.
 */
export async function ensurePayRequestDosyaColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<
      { DATA_TYPE: string; CHARACTER_MAXIMUM_LENGTH: number | bigint | null }[]
    >`
      SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'odeme_istekleri'
        AND COLUMN_NAME = 'dosya'
      LIMIT 1
    `;
    const col = rows[0];
    if (!col) return;
    const type = String(col.DATA_TYPE || '').toLowerCase();
    if (type === 'longtext' || type === 'mediumtext') return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `odeme_istekleri` MODIFY COLUMN `dosya` LONGTEXT NULL',
    );
    console.log('[schema] odeme_istekleri.dosya → LONGTEXT');
  } catch (err) {
    console.warn('[schema] dosya sütunu kontrolü atlandı:', err);
  }
}

/** Gönderim geçmişi tablosu — dump’ta yoksa oluştur */
export async function ensureGonderimGecmisiTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`gonderim_gecmisi\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`musteri_id\` INT NULL,
        \`tip\` VARCHAR(16) NOT NULL,
        \`alici\` VARCHAR(255) NOT NULL,
        \`icerik\` LONGTEXT NULL,
        \`tarih\` DATETIME(3) NOT NULL,
        \`kaynak\` VARCHAR(64) NULL,
        \`ref_id\` INT NULL,
        \`basarili\` TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        INDEX \`gonderim_gecmisi_tarih_idx\` (\`tarih\`),
        INDEX \`gonderim_gecmisi_musteri_id_idx\` (\`musteri_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.warn('[schema] gonderim_gecmisi oluşturma atlandı:', err);
  }
}

/** user.sube_departman_ids — çoklu şube CSV */
export async function ensureUserBranchIdsColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user'
        AND COLUMN_NAME = 'sube_departman_ids'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `user` ADD COLUMN `sube_departman_ids` LONGTEXT NULL',
    );
    console.log('[schema] user.sube_departman_ids eklendi');
  } catch (err) {
    console.warn('[schema] sube_departman_ids kontrolü atlandı:', err);
  }
}

/** İlk girişte geçici parola değişikliğini kalıcı olarak işaretle. */
export async function ensureUserMustChangePasswordColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user'
        AND COLUMN_NAME = 'must_change_password'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `user` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0',
    );
    console.log('[schema] user.must_change_password eklendi');
  } catch (err) {
    console.warn('[schema] must_change_password kontrolü atlandı:', err);
  }
}

/** cari_tipleri.izinli_taksitler */
export async function ensureCariTipiInstallmentsColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'cari_tipleri'
        AND COLUMN_NAME = 'izinli_taksitler'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `cari_tipleri` ADD COLUMN `izinli_taksitler` LONGTEXT NULL',
    );
    console.log('[schema] cari_tipleri.izinli_taksitler eklendi');
  } catch (err) {
    console.warn('[schema] cari_tipleri.izinli_taksitler atlandı:', err);
  }
}

/** ayarlar.taksit_siralama */
export async function ensureTaksitSiralamaColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'taksit_siralama'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `ayarlar` ADD COLUMN `taksit_siralama` VARCHAR(64) NULL DEFAULT 'user,cari,sube'",
    );
    console.log('[schema] ayarlar.taksit_siralama eklendi');
  } catch (err) {
    console.warn('[schema] taksit_siralama atlandı:', err);
  }
}

/** sube_departman.izinli_taksitler */
export async function ensureSubeInstallmentsColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'sube_departman'
        AND COLUMN_NAME = 'izinli_taksitler'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `sube_departman` ADD COLUMN `izinli_taksitler` LONGTEXT NULL',
    );
    console.log('[schema] sube_departman.izinli_taksitler eklendi');
  } catch (err) {
    console.warn('[schema] sube_departman.izinli_taksitler atlandı:', err);
  }
}

/** ayarlar.varsayilanlar — panel varsayılanları JSON */
export async function ensureVarsayilanlarColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'varsayilanlar'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `ayarlar` ADD COLUMN `varsayilanlar` LONGTEXT NULL',
    );
    console.log('[schema] ayarlar.varsayilanlar eklendi');
  } catch (err) {
    console.warn('[schema] varsayilanlar atlandı:', err);
  }
}

/** ayarlar.smtp_ayarlar — SMTP JSON */
export async function ensureSmtpAyarlarColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'smtp_ayarlar'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `ayarlar` ADD COLUMN `smtp_ayarlar` LONGTEXT NULL',
    );
    console.log('[schema] ayarlar.smtp_ayarlar eklendi');
  } catch (err) {
    console.warn('[schema] smtp_ayarlar atlandı:', err);
  }
}

/** ayarlar.whatsapp_ayarlar — Meta WhatsApp JSON */
export async function ensureWhatsappAyarlarColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'whatsapp_ayarlar'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `ayarlar` ADD COLUMN `whatsapp_ayarlar` LONGTEXT NULL',
    );
    console.log('[schema] ayarlar.whatsapp_ayarlar eklendi');
  } catch (err) {
    console.warn('[schema] whatsapp_ayarlar atlandı:', err);
  }
}

/** ayarlar.odeme_hatirlatma — otomatik hatırlatma JSON */
export async function ensureOdemeHatirlatmaColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'odeme_hatirlatma'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `ayarlar` ADD COLUMN `odeme_hatirlatma` LONGTEXT NULL',
    );
    console.log('[schema] ayarlar.odeme_hatirlatma eklendi');
  } catch (err) {
    console.warn('[schema] odeme_hatirlatma atlandı:', err);
  }
}

/** odeme_istekleri.hatirlatma_durum */
export async function ensurePayRequestReminderColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'odeme_istekleri'
        AND COLUMN_NAME = 'hatirlatma_durum'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `odeme_istekleri` ADD COLUMN `hatirlatma_durum` LONGTEXT NULL',
    );
    console.log('[schema] odeme_istekleri.hatirlatma_durum eklendi');
  } catch (err) {
    console.warn('[schema] hatirlatma_durum atlandı:', err);
  }
}

/** Modüller › WhatsApp Ayarları — izinler kaydı yoksa ekle */
export async function ensureWhatsappModule(): Promise<void> {
  try {
    const existing = await prisma.izinler.findFirst({
      where: {
        route: '/ayarlar/whatsapp',
        OR: [{ remove: null }, { remove: false }],
      },
      select: { id: true },
    });
    if (existing) return;
    await prisma.izinler.create({
      data: {
        adi: 'WhatsApp Ayarları',
        tablo: 'ayarlar',
        route: '/ayarlar/whatsapp',
        olusturmaTarihi: new Date(),
        remove: null,
      },
    });
    console.log('[schema] izinler: WhatsApp Ayarları eklendi');
  } catch (err) {
    console.warn('[schema] WhatsApp modülü atlandı:', err);
  }
}

/** eposta_sablonlari — gerçek dump şeması (self-heal gerekmez) */
export async function ensureEpostaSablonlariTable(): Promise<void> {
  /* no-op */
}

/** SMS tabloları dump’ta mevcut */
export async function ensureSmsSchema(): Promise<void> {
  /* no-op */
}

/** bankalar — sanal POS URL / güvenlik tipi sütunları */
export async function ensureBankPosColumns(): Promise<void> {
  const cols: { name: string; ddl: string }[] = [
    { name: 'guvenlik_tipleri', ddl: 'VARCHAR(255) NULL' },
    { name: 'sanal_pos_3d_url', ddl: 'VARCHAR(512) NULL' },
    { name: 'sanal_pos_api_url', ddl: 'VARCHAR(512) NULL' },
    { name: 'sanal_pos_xml_url', ddl: 'VARCHAR(512) NULL' },
  ];
  for (const col of cols) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bankalar'
           AND COLUMN_NAME = '${col.name}'
         LIMIT 1`,
      );
      if (rows[0]) continue;
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`bankalar\` ADD COLUMN \`${col.name}\` ${col.ddl}`,
      );
      console.log(`[schema] bankalar.${col.name} eklendi`);
    } catch (err) {
      console.warn(`[schema] bankalar.${col.name} atlandı:`, err);
    }
  }
}

export async function ensureSchema(): Promise<void> {
  await ensurePayRequestDosyaColumn();
  await ensureGonderimGecmisiTable();
  await ensureUserBranchIdsColumn();
  await ensureUserMustChangePasswordColumn();
  await ensureCariTipiInstallmentsColumn();
  await ensureSubeInstallmentsColumn();
  await ensureTaksitSiralamaColumn();
  await ensureVarsayilanlarColumn();
  await ensureSmtpAyarlarColumn();
  await ensureWhatsappAyarlarColumn();
  await ensureWhatsappModule();
  await ensureOdemeHatirlatmaColumn();
  await ensurePayRequestReminderColumn();
  await ensureQuickAccessSettingsColumn();
  await ensureEpostaSablonlariTable();
  await ensureSmsSchema();
  await ensureBankPosColumns();
  await ensureSanalPosTanimlariTable();
  await ensureBinKayitlariTable();
  await ensureVergiDairesiLocationColumns();
  await ensureOrtakSanalPosTable();
  await ensureKartDefsTables();
  await ensureKartAnlasmalariTable();
  await ensureKasaTables();
  await ensureOtpChallengeTable();
  await ensureSozlesmelerTable();
}

/** Genel ayarlardan yönetilen header hızlı erişimi */
export async function ensureQuickAccessSettingsColumn(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ayarlar'
        AND COLUMN_NAME = 'hizli_erisim_ayarlari'
      LIMIT 1
    `;
    if (rows[0]) return;
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `ayarlar` ADD COLUMN `hizli_erisim_ayarlari` LONGTEXT NULL',
    );
    console.log('[schema] ayarlar.hizli_erisim_ayarlari eklendi');
  } catch (err) {
    console.warn('[schema] hızlı erişim ayarları sütunu kontrolü atlandı:', err);
  }
}

/** Eksik kolon ekle (CREATE IF NOT EXISTS eski tabloyu güncellemez) */
async function ensureColumns(
  table: string,
  cols: { name: string; ddl: string }[],
): Promise<void> {
  for (const col of cols) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = '${table}'
           AND COLUMN_NAME = '${col.name}'
         LIMIT 1`,
      );
      if (rows[0]) continue;
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.ddl}`,
      );
      console.log(`[schema] ${table}.${col.name} eklendi`);
    } catch (err) {
      console.warn(`[schema] ${table}.${col.name} atlandı:`, err);
    }
  }
}

/** Tanımlamalar › Sözleşmeler — canlı dump şeması (baslik/metin/flag) */
export async function ensureSozlesmelerTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`sozlesmeler\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`baslik\` VARCHAR(255) NOT NULL,
        \`metin\` LONGTEXT NULL,
        \`kvkk\` TINYINT(1) NOT NULL DEFAULT 0,
        \`tahsilat\` TINYINT(1) NOT NULL DEFAULT 0,
        \`iade\` TINYINT(1) NOT NULL DEFAULT 0,
        \`remove\` TINYINT(1) NULL,
        \`seourl\` VARCHAR(255) NULL,
        \`sira\` INT NULL DEFAULT 0,
        \`hizmet\` TINYINT(1) NOT NULL DEFAULT 0,
        \`guvenlik\` TINYINT(1) NOT NULL DEFAULT 0,
        \`iletisim\` TINYINT(1) NULL DEFAULT 0,
        \`uyelik\` TINYINT(1) NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await ensureColumns('sozlesmeler', [
      { name: 'baslik', ddl: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'metin', ddl: 'LONGTEXT NULL' },
      { name: 'kvkk', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'tahsilat', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'iade', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'hizmet', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'guvenlik', ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'iletisim', ddl: 'TINYINT(1) NULL DEFAULT 0' },
      { name: 'uyelik', ddl: 'TINYINT(1) NULL DEFAULT 0' },
      { name: 'seourl', ddl: 'VARCHAR(255) NULL' },
      { name: 'sira', ddl: 'INT NULL DEFAULT 0' },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);
  } catch (err) {
    console.warn('[schema] sozlesmeler atlandı:', err);
  }
}

/** OTP — login / reset / vault */
export async function ensureOtpChallengeTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`otp_challenge\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`scope\` VARCHAR(64) NOT NULL,
        \`email\` VARCHAR(180) NOT NULL,
        \`code_hash\` VARCHAR(255) NOT NULL,
        \`expires_at\` DATETIME(3) NOT NULL,
        \`attempts\` INT NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`otp_challenge_scope_email_key\` (\`scope\`, \`email\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.warn('[schema] otp_challenge atlandı:', err);
  }
}

/** Kullanıcı kasası */
export async function ensureKasaTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kasa_ayar\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`kullanici_id\` INT NOT NULL,
        \`sifre_hash\` VARCHAR(255) NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`kasa_ayar_kullanici_id_key\` (\`kullanici_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kasa_kayitlari\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`kullanici_id\` INT NOT NULL,
        \`tip\` VARCHAR(32) NOT NULL,
        \`etiket\` VARCHAR(64) NOT NULL,
        \`baslik\` VARCHAR(255) NOT NULL,
        \`deger\` LONGTEXT NOT NULL,
        \`sira\` INT NOT NULL DEFAULT 0,
        \`remove\` TINYINT(1) NULL,
        \`olusturma\` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`kasa_kayitlari_kullanici_id_idx\` (\`kullanici_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.warn('[schema] kasa tabloları oluşturma atlandı:', err);
  }
}

/** Kart anlaşmaları (oran paketleri) */
export async function ensureKartAnlasmalariTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kart_anlasmalari\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`adi\` VARCHAR(255) NOT NULL,
        \`banka_id\` INT NULL,
        \`taksit\` INT NOT NULL,
        \`alt_limit\` DOUBLE NULL,
        \`komisyon_tum\` DOUBLE NULL,
        \`komisyon_bireysel\` DOUBLE NULL,
        \`komisyon_ticari\` DOUBLE NULL,
        \`tarih\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`grup\` VARCHAR(255) NULL,
        \`blok_adi\` VARCHAR(255) NULL,
        \`blok_logo\` VARCHAR(255) NULL,
        \`detay\` LONGTEXT NULL,
        \`anlasma_kodu\` VARCHAR(64) NOT NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`kart_anlasmalari_anlasma_kodu_idx\` (\`anlasma_kodu\`),
        INDEX \`kart_anlasmalari_banka_id_idx\` (\`banka_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await ensureColumns('kart_anlasmalari', [
      { name: 'tarih', ddl: 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)' },
      { name: 'detay', ddl: 'LONGTEXT NULL' },
    ]);
  } catch (err) {
    console.warn('[schema] kart_anlasmalari oluşturma atlandı:', err);
  }
}

/** Kart tip / tür / marka tanımları */
export async function ensureKartDefsTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kart_tipleri\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`adi\` VARCHAR(255) NOT NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kart_turleri\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`adi\` VARCHAR(255) NOT NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`kart_markalari\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`adi\` VARCHAR(255) NOT NULL,
        \`logo\` VARCHAR(255) NULL,
        \`kisa_kod\` VARCHAR(8) NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await ensureColumns('kart_tipleri', [
      { name: 'adi', ddl: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);
    await ensureColumns('kart_turleri', [
      { name: 'adi', ddl: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);
    await ensureColumns('kart_markalari', [
      { name: 'adi', ddl: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'logo', ddl: 'VARCHAR(255) NULL' },
      { name: 'kisa_kod', ddl: 'VARCHAR(8) NULL' },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);

    const tipCount = await prisma.kartTipi.count();
    if (tipCount === 0) {
      await prisma.kartTipi.createMany({
        data: [
          { adi: 'Banka Kartı', remove: false },
          { adi: 'Kredi Kartı', remove: false },
          { adi: 'Ön Ödemeli Kart', remove: false },
        ],
      });
    }

    const turCount = await prisma.kartTuru.count();
    if (turCount === 0) {
      await prisma.kartTuru.createMany({
        data: [
          { adi: 'Bireysel Kart', remove: false },
          { adi: 'Ticari Kart', remove: false },
        ],
      });
    }

    const markaCount = await prisma.kartMarka.count();
    if (markaCount === 0) {
      await prisma.kartMarka.createMany({
        data: [
          { adi: 'Amex', kisaKod: 'AX', remove: false },
          { adi: 'Diners', kisaKod: 'DC', remove: false },
          { adi: 'JCB', kisaKod: 'JC', remove: false },
          { adi: 'MasterCard', kisaKod: 'MC', remove: false },
          { adi: 'Özel Logolu', kisaKod: 'ÖL', remove: false },
          { adi: 'TROY', kisaKod: 'TR', remove: false },
          { adi: 'TROY/Discover co-badge', kisaKod: 'TC', remove: false },
          { adi: 'UnionPay', kisaKod: 'UP', remove: false },
          { adi: 'Visa', kisaKod: 'VI', remove: false },
        ],
      });
    }
  } catch (err) {
    console.warn('[schema] kart tanımları oluşturma atlandı:', err);
  }
}

/** Ortak Sanal POS eşlemeleri */
export async function ensureOrtakSanalPosTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`ortak_sanal_pos\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`banka_id\` INT NOT NULL,
        \`yonlenen_banka_id\` INT NOT NULL,
        \`aktif\` TINYINT(1) NULL DEFAULT 1,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`ortak_sanal_pos_banka_id_idx\` (\`banka_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await ensureColumns('ortak_sanal_pos', [
      { name: 'banka_id', ddl: 'INT NOT NULL DEFAULT 0' },
      { name: 'yonlenen_banka_id', ddl: 'INT NOT NULL DEFAULT 0' },
      { name: 'aktif', ddl: 'TINYINT(1) NULL DEFAULT 1' },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);
  } catch (err) {
    console.warn('[schema] ortak_sanal_pos oluşturma atlandı:', err);
  }
}

/** Vergi dairesi il / ilçe adı kolonları + eski FK’den doldur */
export async function ensureVergiDairesiLocationColumns(): Promise<void> {
  await ensureColumns('vergi_daireleri', [
    { name: 'il_adi', ddl: 'VARCHAR(255) NULL' },
    { name: 'ilce_adi', ddl: 'VARCHAR(255) NULL' },
  ]);
  // Eski dump: il_id / ilce_id varsa adları çek
  try {
    const hasIlId = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT 1 AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vergi_daireleri' AND COLUMN_NAME = 'il_id' LIMIT 1`,
    );
    if (hasIlId[0]) {
      await prisma.$executeRawUnsafe(`
        UPDATE \`vergi_daireleri\` vd
        INNER JOIN \`il\` i ON i.id = vd.il_id
        SET vd.il_adi = i.adi
        WHERE (vd.il_adi IS NULL OR vd.il_adi = '') AND vd.il_id IS NOT NULL
      `);
    }
  } catch (err) {
    console.warn('[schema] vergi il backfill atlandı:', err);
  }
  try {
    const hasIlceId = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT 1 AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vergi_daireleri' AND COLUMN_NAME = 'ilce_id' LIMIT 1`,
    );
    if (hasIlceId[0]) {
      await prisma.$executeRawUnsafe(`
        UPDATE \`vergi_daireleri\` vd
        INNER JOIN \`ilce\` c ON c.id = vd.ilce_id
        SET vd.ilce_adi = c.adi
        WHERE (vd.ilce_adi IS NULL OR vd.ilce_adi = '') AND vd.ilce_id IS NOT NULL
      `);
    }
  } catch (err) {
    console.warn('[schema] vergi ilçe backfill atlandı:', err);
  }
}

/** Kart BIN kayıtları — tablo + kolon onarımı + eski ad eşleme */
export async function ensureBinKayitlariTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`bin_kayitlari\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`banka_id\` INT NULL,
        \`banka_adi\` VARCHAR(255) NOT NULL DEFAULT '',
        \`bin\` VARCHAR(8) NOT NULL DEFAULT '',
        \`tip\` VARCHAR(64) NULL,
        \`marka\` VARCHAR(64) NULL,
        \`tur\` VARCHAR(64) NULL,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`bin_kayitlari_banka_id_idx\` (\`banka_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    await ensureColumns('bin_kayitlari', [
      { name: 'banka_id', ddl: 'INT NULL' },
      { name: 'banka_adi', ddl: "VARCHAR(255) NOT NULL DEFAULT ''" },
      { name: 'bin', ddl: "VARCHAR(8) NOT NULL DEFAULT ''" },
      { name: 'tip', ddl: 'VARCHAR(64) NULL' },
      { name: 'marka', ddl: 'VARCHAR(64) NULL' },
      { name: 'tur', ddl: 'VARCHAR(64) NULL' },
      { name: 'remove', ddl: 'TINYINT(1) NULL' },
    ]);

    // Eski PHP kolon adları → yeni
    const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bin_kayitlari'`,
    );
    const names = new Set(cols.map((c) => c.COLUMN_NAME));
    if (names.has('banka') && names.has('banka_adi')) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE \`bin_kayitlari\` SET \`banka_adi\` = \`banka\` WHERE (\`banka_adi\` IS NULL OR \`banka_adi\` = '') AND \`banka\` IS NOT NULL`,
        );
      } catch {
        /* ignore */
      }
    }
    if (!names.has('bin') && names.has('bin_kodu')) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE \`bin_kayitlari\` SET \`bin\` = LEFT(CAST(\`bin_kodu\` AS CHAR), 8) WHERE (\`bin\` IS NULL OR \`bin\` = '')`,
        );
      } catch {
        /* ignore */
      }
    }

    // Unique index (yoksa ekle)
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`bin_kayitlari\` ADD UNIQUE KEY \`bin_kayitlari_bin_key\` (\`bin\`)`,
      );
    } catch {
      /* var veya boş bin’ler çakışıyor */
    }
  } catch (err) {
    console.warn('[schema] bin_kayitlari oluşturma atlandı:', err);
  }
}

/** Sanal POS tanımları tablosu */
export async function ensureSanalPosTanimlariTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`sanal_pos_tanimlari\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`banka_id\` INT NOT NULL,
        \`altyapi_kodu\` VARCHAR(64) NOT NULL,
        \`pos_adi\` VARCHAR(255) NOT NULL,
        \`isyeri_no\` VARCHAR(255) NULL,
        \`terminal_safe_id\` VARCHAR(255) NULL,
        \`guvenlik_anahtari\` VARCHAR(512) NULL,
        \`terminal_sifresi\` VARCHAR(255) NULL,
        \`guvenlik_tipi\` VARCHAR(64) NULL,
        \`varsayilan\` TINYINT(1) NULL DEFAULT 0,
        \`aktif\` TINYINT(1) NULL DEFAULT 1,
        \`remove\` TINYINT(1) NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`sanal_pos_tanimlari_banka_id_idx\` (\`banka_id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.warn('[schema] sanal_pos_tanimlari oluşturma atlandı:', err);
  }

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `sanal_pos_tanimlari` ADD COLUMN `terminal_sifresi` VARCHAR(255) NULL',
    );
  } catch {
    /* kolon zaten var */
  }
}
