<div align="center">
  <h1>⚡ J.A.R.V.I.S. Futuristic Authentication Suite</h1>
  <p><strong>Iron Man–style pluggable multi-biometric auth — drop into any Next.js App Router project</strong></p>
  <p>
    <a href="#features"><strong>Features</strong></a> ·
    <a href="#quick-start"><strong>Quick Start</strong></a> ·
    <a href="#plugin-integration"><strong>Plugin Integration</strong></a> ·
    <a href="#adapters"><strong>Auth Adapters</strong></a> ·
    <a href="#project-structure"><strong>Structure</strong></a> ·
    <a href="#contributing"><strong>Contributing</strong></a>
  </p>
  <br/>
  <img alt="JARVIS Banner" src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Futuristic%20cyberpunk%20JARVIS%20Iron%20Man%20style%20HUD%20authentication%20interface%20with%20glowing%20cyan%20arc%20reactor%2C%20holographic%20rings%2C%20hacker%20grid%20lines%2C%20biometric%20scanner%20panels%2C%20neon%20cyan%20and%20dark%20navy%20colors%2C%20dark%20background&image_size=landscape_16_9"/>
</div>

---

## ✨ Features

| Layer | What you get |
|---|---|
| 🔐 **4 Biometric Methods** | Passkey (password) · Facial scan (real camera) · Voice print (real mic) · Fingerprint (press & hold) |
| 🔌 **Pluggable Backends** | **Strategy / Adapter Pattern** — Mock (demo) · FastAPI REST · Firebase (skeleton) · write your own for Supabase, Auth0, Clerk… |
| 🎨 **Sci-Fi Visuals** | Arc Reactor MK VII HUD, animated starfield + grid canvas, laser scan beams, CRT scanlines, neon corner-frames, telemetry badges |
| 🔊 **Zero-file Audio** | Web Audio–synthesized beeps, success triads, error descents — *no MP3 / WAV files required* |
| 🏠 **Persistence** | Session survives reload via `localStorage` (`jarvis_auth_user`) + `onAuthStateChanged` observable subscription pattern |
| ♿ **Accessibility** | `aria-*`, `role="button"` + keyboard (Space/Enter) on all clickable panels, `prefers-reduced-motion` support, live region alerts |
| 📱 **Responsive** | 12-col Tailwind grid collapses gracefully on tablet + mobile |
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

## 🧩 Plugin Integration (Drop into Any Next.js App)

This is the whole point: **copy two folders + two values into your existing Next.js App Router project, and you're done.**

### Step 1 · Copy files
```
your-app/
├── app/
│   ├── (auth)/          # create route group (optional)
│   │   └── jarvis/      # ← COPY ENTIRE CONTENTS OF THIS REPO'S app/ FOLDER HERE
│   │       ├── components/
│   │       ├── context/
│   │       ├── lib/
│   │       ├── types/
│   │       ├── globals.css      # ← or merge into your own globals.css
│   │       └── page.tsx         # (this is the /jarvis route)
```

### Step 2 · Merge Tailwind theme
Add to **your** `tailwind.config.ts` — the color palette, fonts, shadows, keyframes, and animations:

```ts
import jarvisTheme from "./app/(auth)/jarvis/tailwind.theme";

export default {
  content: ["./app/**/*.{ts,tsx,mdx}"],
  presets: [jarvisTheme],           // ← or copy-paste theme.extend block below
  // …your config
} satisfies import("tailwindcss").Config;
```

> If you don't use presets, just copy the `theme.extend` block from [tailwind.config.ts](file:///c:/Users/Aaqib/Desktop/Code%20Playground/jarvis-security-suite/tailwind.config.ts) (colors, fontFamily, boxShadow, keyframes, animations) into your tailwind config.

### Step 3 · Use the `<AuthProvider>` shell on any page
```tsx
// app/(auth)/jarvis/page.tsx  ←  your new drop-in /jarvis auth page
"use client";

import { AuthProvider, createAuthAdapter } from "./context/AuthContext";
import { CanvasBackground } from "./components/CanvasBackground";
import { AuthPortal } from "./components/AuthPortal";

export default function JarvisAuthPage() {
  const adapter = createAuthAdapter(
    (process.env.NEXT_PUBLIC_AUTH_ADAPTER as any) || "mock",
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

### Step 4 · Protect any route (3 lines)
```tsx
// app/dashboard/page.tsx
"use client";
import { useAuth } from "@/app/(auth)/jarvis/context/AuthContext";
import { redirect } from "next/navigation";

export default function Dashboard() {
  const { user, status } = useAuth();
  if (typeof window !== "undefined" && status === "unauthenticated") redirect("/jarvis");
  return <div>Welcome, {user?.fullName}</div>;
}
```

✅ **Done.** J.A.R.V.I.S. auth is now live at `/jarvis` in your app.

---

## 🔌 Auth Adapters

Pick an adapter by setting env var. Everything else (UI, flow, persistence, events) stays 100% identical.

| Adapter | `NEXT_PUBLIC_AUTH_ADAPTER=` | Use-case | Needs backend? |
|---|---|---|---|
| `MockAuthAdapter` *(default)* | `mock` | Demo, local dev, CI, UI testing | ❌ |
| `BackendAuthAdapter` | `backend` | Your Python FastAPI / Node / Go / Rails backend | ✅ |
| `FirebaseAdapter` *(v1 skeleton)* | `firebase` | Google Firebase Auth (extend to fit) | ✅ |
| **Write your own** | *(any string)* | Supabase · Auth0 · Clerk · NextAuth · AWS Cognito… | — |

### Example: Switch to Backend adapter (FastAPI)
```bash
# .env.local  (create at repo root)
NEXT_PUBLIC_AUTH_ADAPTER=backend
NEXT_PUBLIC_AUTH_API_URL=http://localhost:8000
```

A stub FastAPI backend is included at [app/python-backend/](file:///c:/Users/Aaqib/Desktop/Code%20Playground/jarvis-security-suite/app/python-backend/):
```bash
cd app/python-backend
python -m venv .venv && .venv\Scripts\activate        # Windows
# source .venv/bin/activate                            # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### ✍️ Write a new adapter (e.g., for Supabase)
Just **implement the `AuthAdapter` interface** — that's the only rule.

```ts
// app/lib/adapters/supabase-auth-adapter.ts
import type { AuthAdapter, AuthResult, UserProfile } from "../types";

export class SupabaseAuthAdapter implements AuthAdapter {
  readonly name = "SupabaseAuthAdapter";
  constructor(private readonly supabase: SupabaseClient) {}

  async login(email: string, passkey: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password: passkey });
    if (error) return { success: false, error: error.message, errorCode: error.code };
    return { success: true, user: data.user as unknown as UserProfile };
  }
  async register(email, passkey, fullName) { /* … */ }
  async logout() { /* … */ }
  async resetPassword(email) { /* … */ }
  async verifyFace(imageBase64: string) { /* call edge function */ }
  async verifyVoice(audioBlob: Blob)      { /* call edge function */ }
  async verifyFingerprint(scanData: string){ /* call edge function */ }
  async enrollBiometrics(userId){ /* … */ }
  async getCurrentUser(){ return this.supabase.auth.getUser().then(r => r.data.user as any); }
  onAuthStateChanged(cb){
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange((e,u)=>cb(u as any));
    return () => subscription.unsubscribe();
  }
}
```

Then plug it in the AuthProvider:
```tsx
<AuthProvider adapter={new SupabaseAuthAdapter(createClient(…))}>
  <CanvasBackground/>
  <AuthPortal/>
</AuthProvider>
```

✅ **No UI code changes ever.** Your Supabase/Auth0/Clerk/NextAuth backend drives the same futuristic panels.

---

## 📁 Project Structure

```
jarvis-security-suite/              ← npm project root (you are here)
├── app/                            ← Next.js App Router directory
│   ├── components/
│   │   ├── AuthPortal.tsx              shell: header · grid · modes · modal · footer
│   │   ├── ArcReactorHud.tsx           left HUD — rings · telemetry · speech log
│   │   ├── CanvasBackground.tsx        starfield particles + 40 px grid (pure canvas)
│   │   └── biometrics/
│   │       ├── PasskeyForm.tsx         email + passkey + fullName + show/hide
│   │       ├── FacialScanner.tsx       getUserMedia + laser + base64 capture
│   │       ├── VoiceScanner.tsx        MediaRecorder + 24-bar waveform
│   │       └── FingerprintPad.tsx      press-hold conic-gradient ring
│   ├── context/AuthContext.tsx         AuthProvider + useAuth() hook (12 actions)
│   ├── lib/
│   │   ├── auth-adapter.ts             Mock · Backend · Firebase (Strategy classes)
│   │   └── sound-engine.ts             Web Audio synth: beep / success / error
│   ├── types/index.ts                  ALL shared types + AuthAdapter interface
│   ├── python-backend/                 FastAPI stub (BackendAuthAdapter target)
│   ├── globals.css                     fonts + cyber-* classes + scanlines + keyframes
│   ├── layout.tsx                      Next.js root HTML shell + metadata
│   └── page.tsx                        HOME = AuthProvider + Canvas + AuthPortal
├── .env.example                        adapter env vars
├── next.config.js                      (reactStrictMode, no x-powered-by)
├── postcss.config.js                   (Tailwind + Autoprefixer)
├── tailwind.config.ts                  colors · fonts · shadows · keyframes · anims
├── tsconfig.json                       strict:true · jsx:preserve · @/* paths
├── package.json                        deps + scripts (dev / build / start / typecheck)
├── PROJECT_MEMORY.md                   Architectural decision log (read this first)
├── SESSION_LOG.md                      Build history & defects fixed
├── CURRENT_TASK.md                     Next-up prioritized backlog
└── sci_fi_cyber_security_portal.html   Original prototype (VISUAL REFERENCE ONLY)
```

---

## 🔐 Security Notes

This is a **UI + adapter framework** — real security comes from whichever `AuthAdapter` you plug in.

| Concern | MockAdapter | BackendAdapter | *Your Custom Adapter* |
|---|---|---|---|
| Password hashing | ❌ none (demo only) | ✅ do in backend (bcrypt/argon) | ✅ your responsibility |
| HTTPS only | N/A (localhost) | ✅ mandatory in prod | ✅ |
| JWT rotation | ❌ | ⚠️ stub only (see TASK-11c in CURRENT_TASK.md) | ✅ implement |
| Rate limiting | ❌ | ⚠️ stub only | ✅ in your backend |
| WebAuthn real passkeys | ⚠️ boolean toggle only | ⚠️ stub only | 🔜 TASK-11b |
| CSRF | N/A | ⚠️ missing in stub | ✅ add |

👉 **Use `MockAuthAdapter` only for demos/UI development. Before going live, plug in a security-audited adapter.**

---

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14.2** (App Router, RSC-capable — all UI components tagged `"use client"`) |
| Runtime | **React 18.3** with hooks + Context API |
| Types | **TypeScript 5.6** (`strict: true`, no `any` leaks at interfaces) |
| Styling | **Tailwind 3.4** + custom theme + global CSS augmentations |
| Icons | `lucide-react` (tree-shakable, ESM) |
| WebAuthn | `@simplewebauthn/browser` (pre-installed, TASK-11b wires it up) |
| Utilities | `clsx` + `tailwind-merge` → `cn()` helper (inline template) |
| Audio | Native **Web Audio API** (zero files) |
| Particles | Native **HTML5 Canvas 2D** (zero deps) |
| Backend (optional) | **FastAPI + uvicorn** Python stub (drop-in replaceable) |

---

## 📦 NPM Package

> **Coming soon — `@jarvis-security/sdk` is available as a published package.**

### Installation (NPM Package)

For any React / Next.js project:

```bash
npm install @jarvis-security/sdk
```

### Usage

```tsx
"use client";
import {
  AuthProvider,
  AuthPortal,
  CanvasBackground,
  createAuthAdapter,
} from "@jarvis-security/sdk";
import "@jarvis-security/sdk/dist/jarvis.css"; // cyber theme (optional)

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

### Build the SDK locally

```bash
npm run build:sdk   # → dist/index.cjs, dist/index.mjs, dist/index.d.ts
```

### Subpath exports

| Import path | Contains |
|---|---|
| `@jarvis-security/sdk` | All modules — barrel entry |
| `@jarvis-security/sdk/auth-adapter` | Adapters only (`MockAuthAdapter`, `BackendAuthAdapter`, `createAuthAdapter`) |
| `@jarvis-security/sdk/context` | `AuthProvider`, `useAuth` |
| `@jarvis-security/sdk/components` | All React components |
| `@jarvis-security/sdk/types` | All TypeScript types |
| `@jarvis-security/sdk/sound-engine` | `SoundEngine` |

---

## 🤝 Contributing

### PR Rules (per project policy)
1. **Keep PRs small.** One feature / one bugfix per PR.
2. **Write tests.** See `TASK-11a` in [CURRENT_TASK.md](file:///c:/Users/Aaqib/Desktop/Code%20Playground/jarvis-security-suite/CURRENT_TASK.md).
3. **Run typecheck.** `npm run typecheck` must pass 0 errors.
4. **Run build.** `npm run build` must pass.
5. **Update docs.** Any new adapter → add a row to the Adapters table here.
6. **Never touch working production code.** Open an issue first.

### Backlog
Pick any **TASK-\*** from [CURRENT_TASK.md](file:///c:/Users/Aaqib/Desktop/Code%20Playground/jarvis-security-suite/CURRENT_TASK.md):
- **TASK-11a** 🔴 Vitest unit tests (good first issue!)
- **TASK-11b** 🟠 Real WebAuthn passkeys
- **TASK-11c** 🟠 FastAPI backend production hardening
- **TASK-11d** 🟡 Publish `@jarvis-security/sdk` as an NPM package
- **TASK-11g** 🟢 ESLint + Prettier + pre-commit hooks

---

## 📄 License

**MIT © 2026** — Just A Rather Very Intelligent System™  
Portions of visual styling inspired by Marvel's Iron Man / Stark Industries HUD aesthetics — this is a fan-built UI kit, *not* affiliated with Marvel/Disney.

---

<div align="center">
  <strong>« I have successfully hijacked your authentication flow, sir. »</strong><br/>
  <sub>— J.A.R.V.I.S., probably</sub>
  <br/><br/>
  <strong>⭐ Star this repo on GitHub if this saved you from building a boring login page.</strong>
</div>
