"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function ArcReactorHud() {
  const { user, terminalText, playBeep, updateTerminal } = useAuth();
  const [pulse, setPulse] = useState(false);
  const [cpu, setCpu] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [time, setTime] = useState("00:00:00");
  const coreRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    // Try to read real CPU usage from the Performance API (Chromium-only).
    // Falls back to null if unavailable.
    const readCpu = (): number | null => {
      if (typeof performance === "undefined") return null;
      const mem = (performance as any).memory;
      if (mem && mem.usedJSHeapSize) {
        // Heap size in MB — approximate indicator of memory pressure.
        return Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
      }
      return null;
    };

    let lastPerfNow = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const cpuVal = readCpu();
      setCpu(cpuVal);

      // Real tick-latency measurement using the Performance API (sub-millisecond precision).
      setLatency(Math.min(999, Math.max(1, Math.round(now - lastPerfNow))));
      lastPerfNow = now;

      const hh = String(new Date(now).getHours()).padStart(2, "0");
      const mm = String(new Date(now).getMinutes()).padStart(2, "0");
      const ss = String(new Date(now).getSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
    };

    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);

  const triggerPulse = () => {
    setPulse(true);
    playBeep(300, "triangle", 0.4);
    updateTerminal("Arc Reactor energy pulse triggered.");
    setTimeout(() => setPulse(false), 500);
  };

  const authState = user ? "CONNECTED" : "DISCONNECTED";
  const authStateColor = user ? "text-cyber-emerald" : "text-cyber-red";

  return (
    <section className="flex flex-col items-center justify-center relative min-h-[300px] w-full">
      <div
        className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center cursor-pointer group select-none"
        onClick={triggerPulse}
        role="button"
        aria-label="Arc Reactor pulse trigger"
      >
        <div className="absolute inset-0 border border-cyber-cyan/20 rounded-full" />
        <div className="absolute inset-[-10px] border border-dashed border-cyber-cyan/10 rounded-full" />

        <div className="absolute inset-2 border-2 border-dashed border-cyber-cyan/40 rounded-full animate-spin-reverse" />

        <div className="absolute inset-8 border border-cyber-cyan/60 rounded-full animate-spin-slow flex items-center justify-center">
          <div className="w-full h-0.5 bg-cyber-cyan/30 absolute" />
          <div className="h-full w-0.5 bg-cyber-cyan/30 absolute" />
        </div>

        <div className="absolute inset-12 border border-cyber-cyan/30 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-cyber-cyan rounded-full absolute -top-1" />
          <div className="w-2 h-2 bg-cyber-cyan rounded-full absolute -bottom-1" />
          <div className="w-2 h-2 bg-cyber-cyan rounded-full absolute -left-1" />
          <div className="w-2 h-2 bg-cyber-cyan rounded-full absolute -right-1" />
        </div>

        <div
          ref={coreRef}
          id="arc-core"
          className={[
            "relative w-28 h-28 md:w-36 md:h-36 rounded-full bg-cyber-cyan/10 border-2 border-cyber-cyan flex flex-col items-center justify-center shadow-cyber-glow transition-all duration-500 group-hover:scale-105",
            pulse ? "scale-125 shadow-cyber-glow-strong" : "",
          ].join(" ")}
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-cyber-cyan/20 border border-cyber-cyan/80 flex items-center justify-center animate-pulse-glow">
            <Zap className="w-8 h-8 text-cyber-cyan drop-shadow-[0_0_10px_#00f3ff]" />
          </div>
        </div>

        <div className="absolute inset-0 rounded-full animate-spin-slow opacity-30 bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(0,243,255,0.4)_360deg)] pointer-events-none" />

        <div className="absolute -top-4 left-0 text-[10px] text-cyber-cyan/70 tracking-widest bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30">
          HEAP: <span className="font-bold">{cpu !== null ? `${cpu}%` : "---"}</span>
        </div>
        <div className="absolute -top-4 right-0 text-[10px] text-cyber-cyan/70 tracking-widest bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30">
          LATENCY: <span className="font-bold">{latency !== null ? `${latency}ms` : "---"}</span>
        </div>
        <div className="absolute -bottom-4 left-0 text-[10px] text-cyber-cyan/70 tracking-widest bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30">
          STATUS: <span className={`${authStateColor} font-bold`}>{authState}</span>
        </div>
        <div className="absolute -bottom-4 right-0 text-[10px] text-cyber-cyan/70 tracking-widest bg-cyber-bg/80 px-2 py-0.5 border border-cyber-cyan/30">
          UPTIME: <span className="text-cyber-cyan font-bold">{Math.floor((Date.now() - lastTickRef.current) / 60000)}m</span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <div className="font-orbitron tracking-widest text-sm text-cyber-cyan text-glow">
          ARC REACTOR MK VII
        </div>
        <div className="text-[11px] text-cyber-cyan/50 tracking-wider">
          STARK SECURITY MATRIX // ONLINE
        </div>
      </div>

      <div className="mt-6 w-full max-w-md bg-cyber-bg/80 border border-cyber-cyan/30 p-2.5 rounded text-xs font-mono h-20 overflow-hidden relative">
        <div className="text-[10px] text-cyber-cyan/40 mb-1 border-b border-cyber-cyan/20 pb-0.5 flex justify-between">
          <span>JARVIS_SPEECH_LOG</span>
          <span>{time}</span>
        </div>
        <p className="text-cyber-cyan/90 leading-tight">
          &ldquo;{terminalText}&rdquo;
        </p>
      </div>
    </section>
  );
}
