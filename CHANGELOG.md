# Changelog

All notable changes to the `@jarvis-security/sdk` project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [2.0.0] - 2026-08-26

The "no more toy" release — every biometric method now performs **real verification** with a **register-first-then-login** model. Published to npm as `@jarvis-security/sdk@2.0.0`.

### Added

- **Real face & fingerprint biometrics** — new `app/lib/webauthn-biometrics.ts` engine drives the **WebAuthn platform authenticator** (Windows Hello, Face ID, Touch ID). The OS verifies the biometric; raw sensor data never leaves the device. Credentials are stored per-email with signature-count tracking.
- **Real voice recognition** — new `app/lib/voiceprint.ts` engine: client-side MFCC DSP pipeline (pre-emphasis → Hamming → radix-2 FFT → mel filterbank → log → DCT) aggregated into a 26-dim voiceprint, matched via cosine similarity (threshold 0.82). Fully offline — audio is never uploaded.
- **`enrollVoice(audioBlob)`** added to the `AuthAdapter` interface — voiceprints must be enrolled before voice login works.
- **Backend biometric endpoints** — `POST /api/v1/auth/enroll-biometric` (10/min) binds a platform credential to the operative; `POST /api/v1/auth/biometric-login` (20/min) refuses login unless biometrics are enrolled and, for face/fingerprint, verifies the presented `credential_id` is bound to the claimed user before issuing JWTs.
- **VoiceScanner dual-mode UI** — ENROLL VOICEPRINT / VERIFY modes with real microphone recording.
- **FacialScanner & FingerprintPad rewritten** — trigger the real OS biometric prompt instead of fake animations.
- **55 new engine tests** — `voiceprint.test.ts` (25) covers the full DSP pipeline and store; `webauthn-biometrics.test.ts` (21) covers options building, enrollment, and scoped authentication.

### Changed

- **BREAKING:** `verifyFace()` and `verifyFingerprint()` no longer accept payloads (`imageBase64` / `scanData` removed) — the OS biometric prompt is triggered internally.
- **BREAKING:** `AuthAdapter` interface now has **12 methods** (was 11) — `enrollVoice()` added.
- **BREAKING:** biometrics follow **register-first-then-login** — `enrollBiometrics()` / `enrollVoice()` must succeed before `verifyFace()` / `verifyFingerprint()` / `verifyVoice()` will authenticate.
- `MockAuthAdapter` and `BackendAuthAdapter` biometric methods rewritten on top of the real engines; `BackendAuthAdapter` exchanges a local biometric assertion for a backend session via `biometric-login`.
- Backend `requirements.txt`: `python-jose[cryptography]` → **PyJWT** (fixes a latent production bug — code imported `jwt` while the unmaintained `python-jose` was installed).
- Backend startup converted from deprecated `@app.on_event("startup")` to the FastAPI **lifespan** handler.
- Test suite expanded to **119 frontend tests** (7 suites) + **18 backend tests**; adapter/context suites rewritten against the real engines (OS prompt & DSP stubbed at the seam, stores kept genuine).

### Removed

- **BREAKING:** fake backend endpoints `POST /api/v1/auth/verify-face`, `verify-voice`, `verify-fingerprint`, `GET /api/v1/auth/webauthn/options`, `POST /api/v1/auth/webauthn/verify` — they accepted arbitrary payloads and always succeeded.
- All fake biometric shortcuts (instant `FACE-*` / `VOICE-*` / `FP-*` demo logins without any verification).

### Security

- Biometric login now requires prior enrollment server-side (`has_biometrics` gate).
- Face/fingerprint login requires a `credential_id` cryptographically bound to the claimed user (`Passkey` table check); unbound credentials are rejected.
- Rate limiting on both new biometric endpoints (10/min enroll, 20/min login).
- Voice matching runs entirely on-device; only the match result is sent to the backend.

---

## [1.0.0] — 2026-08-20

### Added — Initial Production Release
- `AuthAdapter` interface with Strategy/Adapter pattern
- `MockAuthAdapter` (in-memory demo) and `BackendAuthAdapter` (REST API) implementations
- `createAuthAdapter()` factory function
- 5-state auth state machine: idle | loading | authenticated | unauthenticated | error
- Next.js 14 App Router + React 18 Context API (`AuthProvider`, `useAuth()`)
- Tailwind CSS 3 cyber theme (cyan/red/emerald palette, neon glow, orbitron/space-mono fonts, CRT scanlines)
- Web Audio API `SoundEngine` with synthesized beeps/success/error jingles
- HTML5 Canvas 2D particle starfield + grid background (`CanvasBackground`)
- Biometric login methods:
  - Facial recognition (`FacialScanner` via `getUserMedia`)
  - Voice verification (`VoiceScanner` via `MediaRecorder`)
  - Passkeys / WebAuthn (`PasskeyForm` via `@simplewebauthn/browser` v10)
  - Fingerprint pad (`FingerprintPad`)
- `localStorage` persistence (`jarvis_auth_user` key)
- FastAPI backend with WebAuthn passkey endpoints
- Full TypeScript strict-mode typing
- Full unit/regression test suite with Vitest

[Unreleased]: https://github.com/jarvis-security/jarvis-security-suite/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/jarvis-security/jarvis-security-suite/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jarvis-security/jarvis-security-suite/releases/tag/v1.0.0
