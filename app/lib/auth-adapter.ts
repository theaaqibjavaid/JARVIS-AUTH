import type { AuthAdapter, AuthResult, UserProfile } from "../types";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

const STORAGE_KEY = "jarvis_auth_user";
const DEMO_USERS: Record<string, { passkey: string; user: UserProfile }> = {};

export function __resetMockAdapterStateForTests(): void {
  Object.keys(DEMO_USERS).forEach((k) => delete DEMO_USERS[k]);
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
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

    if (email && passkey.length >= 6) {
      const user: UserProfile = {
        uid: generateUid("MOCK"),
        email: key,
        fullName: email.split("@")[0] || "Operative",
        clearanceLevel: "Level 1",
        hasBiometrics: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      this.currentUser = user;
      persistUser(user);
      this.emit(user);
      return { success: true, user };
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
    return {
      success: true,
      user: undefined,
    };
  }

  async verifyFace(_imageBase64: string): Promise<AuthResult> {
    const user = this.currentUser || {
      uid: generateUid("FACE"),
      email: "stark@avengers.io",
      fullName: "Tony Stark (Facial Match)",
      clearanceLevel: "Level 1",
      hasBiometrics: true,
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = user;
    persistUser(user);
    this.emit(user);
    return { success: true, user };
  }

  async verifyVoice(_audioBlob: Blob): Promise<AuthResult> {
    const user = this.currentUser || {
      uid: generateUid("VOICE"),
      email: "stark@avengers.io",
      fullName: "Tony Stark (Voice Match)",
      clearanceLevel: "Level 1",
      hasBiometrics: true,
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = user;
    persistUser(user);
    this.emit(user);
    return { success: true, user };
  }

  async verifyFingerprint(_scanData: string): Promise<AuthResult> {
    const user = this.currentUser || {
      uid: generateUid("FP"),
      email: "stark@avengers.io",
      fullName: "Tony Stark (Fingerprint Match)",
      clearanceLevel: "Level 1",
      hasBiometrics: true,
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = user;
    persistUser(user);
    this.emit(user);
    return { success: true, user };
  }

  async enrollBiometrics(userId: string): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required for biometric enrollment.",
        errorCode: "no-session",
      };
    }
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
    return { success: true, user: this.currentUser };
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
    return { success: true };
  }

  async verifyFace(imageBase64: string): Promise<AuthResult> {
    try {
      const data = await this.request<{ success: boolean; user: UserProfile }>(
        "/api/v1/auth/verify-face",
        {
          method: "POST",
          body: JSON.stringify({ image_base64: imageBase64 }),
        }
      );
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
      }
      return { success: data.success, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message || "Facial verification failed" };
    }
  }

  async verifyVoice(audioBlob: Blob): Promise<AuthResult> {
    try {
      const fd = new FormData();
      fd.append("file", audioBlob, "voice.wav");
      const res = await fetch(`${this.baseUrl}/api/v1/auth/verify-voice`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = (await res.json()) as { success: boolean; user: UserProfile };
      if (data.success && data.user) {
        this.currentUser = { ...data.user, lastLoginAt: new Date().toISOString() };
        persistUser(this.currentUser);
        this.emit(this.currentUser);
      }
      return { success: data.success, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message || "Voice verification failed" };
    }
  }

  async verifyFingerprint(_scanData: string): Promise<AuthResult> {
    const fallbackUser: UserProfile = {
      uid: generateUid("FP-BE"),
      email: "stark@avengers.io",
      fullName: "Tony Stark (Backend FP)",
      clearanceLevel: "Level 1",
      hasBiometrics: true,
      lastLoginAt: new Date().toISOString(),
    };
    this.currentUser = fallbackUser;
    persistUser(fallbackUser);
    this.emit(fallbackUser);
    return { success: true, user: fallbackUser };
  }

  async enrollBiometrics(_userId: string): Promise<AuthResult> {
    if (!this.currentUser) {
      return {
        success: false,
        error: "Active session required.",
        errorCode: "no-session",
      };
    }
    this.currentUser = { ...this.currentUser, hasBiometrics: true };
    persistUser(this.currentUser);
    this.emit(this.currentUser);
    return { success: true, user: this.currentUser };
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

export type AuthAdapterName = "mock" | "backend" | "firebase";

export function createAuthAdapter(
  kind: AuthAdapterName = "mock",
  options?: { baseUrl?: string }
): AuthAdapter {
  switch (kind) {
    case "backend":
      return new BackendAuthAdapter(options?.baseUrl);
    case "firebase":
      return new MockAuthAdapter();
    case "mock":
    default:
      return new MockAuthAdapter();
  }
}
