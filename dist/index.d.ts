import * as react from 'react';
import { ReactNode } from 'react';

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";
type BiometricMethod = "passkey" | "retina" | "voice" | "fingerprint";
type ClearanceLevel = "Level 1" | "Level 2" | "Level 3" | "Admin";
interface UserProfile {
    uid: string;
    email: string;
    fullName: string;
    clearanceLevel: ClearanceLevel;
    hasBiometrics: boolean;
    createdAt?: string;
    lastLoginAt?: string;
}
interface AuthResult {
    success: boolean;
    user?: UserProfile;
    error?: string;
    errorCode?: string;
    /** Debug token issued by mock adapter's resetPassword for use with resetPasswordConfirm. */
    _debugToken?: string;
}
interface AuthAdapter {
    readonly name: string;
    register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
    login(email: string, passkey: string): Promise<AuthResult>;
    logout(): Promise<AuthResult>;
    resetPassword(email: string): Promise<AuthResult>;
    /** Confirm a password reset using the token issued by resetPassword(request). */
    resetPasswordConfirm(email: string, token: string, newPasskey: string): Promise<AuthResult>;
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
interface TelemetryData {
    cpu: number;
    memory: string;
    authState: "CONNECTED" | "DISCONNECTED";
    power: number;
}
interface TerminalMessage {
    id: string;
    text: string;
    timestamp: Date;
    type: "info" | "success" | "error" | "warning";
}
interface AccessModalState {
    open: boolean;
    isSuccess: boolean;
    title: string;
    message: string;
}

declare function __resetMockAdapterStateForTests(): void;
declare class MockAuthAdapter implements AuthAdapter {
    readonly name = "MockAuthAdapter";
    private listeners;
    private currentUser;
    constructor();
    private emit;
    register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
    login(email: string, passkey: string): Promise<AuthResult>;
    logout(): Promise<AuthResult>;
    resetPassword(email: string): Promise<AuthResult>;
    resetPasswordConfirm(email: string, token: string, newPasskey: string): Promise<AuthResult>;
    /** Resolve a full profile for an email (falls back to a minimal profile). */
    private resolveUserByEmail;
    /** Stamp, persist and broadcast an authenticated user. */
    private commitUser;
    private markBiometricsEnrolled;
    /** Shared real WebAuthn platform-biometric login gate (face + fingerprint). */
    private platformBiometricLogin;
    verifyFace(): Promise<AuthResult>;
    verifyVoice(audioBlob: Blob): Promise<AuthResult>;
    verifyFingerprint(): Promise<AuthResult>;
    enrollBiometrics(_userId: string): Promise<AuthResult>;
    enrollVoice(audioBlob: Blob): Promise<AuthResult>;
    verifyPasskey(_email?: string): Promise<AuthResult>;
    getCurrentUser(): Promise<UserProfile | null>;
    onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
declare class BackendAuthAdapter implements AuthAdapter {
    readonly name = "BackendAuthAdapter";
    private listeners;
    private currentUser;
    private baseUrl;
    constructor(baseUrl?: string);
    private emit;
    private request;
    register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
    login(email: string, passkey: string): Promise<AuthResult>;
    logout(): Promise<AuthResult>;
    resetPassword(email: string): Promise<AuthResult>;
    resetPasswordConfirm(email: string, token: string, newPasskey: string): Promise<AuthResult>;
    /** Establish a session with the backend after a successful local biometric gate. */
    private biometricLogin;
    verifyFace(): Promise<AuthResult>;
    verifyVoice(audioBlob: Blob): Promise<AuthResult>;
    verifyFingerprint(): Promise<AuthResult>;
    enrollBiometrics(_userId: string): Promise<AuthResult>;
    enrollVoice(audioBlob: Blob): Promise<AuthResult>;
    verifyPasskey(_email?: string): Promise<AuthResult>;
    getCurrentUser(): Promise<UserProfile | null>;
    onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
type AuthAdapterName = "mock" | "backend";
declare function createAuthAdapter(kind?: AuthAdapterName, options?: {
    baseUrl?: string;
}): AuthAdapter;

interface AuthContextValue {
    user: UserProfile | null;
    status: AuthStatus;
    error: string | null;
    adapter: AuthAdapter;
    adapterName: AuthAdapterName;
    audioEnabled: boolean;
    activeMethod: BiometricMethod;
    isRegisterMode: boolean;
    terminalText: string;
    modal: AccessModalState;
    login: (email: string, passkey: string) => Promise<void>;
    register: (email: string, passkey: string, fullName: string) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    resetPasswordConfirm: (email: string, token: string, newPasskey: string) => Promise<void>;
    verifyFace: () => Promise<void>;
    verifyVoice: (audioBlob: Blob) => Promise<void>;
    verifyFingerprint: () => Promise<void>;
    enrollBiometrics: () => Promise<void>;
    enrollVoice: (audioBlob: Blob) => Promise<void>;
    verifyPasskey: () => Promise<AuthResult>;
    setActiveMethod: (method: BiometricMethod) => void;
    toggleMode: () => void;
    toggleAudio: () => void;
    updateTerminal: (msg: string) => void;
    showModal: (isSuccess: boolean, title: string, message: string) => void;
    closeModal: () => void;
    playBeep: (freq?: number, type?: OscillatorType, duration?: number) => void;
    playSuccess: () => void;
    playError: () => void;
}
declare function AuthProvider({ children, adapter: adapterArg, adapterOptions, }: {
    children: ReactNode;
    adapter?: AuthAdapterName | AuthAdapter;
    adapterOptions?: {
        baseUrl?: string;
    };
}): react.JSX.Element;
declare function useAuth(): AuthContextValue;

declare class SoundEngine {
    private ctx;
    private ensureContext;
    playBeep(freq?: number, type?: OscillatorType, duration?: number, gain?: number): void;
    playSuccess(): void;
    playError(): void;
    unlock(): void;
    close(): void;
}

declare function AuthPortal(): react.JSX.Element;

declare function ArcReactorHud(): react.JSX.Element;

declare function CanvasBackground(): react.JSX.Element;

declare function PasskeyForm(): react.JSX.Element;

/**
 * Real device face authentication.
 *
 * This does NOT do a fake camera capture. It invokes the OS-level WebAuthn
 * platform authenticator (Windows Hello / Face ID), which owns the camera and
 * performs the genuine biometric match. The raw face data never reaches this
 * app — the OS returns a signed cryptographic assertion instead.
 */
declare function FacialScanner(): react.JSX.Element;

interface VoiceScannerProps {
    /**
     * "enroll" extracts and stores a new voiceprint for the signed-in user.
     * "verify" extracts a probe voiceprint and matches it against enrolled ones.
     */
    mode?: "enroll" | "verify";
}
/**
 * Real voice authentication using client-side DSP.
 *
 * Records a genuine microphone sample, extracts an MFCC voiceprint entirely on
 * device, and either stores it (enroll) or matches it 1:N against enrolled
 * voiceprints (verify). No audio or voiceprint ever leaves the device.
 */
declare function VoiceScanner({ mode }: VoiceScannerProps): react.JSX.Element;

/**
 * Real device fingerprint authentication.
 *
 * This does NOT fabricate a scan string. It invokes the OS-level WebAuthn
 * platform authenticator (Windows Hello fingerprint / Touch ID), which owns the
 * sensor and performs the genuine match. The raw print never leaves the device.
 */
declare function FingerprintPad(): react.JSX.Element;

export { type AccessModalState, ArcReactorHud, type AuthAdapter, type AuthAdapterName, type AuthContextValue, AuthPortal, AuthProvider, type AuthResult, type AuthStatus, BackendAuthAdapter, type BiometricMethod, CanvasBackground, type ClearanceLevel, FacialScanner, FingerprintPad, MockAuthAdapter, PasskeyForm, SoundEngine, type TelemetryData, type TerminalMessage, type UserProfile, VoiceScanner, __resetMockAdapterStateForTests, createAuthAdapter, useAuth };
