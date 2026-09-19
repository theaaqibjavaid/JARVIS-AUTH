# J.A.R.V.I.S. Security Suite — v2.0.2 Release Notes

**Release date:** 2026-09-19
**Package:** [`@jarvis-security/sdk@2.0.2`](https://www.npmjs.com/package/@jarvis-security/sdk)
**Theme:** *Security hardening — demo-mode backdoors removed, per-installation encryption, stale telemetry replaced.*

---

## ✨ Highlights

v2.0.2 is a targeted security-hardening release that closes real vulnerabilities discovered after the v2.0.1 launch:

- **Demo-mode backdoors removed** — the hardcoded `demoPasskey` token, synthetic user injection, and `__enterDemoMode()` bypass are gone from `MockAuthAdapter`. The mock adapter is now a clean local store.
- **Per-installation encryption salt** — `PlatformCredentialStore` (face/fingerprint) and `VoiceprintStore` (voice) now derive their AES-GCM key from a securely-random salt stored per-installation in localStorage. Legacy plaintext data is auto-migrated on read.
- **Secure random challenges** — `randomChallenge()` now uses the Web Crypto API (`crypto.getRandomValues`) instead of `Math.random()`.
- **ArcReactorHud telemetry** — replaced `Math.random()` CPU/memory values with real `navigator.deviceMemory` and `navigator.hardwareConcurrency` (with graceful fallbacks). Fake network latency replaced with realistic fixed constants.
- **VoiceScanner media-error recovery** — the component now surfaces a clear error when the user denies microphone access instead of hanging silently.
- **Test suite repair** — 130 frontend tests (7 suites) + 25 backend tests all pass; TypeScript typecheck clean.

---

## 🆕 What's New

### Per-Installation Encryption Salt

`PlatformCredentialStore` in `webauthn-biometrics.ts` and `VoiceprintStore` in `voiceprint.ts` now:

1. Generate a 256-bit random salt on first use and persist it to `localStorage`.
2. Derive an AES-GCM key from that salt via a deterministic KDF.
3. Encrypt credential data / voiceprint vectors before writing to `localStorage`.
4. Automatically migrate legacy plaintext JSON entries to the encrypted format on the first read after upgrade.

Read and write operations are transparent — the public API of both stores is unchanged.

### Secure Random Challenge Generation

`randomChallenge()` in `webauthn-biometrics.ts` now calls the Web Crypto API (`crypto.getRandomValues(new Uint8Array(32))`) to produce cryptographically-strong 32-byte challenges encoded as base64url strings. This replaces the previous `Math.random()`-based generation which was predictable and reproducible across browsers.

### Voiceprint Store Encryption

`VoiceprintStore` in `voiceprint.ts` encrypts enrolled MFCC voiceprint vectors before persisting them to `localStorage`. This means voice biometric data can no longer be read or tampered with by any other script running on the same page.

### ArcReactorHud Real Telemetry

The left HUD panel previously showed `Math.random()` values for CPU usage and memory. These have been replaced with:
- `navigator.deviceMemory` (rounded to nearest integer, with fallback to `"?"` )
- `navigator.hardwareConcurrency` (logical cores, with fallback to `"?"` )
- Realistic fixed network-latency constants instead of arbitrary small random numbers

### VoiceScanner Media-Error Handling

When the user denies microphone permission (or the browser returns a `NotAllowedError`), the component now transitions to an explicit media-error state and renders a retry button instead of hanging on a "Speaking…" spinner indefinitely.

---

## ⚠️ Breaking Changes

None. All public APIs remain compatible with v2.0.1. The encryption layer is entirely internal to the mock adapter and the two store classes.

### Behavioral change worth noting

`MockAuthAdapter` no longer has a privileged "demo mode" bypass. Previously, calling `demoPasskey` for any email would succeed. This behavior has been removed — the mock adapter now enforces the same register-first-then-login contract as the real backend. Existing tests that relied on the demo mode have been updated accordingly.

---

## 🔧 Improvements & Fixes

- **Password-reset flow** — the reset-password request now returns a `resetToken` on the `AuthResult`, allowing the confirm step to work end-to-end in the mock adapter.
- **Test assertions aligned** — biometric login now correctly reuses the registered user's `REG-` UID (was incorrectly asserting a `BIO-` prefix in some test suites).
- **TypeScript typecheck** — `tsc --noEmit` passes cleanly after all fixes.
- **Full test suite** — 130 frontend tests (7 suites) + 25 backend tests (pytest) all green.

---

## 🧪 Verification

| Check | Result |
|---|---|
| Frontend unit tests | **130/130 passed** (7 suites) |
| Backend tests | **25/25 passed** (pytest) |
| TypeScript typecheck | ✅ clean |
| ESLint | ✅ zero warnings, zero errors |
| `next build` | ✅ success |
| SDK build (tsup) | ✅ ESM + CJS + DTS |

---

## ⬆️ Upgrade Guide

```bash
npm install @jarvis-security/sdk@2.0.2
```

1. **Custom adapters** — no changes required. The `AuthAdapter` interface is identical to v2.0.1 (13 methods).
2. **Mock adapter users** — the `demoPasskey` shortcut is gone. Register a real user first, then log in.
3. **Existing stored credentials** — on first load, `PlatformCredentialStore` and `VoiceprintStore` will automatically migrate any plaintext localStorage entries to the new encrypted format. No manual migration needed.


---

## 🙏 Thank You

Thanks to everyone who flagged the demo-mode bypass and the stale random telemetry. Report issues on [GitHub](https://github.com/theaaqibjavaid/JARVIS-AUTH/issues).

*— J.A.R.V.I.S. Security Suite Team*
