# Changelog

All notable changes to the `@jarvis-security/sdk` project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `@jarvis-security/sdk` NPM package with dual CJS/ESM output, TypeScript declarations, and subpath exports
- Barrel entry point (`app/index.ts`) exporting all SDK modules: auth adapters, context, components, types, and sound engine
- `tsup.config.ts` for root-level SDK build targeting `app/index.ts`, output to `dist/`
- `tsconfig.sdk.json` for isolated SDK DTS generation
- OSS documentation: `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, CI workflow
- `peerDependencies` for React (v18+) — framework-agnostic at peer level
- `files: ["dist"]` field to publish only compiled output to NPM

### Fixed
- **P0 BUG**: Form permanently locked into "AUTHENTICATING..." loading state on dev server start — root cause was dual failure in `onAuthStateChanged()` (adapter) and AuthContext init `useEffect` both guarding on truthy `currentUser`/`user`. Removed both guards and added a 5s `setTimeout` failsafe watchdog
- **Bug-02**: `enrollBiometrics()` now syncs `hasBiometrics: true` back to the module-level `DEMO_USERS` map, not just localStorage — persistence now survives full logout/login round-trips
- `esbuild` allowScripts entry updated for v0.27.7 postinstall script
- `styled-jsx` `<style jsx global>` type error in `AuthPortal.tsx` replaced with standard `dangerouslySetInnerHTML` for SDK compatibility

### Security & Quality
- Backend hardened with bcrypt, PyJWT, CORS, slowapi rate-limiting, SQLModel/SQLite, WebAuthn passkey endpoints
- Vitest suite: 5 test files, 64 green tests, v8 coverage at 60% thresholds
- AuthAdapter interface contract tests — 11 methods verified

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

[Unreleased]: https://github.com/jarvis-security/jarvis-security-suite/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jarvis-security/jarvis-security-suite/releases/tag/v1.0.0
