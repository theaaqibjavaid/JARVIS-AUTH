import type { AuthAdapter, AuthResult, UserProfile } from "../types";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  enrollPlatformBiometric,
  verifyPlatformBiometric,
  PlatformCredentialStore,
} from "./webauthn-biometrics";
import { extractVoiceprint, VoiceprintStore } from "./voiceprint";

const STORAGE_KEY = "jarvis_auth_user";
const DEMO_USERS: Record<string, { passkey: string; user: UserProfile }> = {};

const voiceprintStore = new VoiceprintStore();
const platformCredentialStore = new PlatformCredentialStore();

export function __resetMockAdapterStateForTests(): void {
  Object.keys(DEMO_USERS).forEach((k) => delete DEMO_USERS[k]);
  voiceprintStore.clear();
  platformCredentialStore.clear();
}

function generateUid(prefix = "OP"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function persistUser(user: UserProfile | null) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function readPersistedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export class MockAuthAdapter implements AuthAdapter {
  readonly name = "MockAuthAdapter";
  private listeners = new Set<(user: UserProfile | null) => void>();
  private currentUser: UserProfile | null = null;

  constructor() {
    this.currentUser = readPersistedUser();
  }

  private emit(user: UserProfile | null) {
    this.listeners.forEach((cb) => {
      try {
        cb(user);
      } catch {
        /* noop */
      }
    });
  }

  async register(
    email: string,
    passkey: string,
    fullName: string
  ): Promise<AuthResult> {
    if (!email || !passkey || !fullName) {
      return {
        success: false,
        error: "All fields are required to register an operative.",
        errorCode: "missing-fields",
      };
    }
    if (passkey.length < 6) {
      return {
        success: false,
        error: "Passkey must be at least 6 characters long.",
        errorCode: "weak-passkey",
      };
    }
    if (DEMO_USERS[email.toLowerCase()]) {
      return {
        success: false,
        error: "This email is already registered. Please switch to Sign In.",
        errorCode: "email-already-in-use",
      };
    }

    const user: UserProfile = {
      uid: generateUid("REG"),
      email: email.toLowerCase(),
      fullName: fullName || "Operative",
      clearanceLevel: "Level 1",
      hasBiometrics: false,
      createdAt: new Date().toISOString(),
    };

    DEMO_USERS[email.toLowerCase()] = { passkey, user };
    this.currentUser = { ...user, lastLoginAt: new Date().toISOString() };
    persistUser(this.currentUser);
    this.emit(this.currentUser);

    return { success: true, user: this.currentUser };
  }

  async login(email: string, passkey: string): Promise<AuthResult> {
    const key = email.toLowerCase();
    const entry = DEMO_USERS[key];

    if (entry) {
      if (entry.passkey !== passkey) {
        return {
          success: false,
          error: "Invalid email or passkey combination.",
          errorCode: "invalid-credential",
        };
      }
      this.currentUser = { ...entry.user, lastLoginAt: new Date().toISOString() };
      persistUser(this.currentUser);
      this.emit(this.currentUser);
      return { success: true, user: this.currentUser };
    }

    return {
      success: false,
      error: "Invalid email or passkey combination.",
      errorCode: "invalid-credential",
    };
  }

  async logout(): Promise<AuthResult> {
    this.currentUser = null;
    persistUser(null);
    this.emit(null);
    return { success: true };
  }

  async resetPassword(email: string): Promise<AuthResult> {
    if (!email) {
      return {
        success: false,
        error: "Please enter your email address first.",
        errorCode: "missing-email",
      };
    }
    // Mock adapter generates a visible token so the reset flow can be tested
    // end-to-end without a real SMTP server. Production adapters deliver the
    // token via email and return success without a token field.
    const token = crypto.randomUUID();
    return { success: true, resetToken: token };
  }

  async resetPasswordConfirm(
    email: string,
    token: string,
    newPasskey: string
  ): Promise<AuthResult> {
    if (!email || !token || !newPasskey) {
      return {
        success: false,
        error: "Email, token, and new passkey are all required.",
        errorCode: "missing-fields",
      };
    }
    if (newPasskey.length < 6) {
      return {
        success: false,
        error: "New passkey must be at least 6 characters long.",
        errorCode: "weak-passkey",
      };
    }
    const key = email.toLowerCase();
    const entry = DEMO_USERS[key];
    if (!entry) {
      return {
        success: false,
        error: "No account found for this email.",
        errorCode: "user-not-found",
      };
    }
    entry.passkey = newPasskey;
    return { success: true };
  }

  /** Resolve a full profile for an email — returns null if no account exists. */
  private resolveUserByEmail(email: string): UserProfile | null {
    const key = email.toLowerCase();
    const entry = DEMO_USERS[key];
    if (entry) return entry.user;
    return null;
  }

  /** Stamp, persist and broadcast an authenticated user. */
  private commitUser(user: UserProfile): UserProfile {
    const stamped: UserProfile = {
      ...user,
      hasBiometrics: true,
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = stamped;
    persistUser(stamped);
    this.emit(stamped);
    return stamped;
  }

  private markBiometricsEnrolled(): void {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, hasBiometrics: true };
    const key = this.currentUser.email.toLowerCase();
    if (DEMO_USERS[key]) {
      DEMO_USERS[key] = {
        ...DEMO_USERS[key],
        user: { ...DEMO_USERS[key].user, hasBiometrics: true },
      };
    }
    persistUser(this.currentUser);
    this.emit(this.currentUser);
  }

  async verifyFace(): Promise<AuthResult> {
    const result = await verifyPlatformBiometric(
      this.currentUser?.email,
      platformCredentialStore
    );
    if (!result.success || !result.email) {
      return {
        success: false,
        error: result.error || "Device biometric verification failed.",
        errorCode: result.errorCode || "biometric-failed",
      };
    }
    const user = this.resolveUserByEmail(result.email);
    if (!user) {
      return {
        success: false,
        error: "No account found for this biometric credential.",
        errorCode: "user-not-found",
      };
    }
    return { success: true, user: this.commitUser(user) };
  }

  async verifyVoice(audioBlob: Blob): Promise<AuthResult> {
    try {
      const probe = await extractVoiceprint(audioBlob);
      const match = await voiceprintStore.matchBest(probe);
      if (!match) {
        return {
          success: false,
          error:
            "Voice did not match any enrolled operative. Re-enroll or try again.",
          errorCode: "voice-no-match",
        };
      }
      const user = this.resolveUserByEmail(match.email);
      if (!user) {
        return {
          success: false,
          error: "No account found for this voiceprint.",
          errorCode: "user-not-found",
        };
      }
      return { success: true, user: this.commitUser(user) };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Voice verification failed.",
        errorCode: "voice-error",
      };
    }
  }

  async verifyFingerprint(): Promise<AuthResult> {
    const result = await verifyPlatformBiometric(
      this.currentUser?.email,
      platformCredentialStore
    );
    if (!result.success || !result.email) {
      return {
        success: false,
        error: result.error || "Device biometric verification failed.",
        errorCode: result.errorCode || "biometric-failed",
      };
    }
    const user = this.resolveUserByEmail(result.email);
    if (!user) {
      return {
        success: false,
        error: "No account found for this biometric credential.",
        errorCode: "user-not-found",
      };
    }
    return { success: true, user: this.commitUser(user) };
  }

  async enrollBiometrics(_userId: string): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required for biometric enrollment.",
        errorCode: "no-session",
      };
    }
    const result = await enrollPlatformBiometric(
      {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        fullName: this.currentUser.fullName,
      },
      platformCredentialStore
    );
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Device biometric enrollment failed.",
        errorCode: result.errorCode || "enroll-failed",
      };
    }
    this.markBiometricsEnrolled();
    return { success: true, user: this.currentUser };
  }

  async enrollVoice(audioBlob: Blob): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required for voice enrollment.",
        errorCode: "no-session",
      };
    }
    try {
      const voiceprint = await extractVoiceprint(audioBlob);
      await voiceprintStore.enroll(this.currentUser.email, voiceprint);
      this.markBiometricsEnrolled();
      return { success: true, user: this.currentUser };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Voice enrollment failed.",
        errorCode: "voice-enroll-error",
      };
    }
  }

  async verifyPasskey(_email?: string): Promise<AuthResult> {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      return {
        success: false,
        error: "WebAuthn / Passkey authentication is not supported in this environment.",
        errorCode: "passkey-not-supported",
      };
    }
    try {
      const email = _email ?? this.currentUser?.email ?? "";
      const options = await fetch(
        `${typeof process !== "undefined"
          ? (process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:8000")
          : "http://localhost:8000"
        }/api/v1/auth/webauthn/options?email=${encodeURIComponent(email)}`,
      ).then((r) => r.json());
      const credential = await startAuthentication(options);
      const verification: { success: boolean; user?: UserProfile; error?: string } = await fetch(
        `${typeof process !== "undefined"
          ? (process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:8000")
          : "http://localhost:8000"
        }/api/v1/auth/webauthn/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential),
        },
      ).then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      });
      if (verification.success && verification.user) {
        this.currentUser = { ...verification.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
        return { success: true, user: this.currentUser };
      }
      return {
        success: false,
        error: verification.error || "Passkey verification failed on server.",
        errorCode: "passkey-verification-failed",
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Passkey authentication failed.",
        errorCode: "passkey-auth-error",
      };
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return this.currentUser;
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    queueMicrotask(() => callback(this.currentUser));
    return () => this.listeners.delete(callback);
  }
}

export class BackendAuthAdapter implements AuthAdapter {
  readonly name = "BackendAuthAdapter";
  private listeners = new Set<(user: UserProfile | null) => void>();
  private currentUser: UserProfile | null = null;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof process !== "undefined"
        ? (process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:8000")
        : "http://localhost:8000");
    this.currentUser = readPersistedUser();
  }

  private emit(user: UserProfile | null) {
    this.listeners.forEach((cb) => {
      try {
        cb(user);
      } catch {
        /* noop */
      }
    });
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return (await res.json()) as T;
  }

  async register(
    email: string,
    passkey: string,
    fullName: string
  ): Promise<AuthResult> {
    try {
      const data = await this.request<{ success: boolean; user: UserProfile }>(
        "/api/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            passkey,
            full_name: fullName,
          }),
        }
      );
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
      }
      return { success: data.success, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message || "Registration failed" };
    }
  }

  async login(email: string, passkey: string): Promise<AuthResult> {
    try {
      const data = await this.request<{ success: boolean; user: UserProfile }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, passkey }),
        }
      );
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
      }
      return { success: data.success, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message || "Login failed" };
    }
  }

  async logout(): Promise<AuthResult> {
    this.currentUser = null;
    persistUser(null);
    this.emit(null);
    return { success: true };
  }

  async resetPassword(email: string): Promise<AuthResult> {
    if (!email) {
      return {
        success: false,
        error: "Please enter your email address first.",
        errorCode: "missing-email",
      };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/reset-password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
      return { success: false, error: data.detail ?? "Reset request failed" };
    } catch {
      return { success: false, error: "Failed to contact authentication server." };
    }
  }

  async resetPasswordConfirm(
    email: string,
    token: string,
    newPasskey: string
  ): Promise<AuthResult> {
    if (!email || !token || !newPasskey) {
      return {
        success: false,
        error: "Email, token, and new passkey are all required.",
        errorCode: "missing-fields",
      };
    }
    if (newPasskey.length < 6) {
      return {
        success: false,
        error: "New passkey must be at least 6 characters long.",
        errorCode: "weak-passkey",
      };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/reset-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), token, new_passkey: newPasskey }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
      return { success: false, error: data.detail ?? "Reset confirmation failed" };
    } catch {
      return { success: false, error: "Failed to contact authentication server." };
    }
  }

  /** Establish a session with the backend after a successful local biometric gate. */
  private async biometricLogin(
    email: string,
    method: "face" | "voice" | "fingerprint",
    credentialId?: string
  ): Promise<AuthResult> {
    try {
      const data = await this.request<{ success: boolean; user: UserProfile }>(
        "/api/v1/auth/biometric-login",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            method,
            credential_id: credentialId,
          }),
        }
      );
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
        return { success: true, user: this.currentUser };
      }
      return {
        success: false,
        error: "Biometric login was rejected by the server.",
        errorCode: "biometric-login-rejected",
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Biometric login failed" };
    }
  }

  async verifyFace(): Promise<AuthResult> {
    const result = await verifyPlatformBiometric(
      this.currentUser?.email,
      platformCredentialStore
    );
    if (!result.success || !result.email) {
      return {
        success: false,
        error: result.error || "Device biometric verification failed.",
        errorCode: result.errorCode || "biometric-failed",
      };
    }
    return this.biometricLogin(result.email, "face", result.credentialId);
  }

  async verifyVoice(audioBlob: Blob): Promise<AuthResult> {
    try {
      const probe = await extractVoiceprint(audioBlob);
      const match = await voiceprintStore.matchBest(probe);
      if (!match) {
        return {
          success: false,
          error: "Voice did not match any enrolled operative.",
          errorCode: "voice-no-match",
        };
      }
      return this.biometricLogin(match.email, "voice");
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Voice verification failed.",
        errorCode: "voice-error",
      };
    }
  }

  async verifyFingerprint(): Promise<AuthResult> {
    const result = await verifyPlatformBiometric(
      this.currentUser?.email,
      platformCredentialStore
    );
    if (!result.success || !result.email) {
      return {
        success: false,
        error: result.error || "Device biometric verification failed.",
        errorCode: result.errorCode || "biometric-failed",
      };
    }
    return this.biometricLogin(result.email, "fingerprint", result.credentialId);
  }

  async enrollBiometrics(_userId: string): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required.",
        errorCode: "no-session",
      };
    }
    const result = await enrollPlatformBiometric(
      {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        fullName: this.currentUser.fullName,
      },
      platformCredentialStore
    );
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Device biometric enrollment failed.",
        errorCode: result.errorCode || "enroll-failed",
      };
    }
    // Inform the backend so it can persist the credential binding. Non-fatal:
    // the client-side credential store already holds the platform credential.
    try {
      await this.request("/api/v1/auth/enroll-biometric", {
        method: "POST",
        body: JSON.stringify({
          email: this.currentUser.email,
          credential_id: result.credentialId,
        }),
      });
    } catch {
      /* non-fatal */
    }
    this.currentUser = { ...this.currentUser, hasBiometrics: true };
    persistUser(this.currentUser);
    this.emit(this.currentUser);
    return { success: true, user: this.currentUser };
  }

  async enrollVoice(audioBlob: Blob): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required.",
        errorCode: "no-session",
      };
    }
    try {
      const voiceprint = await extractVoiceprint(audioBlob);
      await voiceprintStore.enroll(this.currentUser.email, voiceprint);
      this.currentUser = { ...this.currentUser, hasBiometrics: true };
      persistUser(this.currentUser);
      this.emit(this.currentUser);
      return { success: true, user: this.currentUser };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Voice enrollment failed.",
        errorCode: "voice-enroll-error",
      };
    }
  }

  async verifyPasskey(_email?: string): Promise<AuthResult> {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      return {
        success: false,
        error: "WebAuthn / Passkey authentication is not supported in this environment.",
        errorCode: "passkey-not-supported",
      };
    }
    try {
      const email = _email ?? this.currentUser?.email ?? "";
      const options = await this.request<any>(
        `/api/v1/auth/webauthn/options?email=${encodeURIComponent(email)}`,
      );
      const credential = await startAuthentication(options);
      const data = await this.request<{ success: boolean; user: UserProfile }>(
        "/api/v1/auth/webauthn/verify",
        {
          method: "POST",
          body: JSON.stringify(credential),
        },
      );
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
        return { success: true, user: this.currentUser };
      }
      return {
        success: false,
        error: "Passkey verification failed on server.",
        errorCode: "passkey-verification-failed",
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Passkey authentication failed.",
        errorCode: "passkey-auth-error",
      };
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return this.currentUser;
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    queueMicrotask(() => callback(this.currentUser));
    return () => this.listeners.delete(callback);
  }
}

export type AuthAdapterName = "mock" | "backend";

export function createAuthAdapter(
  kind: AuthAdapterName = "mock",
  options?: { baseUrl?: string }
): AuthAdapter {
  switch (kind) {
    case "backend":
      return new BackendAuthAdapter(options?.baseUrl);
    case "mock":
    default:
      return new MockAuthAdapter();
  }
}
