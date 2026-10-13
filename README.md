# CatalogIQ — Product Information Management (PIM) for WooCommerce

> **The PIM for WooCommerce stores that demand verified, clean product data and proof it reached the shop — without enterprise overhead.**  
> Built for the Kilowott PIM Challenge.

---

## ⚡ Quick Start (Under 5 Commands)

```bash
# 1. Install all dependencies across monorepo workspaces
npm install

# 2. Seed the 30-product catalog (8 clean, 22 planted defect scenarios)
npm run seed

# 3. Run the automated test suites (Quality engine, Sync state machine, AI evidence validator)
npm test

# 4. Launch the application (API Server :4000, Web Dashboard :5173, Mock WooCommerce Server :5050)
npm run dev
```

Visit the dashboard at **[http://localhost:5173](http://localhost:5173)**.

---

## 🎯 What CatalogIQ Solves

WooCommerce store owners lose sales because product data is scattered across spreadsheets and admins, incomplete, inconsistent, and nothing verifies whether an update actually reached the shop.

CatalogIQ provides:
1. **Central Catalog & Attribute Engine**: Single source of truth with admin-defined attributes and Cartesian variation generator.
2. **Quality Engine (Rules Q01–Q12)**: Continuous 0–100 scoring with inline deductions explaining what is wrong and why.
3. **Agentic AI with Verifiable Evidence**: Proposes descriptions and structured attributes. **Strict Guardrail**: Every proposal requires verbatim evidence quotes in the product text. Invented facts are rejected by the validator.
4. **Idempotent Sync Engine**: State machine (`draft` → `pending` → `syncing` → `synced`), exponential backoff retries, duplicate prevention via SKU pre-lookup, and **read-back verification** confirming WooCommerce accepted the payload.
5. **Zero-Setup Reviewer Experience**: In-process Mock WooCommerce server with failure injection simulator (timeouts, 429 rate limits, 500 errors).

---

## 🏛️ System Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                 Web Dashboard (React + Vite)                  │
│    - Catalog Table (Filtering, Search, Multi-select)          │
│    - Product Editor & Cartesian Variation Matrix Generator    │
│    - AI Proposal Queue (Evidence diffs, Human-in-the-loop)    │
│    - Quality Inspector & Rule Breakdown (Q01-Q12)             │
│    - Sync Monitor (Audit trails, Mock Failure Simulator)      │
└───────────────────────────────▲───────────────────────────────┘
                                │ REST API (JSON)
┌───────────────────────────────▼───────────────────────────────┐
│                 API Backend (Node / Express)                  │
│                                                               │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│   │  Quality Engine  │  │   Sync Worker    │  │  AI Agent  │  │
│   │ (Q01-Q12 Rules)  │  │ (State Machine)  │  │  (5 Tools) │  │
│   └─────────┬────────┘  └─────────┬────────┘  └─────┬──────┘  │
│             │                     │                 │         │
│   ┌─────────▼─────────────────────▼─────────────────▼──────┐  │
│   │                Repository Layer (DB)                   │  │
│   │   Products, Versions, Attributes, SyncJobs, AI, Logs   │  │
│   └───────────────────────────────┬────────────────────────┘  │
│                                   │                           │
│   ┌───────────────────────────────▼────────────────────────┐  │
│   │              WooCommerce Store Adapter                 │  │
│   │    - Live WooCommerce REST API v3                      │  │
│   │    - In-Process Mock Store with Failure Injection      │  │
│   └───────────────────────────────┬────────────────────────┘  │
└───────────────────────────────────┼───────────────────────────┘
                                    │ HTTP / Webhooks
                        ┌───────────▼───────────┐
                        │   WooCommerce Store   │
                        │    (Port 5050/Live)   │
                        └───────────────────────┘
```

---

## 🧪 Testing & Failure Mode Verifications

Run the automated test suites:
```bash
npm test
```

### Covered Test Suites:
- `apps/api/tests/quality.test.ts`: Verifies Rules Q01 to Q12, deduction math, and Healthy/Needs Work/Poor bands.
- `apps/api/tests/sync.test.ts`: Verifies legal state transitions, exponential backoff for 500s, permanent termination for 400 validation errors, and read-back matching.
- `apps/api/tests/ai-validator.test.ts`: Verifies verbatim citation checks, rejecting hallucinations, and preserving uncertain flags.
- `apps/api/tests/connection-error.test.ts`: Verifies that connection errors record the real root cause (`error.cause.code`, `error.cause.message`) in `sync_logs` and never mask or leak consumer credentials.

---

## 🔒 Local WordPress / WooCommerce SSL Setup (`NODE_EXTRA_CA_CERTS`)

When synchronizing with a local WordPress store managed by **Local (by Flywheel)** over HTTPS (e.g., `https://catlogue.local`):

1. **Full TLS Verification Maintained**: Rather than disabling TLS security via `NODE_TLS_REJECT_UNAUTHORIZED=0` (which poses security risks), CatalogIQ retains strict certificate and hostname verification.
2. **Local Root Certificate Configuration**:
   - Local generates an SSL certificate located at:  
     `%APPDATA%\Local\run\router\nginx\certs\catlogue.local.crt`
   - A copy is provided directly in `certs/catlogue.local.crt`.
   - Node is configured using the standard `NODE_EXTRA_CA_CERTS` environment variable:
     ```bash
     cross-env NODE_EXTRA_CA_CERTS="certs/catlogue.local.crt" npm run dev
     ```
3. **Transparent Cause Diagnosis & Secret Masking**:
   - If an SSL handshake fails (e.g., `DEPTH_ZERO_SELF_SIGNED_CERT`), the sync worker captures both `error.cause.code` and `error.cause.message` directly in `sync_logs` and displays them in the **Sync Monitor**.
   - Secret redaction ensures that consumer keys and secrets are never prepended with asterisks or leaked into error logs.

---

## 🎬 3-Minute Demo Script

- **0:00 - 0:30**: **The Problem**. Open the seeded messy catalog on the dashboard. Note the quality score and planted defects (missing descriptions, inconsistent attributes, duplicate SKUs).
- **0:30 - 1:00**: **Quality Inspection**. Drill down into a Poor-rated product in the Product Editor. Inspect the inline deductions.
- **1:00 - 1:40**: **Agentic AI with Evidence**. Run the AI Enrichment Agent. Open the Review Queue. Show the verbatim evidence quotes extracted from source text. Note how unsupported specifications are flagged uncertain instead of guessed.
- **1:40 - 2:15**: **Cartesian Variations**. Open Attribute Builder. Show how sizes 7-10 and colors generate 8 variations with SKUs and prices.
- **2:15 - 2:45**: **Safe Sync & Read-Back**. Publish a product. Show the state machine transition to `syncing` and `synced`. Show the read-back confirmation in the Audit Log.
- **2:45 - 3:00**: **Resilience Under Failure**. Open Sync Monitor, inject a simulated 500 error. Show the exponential backoff retry recover cleanly with 0 duplicate products.
