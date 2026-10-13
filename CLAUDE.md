# CatalogIQ - Development Rules and Guidelines

Welcome to **CatalogIQ** (The Product Information Management system with WooCommerce Sync and Gemini AI Agent).

## Core Principles
1. **TypeScript Strict Mode**: Strict type safety throughout the codebase. No `any` without an explicit justifying comment.
2. **Boundary Validation**: Validate all API inputs and all AI outputs using Zod schemas at runtime boundaries.
3. **Pure Domain Logic**: Keep business logic in pure, unit-tested functions under `apps/api/src/domain/` and `apps/api/src/sync/`. Express route handlers must remain thin.
4. **Secrets Redaction**: Never log, expose in stack traces, or return secrets (WooCommerce consumer key/secret, Gemini API key, session keys) to the browser.
5. **Test-Driven Rigor**: Write tests alongside code. Typecheck (`npm run typecheck`) and tests (`npm run test`) must pass before concluding tasks.
6. **Single Responsibility**: Keep modules small and named for what they do.
7. **Documented Evolution**: Keep `AI_LOG.md` updated with dated entries capturing prompts, architectural decisions, and human interventions.
8. **Safe Sync & Idempotency**:
   - Replay or retried publishes must NEVER create duplicate products in WooCommerce (match by WooCommerce ID, then SKU).
   - A publish is marked as `synced` only after an explicit read-back comparison confirms the store state.
   - Respect the defined state machine: only legal transitions are permitted (`draft`, `pending`, `syncing`, `synced`, `failed`, `conflict`).
9. **Strict AI Evidence Rule**:
   - AI-proposed attributes MUST include verbatim evidence quotes from the product source text.
   - Invented facts or unquoted specifications must be rejected by the proposal validator.
   - Uncertain values must be explicitly flagged as uncertain, not guessed.

## Build and Run Commands
- `npm run dev`: Concurrently start API server, Mock WooCommerce server, and Web frontend.
- `npm run dev:api`: Run API server with hot reload.
- `npm run dev:web`: Run Vite React frontend dev server.
- `npm run dev:mock`: Run Mock WooCommerce server.
- `npm run test`: Run all unit and integration test suites.
- `npm run seed`: Seed the 30-product catalog with planted defect scenarios.
- `npm run reset`: Reset catalog and mock store to initial baseline.
