# J.A.R.V.I.S. Security Suite — v2.0.1 Release Notes

**Release date:** 2026-09-18
**Package:** [`@jarvis-security/sdk@2.0.1`](https://www.npmjs.com/package/@jarvis-security/sdk)
**Theme:** *Production-hardening — security, documentation, and developer ergonomics.*

---

## ✨ Highlights

v2.0.1 is a maintenance release that closes real production gaps left after the v2.0.0 biometrics rebuild:

- **CSRF protection** — origin-validation middleware blocks cross-origin state-changing requests before they reach any handler.
- **Security headers** — every response now carries CSP, HSTS, X-Frame-Options, Referrer-Policy, and Permissions-Policy.
- **Voice visualizer** — the bars now reflect real `AnalyserNode` FFT data instead of `Math.random()`.
- **Password reset** — full three-step confirm UI (`idle → request-sent → confirm`) is wired up in the PasskeyForm component.
- **Developer setup** — `.env.local`, `app/python-backend/.env`, and `.env.example` ship with safe defaults so `npm run dev` works immediately.

---

## 🆕 What's New

### CSRF / Origin Middleware

A FastAPI HTTP middleware in `main.py` inspects the `Origin` header on every POST, PUT, DELETE, and PATCH request. Requests from an origin not listed in `JARVIS_CORS_ORIGINS` are rejected with a `403` before any route handler executes. This prevents cross-site request forgery at the gateway.

### Security Headers Middleware

Every response now includes:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

### Password-Reset Confirm UI

The PasskeyForm component now drives a complete reset workflow:

1. User enters their email → "REQUEST RESET" button is shown.
2. After a successful request, the form shows the debug token (from the mock adapter) and a new passkey input.
3. User submits the token + new passkey → confirmation modal appears.

The backend endpoint now returns `404` for all failure paths (unknown email, invalid token, expired token) to prevent user enumeration.

### Voice Visualizer Fix

The `VoiceScanner` waveform bars previously drew from `Math.random()`, making the animation look fake even though the underlying `MediaRecorder` recording was real. The visualizer now reads from a real `AnalyserNode` driven by the microphone stream.

### Environment Files

Three `.env` files are now included:

- **`.env.example`** — complete variable reference for both frontend and backend.
- **`.env.local`** — local frontend defaults (adapter = `mock`).
- **`app/python-backend/.env`** — local backend defaults.

---

## ⚠️ Breaking Changes

None. v2.0.1 is a pure patch release — all public APIs remain compatible with v2.0.0.

### New interface method (non-breaking for existing adapters)

`AuthAdapter` now has **13 methods** (was 12):

```ts
resetPasswordConfirm(email: string, token: string, newPasskey: string): Promise<AuthResult>;
```

The `MockAuthAdapter` and `BackendAuthAdapter` implementations ship with this method. If you maintain a custom adapter, you should add it to stay fully compatible with `AuthContext`.

---

## 🔧 Improvements & Fixes

- **Backend password-reset endpoints** — `request_password_reset` and `confirm_password_reset` in `main.py` were missing the `session` dependency, causing a `NameError` at runtime. Both now correctly receive `session: Annotated[Session, Depends(get_session)]`.
- **Auth adapter factory** — the `FirebaseAuthAdapter` stub and its test have been fully removed. `AuthAdapterName` now only accepts `"mock"` and `"backend"`. Unknown names gracefully fall back to `MockAuthAdapter`.
- **Test suite** — expanded from 119 + 18 to **132 frontend tests** (7 suites) + **25 backend tests** (pytest). Coverage thresholds raised to 80% across all metrics.
- **CI pipeline** — added a dedicated `test-backend` job so the full suite runs on every PR.

---

## 🧪 Verification

| Check | Result |
|---|---|
| Frontend unit tests | **132/132 passed** (7 suites) |
| Backend tests | **25/25 passed** (pytest) |
| TypeScript typecheck | ✅ clean |
| ESLint | ✅ zero warnings, zero errors |
| `next build` | ✅ success |
| SDK build (tsup) | ✅ ESM + CJS + DTS |

---

## ⬆️ Upgrade Guide

```bash
npm install @jarvis-security/sdk@2.0.1
```

1. **Custom adapters** — if you implemented `AuthAdapter` yourself, add `resetPasswordConfirm()` (3 string args, returns `Promise<AuthResult>`).
2. **Backend users** — redeploy the FastAPI service to pick up the CSRF and security-headers middleware. Ensure `JARVIS_JWT_SECRET` is set in production.
3. **Frontend users** — copy `.env.example` to `.env.local`; no other config changes are required.

Full history: [CHANGELOG.md](./CHANGELOG.md)

---

## 🙏 Thank You

Thanks to everyone who reported the fake voice visualizer and the missing password-reset confirm flow — both are now fixed. Report issues on [GitHub](https://github.com/theaaqibjavaid/JARVIS-AUTH/issues).

*— J.A.R.V.I.S. Security Suite Team*
