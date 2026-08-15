# Current Task — Priority Order

## ✅ JUST COMPLETED: Make JARVIS Login Functional + Industry Grade Plugins
**Task ref**: Build 10/10 todos completed  
**What was done**: Next.js 14 + React 18 + TS strict pluggable auth suite built.
- Pluggable `AuthAdapter` Strategy pattern (Mock/Backend/Firebase) — adapter selection via `NEXT_PUBLIC_AUTH_ADAPTER` env variable
- Four working biometric components: PasskeyForm · FacialScanner (real getUserMedia + base64 capture) · VoiceScanner (real MediaRecorder + waveform) · FingerprintPad (press-hold progress)
- `SoundEngine` (zero-file Web Audio beeps/success/error)
- CanvasBackground particle starfield + animated grid
- ArcReactorHud with concentric rings, telemetry badges, live speech log
- AuthPortal shell: header, 12-col grid, mode switcher, AccessModal dialog, footer clock
- Build: ✅ tsc zero errors, ✅ next build 4/4 pages static, ✅ dev server on :3000 renders correctly

---

## 🔴 CURRENT NEXT TASK (P0): TASK-11a — Add Vitest Unit Test Suite
**Priority**: P0 (required for open source release — "Write tests" user rule)
**Owner**: Next developer session
**Why needed**: Open source projects without tests are not industry-grade. User rules explicitly require "Write tests. Keep existing tests passing."
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

### TASK-11b (P1): Real WebAuthn Passkey Registration + Assertion Flow
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

### TASK-11e (P2): Weather Service Integration (SEPARATE PHASE PER RULES)
⚠️ User rules: Weather remains source of truth, Weather Stations separate phase. Do not mix with auth.
1. Create `app/weather/` domain (NOT inside `app/` Next router unless routing needed, probably `app/lib/weather`)
2. Define `WeatherService` interface (pluggable like AuthAdapter): OpenMeteoAdapter · OpenWeatherMapAdapter · NOAAAdapter · WeatherKitAdapter
3. Define `WeatherStation` interface (Weather Stations is separate phase per rules — do NOT start this phase yet; just placeholder and doc)

### TASK-11f (P3): Add Storybook + Chromatic Visual Regression
### TASK-11g (P3): Add ESLint + Prettier + Husky + lint-staged pre-commit hooks
### TASK-11h (P3): GitHub Actions CI — npm run build, npm test, npm run lint on every PR
