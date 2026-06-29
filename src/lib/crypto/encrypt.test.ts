import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "./encrypt";
import { randomBytes } from "crypto";

const TEST_KEY = randomBytes(32).toString("hex");

describe("encrypt/decrypt", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("round-trips a simple string", () => {
    const plaintext = "sk_test_abc123";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const ciphertext = encrypt("");
    expect(decrypt(ciphertext)).toBe("");
  });

  it("round-trips unicode", () => {
    const plaintext = "key_with_emoji_🔑_and_日本語";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("outputs iv:tag:ciphertext format", () => {
    const ciphertext = encrypt("test");
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encrypt("sensitive");
    const parts = ciphertext.split(":");
    const tampered = parts[0] + ":" + parts[1] + ":ff" + parts[2].slice(2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() => decrypt("not-valid")).toThrow("Invalid ciphertext format");
    expect(() => decrypt("a:b")).toThrow("Invalid ciphertext format");
  });
});

describe("key validation", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY env var is not set");
  });

  it("throws when key is too short", () => {
    process.env.ENCRYPTION_KEY = "abcd1234";
    expect(() => encrypt("test")).toThrow("64 hex characters");
  });

  it("throws when key contains non-hex chars", () => {
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    expect(() => encrypt("test")).toThrow("64 hex characters");
  });

  it("accepts a valid 64-char hex key", () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    expect(() => encrypt("test")).not.toThrow();
  });
});
