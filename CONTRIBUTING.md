# Contributing to @jarvis-security/sdk

Thank you for your interest in contributing to the Jarvis Security Suite! This document outlines how to set up your development environment and the standards we follow.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Building the SDK](#building-the-sdk)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Security](#security)

## Code of Conduct

By participating in this project, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive in all interactions.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/jarvis-security/jarvis-security-suite.git
cd jarvis-security-suite

# Install dependencies (Node.js 18+ required)
npm install

# Allow esbuild install scripts (required for tsup builds)
npm install-scripts approve esbuild
```

## Project Structure

```
jarvis-security-suite/
├── app/
│   ├── components/          # React components (AuthPortal, CanvasBackground, biometrics)
│   ├── context/             # React Context (AuthProvider, useAuth)
│   ├── lib/                 # Core logic (auth-adapter, sound-engine)
│   ├── types/               # TypeScript interfaces and types
│   ├── python-backend/      # FastAPI backend (bcrypt, JWT, WebAuthn)
│   └── index.ts             # SDK barrel entry point
├── __tests__/               # Vitest test suite (64 tests)
├── docs/                    # Project documentation and task logs
├── dist/                    # Compiled SDK output (after build)
├── package.json             # Package manifest, SDK build config
├── tsup.config.ts           # Tsup bundler config (CJS + ESM + DTS)
├── tsconfig.json            # Base TypeScript config
├── tsconfig.sdk.json        # SDK-specific TypeScript config
└── vitest.config.ts         # Vitest configuration
```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes following the coding standards below.

3. Run the full test suite:
   ```bash
   npm test
   ```

4. Run type checking:
   ```bash
   npm run typecheck
   ```

5. Commit your changes with a clear, descriptive message:
   ```bash
   git add .
   git commit -m "feat: add descriptive feature name"
   ```

6. Push and open a Pull Request.

## Testing

Tests use **Vitest 1.6** with jsdom environment and React Testing Library.

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
npm run test:coverage # Run with 60% coverage thresholds
```

**Coverage thresholds**: 60% (statements, branches, functions, lines)

When adding new features, always add or update tests. Each feature should have at least one unit test and, where applicable, one regression test.

## Building the SDK

```bash
npm run build:sdk  # Runs tsup to produce dist/
```

This produces:
- `dist/index.cjs` — CommonJS bundle
- `dist/index.mjs` — ESM bundle
- `dist/index.d.ts` — TypeScript declarations
- `dist/index.d.mts` — ESM TypeScript declarations

To test locally before publishing:
```bash
npm pack  # Creates a .tgz file
```

## Coding Standards

- **TypeScript**: Strict mode (`strict: true`). No `any` types — use `unknown` and type guards.
- **React**: Function components only. Use `useCallback`, `useMemo`, `useRef` appropriately.
- **Testing**: One test file per domain (`types.test.ts`, `auth-adapter.test.ts`, etc.).
- **Accessibility**: All interactive elements must have `aria-label`, `htmlFor`/`id` pairs, and proper ARIA roles.
- **Performance**: No `setTimeout` polling. `requestAnimationFrame` for canvas updates. `queueMicrotask` for async emits.

## Submitting Changes

1. Ensure all tests pass: `npm test`
2. Ensure type checking passes: `npm run typecheck`
3. Ensure the SDK builds: `npm run build:sdk`
4. Open a Pull Request with a clear description of changes
5. Link to any relevant issues in the PR description

## Security

- Report security vulnerabilities to `security@jarvis-security.io`
- Do not commit `.env` files, API keys, or credentials
- All auth flows should validate at system boundaries
- Biometric enrollment should always sync state to the adapter's module-level store

---

By contributing, you agree that your contributions will be licensed under the MIT License.
