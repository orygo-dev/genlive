import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  delete process.env.APP_ENCRYPTION_KEY;
  delete process.env.DATABASE_URL;
});

describe("crypto-secrets", () => {
  it("encrypts and decrypts with APP_ENCRYPTION_KEY", async () => {
    process.env.APP_ENCRYPTION_KEY = "test-key-at-least-32-characters-long!!";
    const {
      encryptSecretPayload,
      decryptSecretPayload,
      isEncryptionConfigured,
    } = await import("./crypto-secrets");
    expect(isEncryptionConfigured()).toBe(true);
    const cipher = encryptSecretPayload(
      '{"livekitUrl":"wss://x.livekit.cloud"}',
    );
    expect(decryptSecretPayload(cipher)).toContain("wss://");
  });

  it("falls back to DATABASE_URL when APP_ENCRYPTION_KEY missing", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/genmeet";
    const {
      encryptSecretPayload,
      decryptSecretPayload,
      isEncryptionConfigured,
    } = await import("./crypto-secrets");
    expect(isEncryptionConfigured()).toBe(true);
    const cipher = encryptSecretPayload('{"ok":true}');
    expect(decryptSecretPayload(cipher)).toBe('{"ok":true}');
  });
});
