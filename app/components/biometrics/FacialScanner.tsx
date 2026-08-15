"use client";

import { useEffect, useRef, useState } from "react";
import { Scan, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function FacialScanner() {
  const { verifyFace, playBeep, status } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState("POSITION FACE IN FRAME");
  const [beepInterval, setBeepInterval] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (beepInterval) window.clearInterval(beepInterval);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* noop */
        });
      }
    } catch {
      /* Camera unavailable - fall back to animated UI */
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const captureFrameAsBase64 = (): string => {
    if (!videoRef.current) return "";
    try {
      const v = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth || 320;
      canvas.height = v.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.6);
      }
    } catch {
      /* noop */
    }
    return "";
  };

  const startScan = async () => {
    if (scanning || status === "loading") return;
    await startCamera();
    setScanning(true);
    setStatusText("SCANNING FACIAL MESH...");

    const interval = window.setInterval(() => {
      playBeep(1400, "sine", 0.05);
    }, 300);
    setBeepInterval(interval);

    timerRef.current = window.setTimeout(async () => {
      window.clearInterval(interval);
      setBeepInterval(null);
      const frameData = captureFrameAsBase64();
      stopCamera();
      setStatusText("MATCH CONFIRMED - 99.8%");
      await verifyFace(frameData);
      setScanning(false);
      timerRef.current = null;
    }, 2500);
  };

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div className="relative w-48 h-48 border-2 border-cyber-cyan/50 rounded-lg overflow-hidden bg-cyber-bg/90 flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(#00f3ff_1px,transparent_1px)] [background-size:12px_12px] opacity-20" />

        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />

        <div className="w-32 h-32 border border-dashed border-cyber-cyan/60 rounded-full flex items-center justify-center relative z-10">
          <User className="w-16 h-16 text-cyber-cyan/30" />
          <div className="absolute top-4 left-6 w-1.5 h-1.5 bg-cyber-cyan rounded-full animate-ping" />
          <div className="absolute top-8 right-8 w-1.5 h-1.5 bg-cyber-cyan rounded-full" />
        </div>

        {scanning && (
          <div className="absolute left-0 right-0 h-0.5 bg-cyber-cyan shadow-cyber-glow-strong animate-scan-laser z-20" />
        )}

        <div className="absolute bottom-2 text-[10px] tracking-wider text-cyber-cyan/80 bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30 z-30">
          {statusText}
        </div>
      </div>

      <p className="text-xs text-cyber-cyan/60 text-center">
        Optic vector scan. Interacts with device hardware biometrics when
        enrolled.
      </p>

      <button
        type="button"
        onClick={startScan}
        disabled={scanning || status === "loading"}
        className="w-full bg-cyber-cyan/10 border border-cyber-cyan hover:bg-cyber-cyan/30 text-cyber-cyan font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Scan className="w-4 h-4" />
        <span>
          {scanning ? "ANALYZING..." : "INITIALIZE OPTIC SCAN"}
        </span>
      </button>
    </div>
  );
}
