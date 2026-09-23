import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** AES-256-GCM with the key from CREDENTIALS_KEY (AC 25). Format: iv.tag.ciphertext, base64. */
export function encrypt(plaintext: string, keyBase64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(keyBase64), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

export function decrypt(encrypted: string, keyBase64: string): string {
  const [iv, tag, ciphertext] = encrypted.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !ciphertext) throw new Error('credentials are not in the expected format');
  const decipher = createDecipheriv('aes-256-gcm', key(keyBase64), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Subscriber tokens are stored as an HMAC, never in the clear (SRS §3). */
export const tokenHmac = (token: string, keyBase64: string): string =>
  createHmac('sha256', key(keyBase64)).update(token).digest('hex');

/** A fresh token or secret: 32 random bytes, base64url, shown once. */
export const newSecret = (): string => randomBytes(32).toString('base64url');

export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The key must be 32 random bytes. Anything else stops the process with the command to fix it. */
function key(keyBase64: string): Buffer {
  const bytes = Buffer.from(keyBase64, 'base64');
  if (bytes.length !== 32) {
    throw new Error(
      'CREDENTIALS_KEY must be 32 random bytes, base64. Generate one with: openssl rand -base64 32',
    );
  }
  return bytes;
}
