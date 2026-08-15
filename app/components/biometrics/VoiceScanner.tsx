"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PHRASE = "JARVIS ACCESS AUTHORIZATION CODE SEVEN";
const DEFAULT_HEIGHTS = [10, 14, 18, 14, 10, 7, 5];

export function VoiceScanner() {
  const { verifyVoice, playBeep, status } = useAuth();
  const [listening, setListening] = useState(false);
  const [heights, setHeights] = useState<number[]>(DEFAULT_HEIGHTS);
  const [btnText, setBtnText] = useState("LISTEN & VERIFY");
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const startListening = async () => {
    if (listening || status === "loading") return;
    setListening(true);
    setBtnText("ANALYZING FREQUENCY...");

    chunksRef.current = [];
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const Mr: typeof MediaRecorder | undefined = (
          window as unknown as { MediaRecorder?: typeof MediaRecorder }
        ).MediaRecorder;
        if (Mr) {
          const rec = new Mr(stream);
          mediaRecorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };
          rec.start();
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch {
        /* Mic unavailable */
      }
    }

    const animate = () => {
      playBeep(400 + Math.random() * 600, "sine", 0.05);
      setHeights(() =>
        DEFAULT_HEIGHTS.map(() => Math.floor(Math.random() * 50) + 6)
      );
    };
    animate();
    intervalRef.current = window.setInterval(animate, 100);

    timeoutRef.current = window.setTimeout(async () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setHeights(DEFAULT_HEIGHTS);

      let audioBlob: Blob;
      if (mediaRecorderRef.current && chunksRef.current.length > 0) {
        try {
          await new Promise<void>((resolve) => {
            const rec = mediaRecorderRef.current!;
            rec.onstop = () => resolve();
            rec.stop();
            if (rec.stream) {
              rec.stream.getTracks().forEach((t) => t.stop());
            }
          });
        } catch {
          /* noop */
        }
        const mime =
          chunksRef.current[0]?.type || "audio/webm";
        audioBlob = new Blob(chunksRef.current, { type: mime });
      } else {
        audioBlob = new Blob(["jarvis-voice-sample"], { type: "audio/wav" });
      }
      chunksRef.current = [];
      mediaRecorderRef.current = null;

      await verifyVoice(audioBlob);
      setListening(false);
      setBtnText("LISTEN & VERIFY");
      timeoutRef.current = null;
    }, 2800);
  };

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div className="w-full h-32 border border-cyber-cyan/40 bg-cyber-bg/90 rounded p-3 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="flex items-end justify-center gap-1.5 w-full h-16">
          {heights.map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-cyber-cyan rounded-full transition-all duration-150"
              style={{
                height: `${h}px`,
                opacity: Math.max(0.3, Math.min(1, h / 50)),
              }}
            />
          ))}
        </div>

        <div className="text-xs text-cyber-cyan font-mono mt-2 tracking-widest text-glow text-center">
          PHRASE: &ldquo;{PHRASE}&rdquo;
        </div>
      </div>

      <p className="text-xs text-cyber-cyan/60 text-center">
        Voice print spectral verification. Speak phrase into microphone.
      </p>

      <button
        type="button"
        onClick={startListening}
        disabled={listening || status === "loading"}
        className={[
          "w-full bg-cyber-cyan/10 border text-cyber-cyan font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow flex items-center justify-center gap-2 disabled:cursor-not-allowed",
          listening
            ? "border-cyber-emerald/80 bg-cyber-emerald/15 animate-pulse"
            : "border-cyber-cyan hover:bg-cyber-cyan/30 disabled:opacity-60",
        ].join(" ")}
      >
        <Mic className="w-4 h-4" />
        <span>{btnText}</span>
      </button>
    </div>
  );
}
