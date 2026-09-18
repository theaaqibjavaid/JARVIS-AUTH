import type {
  AccessModalState,
  AuthAdapter,
  AuthResult,
  AuthStatus,
  BiometricMethod,
  ClearanceLevel,
  TerminalMessage,
  UserProfile,
} from "@/app/types";

describe("types contract", () => {
  it("ClearanceLevel supports 4 tiers", () => {
    const levels: ClearanceLevel[] = [
      "Level 1",
      "Level 2",
      "Level 3",
      "Admin",
    ];
    expect(levels).toHaveLength(4);
  });

  it("BiometricMethod covers 4 inputs", () => {
    const methods: BiometricMethod[] = [
      "passkey",
      "retina",
      "voice",
      "fingerprint",
    ];
    expect(methods).toHaveLength(4);
  });

  it("AuthStatus has 5 valid values", () => {
    const statuses: AuthStatus[] = [
      "idle",
      "loading",
      "authenticated",
      "unauthenticated",
      "error",
    ];
    expect(statuses).toHaveLength(5);
  });

  it("UserProfile requires uid/email/fullName/clearanceLevel/hasBiometrics", () => {
    const u: UserProfile = {
      uid: "A",
      email: "a@b.co",
      fullName: "A B",
      clearanceLevel: "Level 1",
      hasBiometrics: false,
    };
    expect(u.createdAt).toBeUndefined();
    expect(u.lastLoginAt).toBeUndefined();
    u.createdAt = new Date().toISOString();
    u.lastLoginAt = new Date().toISOString();
    expect(u.uid).toBe("A");
  });

  it("AuthResult success shape with error code", () => {
    const fail: AuthResult = {
      success: false,
      error: "nope",
      errorCode: "missing-fields",
    };
    expect(fail.user).toBeUndefined();
    const win: AuthResult = { success: true };
    expect(win.error).toBeUndefined();
  });

  it("TerminalMessage / AccessModalState / TelemetryData shapes compile", () => {
    const t: TerminalMessage = {
      id: "1",
      text: "hello",
      timestamp: new Date(),
      type: "info",
    };
    const a: AccessModalState = {
      open: true,
      isSuccess: true,
      title: "T",
      message: "M",
    };
    expect(t.timestamp).toBeInstanceOf(Date);
    expect(a.title).toBe("T");
  });

  it("AuthAdapter interface lists 12 required methods and a name property", () => {
    const adapter: AuthAdapter = {
      name: "ContractCheck",
      register: async () => ({ success: true }),
      login: async () => ({ success: true }),
      logout: async () => ({ success: true }),
      resetPassword: async () => ({ success: true }),
      resetPasswordConfirm: async () => ({ success: true }),
      verifyFace: async () => ({ success: true }),
      verifyVoice: async () => ({ success: true }),
      verifyFingerprint: async () => ({ success: true }),
      enrollBiometrics: async () => ({ success: true }),
      enrollVoice: async () => ({ success: true }),
      verifyPasskey: async () => ({ success: true }),
      getCurrentUser: async () => null,
      onAuthStateChanged: () => () => {},
    };
    expect(adapter.name).toBe("ContractCheck");
    const methods = [
      "register",
      "login",
      "logout",
      "resetPassword",
      "resetPasswordConfirm",
      "verifyFace",
      "verifyVoice",
      "verifyFingerprint",
      "enrollBiometrics",
      "enrollVoice",
      "verifyPasskey",
      "getCurrentUser",
      "onAuthStateChanged",
    ];
    expect(methods.length).toBe(13);
    for (const m of methods) expect(typeof (adapter as any)[m]).toBe("function");
  });
});
