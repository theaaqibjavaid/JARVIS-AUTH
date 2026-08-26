"use client";

import { useEffect, useState } from "react";
import { Scan, User, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isPlatformBiometricSupported } from "../../lib/webauthn-biometrics";

/**
 * Real device face authentication.
 *
 * This does NOT do a fake camera capture. It invokes the OS-level WebAuthn
 * platform authenticator (Windows Hello / Face ID), which owns the camera and
 * performs the genuine biometric match. The raw face data never reaches this
 * app — the OS returns a signed cryptographic assertion instead.
 */
export function FacialScanner() {
  const { verifyFace, playBeep, status } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [statusText, setStatusText] = useState("READY FOR FACE AUTH");
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isPlatformBiometricSupported().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startScan = async () => {
    if (verifying || status === "loading") return;
    setVerifying(true);
    playBeep(1400, "sine", 0.05);
    setStatusText("VERIFYING VIA DEVICE BIOMETRIC...");
    await verifyFace();
    setVerifying(false);
    setStatusText("READY FOR FACE AUTH");
  };

  const busy = verifying || status === "loading";

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div className="relative w-48 h-48 border-2 border-cyber-cyan/50 rounded-lg overflow-hidden bg-cyber-bg/90 flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(#00f3ff_1px,transparent_1px)] [background-size:12px_12px] opacity-20" />

        <div className="w-32 h-32 border border-dashed border-cyber-cyan/60 rounded-full flex items-center justify-center relative z-10">
          <User className="w-16 h-16 text-cyber-cyan/30" />
          <div className="absolute top-4 left-6 w-1.5 h-1.5 bg-cyber-cyan rounded-full animate-ping" />
          <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-cyber-cyan rounded-full" />
        </div>

        {busy && (
          <div className="absolute left-0 right-0 h-0.5 bg-cyber-cyan shadow-cyber-glow-strong animate-scan-laser z-20" />
        )}

        <div className="absolute bottom-2 text-[10px] tracking-wider text-cyber-cyan/80 bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30 z-30">
          {statusText}
        </div>
      </div>

      {supported === false ? (
        <p className="text-xs text-amber-400/80 text-center flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          No device face authenticator found. Set up Windows Hello / Face ID, or
          use another method.
        </p>
      ) : (
        <p className="text-xs text-cyber-cyan/60 text-center">
          Secure device face auth (Windows Hello / Face ID). Your camera is
          handled by the OS — no image ever leaves this device.
        </p>
      )}

      <button
        type="button"
        onClick={startScan}
        disabled={busy || supported === false}
        className="w-full bg-cyber-cyan/10 border border-cyber-cyan hover:bg-cyber-cyan/30 text-cyber-cyan font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Scan className="w-4 h-4" />
        <span>{busy ? "VERIFYING..." : "INITIALIZE FACE AUTH"}</span>
      </button>
    </div>
  );
}
