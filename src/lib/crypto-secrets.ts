import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "gcm1";

function getKey() {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) {
    return null;
  }
  return createHash("sha256").update(raw).digest();
}

export function isEncryptionConfigured() {
  return Boolean(process.env.APP_ENCRYPTION_KEY?.trim());
}

export function encryptSecretPayload(plaintext: string) {
  const key = getKey();
  if (!key) {
    throw new Error(
      "APP_ENCRYPTION_KEY belum disetel. Tambahkan di .env untuk menyimpan konfigurasi terenkripsi.",
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecretPayload(ciphertext: string) {
  const key = getKey();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY belum disetel.");
  }

  const [prefix, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Format ciphertext tidak valid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
