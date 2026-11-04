import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Symmetric key for secrets that must be read back (TOTP secrets). Never used
// for passwords or backup codes — those are one-way hashed instead.
// MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key. In production this
// comes from a secrets manager (AWS Secrets Manager / KMS), never checked in.
function getEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MFA_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}
