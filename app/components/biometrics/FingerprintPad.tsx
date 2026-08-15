"use client";

import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function FingerprintPad() {
  const { verifyFingerprint, playBeep, status } = useAuth();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const startHold = () => {
    if (holding || status === "loading") return;
    setHolding(true);
    playBeep(600, "sine", 0.05);
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 10;
        playBeep(600 + next * 5, "sine", 0.05);
        if (next >= 100) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          finishScan();
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const finishScan = async () => {
    const scanData = `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await verifyFingerprint(scanData);
    endHold(false);
  };

  const endHold = (reset = true) => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setHolding(false);
    if (reset) setProgress(0);
  };

  const ringDeg = (progress / 100) * 360;

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div
        role="button"
        tabIndex={0}
        onMouseDown={startHold}
        onMouseUp={() => endHold(progress < 100)}
        onMouseLeave={() => endHold(progress < 100)}
        onTouchStart={startHold}
        onTouchEnd={() => endHold(progress < 100)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={() => endHold(progress < 100)}
        className={[
          "w-36 h-36 border-2 border-dashed rounded-full flex items-center justify-center bg-cyber-bg/90 cursor-pointer relative shadow-cyber-glow transition-all select-none",
          holding
            ? "border-cyber-cyan scale-105"
            : "border-cyber-cyan/50 hover:border-cyber-cyan",
          status === "loading" ? "pointer-events-none opacity-80" : "",
        ].join(" ")}
        aria-label="Fingerprint pad - press and hold to scan"
      >
        <Fingerprint
          className={[
            "w-20 h-20 transition-all duration-200",
            holding ? "text-cyber-cyan scale-110" : "text-cyber-cyan/60",
          ].join(" ")}
        />
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              progress > 0
                ? `conic-gradient(from 0deg, rgba(0,243,255,0.9) 0deg, rgba(0,243,255,0.9) ${ringDeg}deg, transparent ${ringDeg}deg, transparent 360deg)`
                : "transparent",
            WebkitMask:
              "radial-gradient(transparent 58%, black 59%, black 70%, transparent 71%)",
            mask: "radial-gradient(transparent 58%, black 59%, black 70%, transparent 71%)",
            opacity: progress > 0 ? 1 : 0,
          }}
        />
        <div
          className="absolute inset-3 rounded-full border-2 border-t-cyber-cyan/80 border-r-cyber-cyan/40 border-b-cyber-cyan/10 border-l-cyber-cyan/40"
          style={{
            animation: holding ? "spin 0.8s linear infinite" : "none",
          }}
        />
      </div>

      <div className="w-36 h-1.5 bg-cyber-cyan/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyber-cyan transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-cyber-cyan/60 text-center">
        PRESS AND HOLD THUMBPRINT SCANNER TO VERIFY BIOMETRICS
      </p>
    </div>
  );
}
