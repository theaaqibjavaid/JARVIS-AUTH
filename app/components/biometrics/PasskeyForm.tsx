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
    resetPasswordConfirm,
    verifyPasskey,
    error,
    status,
    playBeep,
  } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Password-reset state machine
  const [resetStep, setResetStep] = useState<"idle" | "confirm">("idle");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPasskey, setResetNewPasskey] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

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

  const handleResetRequest = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError("Please enter your email first.");
      return;
    }
    const result = await resetPassword(cleanEmail);
    if (result.success && result.resetToken) {
      // Mock adapter returns the token directly — pre-fill and move to confirm.
      setResetToken(result.resetToken);
      setResetStep("confirm");
    } else if (result.success) {
      // Backend adapter: token sent via email. Prompt user to enter it manually.
      setResetStep("confirm");
    } else {
      setLocalError(result.error || "Failed to send reset request.");
    }
  };

  const handleResetConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !resetToken || !resetNewPasskey) {
      setLocalError("Email, token, and new passkey are required.");
      return;
    }
    if (resetNewPasskey.length < 6) {
      setLocalError("New passkey must be at least 6 characters long.");
      return;
    }
    await resetPasswordConfirm(cleanEmail, resetToken, resetNewPasskey);
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
          <label htmlFor="jarvis-fullname" className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
            Full Name / Operative ID
          </label>
          <div className="relative">
            <UserCheck className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
            <input
              id="jarvis-fullname"
              type="text"
              autoComplete="name"
              aria-label="Full Name"
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
        <label htmlFor="jarvis-email" className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
          Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
          <input
            id="jarvis-email"
            type="email"
            autoComplete="email"
            aria-label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="stark@avengers.io"
            required
            className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30"
            disabled={loading}
          />
        </div>
      </div>

      {/* Password-reset confirm flow: show token + new passkey */}
      {resetStep === "confirm" && (
        <>
          <div>
            <label htmlFor="jarvis-reset-token" className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
              Reset Token
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
              <input
                id="jarvis-reset-token"
                type="text"
                autoComplete="off"
                aria-label="Reset Token"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Enter reset token"
                className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label htmlFor="jarvis-reset-passkey" className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
              New Passkey
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
              <input
                id="jarvis-reset-passkey"
                type={showResetPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-label="New Passkey"
                value={resetNewPasskey}
                minLength={6}
                onChange={(e) => setResetNewPasskey(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-cyber-bg/90 border border-cyber-cyan/40 rounded px-10 py-2.5 text-sm text-cyber-cyan focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan transition-all placeholder:text-cyber-cyan/30 pr-12"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => {
                  setShowResetPassword((s) => !s);
                  playBeep(1100, "sine", 0.05);
                }}
                tabIndex={-1}
                className="absolute right-3 top-3 text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
                aria-label={showResetPassword ? "Hide new passkey" : "Show new passkey"}
              >
                {showResetPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetConfirm}
            disabled={loading}
            className="w-full bg-cyber-emerald/10 border-2 border-cyber-emerald hover:bg-cyber-emerald/30 text-cyber-emerald font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>CONFIRMING RESET…</span>
              </>
            ) : (
              <span>CONFIRM NEW PASSKEY</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setResetStep("idle");
              setResetToken("");
              setResetNewPasskey("");
              playBeep(700, "sine", 0.08);
            }}
            className="w-full text-xs text-cyber-cyan/50 hover:text-cyber-cyan underline transition-all py-1"
          >
            ← Back to sign in
          </button>
        </>
      )}

      {/* Normal sign-in / register flow */}
      {resetStep !== "confirm" && (
        <>
          <div>
            <label htmlFor="jarvis-passkey" className="block text-xs text-cyber-cyan/70 tracking-widest mb-1 uppercase">
              Passkey
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-cyber-cyan/50" />
              <input
                id="jarvis-passkey"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                aria-label="Passkey"
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-cyber-cyan/30"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-cyber-cyan/50 bg-cyber-bg">
                OR
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playBeep(900, "sine", 0.1);
              verifyPasskey();
            }}
            disabled={loading}
            className="w-full bg-cyber-cyan/10 border-2 border-cyber-emerald hover:bg-cyber-cyan/30 text-cyber-emerald font-orbitron py-3 rounded tracking-widest font-bold transition-all shadow-cyber-glow flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Use device passkey"
          >
            <span>USE DEVICE PASSKEY</span>
          </button>

          <div className="flex justify-end items-center text-xs pt-1">
            <a
              href="#"
              onClick={handleResetRequest}
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
        </>
      )}
    </form>
  );
}
