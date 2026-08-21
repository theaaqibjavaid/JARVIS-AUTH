<div align="center">

# ⚡ J.A.R.V.I.S. Security Suite

**Iron Man–style pluggable multi-biometric authentication — drop into any React / Next.js app**

[![CI](https://github.com/theaaqibjavaid/JARVIS-AUTH/tree/master/.github/workflows/badge.svg)](https://github.com/theaaqibjavaid/JARVIS-AUTH/tree/master/.github/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-64%20passed-brightgreen)](#-testing)
[![npm](https://img.shields.io/npm/v/@jarvis-security/sdk?label=%40jarvis-security%2Fsdk)](https://www.npmjs.com/package/@jarvis-security/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.json)

[Features](#-features) · [Quick Start](#-quick-start) · [SDK Usage](#-sdk-usage) · [Auth Adapters](#-auth-adapters) · [Backend](#-fastapi-backend) · [Testing](#-testing) · [Contributing](#-contributing)

<br/>

![JARVIS Auth](docs/JARVIS.png)
</div>

---

## ✨ Features

| Layer | What you get |
|---|---|
| 🔐 **4 Biometric Methods** | Passkey (password) · Facial scan (real camera) · Voice print (real mic) · Fingerprint (press & hold) |
| 🗝️ **WebAuthn Passkeys** | Real device passkey sign-in via `@simplewebauthn/browser` with feature detection |
| 🔌 **Pluggable Backends** | **Strategy / Adapter Pattern** — Mock (demo) · FastAPI REST · Firebase (skeleton) · write your own for Supabase, Auth0, Clerk... |
| 🛡️ **Hardened Backend** | FastAPI with bcrypt hashing, JWT access + refresh tokens, CORS, rate limiting (slowapi), SQLModel/SQLite persistence |
| 🎨 **Sci-Fi Visuals** | Arc Reactor MK VII HUD, animated starfield + grid canvas, laser scan beams, CRT scanlines, neon corner-frames, telemetry badges |
| 🔊 **Zero-file Audio** | Web Audio–synthesized beeps, success triads, error descents — *no MP3 / WAV files required* |
| 🏠 **Persistence** | Session survives reload via `localStorage` (`jarvis_auth_user`) + `onAuthStateChanged` observable subscription pattern |
| ♿ **Accessibility** | `aria-*` labels, `htmlFor`/`id` bindings, keyboard support (Space/Enter), `prefers-reduced-motion` support |
| 📱 **Responsive** | 12-col Tailwind grid collapses gracefully on tablet + mobile |
| ✅ **Fully Tested** | 64 unit tests (Vitest + Testing Library) + 10 FastAPI backend tests (pytest) |
| 🔧 **Zero config demo** | `npm run dev` → works out of the box with `MockAuthAdapter` (no backends needed) |

---

## ⚡ Quick Start

> 🚨 **Node.js 18.17+ required** (Next.js 14 requirement)

```bash
# 1. Install
npm install

# 2. Run dev server
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
| Or click **FACIAL/EYE** / **VOICE** / **FINGERPRINT SCAN** buttons | — |

### Production build

```bash
npm run build   # ✓ 0 type errors, outputs statically-rendered pages
npm run start   # serves production build on :3000
```

---

## 📦 SDK Usage

Install the package into any React / Next.js project:

```bash
npm install @jarvis-security/sdk
```

### Drop-in auth page

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

### Build the SDK locally

```bash
npm run build:sdk   # → dist/index.cjs, dist/index.mjs, dist/index.d.ts
```

Dual CJS + ESM output with full TypeScript declarations, built with [tsup](https://tsup.egoist.dev).

---

## 🧩 Manual Integration (Copy Source)

Prefer copying source over installing the package? Copy the `app/` folder contents into your Next.js App Router project, then merge the Tailwind theme.

### Step 1 · Copy files

```
your-app/
├── app/
│   ├── (auth)/
│   │   └── jarvis/      # ← COPY components/, context/, lib/, types/, globals.css, page.tsx
```

### Step 2 · Merge Tailwind theme

Copy the `theme.extend` block from [tailwind.config.ts](./tailwind.config.ts) (colors, fontFamily, boxShadow, keyframes, animations) into your Tailwind config.

### Step 3 · Use the `<AuthProvider>` shell

```tsx
// app/(auth)/jarvis/page.tsx
"use client";

import { AuthProvider } from "./context/AuthContext";
import { createAuthAdapter } from "./lib/auth-adapter";
import { CanvasBackground } from "./components/CanvasBackground";
import { AuthPortal } from "./components/AuthPortal";

export default function JarvisAuthPage() {
  const adapter = createAuthAdapter(
    (process.env.NEXT_PUBLIC_AUTH_ADAPTER as "mock" | "backend" | "firebase") || "mock",
    { baseUrl: process.env.NEXT_PUBLIC_AUTH_API_URL }
  );
  return (
    <AuthProvider adapter={adapter}>
      <CanvasBackground />
      <AuthPortal />
    </AuthProvider>
  );
}
```

✅ **Done.** J.A.R.V.I.S. auth is now live at `/jarvis` in your app.

---

## 🔌 Auth Adapters

Pick an adapter by setting an env var. Everything else (UI, flow, persistence, events) stays 100% identical.

| Adapter | `NEXT_PUBLIC_AUTH_ADAPTER=` | Use-case | Needs backend? |
|---|---|---|---|
| `MockAuthAdapter` *(default)* | `mock` | Demo, local dev, CI, UI testing | ❌ |
| `BackendAuthAdapter` | `backend` | FastAPI backend (included) or any REST API | ✅ |
| `FirebaseAdapter` *(v1 skeleton)* | `firebase` | Google Firebase Auth (extend to fit) | ✅ |
| **Write your own** | *(any string)* | Supabase · Auth0 · Clerk · NextAuth · AWS Cognito... | — |

### Switch to the Backend adapter (FastAPI)

```bash
# .env.local  (create at repo root)
NEXT_PUBLIC_AUTH_ADAPTER=backend
NEXT_PUBLIC_AUTH_API_URL=http://localhost:8000
```

### ✍️ Write a custom adapter

Just **implement the `AuthAdapter` interface** — that's the only rule. The contract has 11 methods:

```ts
interface AuthAdapter {
  readonly name: string;
  register(email: string, passkey: string, fullName?: string): Promise<AuthResult>;
  login(email: string, passkey: string): Promise<AuthResult>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<AuthResult>;
  verifyFace(imageBase64: string): Promise<AuthResult>;
  verifyVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyFingerprint(scanData: string): Promise<AuthResult>;
  verifyPasskey(email?: string): Promise<AuthResult>;
  enrollBiometrics(userId: string): Promise<AuthResult>;
  getCurrentUser(): Promise<UserProfile | null>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
```

Example (Supabase):

```ts
import type { AuthAdapter, AuthResult, UserProfile } from "@jarvis-security/sdk";

export class SupabaseAuthAdapter implements AuthAdapter {
  readonly name = "SupabaseAuthAdapter";
  constructor(private readonly supabase: SupabaseClient) {}

  async login(email: string, passkey: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: passkey });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user as unknown as UserProfile };
  }
  // ... implement the remaining methods
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
| WebAuthn | Passkey options / verify / register endpoints |

### Run it

```bash
cd app/python-backend
python -m venv .venv && .venv\Scripts\activate        # Windows
# source .venv/bin/activate                            # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `JARVIS_JWT_SECRET` | *(warns if unset)* | JWT signing key — **must set in production** |
| `JARVIS_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `JARVIS_DB_URL` | `sqlite:///jarvis_auth.db` | SQLAlchemy database URL |

### API endpoints

| Method | Path | Rate limit |
|---|---|---|
| `GET` | `/api/v1/health` | 60/min |
| `POST` | `/api/v1/auth/register` | 5/min |
| `POST` | `/api/v1/auth/login` | 10/min |
| `POST` | `/api/v1/auth/refresh` | 30/min |
| `POST` | `/api/v1/auth/verify-face` | 20/min |
| `POST` | `/api/v1/auth/verify-voice` | 20/min |
| `POST` | `/api/v1/auth/verify-fingerprint` | 20/min |
| `GET` | `/api/v1/auth/webauthn/options` | 10/min |
| `POST` | `/api/v1/auth/webauthn/verify` | 10/min |

---

## 🧪 Testing

### Frontend — 64 tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # with v8 coverage (60% thresholds)
```

| Suite | Tests | Covers |
|---|---|---|
| `auth-adapter.test.ts` | 31 | MockAuthAdapter register/login/logout/reset, biometric verify, enrollBiometrics persistence, onAuthStateChanged, verifyPasskey, factory, BackendAuthAdapter |
| `auth-context.test.tsx` | 14 | AuthProvider init, login/register flows, logout, mode/audio toggles, modal, biometric enrollment round-trip |
| `types.test.ts` | 7 | AuthAdapter interface contract (11 methods), type shapes |
| `sound-engine.test.ts` | 7 | Web Audio beep/success/error synthesis |
| `PasskeyForm.test.tsx` | 5 | Form rendering, validation, passkey visibility toggle |

### Backend — 10 tests

```bash
cd app/python-backend
pip install -r requirements.txt
pytest -v
```

Covers health, register, duplicate-email conflict, login, wrong-passkey rejection, JWT-protected refresh, face/voice/fingerprint verify, and WebAuthn options.

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
│   │       ├── PasskeyForm.tsx         email + passkey + fullName + WebAuthn button
│   │       ├── FacialScanner.tsx       getUserMedia + laser + base64 capture
│   │       ├── VoiceScanner.tsx        MediaRecorder + 24-bar waveform
│   │       └── FingerprintPad.tsx      press-hold conic-gradient ring
│   ├── context/AuthContext.tsx         AuthProvider + useAuth() hook
│   ├── lib/
│   │   ├── auth-adapter.ts             Mock · Backend · Firebase (Strategy classes)
│   │   └── sound-engine.ts             Web Audio synth: beep / success / error
│   ├── types/index.ts                  ALL shared types + AuthAdapter interface
│   ├── python-backend/                 Hardened FastAPI backend + pytest suite
│   ├── index.ts                        SDK barrel entry point
│   ├── globals.css                     fonts + cyber-* classes + scanlines + keyframes
│   ├── layout.tsx                      Next.js root HTML shell + metadata
│   └── page.tsx                        HOME = AuthProvider + Canvas + AuthPortal
├── __tests__/                          Vitest test suites (64 tests)
├── .github/workflows/ci.yml            CI: typecheck · lint · test · build-sdk
├── docs/                               Task tracking & session history
├── .env.example                        adapter env vars
├── tsup.config.ts                      SDK bundler config (CJS + ESM + DTS)
├── vitest.config.ts                    test runner config
├── tailwind.config.ts                  colors · fonts · shadows · keyframes · anims
└── package.json                        @jarvis-security/sdk
```

---

## 🔐 Security Notes

This is a **UI + adapter framework** — real security comes from whichever `AuthAdapter` you plug in.

| Concern | MockAdapter | BackendAdapter (FastAPI) | *Your Custom Adapter* |
|---|---|---|---|
| Password hashing | ❌ none (demo only) | ✅ bcrypt (12 rounds) | ✅ your responsibility |
| HTTPS only | N/A (localhost) | ✅ mandatory in prod | ✅ |
| JWT tokens | ❌ | ✅ access + refresh (PyJWT HS256) | ✅ implement |
| Rate limiting | ❌ | ✅ slowapi per-endpoint limits | ✅ in your backend |
| WebAuthn passkeys | ⚠️ feature-detected, needs server | ✅ options/verify/register endpoints | ✅ implement |
| Input validation | Client-side only | ✅ Pydantic schemas | ✅ |

👉 **Use `MockAuthAdapter` only for demos/UI development. Before going live, plug in a security-audited adapter and set `JARVIS_JWT_SECRET`.**

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
| CI | **GitHub Actions** — typecheck, lint, test, build-sdk on every PR |

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
