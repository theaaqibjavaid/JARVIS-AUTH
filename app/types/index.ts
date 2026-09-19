export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";

export type BiometricMethod = "passkey" | "retina" | "voice" | "fingerprint";

export type ClearanceLevel = "Level 1" | "Level 2" | "Level 3" | "Admin";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  clearanceLevel: ClearanceLevel;
  hasBiometrics: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  errorCode?: string;
  /** Generated reset token (mock adapter only; real adapters deliver via email). */
  resetToken?: string;
}

export interface AuthAdapter {
  readonly name: string;
  register(
    email: string,
    passkey: string,
    fullName: string
  ): Promise<AuthResult>;
  login(email: string, passkey: string): Promise<AuthResult>;
  logout(): Promise<AuthResult>;
  resetPassword(email: string): Promise<AuthResult>;
  /** Confirm a password reset using the token issued by resetPassword(request). */
  resetPasswordConfirm(
    email: string,
    token: string,
    newPasskey: string
  ): Promise<AuthResult>;
  /** Device face auth via WebAuthn platform authenticator (Windows Hello / Face ID). */
  verifyFace(): Promise<AuthResult>;
  /** Voice auth via real DSP voiceprint matching against an enrolled sample. */
  verifyVoice(audioBlob: Blob): Promise<AuthResult>;
  /** Device fingerprint auth via WebAuthn platform authenticator (Touch ID / Windows Hello). */
  verifyFingerprint(): Promise<AuthResult>;
  /** Enroll device biometric (WebAuthn platform authenticator). */
  enrollBiometrics(userId: string): Promise<AuthResult>;
  /** Enroll a voiceprint from a recorded sample. */
  enrollVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyPasskey(email?: string): Promise<AuthResult>;
  getCurrentUser(): Promise<UserProfile | null>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}

export interface TelemetryData {
  cpu: number;
  memory: string;
  authState: "CONNECTED" | "DISCONNECTED";
  power: number;
}

export interface TerminalMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
}

export interface AccessModalState {
  open: boolean;
  isSuccess: boolean;
  title: string;
  message: string;
}
