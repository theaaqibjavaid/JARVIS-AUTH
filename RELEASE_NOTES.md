# 🚀 J.A.R.V.I.S. Security Suite — v2.0.0 Release Notes

**Release date:** 2026-08-26
**Package:** [`@jarvis-security/sdk@2.0.0`](https://www.npmjs.com/package/@jarvis-security/sdk)
**Theme:** *Real biometrics — no more mocks.*

---

## ✨ Highlights

Every biometric method now performs **real verification** with a **register-first-then-login** model:

- 🧑 **Face** → verified by your **OS** via the WebAuthn platform authenticator (Windows Hello / Face ID)
- 👆 **Fingerprint** → verified by your **OS** via the WebAuthn platform authenticator (Touch ID / Windows Hello)
- 🎙️ **Voice** → verified **100% on-device** by a real MFCC DSP voiceprint engine — audio is never uploaded

> Raw biometric data never leaves the device. Face/fingerprint checks are enforced by the operating system; voice matching runs entirely in the browser.

---

## 🆕 What's New

### Real device biometrics engine — `webauthn-biometrics.ts`

New engine driving the **WebAuthn platform authenticator** for face and fingerprint:

- Touch/scan-to-register and touch/scan-to-login via native OS prompts
- Per-email credential store with signature-count tracking
- Feature detection (`isPlatformBiometricSupported`) with graceful fallback messaging
- Works on Windows Hello, macOS Face ID / Touch ID, and Android platform authenticators

### Real voice recognition engine — `voiceprint.ts`

New fully client-side DSP pipeline:

- Pre-emphasis → Hamming window → radix-2 FFT → mel filterbank → log → DCT → **13 MFCC coefficients**
- Mean + std-deviation aggregation into a **26-dimensional voiceprint**
- **Cosine similarity matching** (threshold `0.82`) against enrolled voiceprints
- Offline, zero-upload, localStorage-backed voiceprint store

### VoiceScanner dual-mode UI

- **ENROLL VOICEPRINT** — record your sample, extract + store the voiceprint
- **VERIFY** — record again, match against enrolled operatives, auto-login on match

### Backend biometric endpoints

| Method | Path | Rate limit | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/enroll-biometric` | 10/min | Bind a platform credential to an operative |
| `POST` | `/api/v1/auth/biometric-login` | 20/min | Issue JWTs after a verified biometric assertion |

The backend (1) refuses biometric login unless the operative has enrolled, and (2) for face/fingerprint verifies the presented `credential_id` is **bound to the claimed user** before issuing tokens.

---

## ⚠️ Breaking Changes

### 1. `verifyFace()` and `verifyFingerprint()` no longer accept payloads

The OS biometric prompt is now triggered internally — there is no image/scan payload to pass.

```ts
// ❌ v1.x
await adapter.verifyFace("data:image/jpeg;base64,...");
await adapter.verifyFingerprint("scandata");

// ✅ v2.0.0
await adapter.verifyFace();
await adapter.verifyFingerprint();
```

### 2. `AuthAdapter` interface now has 12 methods

`enrollVoice(audioBlob: Blob)` was added. Custom adapters must implement it:

```ts
interface AuthAdapter {
  readonly name: string;
  register(email: string, passkey: string, fullName: string): Promise<AuthResult>;
  login(email: string, passkey: string): Promise<AuthResult>;
  logout(): Promise<AuthResult>;
  resetPassword(email: string): Promise<AuthResult>;
  verifyFace(): Promise<AuthResult>;
  verifyVoice(audioBlob: Blob): Promise<AuthResult>;
  verifyFingerprint(): Promise<AuthResult>;
  enrollBiometrics(userId: string): Promise<AuthResult>;
  enrollVoice(audioBlob: Blob): Promise<AuthResult>; // NEW in v2.0.0
  verifyPasskey(email?: string): Promise<AuthResult>;
  getCurrentUser(): Promise<UserProfile | null>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}
```

### 3. Register-first-then-login is enforced

Biometric verification now **fails until enrollment succeeds** — both client-side and server-side:

```ts
// Enroll once
await enrollBiometrics();            // face / fingerprint (OS prompt)
await enrollVoice(recordedBlob);     // voice (DSP voiceprint)

// Then login any time
await verifyFace();                  // OS verifies the face
await verifyVoice(recordedBlob);     // DSP matches the voiceprint
await verifyFingerprint();           // OS verifies the fingerprint
```

### 4. Removed fake backend endpoints

These v1.x endpoints accepted arbitrary payloads and always succeeded — they are **gone**:

- `POST /api/v1/auth/verify-face`
- `POST /api/v1/auth/verify-voice`
- `POST /api/v1/auth/verify-fingerprint`
- `GET /api/v1/auth/webauthn/options`
- `POST /api/v1/auth/webauthn/verify`

Use `POST /api/v1/auth/enroll-biometric` + `POST /api/v1/auth/biometric-login` instead.

---

## 🔧 Improvements & Fixes

- **PyJWT fix** — `requirements.txt` listed the unmaintained `python-jose` while the code imported `jwt`; now correctly depends on `PyJWT>=2.8.0` (latent production bug fixed)
- **FastAPI lifespan** — deprecated `@app.on_event("startup")` replaced with the modern `lifespan` handler
- **BackendAuthAdapter** — biometric methods now exchange a real local assertion for a backend session via `biometric-login` (no more placeholder users)
- **UI components** — FacialScanner / FingerprintPad trigger the real OS prompt; DashboardPanel wires real enrollment

---

## 🔒 Security

| Guarantee | How |
|---|---|
| No raw biometric data leaves the device | Face/fingerprint verified by the OS; voice matched in-browser |
| No biometric login without enrollment | Server-side `has_biometrics` gate |
| No credential spoofing | `credential_id` must be bound to the claimed user (`Passkey` table) |
| Brute-force resistance | Rate limiting: 10/min enroll, 20/min biometric login |
| Voice privacy | Only the abstract 26-dim voiceprint vector is stored locally — never the audio |

---

## 🧪 Verification

| Check | Result |
|---|---|
| Frontend unit tests | **119/119 passed** (7 suites, incl. 46 new engine tests) |
| Backend tests | **18/18 passed** (pytest) |
| Typecheck | ✅ clean |
| `next build` | ✅ success |
| SDK build (tsup) | ✅ ESM + CJS + DTS |

New test suites:

- `voiceprint.test.ts` (25 tests) — full DSP pipeline: FFT, mel filterbank, MFCC, cosine matching, voiceprint store
- `webauthn-biometrics.test.ts` (21 tests) — options building, enrollment, scoped authentication

---

## ⬆️ Upgrade Guide

```bash
npm install @jarvis-security/sdk@2.0.0
```

1. **Update custom adapters** — implement `enrollVoice()`, remove payload args from `verifyFace()` / `verifyFingerprint()`
2. **Update call sites** — biometric verify calls are now no-arg (face/fingerprint)
3. **Add enrollment UX** — call `enrollBiometrics()` / `enrollVoice()` before offering biometric login
4. **Backend users** — point integrations at the new `enroll-biometric` / `biometric-login` endpoints; the old verify endpoints no longer exist
5. **Backend users** — `pip install -r requirements.txt` to pick up the PyJWT fix

Full history: [CHANGELOG.md](./CHANGELOG.md)

---

## 🙏 Thank You

Thanks to the 90+ developers who installed v1.x and surfaced the "it's all fake" feedback — this release exists because of you. Report issues on [GitHub](https://github.com/theaaqibjavaid/JARVIS-AUTH/issues).

*— J.A.R.V.I.S. Security Suite Team*
