"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Eye,
  Fingerprint,
  LogOut,
  Maximize,
  Mic,
  RefreshCw,
  ShieldCheck,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { BiometricMethod } from "../types";
import { PlatformCredentialStore, isPlatformBiometricSupported } from "../lib/webauthn-biometrics";
import { VoiceprintStore } from "../lib/voiceprint";
import { ArcReactorHud } from "./ArcReactorHud";
import { PasskeyForm } from "./biometrics/PasskeyForm";
import { FacialScanner } from "./biometrics/FacialScanner";
import { VoiceScanner } from "./biometrics/VoiceScanner";
import { FingerprintPad } from "./biometrics/FingerprintPad";

function AccessModal() {
  const { modal, closeModal } = useAuth();
  if (!modal.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jarvis-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="cyber-panel max-w-sm w-full p-6 text-center rounded-lg space-y-4 shadow-cyber-glow-strong animate-[popIn_.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          borderColor:
            modal.isSuccess ? "rgba(0, 243, 255, 0.5)" : "rgba(255, 0, 85, 0.5)",
        }}
      >
        <div className="absolute top-[-2px] right-[-2px] w-3 h-3 border-t-2 border-r-2"
          style={{ borderColor: modal.isSuccess ? "#00f3ff" : "#ff0055" }} />
        <div className="absolute bottom-[-2px] left-[-2px] w-3 h-3 border-b-2 border-l-2"
          style={{ borderColor: modal.isSuccess ? "#00f3ff" : "#ff0055" }} />

        <div
          className="w-16 h-16 rounded-full mx-auto flex items-center justify-center border-2"
          style={{
            borderColor: modal.isSuccess ? "#00f3ff" : "#ff0055",
            backgroundColor: modal.isSuccess
              ? "rgba(0, 243, 255, 0.2)"
              : "rgba(255, 0, 85, 0.2)",
          }}
        >
          {modal.isSuccess ? (
            <ShieldCheck className="w-8 h-8" style={{ color: "#00f3ff" }} />
          ) : (
            <AlertTriangle className="w-8 h-8" style={{ color: "#ff0055" }} />
          )}
        </div>

        <h3
          id="jarvis-modal-title"
          className={`font-orbitron font-bold text-xl tracking-widest ${
            modal.isSuccess ? "text-glow" : "text-glow-red"
          }`}
          style={{
            color: modal.isSuccess ? "#00f3ff" : "#ff0055",
          }}
        >
          {modal.title}
        </h3>
        <p className="text-xs text-cyber-cyan/80 leading-relaxed font-mono">
          {modal.message}
        </p>

        <button
          onClick={closeModal}
          className="w-full bg-cyber-cyan/20 border border-cyber-cyan hover:bg-cyber-cyan/40 text-cyber-cyan font-orbitron py-2.5 rounded tracking-widest transition-all"
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}

function BiometricTabs() {
  const { activeMethod, setActiveMethod } = useAuth();

  const methods: {
    id: BiometricMethod;
    icon: React.ReactNode;
    label: string;
  }[] = [
    { id: "retina", icon: <Eye className="w-5 h-5 mb-1" />, label: "FACIAL/EYE" },
    { id: "fingerprint", icon: <Fingerprint className="w-5 h-5 mb-1" />, label: "FINGERPRINT" },
    { id: "passkey", icon: <Target className="w-5 h-5 mb-1" />, label: "PASSKEY" },
    { id: "voice", icon: <Mic className="w-5 h-5 mb-1" />, label: "VOICE" },
  ];

  const baseBtn =
    "flex flex-col items-center justify-center p-3 border rounded transition-all group";
  const activeBtn =
    "border-cyber-cyan bg-cyber-cyan/20 shadow-cyber-glow";
  const inactiveBtn =
    "border-cyber-cyan/30 bg-cyber-cyan/5 hover:bg-cyber-cyan/20";

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {methods.map((m) => {
        const active = activeMethod === m.id;
        return (
          <button
            key={m.id}
            type="button"
            id={`btn-method-${m.id}`}
            onClick={() => setActiveMethod(m.id)}
            className={`${baseBtn} ${active ? activeBtn : inactiveBtn}`}
            aria-pressed={active}
          >
            <div
              className={`transition-transform ${
                active ? "" : "group-hover:scale-110"
              }`}
            >
              {m.icon}
            </div>
            <span className="text-[10px] tracking-wider">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DashboardPanel() {
  const { user, logout, enrollBiometrics, status } = useAuth();
  const [showVoiceEnroll, setShowVoiceEnroll] = useState(false);
  const [deviceEnrolled, setDeviceEnrolled] = useState(false);
  const [voiceEnrolled, setVoiceEnrolled] = useState(false);

  // Reflect the true per-method enrollment state from the on-device stores.
  useEffect(() => {
    if (!user) return;
    (async () => {
      setDeviceEnrolled(await new PlatformCredentialStore().has(user.email));
      setVoiceEnrolled(await new VoiceprintStore().has(user.email));
    })();
  }, [user]);

  if (!user) return null;

  const busy = status === "loading";

  return (
    <div className="cyber-panel w-full max-w-md p-6 md:p-8 rounded-lg shadow-cyber-glow relative space-y-6 animate-[fadeIn_.3s_ease-out]">
      <div className="cyber-corner-tr" />
      <div className="cyber-corner-bl" />

      <div className="flex justify-between items-center border-b border-cyber-cyan/20 pb-4">
        <div>
          <h2 className="font-orbitron text-xl font-bold tracking-widest text-glow text-cyber-emerald">
            CLEARANCE GRANTED
          </h2>
          <p className="text-xs text-cyber-cyan/60 tracking-wider">
            AUTHENTICATED OPERATIVE COMMAND
          </p>
        </div>
        <div className="p-2 bg-cyber-emerald/10 border border-cyber-emerald/40 rounded-full text-cyber-emerald">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>

      <div className="space-y-3 font-mono text-xs bg-cyber-bg/90 p-4 border border-cyber-cyan/30 rounded">
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">OPERATIVE UID:</span>
          <span className="text-cyber-cyan font-bold truncate">
            {user.uid}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">EMAIL:</span>
          <span className="text-cyber-cyan font-bold truncate">
            {user.email}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">FULL NAME:</span>
          <span className="text-cyber-cyan font-bold truncate">
            {user.fullName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">CLEARANCE:</span>
          <span className="text-cyber-emerald font-bold">
            {user.clearanceLevel || "Level 1 - Full Access"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">DEVICE BIOMETRIC:</span>
          <span
            className={
              deviceEnrolled
                ? "text-cyber-emerald font-bold"
                : "text-cyber-cyan font-bold"
            }
          >
            {deviceEnrolled ? "ENROLLED" : "NOT ENROLLED"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-cyber-cyan/50 shrink-0">VOICEPRINT:</span>
          <span
            className={
              voiceEnrolled
                ? "text-cyber-emerald font-bold"
                : "text-cyber-cyan font-bold"
            }
          >
            {voiceEnrolled ? "ENROLLED" : "NOT ENROLLED"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={enrollBiometrics}
        disabled={busy || deviceEnrolled}
        className="w-full bg-cyber-cyan/10 border border-cyber-cyan hover:bg-cyber-cyan/20 text-cyber-cyan py-2.5 rounded font-orbitron text-xs tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Fingerprint className="w-4 h-4" />
        <span>
          {deviceEnrolled
            ? "DEVICE BIOMETRIC ENROLLED"
            : "ENROLL DEVICE BIOMETRIC (TOUCH ID / FACE ID)"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setShowVoiceEnroll((v) => !v)}
        disabled={busy}
        className="w-full bg-cyber-cyan/10 border border-cyber-cyan hover:bg-cyber-cyan/20 text-cyber-cyan py-2.5 rounded font-orbitron text-xs tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Mic className="w-4 h-4" />
        <span>
          {showVoiceEnroll
            ? "HIDE VOICE ENROLLMENT"
            : voiceEnrolled
              ? "RE-ENROLL VOICEPRINT"
              : "ENROLL VOICEPRINT"}
        </span>
      </button>

      {showVoiceEnroll && <VoiceScanner mode="enroll" />}

      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="w-full bg-cyber-red/10 border border-cyber-red hover:bg-cyber-red/30 text-cyber-red font-orbitron py-3 rounded tracking-widest font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <LogOut className="w-4 h-4" />
        <span>TERMINATE SESSION (SIGN OUT)</span>
      </button>
    </div>
  );
}

function AuthPanel() {
  const {
    isRegisterMode,
    toggleMode,
    activeMethod,
    setActiveMethod,
    playBeep,
  } = useAuth();

  const title = isRegisterMode ? "REGISTER" : "SIGN IN";
  const subtitle = isRegisterMode
    ? "CREATE NEW OPERATIVE CLEARANCE"
    : "AUTHENTICATION REQUIRED";
  const toggleLabel = isRegisterMode ? "SIGN IN" : "REGISTER";

  return (
    <div className="cyber-panel w-full max-w-md p-6 md:p-8 rounded-lg shadow-cyber-glow relative animate-[fadeIn_.3s_ease-out]">
      <div className="cyber-corner-tr" />
      <div className="cyber-corner-bl" />

      <div className="flex justify-between items-center mb-6 border-b border-cyber-cyan/20 pb-4">
        <div>
          <h2
            id="auth-title"
            className="font-orbitron text-xl md:text-2xl font-bold tracking-widest text-glow uppercase"
          >
            {title}
          </h2>
          <p className="text-xs text-cyber-cyan/60 tracking-wider">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="text-xs border border-cyber-cyan/40 hover:border-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 px-3 py-1.5 rounded transition-all tracking-wider flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>{toggleLabel}</span>
        </button>
      </div>

      <BiometricTabs />

      <div className="min-h-[360px]">
        {activeMethod === "passkey" && <PasskeyForm />}
        {activeMethod === "retina" && <FacialScanner />}
        {activeMethod === "voice" && <VoiceScanner />}
        {activeMethod === "fingerprint" && <FingerprintPad />}
      </div>

      <div className="mt-6 pt-4 border-t border-cyber-cyan/20 flex justify-between items-center text-xs">
        <span className="text-cyber-cyan/40 uppercase tracking-wider">
          PROTOCOL: {activeMethod}
        </span>
      </div>
    </div>
  );
}

export function AuthPortal() {
  const { user, audioEnabled, toggleAudio, adapterName } = useAuth();
  const [clock, setClock] = useState({ time: "13:14", date: "" });
  const [webauthnSupported, setWebauthnSupported] = useState<boolean | null>(null);

  useEffect(() => {
    isPlatformBiometricSupported().then(setWebauthnSupported);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setClock({
        time: `${hh}:${mm}`,
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch(() => {
          /* noop */
        });
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {
        /* noop */
      });
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between p-4 md:p-8 relative overflow-x-hidden select-none">
      <header className="relative z-10 flex justify-between items-center w-full border-b border-cyber-cyan/20 pb-3">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-cyber-cyan rounded-full animate-ping" />
          <div>
            <h1 className="font-orbitron font-bold text-lg md:text-xl tracking-widest text-glow">
              J.A.R.V.I.S.
              <span className="text-xs px-2 py-0.5 rounded bg-cyber-cyan/10 border border-cyber-cyan/40 text-cyber-cyan ml-2">
                SDK v{process.env.NEXT_PUBLIC_VERSION ?? "2.0.2"}
              </span>
            </h1>
            <p className="text-xs text-cyber-cyan/60 tracking-wider">
              REALTIME AUTHENTICATION &amp; ENCRYPTION ENGINE
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-8 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-cyber-cyan/50">ADAPTER:</span>
            <span className="text-cyber-emerald font-bold uppercase">
              {adapterName}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-cyber-cyan/50">WEBAUTHN:</span>
            <span className={webauthnSupported ? "text-cyber-emerald font-bold" : "text-cyber-red font-bold"}>
              {webauthnSupported === null ? "CHECKING…" : webauthnSupported ? "READY" : "UNAVAILABLE"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleAudio}
            aria-label={audioEnabled ? "Mute audio" : "Enable audio"}
            className={[
              "p-2 bg-cyber-cyan/10 border border-cyber-cyan/30 hover:bg-cyber-cyan/20 text-cyber-cyan transition-all rounded",
              audioEnabled ? "" : "opacity-50",
            ].join(" ")}
          >
            {audioEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="p-2 bg-cyber-cyan/10 border border-cyber-cyan/30 hover:bg-cyber-cyan/20 text-cyber-cyan transition-all rounded"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-6">
        <section className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[300px]">
          <ArcReactorHud />
        </section>
        <section className="lg:col-span-6 flex justify-center">
          {user ? <DashboardPanel /> : <AuthPanel />}
        </section>
      </main>

      <footer className="relative z-10 flex flex-col md:flex-row justify-between items-center border-t border-cyber-cyan/20 pt-3 text-xs text-cyber-cyan/60 space-y-2 md:space-y-0">
        <div className="flex items-center space-x-4">
          <span>STARK INDUSTRIES © {new Date().getFullYear()}</span>
          <span>•</span>
          <span className="text-cyber-emerald flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyber-emerald animate-ping" />{" "}
            SECURE AUTH NODE ACTIVE
          </span>
        </div>
        <div className="flex items-center space-x-6 font-mono">
          <div className="text-cyber-cyan text-sm md:text-base font-bold tracking-widest text-glow">
            {clock.time}
          </div>
          <div className="text-cyber-cyan/50 text-xs uppercase">
            {clock.date}
          </div>
        </div>
      </footer>

      <AccessModal />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
      `,
        }}
      />
    </div>
  );
}
