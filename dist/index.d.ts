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
}
interface AuthAdapter {
    readonly name: string;
    register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
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
    verifyFace(_imageBase64: string): Promise<AuthResult>;
    verifyVoice(_audioBlob: Blob): Promise<AuthResult>;
    verifyFingerprint(_scanData: string): Promise<AuthResult>;
    enrollBiometrics(userId: string): Promise<AuthResult>;
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
    verifyFace(imageBase64: string): Promise<AuthResult>;
    verifyVoice(audioBlob: Blob): Promise<AuthResult>;
    verifyFingerprint(_scanData: string): Promise<AuthResult>;
    enrollBiometrics(_userId: string): Promise<AuthResult>;
    verifyPasskey(_email?: string): Promise<AuthResult>;
    getCurrentUser(): Promise<UserProfile | null>;
    onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
type AuthAdapterName = "mock" | "backend" | "firebase";
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
    verifyFace: (imageBase64: string) => Promise<void>;
    verifyVoice: (audioBlob: Blob) => Promise<void>;
    verifyFingerprint: (scanData: string) => Promise<void>;
    enrollBiometrics: () => Promise<void>;
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
}

declare function AuthPortal(): react.JSX.Element;

declare function ArcReactorHud(): react.JSX.Element;

declare function CanvasBackground(): react.JSX.Element;

declare function PasskeyForm(): react.JSX.Element;

declare function FacialScanner(): react.JSX.Element;

declare function VoiceScanner(): react.JSX.Element;

declare function FingerprintPad(): react.JSX.Element;

export { type AccessModalState, ArcReactorHud, type AuthAdapter, type AuthAdapterName, type AuthContextValue, AuthPortal, AuthProvider, type AuthResult, type AuthStatus, BackendAuthAdapter, type BiometricMethod, CanvasBackground, type ClearanceLevel, FacialScanner, FingerprintPad, MockAuthAdapter, PasskeyForm, SoundEngine, type TelemetryData, type TerminalMessage, type UserProfile, VoiceScanner, __resetMockAdapterStateForTests, createAuthAdapter, useAuth };
