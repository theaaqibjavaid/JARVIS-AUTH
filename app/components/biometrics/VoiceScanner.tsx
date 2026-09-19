"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const RECORD_MS = 3000;
const DEFAULT_HEIGHTS = [10, 14, 18, 14, 10, 7, 5];

export interface VoiceScannerProps {
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
export function VoiceScanner({ mode = "verify" }: VoiceScannerProps) {
  const { verifyVoice, enrollVoice, playBeep, playError, status } = useAuth();
  const [listening, setListening] = useState(false);
  const [heights, setHeights] = useState<number[]>(DEFAULT_HEIGHTS);
  const [micError, setMicError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isEnroll = mode === "enroll";

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (animFrameRef.current) window.cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* noop */ }
      }
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try { rec.stop(); } catch { /* noop */ }
        if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startListening = async () => {
    if (listening || status === "loading") return;
    setMicError(null);
    setListening(true);

    let started = false;
    let mediaErr: DOMException | null = null;
    chunksRef.current = [];

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      mediaErr = new DOMException(
        "This browser does not support microphone access.",
        "NotSupportedError"
      );
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1 },
        });
        const Mr = (window as unknown as { MediaRecorder?: typeof MediaRecorder })
          .MediaRecorder;
        if (Mr) {
          const rec = new Mr(stream);
          mediaRecorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };
          rec.start();
          started = true;

          // Set up real-time FFT visualizer from the live audio stream.
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const barCount = DEFAULT_HEIGHTS.length;

          const draw = () => {
            animFrameRef.current = window.requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            const step = Math.floor(bufferLength / barCount);
            const newHeights = Array.from({ length: barCount }, (_, i) => {
              let sum = 0;
              for (let j = 0; j < step; j++) sum += dataArray[i * step + j] || 0;
              const avg = sum / step;
              return Math.max(4, Math.floor((avg / 255) * 50));
            });
            setHeights(newHeights);
          };
          draw();
        } else {
          stream.getTracks().forEach((t) => t.stop());
          mediaErr = new DOMException(
            "MediaRecorder is not supported in this browser.",
            "NotSupportedError"
          );
        }
      } catch (err) {
        mediaErr = err instanceof DOMException ? err : new DOMException(String(err), "UnknownError");
      }
    }

    if (!started) {
      setListening(false);
      const errorMessage = mediaErr
        ? formatMediaError(mediaErr)
        : "Microphone unavailable. Grant mic access and retry.";
      setMicError(errorMessage);
      playError();
      return;
    }

    timeoutRef.current = window.setTimeout(async () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (animFrameRef.current) {
        window.cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setHeights(DEFAULT_HEIGHTS);

      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          try {
            rec.stop();
          } catch {
            resolve();
          }
        });
        if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
      }

      // Clean up audio context and analyser.
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* noop */ }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      mediaRecorderRef.current = null;

      const mime = chunksRef.current[0]?.type || "audio/webm";
      const audioBlob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      setListening(false);
      timeoutRef.current = null;

      if (audioBlob.size === 0) {
        setMicError("No audio captured. Speak clearly into the mic and retry.");
        playError();
        return;
      }

      if (isEnroll) {
        await enrollVoice(audioBlob);
      } else {
        await verifyVoice(audioBlob);
      }
    }, RECORD_MS);
  };

  const btnText = listening
    ? "RECORDING..."
    : isEnroll
      ? "RECORD & ENROLL VOICE"
      : "LISTEN & VERIFY";

  return (
    <div className="flex flex-col items-center space-y-4 py-2">
      <div className="w-full h-32 border border-cyber-cyan/40 bg-cyber-bg/90 rounded p-3 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="flex items-end justify-center gap-1.5 w-full h-16">
          {heights.map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-cyber-cyan rounded-full transition-all duration-100"
              style={{
                height: `${h}px`,
                opacity: Math.max(0.3, Math.min(1, h / 50)),
              }}
            />
          ))}
        </div>

        <div className="text-xs text-cyber-cyan font-mono mt-2 tracking-widest text-glow text-center">
          {isEnroll ? "ENROLL MODE" : "VERIFY MODE"}
        </div>
      </div>

      {micError ? (
        <p className="text-xs text-amber-400/80 text-center flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          {micError}
        </p>
      ) : (
        <p className="text-xs text-cyber-cyan/60 text-center">
          {isEnroll
            ? "Speak clearly into the microphone. Voiceprint is processed on-device."
            : "Speak clearly into the microphone. Voiceprint is matched on-device."}
        </p>
      )}

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

/** Convert a DOMException from getUserMedia into a user-friendly message. */
function formatMediaError(err: DOMException): string {
  switch (err.name) {
    case "NotAllowedError":
      return "Microphone access was denied. Allow microphone access in your browser settings and retry.";
    case "NotFoundError":
      return "No microphone found. Connect a microphone and retry.";
    case "NotReadableError":
      return "Microphone is in use by another application. Close other apps using the mic and retry.";
    case "SecurityError":
      return "Microphone access is blocked by browser security policy. Ensure the page is served over HTTPS or localhost.";
    case "TypeError":
      return "Invalid microphone configuration. Please retry.";
    default:
      return `Microphone error (${err.name}): ${err.message}. Grant mic access and retry.`;
  }
}
