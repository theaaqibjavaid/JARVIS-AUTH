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
  verifyFace(imageBase64: string): Promise<AuthResult>;
  verifyVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyFingerprint(scanData: string): Promise<AuthResult>;
  enrollBiometrics(userId: string): Promise<AuthResult>;
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
