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
  AuthResult,
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
  resetPassword: (email: string) => Promise<AuthResult>;
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  adapter: adapterArg = "mock",
  adapterOptions,
}: {
  children: ReactNode;
  adapter?: AuthAdapterName | AuthAdapter;
  adapterOptions?: { baseUrl?: string };
}) {
  const adapter = useMemo(
    () =>
      typeof adapterArg === "string"
        ? createAuthAdapter(adapterArg, adapterOptions)
        : adapterArg,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapterArg]
  );

  const adapterName: AuthAdapterName = useMemo(() => {
    const n = adapter.name.toLowerCase();
    if (n.includes("backend")) return "backend";
    return "mock";
  }, [adapter]);

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

  useEffect(() => {
    return () => {
      sound.close();
    };
  }, [sound]);

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
    let cancelled = false;
    const unsub = adapter.onAuthStateChanged((u) => {
      if (cancelled) return;
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
    });
    (async () => {
      try {
        const u = await adapter.getCurrentUser();
        if (cancelled) return;
        setUser(u);
        setStatus(u ? "authenticated" : "unauthenticated");
      } catch {
        if (cancelled) return;
        setStatus("unauthenticated");
      }
    })();
    const safety = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "unauthenticated" : s));
    }, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      unsub();
    };
  }, [adapter]);

  const login = useCallback(
    async (email: string, passkey: string) => {
      setStatus("loading");
      setError(null);
      updateTerminal("Validating credentials with authentication core...");
      const res = await adapter.login(email, passkey);
      if (!res.success) {
        setError(res.error || "Authentication failed");
        setUser(null);
        setStatus("error");
        playError();
        updateTerminal(`[ERROR]: ${res.error}`);
        showModal(false, "AUTHENTICATION FAILED", res.error || "");
        return;
      }
      setUser(res.user ?? null);
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
        setUser(null);
        setStatus("error");
        playError();
        updateTerminal(`[ERROR]: ${res.error}`);
        showModal(false, "REGISTRATION FAILED", res.error || "");
        return;
      }
      setUser(res.user ?? null);
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
        return res;
      }
      if (res.resetToken) {
        // Mock adapter surfaces the token directly; show it in a modal.
        showModal(
          true,
          "RECOVERY DISPATCHED",
          `Reset token for ${email}:\n\n${res.resetToken}\n\nPaste this token into the form below.`
        );
      } else {
        showModal(
          true,
          "RECOVERY DISPATCHED",
          `Passkey reset instructions sent to ${email}. Check your email for the token.`
        );
      }
      return res;
    },
    [adapter, playError, showModal]
  );

  const resetPasswordConfirm = useCallback(
    async (email: string, token: string, newPasskey: string) => {
      const res = await adapter.resetPasswordConfirm(email, token, newPasskey);
      if (!res.success) {
        playError();
        showModal(false, "RECOVERY FAILED", res.error || "");
        return;
      }
      setUser(res.user ?? null);
      setStatus("authenticated");
      showModal(
        true,
        "PASSKEY RESET COMPLETE",
        `Passkey for ${email} has been updated successfully.`
      );
    },
    [adapter, playError, showModal]
  );

  const verifyFace = useCallback(async () => {
    setStatus("loading");
    updateTerminal(
      "Requesting device face verification (Windows Hello / Face ID)..."
    );
    const res = await adapter.verifyFace();
    if (!res.success) {
      setUser(null);
      setStatus("error");
      playError();
      showModal(false, "FACIAL SCAN FAILED", res.error || "");
      return;
    }
    setUser(res.user ?? null);
    setStatus("authenticated");
    showModal(
      true,
      "FACIAL SCAN VERIFIED",
      "Device face biometric matched and authorized."
    );
  }, [adapter, updateTerminal, playError, showModal]);

  const verifyVoice = useCallback(
    async (audioBlob: Blob) => {
      setStatus("loading");
      updateTerminal("Extracting voiceprint and matching against enrolled samples...");
      const res = await adapter.verifyVoice(audioBlob);
      if (!res.success) {
        setUser(null);
        setStatus("error");
        playError();
        showModal(false, "VOICE VERIFICATION FAILED", res.error || "");
        return;
      }
      setUser(res.user ?? null);
      setStatus("authenticated");
      showModal(
        true,
        "VOICE PRINT MATCHED",
        "Voice acoustic spectrum matches Operative profile."
      );
    },
    [adapter, updateTerminal, playError, showModal]
  );

  const verifyFingerprint = useCallback(async () => {
    setStatus("loading");
    updateTerminal("Touch the fingerprint sensor to verify (Windows Hello / Touch ID)...");
    const res = await adapter.verifyFingerprint();
    if (!res.success) {
      setUser(null);
      setStatus("error");
      playError();
      showModal(false, "FINGERPRINT FAILED", res.error || "");
      return;
    }
    setUser(res.user ?? null);
    setStatus("authenticated");
    showModal(
      true,
      "FINGERPRINT AUTHORIZED",
      "Device fingerprint biometric matched and authorized."
    );
  }, [adapter, updateTerminal, playError, showModal]);

  const enrollBiometrics = useCallback(async () => {
    if (!user) {
      playError();
      showModal(false, "ENROLLMENT FAILED", "No active session. Sign in first.");
      return;
    }
    updateTerminal("Prompting device biometric enrollment (follow the OS prompt)...");
    const res = await adapter.enrollBiometrics(user.uid);
    if (!res.success) {
      playError();
      showModal(false, "ENROLLMENT FAILED", res.error || "");
      return;
    }
    setUser((u) => (u ? { ...u, hasBiometrics: true } : u));
    showModal(
      true,
      "BIOMETRIC LINKED",
      "Device biometrics securely registered to profile."
    );
  }, [adapter, user, playError, showModal, updateTerminal]);

  const enrollVoice = useCallback(
    async (audioBlob: Blob) => {
      if (!user) {
        playError();
        showModal(
          false,
          "VOICE ENROLLMENT FAILED",
          "No active session. Sign in first."
        );
        return;
      }
      updateTerminal("Extracting and storing voiceprint signature...");
      const res = await adapter.enrollVoice(audioBlob);
      if (!res.success) {
        playError();
        showModal(false, "VOICE ENROLLMENT FAILED", res.error || "");
        return;
      }
      setUser((u) => (u ? { ...u, hasBiometrics: true } : u));
      showModal(
        true,
        "VOICEPRINT LINKED",
        "Voice signature securely registered to profile."
      );
    },
    [adapter, user, playError, showModal, updateTerminal]
  );

  const verifyPasskey = useCallback(async (): Promise<AuthResult> => {
    setStatus("loading");
    updateTerminal("Initializing WebAuthn passkey assertion...");
    const res = await adapter.verifyPasskey(user?.email);
    if (!res.success) {
      setError(res.error || "Passkey authentication failed");
      setStatus("error");
      playError();
      showModal(false, "PASSKEY FAILED", res.error || "");
      return res;
    }
    setUser(res.user ?? null);
    setStatus("authenticated");
    showModal(
      true,
      "PASSKEY VERIFIED",
      "Device passkey assertion matched in database."
    );
    return res;
  }, [adapter, user, updateTerminal, playError, showModal]);

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
    resetPasswordConfirm,
    verifyFace,
    verifyVoice,
    verifyFingerprint,
    enrollBiometrics,
    enrollVoice,
    verifyPasskey,
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
