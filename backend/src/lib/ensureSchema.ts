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
