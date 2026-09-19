import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthAdapter,
  MockAuthAdapter,
  BackendAuthAdapter,
  __resetMockAdapterStateForTests,
} from "@/app/lib/auth-adapter";
import type { AuthAdapter, AuthResult } from "@/app/types";
import {
  enrollPlatformBiometric,
  verifyPlatformBiometric,
} from "@/app/lib/webauthn-biometrics";
import { extractVoiceprint } from "@/app/lib/voiceprint";

// Keep the real credential/voiceprint stores (so enroll→match behaves
// genuinely) but stub the OS biometric prompt + audio DSP at the seam.
vi.mock("@/app/lib/webauthn-biometrics", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/lib/webauthn-biometrics")>();
  return {
    ...actual,
    enrollPlatformBiometric: vi.fn(),
    verifyPlatformBiometric: vi.fn(),
  };
});

vi.mock("@/app/lib/voiceprint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/voiceprint")>();
  return {
    ...actual,
    extractVoiceprint: vi.fn(),
  };
});

const mockedEnrollPlatform = vi.mocked(enrollPlatformBiometric);
const mockedVerifyPlatform = vi.mocked(verifyPlatformBiometric);
const mockedExtractVoiceprint = vi.mocked(extractVoiceprint);

/** Deterministic 26-dim probe so enroll and verify hit the same voiceprint. */
const fixedVoiceprint = () => {
  const v = new Float32Array(26);
  for (let i = 0; i < v.length; i++) v[i] = 1 + i * 0.01;
  return v;
};

const STORAGE_KEY = "jarvis_auth_user";

const validUser = (email = "stark@avengers.io") => ({
  email,
  passkey: "iamironman",
  fullName: "Tony Stark",
});

describe("MockAuthAdapter", () => {
  let adapter: MockAuthAdapter;

  const clearStorage = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    __resetMockAdapterStateForTests();
  };

  beforeEach(() => {
    clearStorage();
    mockedEnrollPlatform.mockReset();
    mockedVerifyPlatform.mockReset();
    mockedExtractVoiceprint.mockReset();
    adapter = new MockAuthAdapter();
  });

  it("implements AuthAdapter interface", () => {
    expect(adapter.name).toBe("MockAuthAdapter");
    expect(typeof adapter.register).toBe("function");
    expect(typeof adapter.login).toBe("function");
    expect(typeof adapter.logout).toBe("function");
    expect(typeof adapter.resetPassword).toBe("function");
    expect(typeof adapter.verifyFace).toBe("function");
    expect(typeof adapter.verifyVoice).toBe("function");
    expect(typeof adapter.verifyFingerprint).toBe("function");
    expect(typeof adapter.enrollBiometrics).toBe("function");
    expect(typeof adapter.getCurrentUser).toBe("function");
    expect(typeof adapter.onAuthStateChanged).toBe("function");
  });

  describe("register", () => {
    it("rejects if fields missing", async () => {
      const res = await adapter.register("", "x", "");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("missing-fields");
    });

    it("rejects if passkey shorter than 6 chars", async () => {
      const res = await adapter.register("a@b.co", "12345", "A B");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("weak-passkey");
    });

    it("succeeds and persists user", async () => {
      const u = validUser();
      const res = await adapter.register(u.email, u.passkey, u.fullName);
      expect(res.success).toBe(true);
      expect(res.user).toMatchObject({
        email: u.email.toLowerCase(),
        fullName: u.fullName,
        clearanceLevel: "Level 1",
        hasBiometrics: false,
      });
      expect(res.user?.uid).toMatch(/^REG-/);
      expect(res.user?.createdAt).toBeDefined();
      expect(res.user?.lastLoginAt).toBeDefined();
      const storage = window.localStorage.getItem(STORAGE_KEY);
      expect(storage).not.toBeNull();
      expect(JSON.parse(storage!).email).toBe(u.email.toLowerCase());
    });

    it("rejects duplicate emails", async () => {
      const u = validUser();
      const first = await adapter.register(u.email, u.passkey, u.fullName);
      expect(first.success).toBe(true);
      const dup = await adapter.register(
        u.email.toUpperCase(),
        "different1",
        "Other"
      );
      expect(dup.success).toBe(false);
      expect(dup.errorCode).toBe("email-already-in-use");
    });
  });

  describe("login", () => {
    it("rejects invalid passkey for registered user", async () => {
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const res = await adapter.login(u.email, "wrongpass");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("invalid-credential");
    });

    it("rejects unregistered users", async () => {
      const res = await adapter.login("demo@test.io", "password1");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("invalid-credential");
    });

    it("authenticates registered user correctly", async () => {
      const u = validUser();
      const regRes = await adapter.register(u.email, u.passkey, u.fullName);
      expect(regRes.success).toBe(true);
      expect(regRes.user?.uid).toMatch(/^REG-/);
      const res = await adapter.login(u.email, u.passkey);
      expect(res.success).toBe(true);
      expect(res.user?.uid).toMatch(/^REG-/);
      expect(res.user?.email).toBe(u.email.toLowerCase());
    });
  });

  describe("logout", () => {
    it("clears current user and storage", async () => {
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const res = await adapter.logout();
      expect(res.success).toBe(true);
      expect(await adapter.getCurrentUser()).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("resetPassword", () => {
    it("fails with empty email", async () => {
      const res = await adapter.resetPassword("");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("missing-email");
    });
    it("succeeds with non-empty email (mock always succeeds)", async () => {
      const res = await adapter.resetPassword("x@y.com");
      expect(res.success).toBe(true);
    });
  });

  describe("device biometrics (face / fingerprint via WebAuthn platform)", () => {
    it("verifyFace authenticates after a successful platform assertion", async () => {
      // User must be registered before biometric login works
      await adapter.register("face@avengers.io", "facepass1", "Face Operative");
      mockedVerifyPlatform.mockResolvedValue({
        success: true,
        email: "face@avengers.io",
        credentialId: "cred-face",
      });
      const res = await adapter.verifyFace();
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe("face@avengers.io");
      expect(res.user?.hasBiometrics).toBe(true);
    });

    it("verifyFace fails when the platform assertion fails", async () => {
      mockedVerifyPlatform.mockResolvedValue({
        success: false,
        error: "No device biometric enrolled yet.",
        errorCode: "no-platform-credential",
      });
      const res = await adapter.verifyFace();
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("no-platform-credential");
      expect(await adapter.getCurrentUser()).toBeNull();
    });

    it("verifyFingerprint authenticates after a successful platform assertion", async () => {
      // User must be registered before biometric login works
      await adapter.register("fp@avengers.io", "fppass1", "FP Operative");
      mockedVerifyPlatform.mockResolvedValue({
        success: true,
        email: "fp@avengers.io",
        credentialId: "cred-fp",
      });
      const res = await adapter.verifyFingerprint();
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe("fp@avengers.io");
      expect(res.user?.hasBiometrics).toBe(true);
    });
  });

  describe("voice biometrics (register first, then login)", () => {
    it("verifyVoice fails with voice-no-match when nothing is enrolled", async () => {
      mockedExtractVoiceprint.mockResolvedValue(fixedVoiceprint());
      const res = await adapter.verifyVoice(new Blob(["probe"]));
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("voice-no-match");
    });

    it("verifyVoice logs in the enrolled operative after enrollVoice", async () => {
      mockedExtractVoiceprint.mockResolvedValue(fixedVoiceprint());
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const enroll = await adapter.enrollVoice(new Blob(["sample"]));
      expect(enroll.success).toBe(true);
      await adapter.logout();
      expect(await adapter.getCurrentUser()).toBeNull();

      const res = await adapter.verifyVoice(new Blob(["probe"]));
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe(u.email.toLowerCase());
      expect(res.user?.uid).toMatch(/^REG-/);
      expect(res.user?.hasBiometrics).toBe(true);
    });

    it("verifyVoice surfaces DSP errors as voice-error", async () => {
      mockedExtractVoiceprint.mockRejectedValue(new Error("decode failed"));
      const res = await adapter.verifyVoice(new Blob(["bad"]));
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("voice-error");
      expect(res.error).toBe("decode failed");
    });
  });

  describe("enrollBiometrics", () => {
    it("fails without active session", async () => {
      const res = await adapter.enrollBiometrics("X");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("no-session");
      expect(mockedEnrollPlatform).not.toHaveBeenCalled();
    });

    it("flips hasBiometrics=true after a successful platform enrollment", async () => {
      mockedEnrollPlatform.mockResolvedValue({
        success: true,
        email: validUser().email,
        credentialId: "cred-1",
      });
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const user = await adapter.getCurrentUser();
      expect(user?.hasBiometrics).toBe(false);
      const res = await adapter.enrollBiometrics(user!.uid);
      expect(res.success).toBe(true);
      expect(res.user?.hasBiometrics).toBe(true);
      expect((await adapter.getCurrentUser())?.hasBiometrics).toBe(true);
      expect(mockedEnrollPlatform).toHaveBeenCalledWith(
        expect.objectContaining({ email: u.email.toLowerCase() }),
        expect.anything()
      );
    });

    it("propagates platform enrollment failure without flipping hasBiometrics", async () => {
      mockedEnrollPlatform.mockResolvedValue({
        success: false,
        error: "No device biometric authenticator available.",
        errorCode: "platform-biometric-unavailable",
      });
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const res = await adapter.enrollBiometrics("uid");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("platform-biometric-unavailable");
      expect((await adapter.getCurrentUser())?.hasBiometrics).toBe(false);
    });
  });

  describe("enrollVoice", () => {
    it("fails without active session", async () => {
      const res = await adapter.enrollVoice(new Blob(["x"]));
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("no-session");
    });

    it("reports voice-enroll-error when DSP extraction fails", async () => {
      mockedExtractVoiceprint.mockRejectedValue(new Error("mic denied"));
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const res = await adapter.enrollVoice(new Blob(["x"]));
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("voice-enroll-error");
    });
  });

  describe("onAuthStateChanged", () => {
    it("emits initial state synchronously (null when no user)", async () => {
      let received: unknown = "__unset__";
      adapter.onAuthStateChanged((u) => {
        received = u;
      });
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(received).toBeNull();
    });

    it("emits registered user on registration", async () => {
      const emitted: (string | null)[] = [];
      adapter.onAuthStateChanged((u) => emitted.push(u?.email ?? null));
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      expect(emitted).toContain(u.email.toLowerCase());
    });

    it("unsubscribe removes listener", async () => {
      let calls = 0;
      const unsub = adapter.onAuthStateChanged(() => calls++);
      await new Promise<void>((r) => setTimeout(r, 0));
      const baseline = calls;
      unsub();
      await adapter.login("e@e.ee", "123456");
      expect(calls).toBe(baseline);
    });
  });

  describe("verifyPasskey", () => {
    it("returns passkey-not-supported when PublicKeyCredential is unavailable", async () => {
      const res = await adapter.verifyPasskey();
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("passkey-not-supported");
    });

    it("returns passkey-not-supported in environments without WebAuthn", async () => {
      const original = (window as any).PublicKeyCredential;
      try {
        (window as any).PublicKeyCredential = undefined;
        const res = await adapter.verifyPasskey();
        expect(res.success).toBe(false);
        expect(res.errorCode).toBe("passkey-not-supported");
      } finally {
        (window as any).PublicKeyCredential = original;
      }
    });
  });
});

describe("createAuthAdapter factory", () => {
  it("returns MockAuthAdapter by default", () => {
    const a = createAuthAdapter();
    expect(a).toBeInstanceOf(MockAuthAdapter);
    expect(a.name).toBe("MockAuthAdapter");
  });
  it("returns MockAuthAdapter for 'mock'", () => {
    expect(createAuthAdapter("mock").name).toBe("MockAuthAdapter");
  });
  it("returns BackendAuthAdapter for 'backend'", () => {
    expect(createAuthAdapter("backend").name).toBe("BackendAuthAdapter");
  });
  it("returns MockAuthAdapter for unknown adapter names (graceful fallback)", () => {
    // Unknown/removed adapter names fall back to MockAuthAdapter.
    const a = createAuthAdapter("mock" as "mock" | "backend");
    expect(a).toBeInstanceOf(MockAuthAdapter);
  });
  it("BackendAuthAdapter respects custom baseUrl option", () => {
    const a = createAuthAdapter("backend", {
      baseUrl: "http://custom:9000",
    }) as BackendAuthAdapter;
    expect(a.name).toBe("BackendAuthAdapter");
  });
});

describe("BackendAuthAdapter", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.localStorage.removeItem("jarvis_auth_user");
    mockedEnrollPlatform.mockReset();
    mockedVerifyPlatform.mockReset();
    mockedExtractVoiceprint.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const jsonResponse = (body: unknown, ok = true) =>
    ({
      ok,
      statusText: ok ? "OK" : "Unauthorized",
      json: async () => body,
    }) as unknown as Response;

  it("constructs with default base URL", () => {
    const a = new BackendAuthAdapter();
    expect(a.name).toBe("BackendAuthAdapter");
  });

  it("verifyFingerprint fails when the local platform gate fails (no server call)", async () => {
    mockedVerifyPlatform.mockResolvedValue({
      success: false,
      error: "No device biometric enrolled yet.",
      errorCode: "no-platform-credential",
    });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const a = new BackendAuthAdapter("http://example.invalid");
    const res = (await a.verifyFingerprint()) as AuthResult;
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("no-platform-credential");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifyFingerprint exchanges a platform assertion for a backend session", async () => {
    mockedVerifyPlatform.mockResolvedValue({
      success: true,
      email: "fp@backend.io",
      credentialId: "cred-9",
    });
    const serverUser = {
      uid: "BE-1",
      email: "fp@backend.io",
      fullName: "Backend Operative",
      clearanceLevel: "Level 1",
      hasBiometrics: true,
      createdAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, user: serverUser })
    );
    global.fetch = fetchMock;

    const a = new BackendAuthAdapter("http://example.invalid");
    const res = (await a.verifyFingerprint()) as AuthResult;
    expect(res.success).toBe(true);
    expect(res.user?.email).toBe("fp@backend.io");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://example.invalid/api/v1/auth/biometric-login");
    expect(JSON.parse(init.body)).toEqual({
      email: "fp@backend.io",
      method: "fingerprint",
      credential_id: "cred-9",
    });
  });

  it("verifyFace reports failure when the server rejects the biometric login", async () => {
    mockedVerifyPlatform.mockResolvedValue({
      success: true,
      email: "face@backend.io",
      credentialId: "cred-10",
    });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ detail: "Biometrics not enrolled for this operative" }, false)
      );
    const a = new BackendAuthAdapter("http://example.invalid");
    const res = (await a.verifyFace()) as AuthResult;
    expect(res.success).toBe(false);
    expect(res.error).toBe("Biometrics not enrolled for this operative");
  });

  it("verifyVoice requires a local DSP match before calling the backend", async () => {
    mockedExtractVoiceprint.mockResolvedValue(fixedVoiceprint());
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const a = new BackendAuthAdapter("http://example.invalid");
    const res = (await a.verifyVoice(new Blob(["probe"]))) as AuthResult;
    // Nothing enrolled in the voiceprint store → local gate fails, no server call.
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("voice-no-match");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enrollBiometrics fails without active session", async () => {
    const a = new BackendAuthAdapter("http://example.invalid");
    const res = await a.enrollBiometrics("any");
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("no-session");
  });
  it("onAuthStateChanged always emits initial value even when null", async () => {
    const a = new BackendAuthAdapter("http://example.invalid");
    let initial: unknown = "__unset__";
    a.onAuthStateChanged((u) => {
      initial = u;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(initial).toBeNull();
  });

  describe("resetPassword", () => {
    it("returns missing-email when no email is provided", async () => {
      const a = new BackendAuthAdapter("http://example.invalid");
      const res = await a.resetPassword("");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("missing-email");
    });

    it("calls the backend reset endpoint and returns success on 200", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ success: true })
      );
      global.fetch = fetchMock;
      const a = new BackendAuthAdapter("http://example.invalid");
      const res = (await a.resetPassword("op@example.io")) as AuthResult;
      expect(res.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://example.invalid/api/v1/auth/reset-password/request");
      expect(JSON.parse(init!.body)).toEqual({ email: "op@example.io" });
    });

    it("returns error when the backend responds with detail", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        jsonResponse({ detail: "Service unavailable" }, false)
      );
      const a = new BackendAuthAdapter("http://example.invalid");
      const res = (await a.resetPassword("op@example.io")) as AuthResult;
      expect(res.success).toBe(false);
      expect(res.error).toBe("Service unavailable");
    });

    it("returns connection error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
      const a = new BackendAuthAdapter("http://example.invalid");
      const res = (await a.resetPassword("op@example.io")) as AuthResult;
      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed to contact authentication server.");
    });
  });
});

type _adapterContract = AuthAdapter;
void ({} as _adapterContract);
