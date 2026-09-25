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

export async function ensureSchema(): Promise<void> {
  await ensurePayRequestDosyaColumn();
  await ensureGonderimGecmisiTable();
  await ensureUserBranchIdsColumn();
}
