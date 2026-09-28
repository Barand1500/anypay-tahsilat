import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'v1:';

function encKey(): Buffer {
  const raw = process.env.VAULT_ENC_KEY || process.env.JWT_SECRET || 'anypay-vault-dev-key';
  return createHash('sha256').update(raw).digest();
}

/** AES-256-GCM — DB’de düz metin yerine mühürlü değer */
export function encryptVaultValue(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptVaultValue(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // eski düz metin
  const body = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return stored;
  try {
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return stored;
  }
}

export function isVaultEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}
