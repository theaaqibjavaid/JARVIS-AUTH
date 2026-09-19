# Current Task — Priority Order

## ✅ JUST COMPLETED: v2.0.2 — Security Hardening & Test Repair (2026-09-19, published to npm)
**Status**: ✅ COMPLETE — Demo-mode backdoors removed, per-installation encryption salts applied, stale random telemetry replaced with real device metrics, test suite repaired and verified.
**Task ref**: v2.0.2 security hardening
**Date**: 2026-09-19
**What was done**: Removed hardcoded `demoPasskey` token, synthetic user injection, and `__enterDemoMode()` backdoor from `MockAuthAdapter`. Replaced `Math.random()`-based salt and challenge generation with cryptographically secure `crypto.getRandomValues()` in `webauthn-biometrics.ts` and `voiceprint.ts`. Added per-installation encrypted storage migration. Replaced random CPU/memory telemetry in `ArcReactorHud.tsx` with real `navigator.deviceMemory`/`navigator.hardwareConcurrency`. Fixed voice scan media-error recovery in `VoiceScanner.tsx`. Added `resetToken` to `AuthResult` and `MockAuthAdapter` for complete password-reset flow. Repaired 3 failing tests (auth-context voice section missing register step, auth-adapter duplicate UID tests). Total: 130 frontend tests (7 suites) + 25 backend tests (pytest), all green; `tsc --noEmit` clean; `next build` success; tsup SDK build success. Published: `@jarvis-security/sdk@2.0.2` on npm.
**Docs updated**: README.md, CHANGELOG.md, CONTRIBUTING.md, RELEASE_NOTES.md, CURRENT_TASK.md.

---

## ✅ JUST COMPLETED: v2.0.0 — Real Biometrics Rebuild (2026-08-26, published to npm)
**Status**: ✅ COMPLETE — Real biometrics shipped, 130 frontend tests + 25 backend tests green, SDK v2.0.0 published.
**Task ref**: v2.0.0 real biometrics rebuild
**Date**: 2026-08-26
**What was done**: Replaced all fake/mock biometrics with real verification and a register-first-then-login model.
- `app/lib/webauthn-biometrics.ts` (NEW) — real WebAuthn platform authenticator engine for face + fingerprint (Windows Hello / Face ID / Touch ID). OS verifies the biometric; raw data never leaves the device. Per-email credential store with signature-count tracking.
- `app/lib/voiceprint.ts` (NEW) — real client-side MFCC DSP voiceprint engine (pre-emphasis → Hamming → radix-2 FFT → mel filterbank → log → DCT → 26-dim vector, cosine similarity, threshold 0.82). Fully offline.
- `app/types/index.ts` — `AuthAdapter` now has 13 methods: `verifyFace()` / `verifyFingerprint()` are no-arg (OS prompt internal), new `enrollVoice(audioBlob)`, plus `resetPasswordConfirm()` added in v2.0.1.
- `app/lib/auth-adapter.ts` — Mock + Backend adapters rewritten on the real engines; BackendAuthAdapter exchanges the local assertion for a session via `POST /api/v1/auth/biometric-login`.
- UI — FacialScanner / FingerprintPad trigger the real OS prompt; VoiceScanner has dual ENROLL/VERIFY modes with real mic recording; DashboardPanel enrolls device biometrics.
- Backend `main.py` — removed 5 fake endpoints (`verify-face/voice/fingerprint`, `webauthn/options`, `webauthn/verify`); added `POST /api/v1/auth/enroll-biometric` (10/min) + `POST /api/v1/auth/biometric-login` (20/min) with enrollment gate + credential-binding check. `python-jose` → PyJWT fix; `on_event` → lifespan.
- Tests — 55 new engine tests (`voiceprint.test.ts` 25, `webauthn-biometrics.test.ts` 21) + adapter/context suites rewritten against the real engines.
- Verification — Frontend: 130/130 tests pass (7 suites), typecheck clean, `next build` success, tsup SDK build success. Backend: 25/25 pytest pass. Published: `@jarvis-security/sdk@2.0.0` on npm.
- Docs — README.md, CHANGELOG.md, and CONTRIBUTING.md updated for v2.0.0.

---

## ✅ JUST COMPLETED: Make JARVIS Login Functional + Industry Grade Plugins
**Status**: ✅ COMPLETE — Build 10/10 todos completed, all pending tasks resolved.
**Task ref**: Build 10/10 todos completed  
**Date**: 2026-08-20
**What was done**: Next.js 14 + React 18 + TS strict pluggable auth suite built and production-hardened.
- Pluggable `AuthAdapter` Strategy pattern (Mock/Backend/Firebase) — adapter selection via `NEXT_PUBLIC_AUTH_ADAPTER` env variable
- Four working biometric components: PasskeyForm · FacialScanner (real getUserMedia + base64 capture) · VoiceScanner (real MediaRecorder + waveform) · FingerprintPad (press-hold progress)
- `SoundEngine` (zero-file Web Audio beeps/success/error)
- CanvasBackground particle starfield + animated grid
- ArcReactorHud with concentric rings, telemetry badges, live speech log
- AuthPortal shell: header, 12-col grid, mode switcher, AccessModal dialog, footer clock
- Build: ✅ tsc zero errors, ✅ next build 4/4 pages static, ✅ dev server on :3000 renders correctly

---

## 🔴 CURRENT NEXT TASK (P0): TASK-11a — Add Vitest Unit Test Suite
**Status**: ✅ COMPLETE
**Priority**: P0 (required for open source release — "Write tests" user rule)
**Owner**: Next developer session
**Why needed**: Open source projects without tests are not industry-grade. User rules explicitly require "Write tests. Keep existing tests passing."
**Acceptance criteria**: ✅ All met — Vitest 1.6 + jsdom + Testing Library installed. 5 test files, **64 green tests** (auth-adapter: 31, auth-context: 14, types: 7, sound-engine: 7, PasskeyForm: 5). Coverage at 60% thresholds.
**Acceptance criteria**:
1. `package.json` adds `devDependencies`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`
2. `vitest.config.ts` created at repo root with jsdom environment, Next.js moduleNameMapper for `@/*` aliases
3. Tests folder: `__tests__/` at repo root (or `app/**/*.test.tsx` colocated)
4. Tests that MUST PASS:
   - `MockAuthAdapter.test.ts`:
     - register + login with valid email (≥6 chars) → success
     - login with short passkey (<6) → error "Passkey must be at least 6 characters"
     - logout → `getCurrentUser()` returns null, localStorage key removed
     - verifyFace / verifyVoice / verifyFingerprint → returns user profile with success
     - onAuthStateChanged fires immediately with existing user (and cleanup returns unsubscribe fn)
   - `SoundEngine.test.ts`: mock AudioContext / OSC / gain; verify playBeep / playSuccess / playError create right nodes
   - `AuthContext.test.tsx`: render `<AuthProvider>` with mock adapter, useAuth() returns initial { user:null, status:"idle" }, login() → status becomes loading then authenticated
5. Script added to package.json: `"test": "vitest run"`, `"test:watch": "vitest"`
6. Script actually run: `npm test` exits 0 with all tests passing

---

## 🟠 FUTURE TASKS (Backlog, sorted by priority)

### TASK-11a (P0) — Vitest Unit Test Suite
**Status**: ✅ COMPLETE — 5 test files, 64 green tests.

### TASK-11b (P1) — Real WebAuthn Passkey Registration + Assertion Flow
**Status**: ✅ COMPLETE
- `verifyPasskey()` added to `AuthAdapter` interface and both `MockAuthAdapter` / `BackendAuthAdapter`
- Uses `@simplewebauthn/browser` `startAuthentication()`
- "USE DEVICE PASSKEY" button on PasskeyForm with `aria-label`
- Feature detection via `window.PublicKeyCredential` check → returns `passkey-not-supported` error
- Test coverage: 2 verifyPasskey tests + interface contract verification

### TASK-11c (P1) — FastAPI Backend Production Hardening
**Status**: ✅ COMPLETE
- FastAPI backend hardened with `bcrypt`, `PyJWT`, CORS middleware, `slowapi` rate-limiting
- SQLModel/SQLite for storage, WebAuthn passkey endpoints (options/verify/register)
- Dependencies recorded in `requirements.txt`

### TASK-11d (P2) — Extract to `@jarvis-security/sdk` NPM Package
**Status**: ✅ COMPLETE
- Root-level SDK build using `tsup` (dual CJS/ESM + DTS)
- Entry: `app/index.ts` barrel exporting all adapters, context, components, types, SoundEngine
- `package.json` fields: `main`, `module`, `types`, `exports` all point to `dist/`
- `tsup.config.ts` + `tsconfig.sdk.json` for isolated DTS build
- `npm run build:sdk` → ✅ CJS (48.50 KB), ESM (45.61 KB), DTS (6.09 KB)
- `files: ["dist"]` to publish only compiled output
- `peerDependencies`: react ^18, react-dom ^18
**Why**: We already ship `@simplewebauthn/browser` but `enrollBiometrics` currently just toggles a boolean. Upgrade it to:
1. On `enrollBiometrics()`: call server for registration options, call `startRegistration()`, save credential via adapter
2. Add new `verifyPasskey()` method to `AuthAdapter` interface (WebAuthn assertion), separate from password login
3. Show passkey "USE DEVICE PASSKEY" option button on PasskeyForm

### TASK-11c (P1): FastAPI Backend Production Hardening
**Current**: python-backend/main.py has stub endpoints returning demo user objects. Upgrade:
1. Password hashing: bcrypt (never store plaintext)
2. JWT access + refresh tokens (PyJWT + python-jose) with HttpOnly cookie or Authorization: Bearer
3. Pydantic schemas + request validation, CORS middleware, rate limiting (slowapi)
4. Real SQLite / Postgres via SQLAlchemy (or async SQLModel)
5. Facial/voice endpoints: call real CV / speaker verification libraries (face_recognition, librosa + Resemblyzer) or placeholder for pluggable AI providers
6. Scripts: create venv, install reqs, run uvicorn, pytest suite for FastAPI

### TASK-11d (P2): Extract to @jarvis-security/sdk NPM Package (The True Plugin Vision)
**Goal**: Publish pluggable package so any app can `npm i @jarvis-security/sdk` + `<JarvisAuthPortal adapter={myAdapter} onSuccess={redirect}/>` without copying files.
1. Create `packages/sdk/` with `tsup` or `rollup` bundler
2. Export: `<AuthProvider />`, `<AuthPortal />`, all biometric components, `createAuthAdapter()`, `MockAuthAdapter`, `AuthAdapter` interface, `SoundEngine`
3. Peer deps: react ^18, next ^14 (optional), tailwindcss ^3 (optional, provide global CSS bundle too)
4. Storybook playground in `packages/storybook` with all four biometric panels for isolated visual testing

### TASK-11f (P3): Add Storybook + Chromatic Visual Regression
### TASK-11g (P3): Add ESLint + Prettier + Husky + lint-staged pre-commit hooks
### TASK-11h (P3): GitHub Actions CI — npm run build, npm test, npm run lint on every PR
