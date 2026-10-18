import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const FORMAT = 'be-good-recovery-key-kit';
const MAX_ENCODED_BYTES = 16 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = MAX_ENCODED_BYTES * 3 / 4;
const decode = (value, length) => {
  if (typeof value !== 'string' || (length !== undefined && value.length !== Math.ceil(length * 4 / 3)) || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid recovery kit encoding');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (length !== undefined && bytes.length !== length)) throw new Error('Invalid recovery kit encoding');
  return bytes;
};
export function validateRecoveryPassphrase(value) { if (typeof value !== 'string' || value.length < 20 || value.length > 256) throw new Error('Recovery passphrase must contain 20 to 256 characters'); }
function material(value) {
  if (!value || value.format !== 'be-good-recovery-material/v1' || !Array.isArray(value.archiveKeys) || !value.archiveKeys.length || value.archiveKeys.length > 1000 || !Array.isArray(value.providerConfigurations)) throw new Error('Invalid recovery material');
  const ids = new Set();
  for (const item of value.archiveKeys) {
    if (!/^\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(item.id || '') || ids.has(item.id) || typeof item.keyBase64 !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(item.keyBase64) || Buffer.from(item.keyBase64, 'base64').length !== 32) throw new Error('Invalid recovery key identity');
    ids.add(item.id);
  }
  for (const item of value.providerConfigurations) if (!item || typeof item.name !== 'string' || !/^[a-z0-9-]{1,120}$/.test(item.name) || !item.document || typeof item.document !== 'object') throw new Error('Invalid provider recovery record');
}

export async function sealRecoveryKit(value, passphrase) {
  validateRecoveryPassphrase(passphrase); material(value);
  const plaintext = Buffer.from(JSON.stringify(value));
  if (plaintext.length > MAX_PLAINTEXT_BYTES) { plaintext.fill(0); throw new Error('Recovery material is too large'); }
  const salt = randomBytes(32), iv = randomBytes(12);
  const header = { format: FORMAT, version: 1, createdAt: new Date().toISOString(), kdf: 'scrypt', N: 32768, r: 8, p: 1, salt: salt.toString('base64url'), cipher: 'AES-256-GCM', iv: iv.toString('base64url') };
  const protectedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  let key;
  try {
    key = await derive(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(protectedHeader, 'ascii'));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { format: FORMAT, version: 1, protected: protectedHeader, ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
  } finally { key?.fill(0); plaintext.fill(0); }
}

export async function openRecoveryKit(kit, passphrase) {
  validateRecoveryPassphrase(passphrase);
  if (kit?.format !== FORMAT || kit.version !== 1 || typeof kit.protected !== 'string' || kit.protected.length > 4096 || typeof kit.ciphertext !== 'string' || kit.ciphertext.length > MAX_ENCODED_BYTES || typeof kit.tag !== 'string' || kit.tag.length !== 22) throw new Error('Invalid recovery kit');
  const header = JSON.parse(decode(kit.protected).toString('utf8'));
  if (header.format !== FORMAT || header.version !== 1 || header.kdf !== 'scrypt' || header.N !== 32768 || header.r !== 8 || header.p !== 1 || header.cipher !== 'AES-256-GCM' || !Number.isFinite(Date.parse(header.createdAt))) throw new Error('Invalid recovery kit parameters');
  const salt = decode(header.salt, 32), iv = decode(header.iv, 12), tag = decode(kit.tag, 16), ciphertext = decode(kit.ciphertext);
  const key = await derive(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  let plaintext;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAAD(Buffer.from(kit.protected, 'ascii')); decipher.setAuthTag(tag);
    try { plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]); }
    catch { throw new Error('Recovery kit authentication failed'); }
    const value = JSON.parse(plaintext.toString('utf8')); material(value); return value;
  } finally { key.fill(0); plaintext?.fill(0); }
}
