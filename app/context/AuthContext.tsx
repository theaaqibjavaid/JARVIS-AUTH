"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AccessModalState,
  AuthAdapter,
  AuthStatus,
  BiometricMethod,
  TerminalMessage,
  UserProfile,
} from "../types";
import {
  createAuthAdapter,
  type AuthAdapterName,
} from "../lib/auth-adapter";
import { SoundEngine } from "../lib/sound-engine";

export interface AuthContextValue {
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
  register: (
    email: string,
    passkey: string,
    fullName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyFace: (imageBase64: string) => Promise<void>;
  verifyVoice: (audioBlob: Blob) => Promise<void>;
  verifyFingerprint: (scanData: string) => Promise<void>;
  enrollBiometrics: () => Promise<void>;
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  adapter: adapterName = "mock",
  adapterOptions,
}: {
  children: ReactNode;
  adapter?: AuthAdapterName;
  adapterOptions?: { baseUrl?: string };
}) {
  const adapter = useMemo(
    () => createAuthAdapter(adapterName, adapterOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapterName]
  );

  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [activeMethod, setActiveMethodState] =
    useState<BiometricMethod>("passkey");
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [terminalText, setTerminalText] = useState<string>(
    "Greetings. System active. Enter valid credentials or register new clearance."
  );
  const [modal, setModal] = useState<AccessModalState>({
    open: false,
    isSuccess: true,
    title: "",
    message: "",
  });

  const sound = useMemo(() => new SoundEngine(), []);

  const playBeep = useCallback(
    (freq = 800, type: OscillatorType = "sine", duration = 0.1) => {
      if (!audioEnabled) return;
      sound.playBeep(freq, type, duration);
    },
    [audioEnabled, sound]
  );

  const playSuccess = useCallback(() => {
    if (!audioEnabled) return;
    sound.playSuccess();
  }, [audioEnabled, sound]);

  const playError = useCallback(() => {
    if (!audioEnabled) return;
    sound.playError();
  }, [audioEnabled, sound]);

  const updateTerminal = useCallback((msg: string) => {
    setTerminalText(msg);
  }, []);

  const showModal = useCallback(
    (isSuccess: boolean, title: string, message: string) => {
      setModal({ open: true, isSuccess, title, message });
      if (isSuccess) {
        playSuccess();
      } else {
        playError();
      }
    },
    [playSuccess, playError]
  );

  const closeModal = useCallback(() => {
    playBeep(800, "sine", 0.05);
    setModal((m) => ({ ...m, open: false }));
  }, [playBeep]);

  const setActiveMethod = useCallback(
    (method: BiometricMethod) => {
      setActiveMethodState(method);
      playBeep(700, "sine", 0.1);
      const msgs: Record<BiometricMethod, string> = {
        passkey: "Passkey entry active.",
        retina: "Facial scan camera matrix standby.",
        voice: "Voice spectral analyzer standby.",
        fingerprint: "Fingerprint capacitive scanner standby.",
      };
      updateTerminal(msgs[method]);
    },
    [playBeep, updateTerminal]
  );

  const toggleMode = useCallback(() => {
    setIsRegisterMode((m) => !m);
    setError(null);
    playBeep(900, "sine", 0.1);
    updateTerminal(
      !isRegisterMode
        ? "Registration mode active. Submit email and passkey."
        : "Sign in mode active."
    );
  }, [isRegisterMode, playBeep, updateTerminal]);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((a) => {
      const next = !a;
      if (next) {
        sound.playBeep(1000, "sine", 0.1);
        updateTerminal("Audio sound system online.");
      } else {
        updateTerminal("Audio sound system muted.");
      }
      return next;
    });
  }, [sound, updateTerminal]);

  useEffect(() => {
    setStatus("loading");
    const unsub = adapter.onAuthStateChanged((u) => {
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
    });
    adapter.getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        setStatus("authenticated");
      }
    });
    return unsub;
  }, [adapter]);

  const login = useCallback(
    async (email: string, passkey: string) => {
      setStatus("loading");
      setError(null);
      updateTerminal("Validating credentials with authentication core...");
      const res = await adapter.login(email, passkey);
      if (!res.success) {
        setError(res.error || "Authentication failed");
        setStatus("error");
        playError();
        updateTerminal(`[ERROR]: ${res.error}`);
        showModal(false, "AUTHENTICATION FAILED", res.error || "");
        return;
      }
      setStatus("authenticated");
      showModal(
        true,
        "ACCESS GRANTED",
        `Security clearance confirmed for ${email}. Welcome back.`
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const register = useCallback(
    async (email: string, passkey: string, fullName: string) => {
      setStatus("loading");
      setError(null);
      updateTerminal("Creating new operative clearance record...");
      const res = await adapter.register(email, passkey, fullName);
      if (!res.success) {
        setError(res.error || "Registration failed");
        setStatus("error");
        playError();
        updateTerminal(`[ERROR]: ${res.error}`);
        showModal(false, "REGISTRATION FAILED", res.error || "");
        return;
      }
      setStatus("authenticated");
      showModal(
        true,
        "REGISTRATION COMPLETE",
        `Operative [${email}] successfully enrolled into Stark Security Database.`
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const logout = useCallback(async () => {
    setStatus("loading");
    await adapter.logout();
    setStatus("unauthenticated");
    setUser(null);
    playBeep(400, "sine", 0.2);
    updateTerminal("Session terminated.");
  }, [adapter, playBeep, updateTerminal]);

  const resetPassword = useCallback(
    async (email: string) => {
      const res = await adapter.resetPassword(email);
      if (!res.success) {
        playError();
        showModal(false, "RECOVERY ERROR", res.error || "");
        return;
      }
      showModal(
        true,
        "RECOVERY DISPATCHED",
        `Passkey reset instructions sent to ${email}.`
      );
    },
    [adapter, playError, showModal]
  );

  const verifyFace = useCallback(
    async (imageBase64: string) => {
      setStatus("loading");
      updateTerminal("Analyzing facial geometry mesh...");
      const res = await adapter.verifyFace(imageBase64);
      if (!res.success) {
        setStatus("error");
        playError();
        showModal(false, "FACIAL SCAN FAILED", res.error || "");
        return;
      }
      setStatus("authenticated");
      showModal(
        true,
        "FACIAL SCAN VERIFIED",
        "Iris vector scan matched in database."
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const verifyVoice = useCallback(
    async (audioBlob: Blob) => {
      setStatus("loading");
      updateTerminal("Listening for voice waveform match...");
      const res = await adapter.verifyVoice(audioBlob);
      if (!res.success) {
        setStatus("error");
        playError();
        showModal(false, "VOICE VERIFICATION FAILED", res.error || "");
        return;
      }
      setStatus("authenticated");
      showModal(
        true,
        "VOICE PRINT MATCHED",
        "Voice acoustic spectrum matches Operative profile."
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const verifyFingerprint = useCallback(
    async (scanData: string) => {
      setStatus("loading");
      updateTerminal("Fingerprint capacitive scan in progress...");
      const res = await adapter.verifyFingerprint(scanData);
      if (!res.success) {
        setStatus("error");
        playError();
        showModal(false, "FINGERPRINT FAILED", res.error || "");
        return;
      }
      setStatus("authenticated");
      showModal(
        true,
        "FINGERPRINT AUTHORIZED",
        "Dermal ridge pattern verified."
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const enrollBiometrics = useCallback(async () => {
    if (!user) return;
    const res = await adapter.enrollBiometrics(user.uid);
    if (!res.success) {
      playError();
      showModal(false, "ENROLLMENT FAILED", res.error || "");
      return;
    }
    showModal(
      true,
      "BIOMETRIC LINKED",
      "Device biometrics securely registered to profile."
    );
  }, [adapter, user, playError, showModal]);

  const value: AuthContextValue = {
    user,
    status,
    error,
    adapter,
    adapterName,
    audioEnabled,
    activeMethod,
    isRegisterMode,
    terminalText,
    modal,
    login,
    register,
    logout,
    resetPassword,
    verifyFace,
    verifyVoice,
    verifyFingerprint,
    enrollBiometrics,
    setActiveMethod,
    toggleMode,
    toggleAudio,
    updateTerminal,
    showModal,
    closeModal,
    playBeep,
    playSuccess,
    playError,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
