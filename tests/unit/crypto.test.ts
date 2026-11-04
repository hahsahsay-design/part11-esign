import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, sha256Hex, randomToken, hashToken } from "@/lib/crypto";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext secret", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const secret = "same-secret";
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  it("fails to decrypt a tampered ciphertext (auth tag check)", () => {
    const encrypted = encryptSecret("totp-secret");
    const [iv, tag, data] = encrypted.split(".");
    const tamperedData = Buffer.from(data, "base64");
    tamperedData[0] ^= 0xff;
    const tampered = [iv, tag, tamperedData.toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("sha256Hex", () => {
  it("matches a known SHA-256 vector", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic for the same input", () => {
    expect(sha256Hex("hello world")).toBe(sha256Hex("hello world"));
  });

  it("differs for different input (avalanche)", () => {
    expect(sha256Hex("hello world")).not.toBe(sha256Hex("hello world!"));
  });
});

describe("randomToken / hashToken", () => {
  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomToken()));
    expect(tokens.size).toBe(50);
  });

  it("hashToken is deterministic and matches sha256Hex", () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(sha256Hex(token));
  });
});
