import { prisma } from './prisma.js';

/**
 * sanal_pos_tanimlari.iade_sifresi (Garanti PROVRFN şifresi) — ham SQL.
 * Sütun yoksa okuma boş döner (uygulama çalışmaya devam eder), yazma hata verir.
 */
export async function readRefundPassword(posId: number): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<{ iade_sifresi: string | null }[]>`
      SELECT iade_sifresi FROM sanal_pos_tanimlari WHERE id = ${posId} LIMIT 1
    `;
    return (rows[0]?.iade_sifresi || '').trim();
  } catch {
    return '';
  }
}

export async function writeRefundPassword(posId: number, value: string): Promise<void> {
  const v = value.trim().slice(0, 255);
  try {
    await prisma.$executeRaw`
      UPDATE sanal_pos_tanimlari SET iade_sifresi = ${v || null} WHERE id = ${posId}
    `;
  } catch (err) {
    // Sütun yok ve değer boşsa sorun değil; dolu değer kaydedilemiyorsa kullanıcı bilsin
    if (v) throw new Error('İade şifresi kaydedilemedi (veritabanı sütunu yok)');
    console.warn('[pos-refund] yazılamadı', err);
  }
}
