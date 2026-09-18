<div align="center">

# ⚡ J.A.R.V.I.S. Security Suite SDK

**Production-grade pluggable multi-biometric authentication for React / Next.js applications**

<a href="https://github.com/theaaqibjavaid/jarvis-security-suite/actions"><img src="https://github.com/theaaqibjavaid/jarvis-security-suite/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
[![Tests](https://img.shields.io/badge/tests-157%20passed-brightgreen)](#-testing)
[![npm](https://img.shields.io/npm/v/@jarvis-security/sdk?label=%40jarvis-security%2Fsdk)](https://www.npmjs.com/package/@jarvis-security/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)

[Features](#-features) · [Quick Start](#-quick-start) · [SDK Integration](#-sdk-integration) · [Auth Adapters](#-auth-adapters) · [FastAPI Backend](#-fastapi-backend) · [Testing](#-testing) · [Contributing](#-contributing)

<br/>

![JARVIS Auth](docs/JARVIS.png)
</div>

---

## ✨ Features

| Layer | What you get |
|---|---|
| 🔐 **4 Real Biometric Methods** | Passkey (WebAuthn) · Face (Windows Hello / Face ID) · Voice (on-device MFCC DSP) · Fingerprint (Touch ID / Windows Hello) — **register first, then login** |
| 🧬 **Real Device Biometrics** | Face & fingerprint use the **WebAuthn platform authenticator** — the OS verifies the biometric, raw data never leaves the device |
| 🎙️ **Real Voice Recognition** | Client-side **MFCC voiceprint** engine (FFT → mel filterbank → DCT → cosine similarity) — fully offline, no audio ever uploaded |
| 🗝️ **WebAuthn Passkeys** | Real device passkey sign-in via `@simplewebauthn/browser` with feature detection |
| 🔌 **Pluggable Backends** | **Strategy / Adapter Pattern** — Mock (demo/local) · FastAPI REST · write your own for Supabase, Auth0, Clerk... |
| 🛡️ **Hardened Backend** | FastAPI with bcrypt hashing, JWT access + refresh tokens, CORS, rate limiting (slowapi), CSRF/Origin validation, security headers, SQLModel/SQLite persistence |
| 🎨 **Sci-Fi Visuals** | Arc Reactor MK VII HUD, animated starfield + grid canvas, laser scan beams, CRT scanlines, neon corner-frames, telemetry badges |
| 🔊 **Zero-file Audio** | Web Audio–synthesized beeps, success triads, error descents — *no MP3 / WAV files required* |
| 🏠 **Persistence** | Session survives reload via `localStorage` (`jarvis_auth_user`) + `onAuthStateChanged` observable subscription pattern |
| ♿ **Accessibility** | `aria-*` labels, `htmlFor`/`id` bindings, keyboard support (Space/Enter), `prefers-reduced-motion` support |
| 📱 **Responsive** | 12-col Tailwind grid collapses gracefully on tablet + mobile |
| ✅ **Fully Tested** | 132 frontend unit tests (Vitest + Testing Library) + 25 backend tests (pytest) |
| 🔧 **Zero config demo** | `npm run dev` → works out of the box with `MockAuthAdapter` (no backends needed) |

---

## ⚡ Quick Start

> 🚨 **Node.js 18.17+ required** (Next.js 14 requirement)

```bash
# 1. Install dependencies
npm install

# 2. Run dev server (Mock adapter — works out of the box)
npm run dev

# 3. Open  →  http://localhost:3000
```

That's it. **No API keys, no backends.** The default `MockAuthAdapter` accepts:
- Any valid email format
- Any passkey with 6+ characters

Try these:

| What | Input |
|---|---|
| Email | `stark@avengers.io` |
| Passkey | `iamironman` |

**Biometrics are real — register first, then login:**

| Method | Enroll | Login |
|---|---|---|
| 🧑 **Face** | Dashboard → *Enroll Biometrics* → OS face prompt (Windows Hello / Face ID) | Face panel → OS verifies your face |
| 🎙️ **Voice** | Voice panel → *ENROLL VOICEPRINT* → speak the phrase | Voice panel → *VERIFY* → speak again → DSP match |
| 👆 **Fingerprint** | Dashboard → *Enroll Biometrics* → touch the sensor | Fingerprint panel → touch the sensor |

> Face & fingerprint are enforced by your **OS** via the WebAuthn platform authenticator (no sensor data ever reaches the app). Voice matching runs **100% on-device** (MFCC voiceprint + cosine similarity).

### Production build

```bash
npm run build   # ✓ 0 type errors, outputs statically-rendered pages
npm run start   # serves production build on :3000
```

---

## 📦 SDK Integration

Install the package into any React / Next.js project:

```bash
npm install @jarvis-security/sdk
```

### Minimal drop-in auth page

```tsx
"use client";
import {
  AuthProvider,
  AuthPortal,
  CanvasBackground,
  createAuthAdapter,
} from "@jarvis-security/sdk";

const adapter = createAuthAdapter("mock");

export default function AuthPage() {
  return (
    <AuthProvider adapter={adapter}>
      <CanvasBackground />
      <AuthPortal />
    </AuthProvider>
  );
}
```

### Protect any route (3 lines)

```tsx
"use client";
import { useAuth } from "@jarvis-security/sdk";
import { redirect } from "next/navigation";

export default function Dashboard() {
  const { user, status } = useAuth();
  if (typeof window !== "undefined" && status === "unauthenticated") redirect("/auth");
  return <div>Welcome, {user?.fullName}</div>;
}
```

### Build the SDK bundle

```bash
npm run build:sdk   # → dist/index.cjs, dist/index.mjs, dist/index.d.ts
```

Dual CJS + ESM output with full TypeScript declarations, built with [tsup](https://tsup.egoist.dev).

---

## 📦 Publishing to npm

The package publishes under the scoped name `@jarvis-security/sdk`. A GitHub Actions workflow handles the full release pipeline on every version tag push.

### Prerequisites

Set up **trusted publishing** once — no secrets to manage, no tokens to rotate.

1. **Add a trusted publisher in npm:**
   Go to [npm → Settings → Security → Trusted Publishers](https://www.npmjs.com/settings/<username>/security) and add:

   | Field | Value |
   |---|---|
   | **Name** | `GitHub Actions` (or anything you like) |
   | **Workflow** | `.github/workflows/release.yml` |
   | **Environment** | *(leave blank for all environments)* |
   | **Branch/Tag** | *(leave blank for any)* |

   npm will store your public OIDC key and associate it with this workflow file path.

2. **Nothing else needed** — the `id-token: write` permission declared in the workflow lets GitHub mint OIDC tokens; npm verifies them against the key you registered above.

> **No `NPM_TOKEN` secret is required.** If you previously added one, you can remove it from `Settings → Secrets and variables → Actions`.

### Release process

```bash
# 1. Update the version in package.json
npm version 2.1.0 --no-git-tag-version

# 2. Commit and push the version bump
git add package.json
git commit -m "Bump version to 2.1.0"
git push origin main

# 3. Create and push a semver tag — this triggers the release workflow
git tag v2.1.0
git push origin v2.1.0
```

The [`release.yml`](./.github/workflows/release.yml) workflow then:

| Step | Action |
|---|---|
| Version guard | Compares the tag against `package.json`; aborts if they don't match |
| Typecheck | `npx tsc --noEmit -p tsconfig.typecheck.json` |
| Lint | `npm run lint` |
| Frontend tests | `npm test` (132 tests) |
| Build SDK | `npm run build:sdk` |
| Backend tests | `pytest test_main.py` (25 tests) |
| Publish | `npm publish --provenance --access public` |
| GitHub Release | Creates a release with the changelog entry auto-injected |

The `--provenance` flag adds [npm provenance](https://docs.npmjs.com/generating-provenance-statements) attestation for supply-chain integrity.

For manual trigger without a tag (e.g. hotfix), use:
```bash
gh workflow run release.yml -f version=2.1.1
```

---

## 🔌 Environment Variables

Copy `.env.example` to `.env.local` (frontend) and `app/python-backend/.env` (backend):

```bash
# Frontend — .env.local
NEXT_PUBLIC_AUTH_ADAPTER=mock          # or "backend"
NEXT_PUBLIC_AUTH_API_URL=http://localhost:8000   # only needed for backend

# Backend — app/python-backend/.env
JARVIS_JWT_SECRET=                     # REQUIRED in production (openssl rand -hex 64)
JARVIS_CORS_ORIGINS=http://localhost:3000
JARVIS_DB_URL=sqlite:///jarvis_auth.db
```

See [`.env.example`](./.env.example) for the complete variable reference.

---

## 🧩 Auth Adapters

Pick an adapter by passing it to `createAuthAdapter()` or injecting it directly into `<AuthProvider>`.

| Adapter | Name | Use-case | Needs backend? |
|---|---|---|---|
| `MockAuthAdapter` *(default)* | `"mock"` | Demo, local dev, CI, UI testing | ❌ |
| `BackendAuthAdapter` | `"backend"` | FastAPI backend (included) or any REST API | ✅ |
| **Write your own** | *(any string)* | Supabase · Auth0 · Clerk · NextAuth · AWS Cognito... | — |

### Switch to the Backend adapter

```tsx
// .env.local
NEXT_PUBLIC_AUTH_ADAPTER=backend
NEXT_PUBLIC_AUTH_API_URL=http://localhost:8000
```

Or inject programmatically:

```tsx
const adapter = createAuthAdapter("backend", {
  baseUrl: process.env.NEXT_PUBLIC_AUTH_API_URL,
});
```

### ✍️ Write a custom adapter

Implement the `AuthAdapter` interface — that's the only contract. The interface has 13 methods:

```ts
import type { AuthAdapter, AuthResult, UserProfile } from "@jarvis-security/sdk";

interface AuthAdapter {
  readonly name: string;
  register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
  login(email: string, passkey: string): Promise<AuthResult>;
  logout(): Promise<AuthResult>;
  resetPassword(email: string): Promise<AuthResult>;
  resetPasswordConfirm(email: string, token: string, newPasskey: string): Promise<AuthResult>;
  verifyFace(): Promise<AuthResult>;
  verifyVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyFingerprint(): Promise<AuthResult>;
  enrollBiometrics(userId: string): Promise<AuthResult>;
  enrollVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyPasskey(email?: string): Promise<AuthResult>;
  getCurrentUser(): Promise<UserProfile | null>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
```

Example (Supabase):

```ts
export class SupabaseAuthAdapter implements AuthAdapter {
  readonly name = "SupabaseAuthAdapter";
  constructor(private readonly supabase: SupabaseClient) {}

  async login(email: string, passkey: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: passkey });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user as unknown as UserProfile };
  }
  // ... implement the remaining 12 methods
}
```

Then plug it in:

```tsx
<AuthProvider adapter={new SupabaseAuthAdapter(createClient(...))}>
  <CanvasBackground />
  <AuthPortal />
</AuthProvider>
```

✅ **No UI code changes ever.** Your Supabase/Auth0/Clerk/NextAuth backend drives the same futuristic panels.

---

## 🐍 FastAPI Backend

A production-hardened backend lives in [app/python-backend/](./app/python-backend/):

| Feature | Implementation |
|---|---|
| Password hashing | **bcrypt** (12 rounds, never stores plaintext) |
| Tokens | **PyJWT** — HS256 access (30 min) + refresh (7 days) tokens |
| Rate limiting | **slowapi** — 5/min register, 10/min login, 30/min default |
| Storage | **SQLModel + SQLite** (swap to Postgres via `JARVIS_DB_URL`) |
| CORS | Configurable via `JARVIS_CORS_ORIGINS` |
| CSRF/Origin | Rejects POST/PUT/DELETE from non-allowed origins |
| Security headers | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Device biometrics | Register-first enrollment + biometric login with per-user credential binding (`Passkey` table) |
| Password reset | In-memory one-time tokens (`_reset_tokens`); integrates with email service in production |

### Run it

```bash
cd app/python-backend
python -m venv .venv && .venv\Scripts\activate        # Windows
# source .venv/bin/activate                            # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### API endpoints

| Method | Path | Rate limit |
|---|---|---|
| `GET` | `/api/v1/health` | 60/min |
| `POST` | `/api/v1/auth/register` | 5/min |
| `POST` | `/api/v1/auth/login` | 10/min |
| `POST` | `/api/v1/auth/refresh` | 30/min |
| `POST` | `/api/v1/auth/reset-password/request` | 5/min |
| `POST` | `/api/v1/auth/reset-password/confirm` | 5/min |
| `POST` | `/api/v1/auth/enroll-biometric` | 10/min |
| `POST` | `/api/v1/auth/biometric-login` | 20/min |

**Biometric model:** the real biometric gate happens on the device (OS platform authenticator for face/fingerprint, DSP voiceprint for voice). The backend then (1) refuses `biometric-login` unless the operative has enrolled, and (2) for face/fingerprint verifies the presented `credential_id` is bound to the claimed user before issuing JWTs.

---

## 🧪 Testing

### Frontend — 132 tests

```bash
npm test          # single run
npm run test:watch  # watch mode
npm run test:coverage  # with coverage report
```

| Suite | Tests |
|---|---|
| `auth-adapter.test.ts` | 44 |
| `voiceprint.test.ts` | 25 |
| `webauthn-biometrics.test.ts` | 21 |
| `auth-context.test.tsx` | 15 |
| `types.test.ts` | 7 |
| `sound-engine.test.ts` | 7 |
| `PasskeyForm.test.tsx` | 5 |
| `App.test.tsx` | 8 |

Coverage thresholds enforced: **lines 80% · branches 80% · functions 80% · statements 80%**

The biometric engines are tested for real: `voiceprint.test.ts` exercises the full DSP pipeline (FFT, mel filterbank, MFCC, cosine matching, voiceprint store) and `webauthn-biometrics.test.ts` covers credential options building, enrollment, and scoped authentication against a stubbed OS authenticator.

### Backend — 25 tests

```bash
cd app/python-backend
pip install -r requirements.txt
pytest test_main.py -v --asyncio-mode=auto
```

Covers: health check, register, login, duplicate rejection, password reset request/confirm, JWT refresh, biometric enrollment, register-first biometric login (face / voice / fingerprint), credential-binding rejection, rate limiting, CSRF/Origin validation.

---

## 📁 Project Structure

```
jarvis-security-suite/              ← npm project root
├── app/                            ← Next.js App Router directory + SDK source
│   ├── components/
│   │   ├── AuthPortal.tsx              shell: header · grid · modes · modal · footer
│   │   ├── ArcReactorHud.tsx           left HUD — rings · telemetry · speech log
│   │   ├── CanvasBackground.tsx        starfield particles + 40 px grid (pure canvas)
│   │   └── biometrics/
│   │       ├── PasskeyForm.tsx         email + passkey + fullName + reset-confirm UI
│   │       ├── FacialScanner.tsx       Face auth via WebAuthn platform authenticator
│   │       ├── VoiceScanner.tsx        Voice enroll/verify via real DSP voiceprint
│   │       └── FingerprintPad.tsx      Fingerprint auth via WebAuthn platform authenticator
│   ├── context/AuthContext.tsx         AuthProvider + useAuth() hook
│   ├── lib/
│   │   ├── auth-adapter.ts             Mock · Backend (Strategy classes)
│   │   ├── webauthn-biometrics.ts      Real WebAuthn platform authenticator engine
│   │   ├── voiceprint.ts               Real MFCC DSP voiceprint engine
│   │   └── sound-engine.ts             Web Audio synth: beep / success / error
│   ├── types/index.ts                  ALL shared types + AuthAdapter interface (13 methods)
│   ├── python-backend/                 Hardened FastAPI backend + pytest suite
│   ├── index.ts                        SDK barrel entry point
│   ├── globals.css                     fonts + cyber-* classes + scanlines + keyframes
│   ├── layout.tsx                      Next.js root HTML shell + metadata
│   └── page.tsx                        HOME = AuthProvider + Canvas + AuthPortal
├── __tests__/                          Vitest test suites (132 tests, 7 suites)
├── .github/workflows/ci.yml            CI: typecheck · lint · test-frontend · test-backend · build-sdk
├── docs/                               Task tracking & session history
├── .env.example                        Complete env var reference (frontend + backend)
├── tsup.config.ts                      SDK bundler config (CJS + ESM + DTS)
├── vitest.config.ts                    test runner config
├── vitest.setup.ts                     test globals + audio mocks
├── tailwind.config.ts                  colors · fonts · shadows · keyframes · anims
└── package.json                        @jarvis-security/sdk v2.0.1
```

---

## 🔐 Security Notes

This is a **UI + adapter framework** — real security comes from whichever `AuthAdapter` you plug in.

| Concern | MockAdapter | BackendAdapter (FastAPI) | *Your Custom Adapter* |
|---|---|---|---|
| Password hashing | ❌ none (demo only) | ✅ bcrypt (12 rounds) | ✅ your responsibility |
| HTTPS only | N/A (localhost) | ✅ mandatory in prod | ✅ |
| JWT tokens | ❌ | ✅ access + refresh (PyJWT HS256) | ✅ implement |
| Rate limiting | ❌ | ✅ slowapi per-endpoint limits (20/min biometric login) | ✅ in your backend |
| CSRF/Origin | ❌ | ✅ rejects cross-origin state-changing requests | ✅ implement |
| Security headers | ❌ | ✅ CSP, HSTS, X-Frame-Options, Referrer-Policy | ✅ your responsibility |
| Face / fingerprint biometrics | ✅ OS-enforced via WebAuthn platform authenticator | ✅ + server-side credential binding & register-first enforcement | ✅ implement |
| Voice biometrics | ✅ on-device DSP voiceprint (audio never uploaded) | ✅ + server-side register-first enforcement | ✅ implement |
| WebAuthn passkeys | ⚠️ feature-detected, needs server | ✅ options/verify/register endpoints | ✅ implement |
| Input validation | Client-side only | ✅ Pydantic schemas | ✅ |

👉 **Use `MockAuthAdapter` only for demos/UI development. Before going live, plug in a security-audited adapter, set `JARVIS_JWT_SECRET`, and enable HTTPS.**

---

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14.2** (App Router — all UI components tagged `"use client"`) |
| Runtime | **React 18.3** with hooks + Context API |
| Types | **TypeScript 5.6** (`strict: true`) |
| Styling | **Tailwind 3.4** + custom cyber theme + global CSS augmentations |
| Icons | `lucide-react` (tree-shakable, ESM) |
| WebAuthn | `@simplewebauthn/browser` v10 |
| Utilities | `clsx` + `tailwind-merge` |
| Audio | Native **Web Audio API** (zero files) |
| Particles | Native **HTML5 Canvas 2D** (zero deps) |
| SDK build | **tsup** (dual CJS/ESM + DTS) |
| Testing | **Vitest 1.6** + Testing Library + jsdom · **pytest** + httpx (backend) |
| Backend | **FastAPI** + SQLModel + bcrypt + PyJWT + slowapi |
| CI | **GitHub Actions** — typecheck, lint, test-frontend, test-backend, build-sdk on every PR |

---

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

**TL;DR:**
1. Fork & create a feature branch (`feat/...` or `fix/...`)
2. Keep PRs small — one feature / one bugfix per PR
3. Write tests for any new feature or bugfix
4. Ensure `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build:sdk` all pass
5. Follow the [Code of Conduct](./CODE_OF_CONDUCT.md)

---

## 📄 License

**[MIT](./LICENSE) © 2026** — Just A Rather Very Intelligent System™
Portions of visual styling inspired by Marvel's Iron Man / Stark Industries HUD aesthetics — this is a fan-built UI kit, *not* affiliated with Marvel/Disney.

---

<div align="center">
  <strong>« I have successfully hijacked your authentication flow, sir. »</strong><br/>
  <sub>— J.A.R.V.I.S., probably</sub>
  <br/><br/>
  <strong>⭐ Star this repo on GitHub if this saved you from building a boring login page.</strong>
</div>
