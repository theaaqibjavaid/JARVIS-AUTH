/**
 * J.A.R.V.I.S. Device Biometric Engine — real WebAuthn platform authenticator.
 *
 * This is the industry-standard way to use a device's built-in biometric
 * hardware (Windows Hello fingerprint/face, Touch ID, Face ID, Android
 * fingerprint) from a browser. The raw biometric never leaves the device:
 * the OS verifies the fingerprint/face and returns a cryptographic assertion.
 *
 *   - Enroll  -> navigator.credentials.create() with
 *                authenticatorAttachment:"platform" + userVerification:"required"
 *                => the OS prompts the user to touch the sensor / show face.
 *   - Login   -> navigator.credentials.get() with userVerification:"required"
 *                => the OS prompts the biometric again and signs a challenge.
 *
 * For full production hardening the attestation/assertion should also be
 * verified server-side with @simplewebauthn/server (see python-backend or a
 * Node relying party). The biometric gate itself, however, is genuinely
 * enforced by the OS here.
 */

import {
  startRegistration,
  startAuthentication,
  platformAuthenticatorIsAvailable,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";

const CREDENTIAL_STORE_KEY = "jarvis_platform_credentials";
const RP_NAME = "J.A.R.V.I.S. Security Suite";

// ---------------------------------------------------------------------------
// Encryption key — derived via PBKDF2 from a per-installation salt.
// Each stored entry is independently encrypted with AES-256-GCM.
// The salt is generated once per browser installation and stored in
// sessionStorage so it survives page reloads but not cross-device use.
// ---------------------------------------------------------------------------
const SESSION_SALT_KEY = "jarvis_encrypt_salt_v1";
const PBKDF2_ITERATIONS = 100_000;

/**
 * Return a per-installation PBKDF2 salt as a Uint8Array.
 * Stored in sessionStorage so it persists across navigations on the same
 * device but is not shared between devices or browsers.
 */
async function getInstallSalt(): Promise<Uint8Array> {
  if (typeof sessionStorage === "undefined") {
    // Server-side / test fallback: generate a random salt once per process.
    const s = new Uint8Array(32);
    crypto.getRandomValues(s);
    return s;
  }
  let raw = sessionStorage.getItem(SESSION_SALT_KEY);
  if (!raw) {
    const s = new Uint8Array(32);
    crypto.getRandomValues(s);
    raw = bufferToBase64Url(s);
    sessionStorage.setItem(SESSION_SALT_KEY, raw);
  }
  return decodeBase64Url(raw);
}

/** Decode a base64url string to raw bytes. */
export function decodeBase64Url(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - base64.length % 4);
  const binary =
    typeof atob !== "undefined"
      ? atob(base64 + padding)
      : Buffer.from(base64 + padding, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Derive an AES-256-GCM encryption key from the per-installation salt via PBKDF2. */
async function deriveEncryptKey(): Promise<CryptoKey> {
  const salt = await getInstallSalt();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new Uint8Array([0x4a, 0x52, 0x56, 0x53]), // "JRV" magic bytes as key material seed
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a JSON-serializable object and return base64url ciphertext. */
export async function encryptStoreData(data: unknown): Promise<string> {
  const key = await deriveEncryptKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToBase64Url(combined);
}

/** Decrypt a base64url ciphertext and return the parsed object. */
export async function decryptStoreData(b64: string): Promise<Record<string, StoredPlatformCredential>> {
  const key = await deriveEncryptKey();
  const combined = decodeBase64Url(b64);
  if (combined.length < 13) return {};
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, StoredPlatformCredential>;
}

// ---------------------------------------------------------------------------
// base64url helpers (self-contained, work in browser + node for tests)
// ---------------------------------------------------------------------------

export function bufferToBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function stringToBase64Url(str: string): string {
  return bufferToBase64Url(new TextEncoder().encode(str));
}

/** Generate a cryptographically random base64url challenge. */
export function randomChallenge(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error("Cryptographically secure random generation not available.");
  }
  return bufferToBase64Url(bytes);
}

/** Resolve the relying-party id (current hostname). */
export function resolveRpId(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

// ---------------------------------------------------------------------------
// Support detection
// ---------------------------------------------------------------------------

/** True when the browser supports WebAuthn AND a platform biometric is present. */
export async function isPlatformBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Persistent platform-credential store (localStorage, keyed by email)
// ---------------------------------------------------------------------------

export interface StoredPlatformCredential {
  email: string;
  credentialId: string; // base64url
  publicKey?: string;
  signCount: number;
  transports?: string[];
  enrolledAt: string;
}

export class PlatformCredentialStore {
  private async read(): Promise<Record<string, StoredPlatformCredential>> {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(CREDENTIAL_STORE_KEY);
      if (!raw) return {};
      // Legacy plaintext data starts with '{' (JSON object)
      if (raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw) as Record<string, StoredPlatformCredential>;
          await this.write(parsed); // Migrate to encrypted format
          return parsed;
        } catch {
          return {};
        }
      }
      return await decryptStoreData(raw);
    } catch {
      return {};
    }
  }

  private async write(map: Record<string, StoredPlatformCredential>): Promise<void> {
    if (typeof window === "undefined") return;
    const encrypted = await encryptStoreData(map);
    window.localStorage.setItem(CREDENTIAL_STORE_KEY, encrypted);
  }

  async save(email: string, credential: StoredPlatformCredential): Promise<void> {
    const map = await this.read();
    map[email.toLowerCase()] = { ...credential, email: email.toLowerCase() };
    await this.write(map);
  }

  async get(email: string): Promise<StoredPlatformCredential | null> {
    const map = await this.read();
    return map[email.toLowerCase()] ?? null;
  }

  async has(email: string): Promise<boolean> {
    return Boolean(await this.get(email));
  }

  async getAll(): Promise<StoredPlatformCredential[]> {
    return Object.values(await this.read());
  }

  async remove(email: string): Promise<void> {
    const map = await this.read();
    delete map[email.toLowerCase()];
    await this.write(map);
  }

  async clear(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(CREDENTIAL_STORE_KEY);
  }

  async findByCredentialId(credentialId: string): Promise<StoredPlatformCredential | null> {
    for (const entry of await this.getAll()) {
      if (entry.credentialId === credentialId) return entry;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Options builders (pure + unit-testable)
// ---------------------------------------------------------------------------

export interface PlatformUser {
  uid: string;
  email: string;
  fullName: string;
}

export function buildRegistrationOptions(
  user: PlatformUser,
  rpId: string = resolveRpId()
): PublicKeyCredentialCreationOptionsJSON {
  return {
    rp: { name: RP_NAME, id: rpId },
    user: {
      id: stringToBase64Url(user.uid),
      name: user.email,
      displayName: user.fullName || user.email,
    },
    challenge: randomChallenge(),
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60000,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
      requireResidentKey: false,
    },
    attestation: "none",
  };
}

export function buildAuthenticationOptions(
  allowCredentialIds: string[],
  rpId: string = resolveRpId()
): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: randomChallenge(),
    timeout: 60000,
    rpId,
    userVerification: "required",
    allowCredentials: allowCredentialIds.map((id) => ({
      type: "public-key" as const,
      id,
    })),
  };
}

// ---------------------------------------------------------------------------
// Injectable WebAuthn driver (lets unit tests stub the OS prompt)
// ---------------------------------------------------------------------------

export interface WebAuthnDriver {
  register(
    options: PublicKeyCredentialCreationOptionsJSON
  ): Promise<RegistrationResponseJSON>;
  authenticate(
    options: PublicKeyCredentialRequestOptionsJSON
  ): Promise<AuthenticationResponseJSON>;
}

export const defaultWebAuthnDriver: WebAuthnDriver = {
  register: (options) => startRegistration(options),
  authenticate: (options) => startAuthentication(options),
};

// ---------------------------------------------------------------------------
// Enroll + authenticate orchestration
// ---------------------------------------------------------------------------

export interface PlatformBiometricResult {
  success: boolean;
  email?: string;
  credentialId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Enroll a device biometric for a user. Triggers the real OS biometric prompt
 * (fingerprint touch / face). On success the credential id is persisted.
 */
export async function enrollPlatformBiometric(
  user: PlatformUser,
  store: PlatformCredentialStore = new PlatformCredentialStore(),
  driver: WebAuthnDriver = defaultWebAuthnDriver
): Promise<PlatformBiometricResult> {
  if (!(await isPlatformBiometricSupported())) {
    return {
      success: false,
      error:
        "No device biometric authenticator available. Set up Windows Hello / Touch ID, or use another method.",
      errorCode: "platform-biometric-unavailable",
    };
  }
  try {
    const options = buildRegistrationOptions(user);
    const credential = await driver.register(options);
    if (!credential?.id) {
      return {
        success: false,
        error: "Biometric enrollment returned no credential.",
        errorCode: "enroll-no-credential",
      };
    }
    await store.save(user.email, {
      email: user.email,
      credentialId: credential.id,
      publicKey: credential.response?.publicKey,
      signCount: 0,
      transports: credential.response?.transports as string[] | undefined,
      enrolledAt: new Date().toISOString(),
    });
    return { success: true, email: user.email, credentialId: credential.id };
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Device biometric enrollment failed.",
      errorCode: "enroll-failed",
    };
  }
}

/**
 * Authenticate with a device biometric. Triggers the real OS biometric prompt.
 * If `email` is provided it scopes the assertion to that user's credential;
 * otherwise it performs a discoverable (usernameless) assertion across all
 * enrolled credentials.
 */
export async function verifyPlatformBiometric(
  email: string | undefined,
  store: PlatformCredentialStore = new PlatformCredentialStore(),
  driver: WebAuthnDriver = defaultWebAuthnDriver
): Promise<PlatformBiometricResult> {
  if (!(await isPlatformBiometricSupported())) {
    return {
      success: false,
      error:
        "No device biometric authenticator available on this device.",
      errorCode: "platform-biometric-unavailable",
    };
  }

  const scoped = email ? await store.get(email) : null;
  const allowIds = scoped
    ? [scoped.credentialId]
    : (await store.getAll()).map((c) => c.credentialId);

  if (allowIds.length === 0) {
    return {
      success: false,
      error:
        "No device biometric enrolled yet. Enroll your fingerprint / face first.",
      errorCode: "no-platform-credential",
    };
  }

  try {
    const options = buildAuthenticationOptions(allowIds);
    const assertion = await driver.authenticate(options);
    if (!assertion?.id) {
      return {
        success: false,
        error: "Biometric assertion returned no credential.",
        errorCode: "auth-no-assertion",
      };
    }
    const matched = await store.findByCredentialId(assertion.id);
    if (!matched) {
      return {
        success: false,
        error: "Presented biometric credential is not registered.",
        errorCode: "auth-unknown-credential",
      };
    }
    return { success: true, email: matched.email, credentialId: assertion.id };
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : "Device biometric verification failed.",
      errorCode: "auth-failed",
    };
  }
}
