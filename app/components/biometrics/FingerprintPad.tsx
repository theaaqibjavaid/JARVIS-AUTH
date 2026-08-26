"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isPlatformBiometricSupported } from "../../lib/webauthn-biometrics";

/**
 * Real device fingerprint authentication.
 *
 * This does NOT fabricate a scan string. It invokes the OS-level WebAuthn
 * platform authenticator (Windows Hello fingerprint / Touch ID), which owns the
 * sensor and performs the genuine match. The raw print never leaves the device.
 */
export function FingerprintPad() {
  const { verifyFingerprint, playBeep, status } = useAuth();
  const [verifying, setVerifying] = useState(false);
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
    playBeep(600, "sine", 0.05);
    await verifyFingerprint();
    setVerifying(false);
  };

  const busy = verifying || status === "loading";

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div
        role="button"
        tabIndex={0}
        onClick={startScan}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            startScan();
          }
        }}
        className={[
          "w-36 h-36 border-2 border-dashed rounded-full flex items-center justify-center bg-cyber-bg/90 cursor-pointer relative shadow-cyber-glow transition-all select-none",
          busy
            ? "border-cyber-cyan scale-105"
            : "border-cyber-cyan/50 hover:border-cyber-cyan",
          busy || supported === false ? "pointer-events-none opacity-80" : "",
        ].join(" ")}
        aria-label="Fingerprint pad - activate to verify"
      >
        <Fingerprint
          className={[
            "w-20 h-20 transition-all duration-200",
            busy ? "text-cyber-cyan scale-110" : "text-cyber-cyan/60",
          ].join(" ")}
        />
        <div
          className="absolute inset-3 rounded-full border-2 border-t-cyber-cyan/80 border-r-cyber-cyan/40 border-b-cyber-cyan/10 border-l-cyber-cyan/40"
          style={{
            animation: busy ? "spin 0.8s linear infinite" : "none",
          }}
        />
      </div>

      {supported === false ? (
        <p className="text-xs text-amber-400/80 text-center flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          No device fingerprint authenticator found. Set up Windows Hello /
          Touch ID, or use another method.
        </p>
      ) : (
        <p className="text-xs text-cyber-cyan/60 text-center">
          TAP THE SCANNER TO VERIFY VIA DEVICE FINGERPRINT (WINDOWS HELLO /
          TOUCH ID)
        </p>
      )}
    </div>
  );
}
