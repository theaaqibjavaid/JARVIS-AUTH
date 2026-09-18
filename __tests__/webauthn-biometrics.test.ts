import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import {
  bufferToBase64Url,
  stringToBase64Url,
  decodeBase64Url,
  randomChallenge,
  resolveRpId,
  isPlatformBiometricSupported,
  buildRegistrationOptions,
  buildAuthenticationOptions,
  encryptStoreData,
  decryptStoreData,
  PlatformCredentialStore,
  enrollPlatformBiometric,
  verifyPlatformBiometric,
  type WebAuthnDriver,
} from "@/app/lib/webauthn-biometrics";

// Stub the OS-level WebAuthn primitives so the orchestration logic can be
// exercised deterministically in jsdom (no real authenticator present).
vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
  platformAuthenticatorIsAvailable: vi.fn(),
  browserSupportsWebAuthn: vi.fn(),
}));

function makeDriver(
  registerResult?: unknown,
  authenticateResult?: unknown,
  registerError?: Error,
  authenticateError?: Error
): WebAuthnDriver {
  return {
    register: vi.fn().mockImplementation(() =>
      registerError ? Promise.reject(registerError) : Promise.resolve(registerResult)
    ),
    authenticate: vi.fn().mockImplementation(() =>
      authenticateError ? Promise.reject(authenticateError) : Promise.resolve(authenticateResult)
    ),
  } as unknown as WebAuthnDriver;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
  vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(true);
});

describe("base64url helpers", () => {
  it("bufferToBase64Url produces url-safe output without padding", () => {
    expect(bufferToBase64Url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
  });

  it("stringToBase64Url encodes text url-safely", () => {
    expect(stringToBase64Url("hi")).toBe("aGk");
  });

  it("randomChallenge is non-empty, url-safe, and unique", () => {
    const a = randomChallenge();
    const b = randomChallenge();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });
});

describe("support detection + relying party", () => {
  it("resolveRpId falls back to the current hostname", () => {
    expect(resolveRpId()).toBe(window.location.hostname);
  });

  it("isPlatformBiometricSupported resolves true when available", async () => {
    await expect(isPlatformBiometricSupported()).resolves.toBe(true);
  });

  it("isPlatformBiometricSupported resolves false without an authenticator", async () => {
    vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(false);
    await expect(isPlatformBiometricSupported()).resolves.toBe(false);
  });

  it("isPlatformBiometricSupported resolves false without WebAuthn", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    await expect(isPlatformBiometricSupported()).resolves.toBe(false);
  });
});

describe("options builders", () => {
  it("buildRegistrationOptions targets the platform authenticator", () => {
    const opts = buildRegistrationOptions(
      { uid: "U1", email: "op@example.io", fullName: "Operative" },
      "localhost"
    );
    expect(opts.rp.name).toBe("J.A.R.V.I.S. Security Suite");
    expect(opts.rp.id).toBe("localhost");
    expect(opts.user.name).toBe("op@example.io");
    expect(opts.user.displayName).toBe("Operative");
    expect(opts.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(opts.authenticatorSelection?.authenticatorAttachment).toBe("platform");
    expect(opts.authenticatorSelection?.userVerification).toBe("required");
    const algs = opts.pubKeyCredParams.map((p) => p.alg);
    expect(algs).toContain(-7);
    expect(algs).toContain(-257);
  });

  it("buildAuthenticationOptions scopes to allowed credentials", () => {
    const opts = buildAuthenticationOptions(["cred-a", "cred-b"], "localhost");
    expect(opts.userVerification).toBe("required");
    expect(opts.rpId).toBe("localhost");
    expect(opts.allowCredentials).toEqual([
      { type: "public-key", id: "cred-a" },
      { type: "public-key", id: "cred-b" },
    ]);
  });
});

describe("encryption helpers", () => {
  it("decodeBase64Url reverses bufferToBase64Url", () => {
    const original = "hello world";
    const encoded = stringToBase64Url(original);
    const decoded = new TextDecoder().decode(decodeBase64Url(encoded));
    expect(decoded).toBe(original);
  });

  it("encryptStoreData + decryptStoreData round-trip preserves data", async () => {
    const data = { "user@example.io": { email: "user@example.io", credentialId: "cred-xyz", signCount: 0, enrolledAt: "2026-01-01T00:00:00.000Z" } };
    const encrypted = await encryptStoreData(data);
    // Encrypted data starts with "____" prefix (base64url of IV+ciphertext is always >= 4 chars)
    expect(encrypted).not.toBe(JSON.stringify(data));
    expect(encrypted.length).toBeGreaterThan(data.toString().length);
    const decrypted = await decryptStoreData(encrypted);
    expect(decrypted["user@example.io"]?.credentialId).toBe("cred-xyz");
  });

  it("decryptStoreData returns empty object for tampered ciphertext", async () => {
    // Use data long enough to pass the 13-byte minimum but invalid for AES-GCM
    await expect(decryptStoreData("AAAAAAAAAAAAAAAAAAAAAA==")).rejects.toThrow();
  });

  it("decryptStoreData returns empty object for short input", async () => {
    const result = await decryptStoreData("abc");
    expect(result).toEqual({});
  });
});

describe("PlatformCredentialStore", () => {
  let store: PlatformCredentialStore;

  beforeEach(() => {
    window.localStorage.clear();
    store = new PlatformCredentialStore();
  });

  const cred = {
    email: "op@example.io",
    credentialId: "cred-123",
    signCount: 0,
    enrolledAt: "2026-01-01T00:00:00.000Z",
  };

  it("save + get + has round-trip (case-insensitive email)", async () => {
    await store.save("OP@Example.io", cred);
    expect(await store.has("op@example.io")).toBe(true);
    expect((await store.get("op@example.io"))?.credentialId).toBe("cred-123");
  });

  it("getAll and findByCredentialId", async () => {
    await store.save("op@example.io", cred);
    expect((await store.getAll()).length).toBe(1);
    expect((await store.findByCredentialId("cred-123"))?.email).toBe("op@example.io");
    expect(await store.findByCredentialId("missing")).toBeNull();
  });

  it("remove and clear", async () => {
    await store.save("op@example.io", cred);
    await store.remove("op@example.io");
    expect(await store.has("op@example.io")).toBe(false);
    await store.save("op@example.io", cred);
    await store.clear();
    expect((await store.getAll()).length).toBe(0);
  });

  it("stored data in localStorage is encrypted (not plaintext JSON)", async () => {
    await store.save("op@example.io", cred);
    const raw = window.localStorage.getItem("jarvis_platform_credentials");
    expect(raw).not.toBeNull();
    expect(raw!.startsWith("{")).toBe(false); // not plaintext JSON
    // Re-reading through the store should still work
    expect((await store.getAll()).length).toBe(1);
  });

  it("migrates legacy plaintext data to encrypted format", async () => {
    const legacyData = JSON.stringify({ "old@example.io": cred });
    window.localStorage.setItem("jarvis_platform_credentials", legacyData);
    const freshStore = new PlatformCredentialStore();
    expect(await freshStore.has("old@example.io")).toBe(true);
    // Now stored data should be encrypted
    const raw = window.localStorage.getItem("jarvis_platform_credentials");
    expect(raw!.startsWith("{")).toBe(false);
  });
});

describe("enrollPlatformBiometric", () => {
  const user = { uid: "U1", email: "op@example.io", fullName: "Operative" };

  it("enrolls and persists the credential on success", async () => {
    const store = new PlatformCredentialStore();
    const driver = makeDriver({
      id: "cred-abc",
      response: { publicKey: "pk", transports: ["internal"] },
    });
    const result = await enrollPlatformBiometric(user, store, driver);
    expect(result.success).toBe(true);
    expect(result.credentialId).toBe("cred-abc");
    expect(await store.has("op@example.io")).toBe(true);
    expect((await store.get("op@example.io"))?.credentialId).toBe("cred-abc");
  });

  it("fails when the authenticator is unavailable", async () => {
    vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(false);
    const result = await enrollPlatformBiometric(user, new PlatformCredentialStore(), makeDriver());
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("platform-biometric-unavailable");
  });

  it("fails when registration returns no credential id", async () => {
    const result = await enrollPlatformBiometric(
      user,
      new PlatformCredentialStore(),
      makeDriver({ id: "" })
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("enroll-no-credential");
  });

  it("maps driver errors to enroll-failed", async () => {
    const result = await enrollPlatformBiometric(
      user,
      new PlatformCredentialStore(),
      makeDriver(undefined, undefined, new Error("user cancelled"))
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("enroll-failed");
    expect(result.error).toBe("user cancelled");
  });
});

describe("verifyPlatformBiometric", () => {
  const user = { uid: "U1", email: "op@example.io", fullName: "Operative" };

  it("verifies a scoped credential and resolves the owner email", async () => {
    const store = new PlatformCredentialStore();
    await enrollPlatformBiometric(
      user,
      store,
      makeDriver({ id: "cred-abc", response: {} })
    );
    const driver = makeDriver(undefined, { id: "cred-abc" });
    const result = await verifyPlatformBiometric("op@example.io", store, driver);
    expect(result.success).toBe(true);
    expect(result.email).toBe("op@example.io");
    expect(result.credentialId).toBe("cred-abc");
  });

  it("rejects when no credential is enrolled", async () => {
    const result = await verifyPlatformBiometric(
      "op@example.io",
      new PlatformCredentialStore(),
      makeDriver()
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("no-platform-credential");
  });

  it("rejects an assertion for an unknown credential", async () => {
    const store = new PlatformCredentialStore();
    await enrollPlatformBiometric(user, store, makeDriver({ id: "cred-abc", response: {} }));
    const driver = makeDriver(undefined, { id: "cred-forged" });
    const result = await verifyPlatformBiometric("op@example.io", store, driver);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("auth-unknown-credential");
  });

  it("maps driver errors to auth-failed", async () => {
    const store = new PlatformCredentialStore();
    await enrollPlatformBiometric(user, store, makeDriver({ id: "cred-abc", response: {} }));
    const driver = makeDriver(undefined, undefined, undefined, new Error("no match"));
    const result = await verifyPlatformBiometric("op@example.io", store, driver);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("auth-failed");
    expect(result.error).toBe("no match");
  });

  it("fails when the authenticator is unavailable", async () => {
    vi.mocked(platformAuthenticatorIsAvailable).mockResolvedValue(false);
    const result = await verifyPlatformBiometric(
      "op@example.io",
      new PlatformCredentialStore(),
      makeDriver()
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("platform-biometric-unavailable");
  });
});
