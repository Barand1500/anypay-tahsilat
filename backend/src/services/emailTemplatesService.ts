import { prisma } from '../lib/prisma.js';
import { SettingsError } from './settingsService.js';

export type PublicEmailTemplate = {
  id: string;
  /** essablonlar.id */
  sablonId: string;
  typeKey: string;
  name: string;
  subject: string;
  body: string;
};

export type EmailSablonOption = {
  id: string;
  name: string;
  used: boolean;
};

function notRemoved() {
  return { OR: [{ remove: null }, { remove: false }] };
}

export async function listEmailTemplates(): Promise<PublicEmailTemplate[]> {
  const rows = await prisma.$queryRaw<
    {
      id: number;
      sablon_id: number;
      konu: string;
      icerik: string;
      adi: string | null;
    }[]
  >`
    SELECT e.\`id\`, e.\`sablon_id\`, e.\`konu\`, e.\`icerik\`, s.\`adi\`
    FROM \`eposta_sablonlari\` e
    LEFT JOIN \`essablonlar\` s ON s.\`id\` = e.\`sablon_id\`
    WHERE e.\`remove\` IS NULL OR e.\`remove\` = 0
    ORDER BY COALESCE(s.\`adi\`, e.\`konu\`) ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    sablonId: String(r.sablon_id),
    typeKey: String(r.sablon_id),
    name: r.adi || r.konu || `Şablon #${r.sablon_id}`,
    subject: r.konu,
    body: r.icerik,
  }));
}

/** E-posta tipi (tip=0) essablonlar — create modal seçenekleri */
export async function listEmailSablonOptions(): Promise<EmailSablonOption[]> {
  const used = await prisma.$queryRaw<{ sablon_id: number }[]>`
    SELECT \`sablon_id\` FROM \`eposta_sablonlari\`
    WHERE \`remove\` IS NULL OR \`remove\` = 0
  `;
  const usedSet = new Set(used.map((u) => u.sablon_id));

  const rows = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`essablonlar\`
    WHERE (\`remove\` IS NULL OR \`remove\` = 0) AND \`tip\` = 0
    ORDER BY \`adi\` ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: r.adi,
    used: usedSet.has(r.id),
  }));
}

export async function getEmailTemplateByType(
  typeKey: string,
): Promise<PublicEmailTemplate | null> {
  const sablonId = Number(typeKey);
  if (!Number.isFinite(sablonId)) return null;
  const rows = await prisma.$queryRaw<
    {
      id: number;
      sablon_id: number;
      konu: string;
      icerik: string;
      adi: string | null;
    }[]
  >`
    SELECT e.\`id\`, e.\`sablon_id\`, e.\`konu\`, e.\`icerik\`, s.\`adi\`
    FROM \`eposta_sablonlari\` e
    LEFT JOIN \`essablonlar\` s ON s.\`id\` = e.\`sablon_id\`
    WHERE e.\`sablon_id\` = ${sablonId}
      AND (e.\`remove\` IS NULL OR e.\`remove\` = 0)
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    sablonId: String(r.sablon_id),
    typeKey: String(r.sablon_id),
    name: r.adi || r.konu,
    subject: r.konu,
    body: r.icerik,
  };
}

export async function createEmailTemplate(input: {
  typeKey: string;
  subject: string;
  body: string;
}): Promise<PublicEmailTemplate> {
  const sablonId = Number(input.typeKey);
  if (!Number.isFinite(sablonId)) throw new SettingsError('Geçersiz şablon');
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new SettingsError('Konu gerekli');
  if (!body) throw new SettingsError('İçerik gerekli');

  const meta = await prisma.$queryRaw<{ id: number; adi: string }[]>`
    SELECT \`id\`, \`adi\` FROM \`essablonlar\`
    WHERE \`id\` = ${sablonId} AND \`tip\` = 0
      AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!meta[0]) throw new SettingsError('Şablon değişkeni bulunamadı (e-posta)');

  const existing = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`eposta_sablonlari\`
    WHERE \`sablon_id\` = ${sablonId}
      AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (existing[0]) throw new SettingsError('Bu şablon zaten ekli');

  const soft = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`eposta_sablonlari\`
    WHERE \`sablon_id\` = ${sablonId} AND \`remove\` = 1
    LIMIT 1
  `;
  if (soft[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`eposta_sablonlari\` SET \`konu\` = ?, \`icerik\` = ?, \`remove\` = 0 WHERE \`id\` = ?`,
      subject.slice(0, 255),
      body,
      soft[0].id,
    );
    return {
      id: String(soft[0].id),
      sablonId: String(sablonId),
      typeKey: String(sablonId),
      name: meta[0].adi,
      subject: subject.slice(0, 255),
      body,
    };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`eposta_sablonlari\` (\`sablon_id\`, \`konu\`, \`icerik\`, \`remove\`, \`info\`)
     VALUES (?, ?, ?, 0, NULL)`,
    sablonId,
    subject.slice(0, 255),
    body,
  );
  const created = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`eposta_sablonlari\` WHERE \`sablon_id\` = ${sablonId}
    ORDER BY \`id\` DESC LIMIT 1
  `;
  return {
    id: String(created[0]!.id),
    sablonId: String(sablonId),
    typeKey: String(sablonId),
    name: meta[0].adi,
    subject: subject.slice(0, 255),
    body,
  };
}

export async function updateEmailTemplate(
  id: number,
  input: { typeKey: string; subject: string; body: string },
): Promise<PublicEmailTemplate> {
  const rows = await prisma.$queryRaw<{ id: number; sablon_id: number }[]>`
    SELECT \`id\`, \`sablon_id\` FROM \`eposta_sablonlari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!rows[0]) throw new SettingsError('Şablon bulunamadı');

  const nextSablon = Number(input.typeKey) || rows[0].sablon_id;
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new SettingsError('Konu gerekli');
  if (!body) throw new SettingsError('İçerik gerekli');

  if (nextSablon !== rows[0].sablon_id) {
    const clash = await prisma.$queryRaw<{ id: number }[]>`
      SELECT \`id\` FROM \`eposta_sablonlari\`
      WHERE \`sablon_id\` = ${nextSablon}
        AND (\`remove\` IS NULL OR \`remove\` = 0)
        AND \`id\` <> ${id}
      LIMIT 1
    `;
    if (clash[0]) throw new SettingsError('Bu şablon zaten ekli');
  }

  await prisma.$executeRawUnsafe(
    `UPDATE \`eposta_sablonlari\` SET \`sablon_id\` = ?, \`konu\` = ?, \`icerik\` = ? WHERE \`id\` = ?`,
    nextSablon,
    subject.slice(0, 255),
    body,
    id,
  );

  const meta = await prisma.$queryRaw<{ adi: string }[]>`
    SELECT \`adi\` FROM \`essablonlar\` WHERE \`id\` = ${nextSablon} LIMIT 1
  `;
  return {
    id: String(id),
    sablonId: String(nextSablon),
    typeKey: String(nextSablon),
    name: meta[0]?.adi || subject,
    subject: subject.slice(0, 255),
    body,
  };
}

export async function softDeleteEmailTemplate(id: number): Promise<void> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT \`id\` FROM \`eposta_sablonlari\`
    WHERE \`id\` = ${id} AND (\`remove\` IS NULL OR \`remove\` = 0)
    LIMIT 1
  `;
  if (!rows[0]) throw new SettingsError('Şablon bulunamadı');
  await prisma.$executeRawUnsafe(
    `UPDATE \`eposta_sablonlari\` SET \`remove\` = 1 WHERE \`id\` = ?`,
    id,
  );
}

/** Eski ensure — artık no-op (gerçek tablo dump’ta var) */
export async function ensureEpostaSablonTable(): Promise<void> {
  /* gerçek şema: sablon_id, konu, icerik — tip kolonu yok */
}

export async function seedEmailTemplatesIfEmpty(): Promise<void> {
  /* seed yok — canlı veri essablonlar + eposta_sablonlari */
}

void notRemoved;
