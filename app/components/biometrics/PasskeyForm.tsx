"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function PasskeyForm() {
  const {
    isRegisterMode,
    login,
    register,
    resetPassword,
    error,
    status,
    playBeep,
  } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const loading = status === "loading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setLocalError("Email and passkey are required.");
      return;
    }
    if (isRegisterMode) {
      if (!fullName.trim()) {
        setLocalError("Full name is required for registration.");
        return;
      }
      if (password.length < 6) {
        setLocalError("Passkey must be at least 6 characters long.");
        return;
      }
      await register(cleanEmail, password, fullName.trim());
    } else {
      await login(cleanEmail, password);
    }
  };

  const handleReset = async (e: React.MouseEvent) => {
    e.preventDefault();
    await resetPassword(email.trim());
  };

  const togglePwd = () => {
    setShowPassword((s) => !s);
    playBeep(1100, "sine", 0.05);
  };

  const submitLabel = isRegisterMode ? "ENROLL OPERATIVE" : "AUTHENTICATE";
  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {isRegisterMode && (
        <div>
          <label className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
            Full Name / Operative ID
          </label>
          <div className="relative">
            <UserCheck className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tony Stark"
              className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30"
              disabled={loading}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
          Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="stark@avengers.io"
            required
            className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
          Passkey
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            value={password}
            minLength={6}
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30 pr-12"
            disabled={loading}
          />
          <button
            type="button"
            onClick={togglePwd}
            tabIndex={-1}
            className="absolute right-3 top-3 text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
            aria-label={showPassword ? "Hide passkey" : "Show passkey"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {displayError && (
        <div
          role="alert"
          className="text-xs text-cyber-red bg-cyber-red/10 border border-cyber-red/40 p-2.5 rounded font-mono text-center"
        >
          {displayError}
        </div>
      )}

      <div className="flex justify-between items-center text-xs pt-1">
        <label className="flex items-center space-x-2 cursor-pointer text-cyber-cyan/70 hover:text-cyber-cyan">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-cyber-cyan bg-cyber-bg border-cyber-cyan/40 rounded"
            disabled={loading}
          />
          <span>REMEMBER ID</span>
        </label>
        <a
          href="#"
          onClick={handleReset}
          className="text-cyber-cyan/70 hover:text-cyber-cyan underline transition-all"
        >
          RECOVER ACCESS
        </a>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 bg-cyber-cyan/10 border-2 border-cyber-cyan hover:bg-cyber-cyan/30 text-cyber-cyan font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AUTHENTICATING...</span>
          </>
        ) : (
          <span>{submitLabel}</span>
        )}
      </button>
    </form>
  );
}
