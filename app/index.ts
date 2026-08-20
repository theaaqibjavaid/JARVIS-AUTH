/**
 * @jarvis-security/sdk — Pluggable Authentication Suite
 *
 * Industry-grade futuristic biometric & passkey authentication for any
 * React / Next.js application. Drop-in `<AuthPortal />` + injectable
 * `AuthAdapter` strategy.
 */

export {
  MockAuthAdapter,
  BackendAuthAdapter,
  createAuthAdapter,
  __resetMockAdapterStateForTests,
} from "./lib/auth-adapter";
export type { AuthAdapterName } from "./lib/auth-adapter";

export { AuthProvider, useAuth } from "./context/AuthContext";
export type { AuthContextValue } from "./context/AuthContext";

export { SoundEngine } from "./lib/sound-engine";

export { AuthPortal } from "./components/AuthPortal";
export { ArcReactorHud } from "./components/ArcReactorHud";
export { CanvasBackground } from "./components/CanvasBackground";
export { PasskeyForm } from "./components/biometrics/PasskeyForm";
export { FacialScanner } from "./components/biometrics/FacialScanner";
export { VoiceScanner } from "./components/biometrics/VoiceScanner";
export { FingerprintPad } from "./components/biometrics/FingerprintPad";

export type {
  AuthStatus,
  BiometricMethod,
  ClearanceLevel,
  UserProfile,
  AuthResult,
  AuthAdapter,
  TelemetryData,
  TerminalMessage,
  AccessModalState,
} from "./types";
