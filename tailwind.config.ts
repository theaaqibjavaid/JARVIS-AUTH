import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          cyan: "#00f3ff",
          darkCyan: "#005f73",
          bg: "#030a16",
          panel: "rgba(4, 18, 33, 0.88)",
          border: "rgba(0, 243, 255, 0.3)",
          glow: "rgba(0, 243, 255, 0.4)",
          red: "#ff0055",
          emerald: "#00ffaa",
        },
      },
      fontFamily: {
        orbitron: ["var(--font-orbitron)", "Orbitron", "sans-serif"],
        mono: ["var(--font-share-tech)", '"Share Tech Mono"', "monospace"],
      },
      boxShadow: {
        "cyber-glow":
          "0 0 15px rgba(0, 243, 255, 0.35), inset 0 0 15px rgba(0, 243, 255, 0.15)",
        "cyber-glow-strong":
          "0 0 30px rgba(0, 243, 255, 0.6), inset 0 0 20px rgba(0, 243, 255, 0.3)",
        "cyber-red":
          "0 0 15px rgba(255, 0, 85, 0.4), inset 0 0 15px rgba(255, 0, 85, 0.15)",
      },
      keyframes: {
        rotateClockwise: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        rotateCounter: {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.03)" },
        },
        scanBeam: {
          "0%": { top: "0%", opacity: "0.8" },
          "50%": { opacity: "1" },
          "100%": { top: "100%", opacity: "0.8" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "spin-slow": "rotateClockwise 20s linear infinite",
        "spin-reverse": "rotateCounter 15s linear infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "scan-laser": "scanBeam 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.3s ease-out",
        "pop-in": "popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
