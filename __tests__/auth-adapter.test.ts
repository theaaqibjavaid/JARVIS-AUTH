import { beforeEach, describe, expect, it } from "vitest";
import {
  createAuthAdapter,
  MockAuthAdapter,
  BackendAuthAdapter,
  __resetMockAdapterStateForTests,
} from "@/app/lib/auth-adapter";
import type { AuthAdapter, AuthResult } from "@/app/types";

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

    it("allows demo login for any valid unregistered email (no registration)", async () => {
      const res = await adapter.login("demo@test.io", "password1");
      expect(res.success).toBe(true);
      expect(res.user?.email).toBe("demo@test.io");
    });

    it("rejects with missing or too-short passkey in demo path", async () => {
      const res = await adapter.login("a@b.com", "12");
      expect(res.success).toBe(false);
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

  describe("biometric shortcuts", () => {
    it("verifyFace logs in with demo user", async () => {
      const res = await adapter.verifyFace("data:image/jpeg;base64,xx");
      expect(res.success).toBe(true);
      expect(res.user?.uid).toMatch(/^FACE-/);
      expect(res.user?.hasBiometrics).toBe(true);
    });
    it("verifyVoice logs in with demo user", async () => {
      const res = await adapter.verifyVoice(new Blob(["fake"]));
      expect(res.success).toBe(true);
      expect(res.user?.uid).toMatch(/^VOICE-/);
    });
    it("verifyFingerprint logs in with demo user", async () => {
      const res = await adapter.verifyFingerprint("scandata");
      expect(res.success).toBe(true);
      expect(res.user?.uid).toMatch(/^FP-/);
    });
  });

  describe("enrollBiometrics", () => {
    it("fails without active session", async () => {
      const res = await adapter.enrollBiometrics("X");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("no-session");
    });
    it("flips hasBiometrics=true for logged-in user", async () => {
      const u = validUser();
      await adapter.register(u.email, u.passkey, u.fullName);
      const user = await adapter.getCurrentUser();
      expect(user?.hasBiometrics).toBe(false);
      const res = await adapter.enrollBiometrics(user!.uid);
      expect(res.success).toBe(true);
      expect(res.user?.hasBiometrics).toBe(true);
      expect((await adapter.getCurrentUser())?.hasBiometrics).toBe(true);
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
  it("returns MockAuthAdapter for 'firebase' (skeleton)", () => {
    const a = createAuthAdapter("firebase");
    expect(a).toBeInstanceOf(MockAuthAdapter);
  });
  it("BackendAuthAdapter respects custom baseUrl option", () => {
    const a = createAuthAdapter("backend", {
      baseUrl: "http://custom:9000",
    }) as BackendAuthAdapter;
    expect(a.name).toBe("BackendAuthAdapter");
  });
});

describe("BackendAuthAdapter stub", () => {
  beforeEach(() => {
    window.localStorage.removeItem("jarvis_auth_user");
  });
  it("constructs with default base URL", () => {
    const a = new BackendAuthAdapter();
    expect(a.name).toBe("BackendAuthAdapter");
  });
  it("verifyFingerprint fallback creates placeholder user with success", async () => {
    const a = new BackendAuthAdapter("http://example.invalid");
    const res = (await a.verifyFingerprint("scan")) as AuthResult;
    expect(res.success).toBe(true);
    expect(res.user?.uid).toMatch(/^FP-BE-/);
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
});

type _adapterContract = AuthAdapter;
void ({} as _adapterContract);
