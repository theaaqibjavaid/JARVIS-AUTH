import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import React, { type ReactNode } from "react";
import {
  AuthProvider,
  useAuth,
} from "@/app/context/AuthContext";
import {
  MockAuthAdapter,
  __resetMockAdapterStateForTests,
} from "@/app/lib/auth-adapter";
import {
  enrollPlatformBiometric,
  verifyPlatformBiometric,
} from "@/app/lib/webauthn-biometrics";
import { extractVoiceprint } from "@/app/lib/voiceprint";

// Keep the real credential/voiceprint stores but stub the OS biometric
// prompt + audio DSP at the seam so tests never touch real hardware.
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

const fixedVoiceprint = () => {
  const v = new Float32Array(26);
  for (let i = 0; i < v.length; i++) v[i] = 1 + i * 0.01;
  return v;
};

const wrapper = ({ children }: { children: ReactNode }) => {
  __resetMockAdapterStateForTests();
  return (
    <AuthProvider adapter={new MockAuthAdapter()}>
      {children}
    </AuthProvider>
  );
};

const STORAGE_KEY = "jarvis_auth_user";

describe("AuthContext (useAuth hook)", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    mockedEnrollPlatform.mockReset();
    mockedVerifyPlatform.mockReset();
    mockedExtractVoiceprint.mockReset();
  });
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("provides initial default value structure", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(["authenticated", "unauthenticated", "idle"]).toContain(
        result.current.status
      );
    });
    expect(result.current.error).toBeNull();
    expect(result.current.user).toBeNull();
    expect(typeof result.current.login).toBe("function");
    expect(typeof result.current.register).toBe("function");
    expect(typeof result.current.logout).toBe("function");
    expect(typeof result.current.toggleMode).toBe("function");
    expect(typeof result.current.toggleAudio).toBe("function");
    expect(typeof result.current.setActiveMethod).toBe("function");
    expect(typeof result.current.showModal).toBe("function");
    expect(typeof result.current.closeModal).toBe("function");
    expect(typeof result.current.playBeep).toBe("function");
    expect(typeof result.current.playSuccess).toBe("function");
    expect(typeof result.current.playError).toBe("function");
    expect(typeof result.current.adapterName).toBe("string");
    expect(typeof result.current.audioEnabled).toBe("boolean");
    expect(typeof result.current.isRegisterMode).toBe("boolean");
    expect(
      typeof result.current.terminalText === "string" ||
        Array.isArray(result.current.terminalText)
    ).toBe(true);
    expect(["passkey", "retina", "voice", "fingerprint"]).toContain(
      result.current.activeMethod
    );
    expect(result.current.modal.open).toBe(false);
  });

  it("login with valid demo credentials transitions to authenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("user@example.com", "password1");
    });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.user?.email).toBe("user@example.com");
    expect(result.current.error).toBeNull();
    expect(result.current.modal.open).toBe(true);
    expect(result.current.modal.isSuccess).toBe(true);
  });

  it("short passkey login fails with error + modal", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("x@y.com", "123");
    });
    expect(result.current.status).not.toBe("loading");
    expect(result.current.modal.open).toBe(true);
  });

  it("register happy path creates user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.register(
        "new@stark.com",
        "password",
        "New Operative"
      );
    });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.user?.fullName).toBe("New Operative");
    expect(result.current.modal.title).toBe("REGISTRATION COMPLETE");
  });

  it("duplicate register fails with email-already-in-use error", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.register("dup@x.co", "password", "A");
    });
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.register("dup@x.co", "password", "B");
    });
    expect(result.current.error).not.toBeNull();
    expect(result.current.modal.isSuccess).toBe(false);
  });

  it("logout resets user to null", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("a@b.co", "password1");
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe("unauthenticated");
  });

  it("toggleMode flips register/login mode", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    const first = result.current.isRegisterMode;
    act(() => result.current.toggleMode());
    expect(result.current.isRegisterMode).toBe(!first);
    act(() => result.current.toggleMode());
    expect(result.current.isRegisterMode).toBe(first);
  });

  it("toggleAudio flips audioEnabled flag", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    const initial = result.current.audioEnabled;
    act(() => result.current.toggleAudio());
    expect(result.current.audioEnabled).toBe(!initial);
  });

  it("setActiveMethod changes active biometric method", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setActiveMethod("voice"));
    expect(result.current.activeMethod).toBe("voice");
    act(() => result.current.setActiveMethod("fingerprint"));
    expect(result.current.activeMethod).toBe("fingerprint");
  });

  it("showModal/closeModal open/close the modal", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() =>
      result.current.showModal(true, "WELCOME", "Welcome home, operative.")
    );
    expect(result.current.modal).toEqual({
      open: true,
      isSuccess: true,
      title: "WELCOME",
      message: "Welcome home, operative.",
    });
    act(() => result.current.closeModal());
    expect(result.current.modal.open).toBe(false);
  });

  it("enrollBiometrics fails without active session then succeeds after login", async () => {
    mockedEnrollPlatform.mockResolvedValue({
      success: true,
      email: "e@e.ee",
      credentialId: "cred-ctx",
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.enrollBiometrics();
    });
    expect(result.current.modal.isSuccess).toBe(false);
    expect(mockedEnrollPlatform).not.toHaveBeenCalled();
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.login("e@e.ee", "password1");
    });
    act(() => result.current.closeModal());
    const preBio = result.current.user?.hasBiometrics;
    await act(async () => {
      await result.current.enrollBiometrics();
    });
    expect(result.current.user?.hasBiometrics).toBe(true);
    expect(result.current.user?.hasBiometrics).not.toBe(preBio);
  });

  it("hasBiometrics persists through logout/login round-trip (Bug-02 regression)", async () => {
    mockedEnrollPlatform.mockResolvedValue({
      success: true,
      email: "bio@persist.io",
      credentialId: "cred-persist",
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.register("bio@persist.io", "password1", "Bio Tester");
    });
    act(() => result.current.closeModal());
    expect(result.current.user?.hasBiometrics).toBe(false);
    await act(async () => {
      await result.current.enrollBiometrics();
    });
    expect(result.current.user?.hasBiometrics).toBe(true);
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.status).toBe("unauthenticated");
    await act(async () => {
      await result.current.login("bio@persist.io", "password1");
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.hasBiometrics).toBe(true);
  });

  it("resetPassword opens success modal when email provided", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.resetPassword("x@y.com");
    });
    expect(result.current.modal.open).toBe(true);
  });

  it("verifyFace/verifyVoice/verifyFingerprint auto-authenticate", async () => {
    // Face: real platform assertion → session
    mockedVerifyPlatform.mockResolvedValue({
      success: true,
      email: "face@ctx.io",
      credentialId: "cred-face",
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.verifyFace();
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.email).toBe("face@ctx.io");
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.logout();
    });

    // Voice: register first, then login
    mockedExtractVoiceprint.mockResolvedValue(fixedVoiceprint());
    await act(async () => {
      await result.current.login("voice@ctx.io", "password1");
    });
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.enrollVoice(new Blob(["sample"]));
    });
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.status).toBe("unauthenticated");
    await act(async () => {
      await result.current.verifyVoice(new Blob(["probe"]));
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.email).toBe("voice@ctx.io");
    act(() => result.current.closeModal());
    await act(async () => {
      await result.current.logout();
    });

    // Fingerprint: real platform assertion → session
    mockedVerifyPlatform.mockResolvedValue({
      success: true,
      email: "fp@ctx.io",
      credentialId: "cred-fp",
    });
    await act(async () => {
      await result.current.verifyFingerprint();
    });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.email).toBe("fp@ctx.io");
  });
});
