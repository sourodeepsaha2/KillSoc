import crypto from 'node:crypto';
import type { EncryptedData } from '../types/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for GCM (96 bits)

/**
 * Derives a 32-byte key from the provided secret using SHA-256.
 */
const deriveKey = (secretKey: string): Buffer => {
  return crypto.createHash('sha256').update(secretKey).digest();
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export const encryptToken = (plaintext: string, secretKey: string): EncryptedData => {
  const key = deriveKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
};

/**
 * Decrypts an AES-256-GCM ciphertext using the secret key, IV, and auth tag.
 */
export const decryptToken = (encrypted: EncryptedData, secretKey: string): string => {
  const key = deriveKey(secretKey);
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Generates a cryptographically secure random state parameter for OAuth CSRF protection.
 */
export const generateOAuthState = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Performs a timing-safe comparison of OAuth state parameters to prevent timing attacks.
 */
export const validateOAuthState = (
  storedState?: string,
  receivedState?: string
): boolean => {
  if (!storedState || !receivedState) {
    return false;
  }

  const storedBuffer = Buffer.from(storedState, 'utf8');
  const receivedBuffer = Buffer.from(receivedState, 'utf8');

  if (storedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, receivedBuffer);
};
