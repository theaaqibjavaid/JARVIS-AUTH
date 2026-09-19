# J.A.R.V.I.S. Security Suite — Project Memory

## Project Identity
- **Codename**: jarvis-security-suite
- **Public Name**: J.A.R.V.I.S. Futuristic Pluggable Authentication Suite
- **License**: MIT (open-source ready)
- **Stack**: Next.js 14 (App Router) + React 18 + TypeScript (strict) + Tailwind CSS 3

## Core Architectural Decisions (Non-Negotiable)
1. **Adapter Pattern (Strategy) for Pluggable Auth**
   - All auth backends implement the `AuthAdapter` interface contract
   - Three adapters ship out of the box: `MockAuthAdapter` (default/demo), `BackendAuthAdapter` (FastAPI)
   - Consumers swap adapters via env var or props — **UI never changes**
   - Storage key: `jarvis_auth_user` for localStorage persistence
2. **Next.js App Router — page.tsx is the drop-in shell**
   - `page.tsx` composes: `<AuthProvider> <CanvasBackground /> <AuthPortal /> </AuthProvider>`
   - Drop this page (and folder) into any Next.js App Router project
3. **Zero external media assets**
   - All sounds synthesized in-browser via `SoundEngine` class (Web Audio API)
   - All visuals rendered via pure CSS + HTML5 Canvas
   - Only runtime deps: `lucide-react`, `tailwind-merge`, `clsx`, `@simplewebauthn/browser`
4. **Graceful hardware degradation**
   - Every real MediaDevice API (`getUserMedia`, `MediaRecorder`) wrapped in try/catch
   - Falls back to simulated progress flow if camera/mic unavailable

## Visual Brand Contract (match prototype HTML)
- Palette: `cyber-cyan #00f3ff`, `cyber-red #ff0055`, `cyber-emerald #00ffaa`, `cyber-bg #030a16`
- Fonts: Orbitron (display), Share Tech Mono (terminal) — Google Fonts CDN in globals.css
- Effects: corner-borders `.cyber-corner-tr/.cyber-corner-bl`, `.scanlines` overlay, neon `shadow-cyber-glow`, concentric spinning rings on Arc Reactor, laser scan beam
- Animations in BOTH globals.css (`.animate-spin-slow` etc.) AND tailwind.config.js theme extension for redundancy

## File Layout
```
jarvis-security-suite/            ← project root (package.json here)
├── app/                          ← Next.js App Router directory
│   ├── components/
│   │   ├── AuthPortal.tsx            (shell + tab switcher + modal)
│   │   ├── ArcReactorHud.tsx         (left HUD — rings, telemetry, terminal)
│   │   ├── CanvasBackground.tsx      (starfield + grid particles)
│   │   └── biometrics/
│   │       ├── PasskeyForm.tsx       (email + passkey + fullName)
│   │       ├── FacialScanner.tsx     (getUserMedia + laser capture)
│   │       ├── VoiceScanner.tsx      (MediaRecorder + waveform)
│   │       └── FingerprintPad.tsx    (press-hold conic progress)
│   ├── context/AuthContext.tsx       (AuthProvider + useAuth())
│   ├── lib/
│   ├── lib/
│   │   ├── auth-adapter.ts           (Mock / Backend classes)
│   │   └── sound-engine.ts           (Web Audio synth)
│   ├── types/index.ts                (All shared TS interfaces, AuthAdapter contract)
│   ├── python-backend/               (Hardened FastAPI backend — bcrypt, JWT, rate limiting, 25 pytest tests)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── .env.example
├── next.config.js
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Rules & Constraints (User-Defined)
- ❌ Never redesign architecture
- ❌ Never modify completed production code
- ❌ Never duplicate provider logic / cache / normalization
- ✅ Always consume Weather Service; Weather remains source of truth
- ✅ Weather Stations are a *separate phase* (not part of this auth plugin)
- ✅ Keep PRs small, write tests, run Ruff (Python), existing tests passing
- ❌ Never introduce new features into legacy sensors domain → all new sensor logic in `weather_station`

## Adapter Environment
`NEXT_PUBLIC_AUTH_ADAPTER` ∈ {`mock` (default), `backend`}
`NEXT_PUBLIC_AUTH_API_URL` (backend only, default http://localhost:8000)

## Build Verification (v2.0.2, 2026-09-19)
- `npm run typecheck` → PASS
- `npm test` → 130/130 PASS (7 suites)
- `npm run build` → PASS
- `npm run build:sdk` → PASS (ESM + CJS + DTS)
- Backend `pytest test_main.py` → 25/25 PASS
- Published: `@jarvis-security/sdk@2.0.2` on npm

## Upcoming / Backlog
1. ~~**Voiceprint Engine**~~ — ✅ DONE in v2.0.0 (`app/lib/voiceprint.ts`, real MFCC DSP)
2. ~~Write Vitest unit tests for `MockAuthAdapter` + `SoundEngine` + `AuthContext` reducer~~ — ✅ DONE (130 tests, 7 suites)
3. Production-harden `BackendAuthAdapter` with refresh token rotation, CSRF, rate-limit headers — ✅ DONE in v2.0.1 (CSRF/Origin middleware, security headers)
4. ~~Implement real WebAuthn passkey registration/assertion in enrollBiometrics (`@simplewebauthn/browser` already installed)~~ — ✅ DONE in v2.0.0 (`app/lib/webauthn-biometrics.ts`, platform authenticator for face/fingerprint)
5. Add `AuthAdapter` implementations for Supabase, Auth0, Clerk as community adapters
6. Create actual Weather Service integration (separate phase per rules)
7. Storybook visual regression snapshots for all biometric panels

## Lessons Learned
- Tailwind JIT **cannot detect dynamically interpolated classes** like `` `bg-cyber-${accent}/20` `` → always use `style` prop or full literal strings
- Move `package.json` + all Node configs to **repository root**, then `app/` becomes the actual Next.js App Router directory (not a nested package)
- `npx next build` needs both `pages/` or `app/` to exist at the same level as `package.json`
- `browser_evaluate` tool has restrictions on inputs/forms — rely on snapshot+click+type workflows for real E2E
- Pipe through `Out-String` on long-running processes causes stdout buffering — omit it for web servers/dev servers
