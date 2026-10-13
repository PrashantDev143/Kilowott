# CatalogIQ System Architecture

## Overview
CatalogIQ is a modern Product Information Management (PIM) platform purpose-built for WooCommerce stores. It serves as a single source of truth for product data, providing automated quality scoring, AI-assisted enrichment with verifiable evidence, idempotent two-way sync, and an audit trail.

```
┌────────────────────────────────────────────────────────┐
│                   Web Dashboard (React)                │
│    - Catalog Table (Filtering, Search, Multi-select)   │
│    - Product Editor & Variation Generator              │
│    - AI Proposal Queue (Evidence diffs, Approvals)     │
│    - Quality Engine Inspector & Deduction Breakdown    │
│    - Sync Monitor (Audit trails, Failure simulator)    │
└───────────────────────────▲────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────▼────────────────────────────┐
│                    API Backend (Node / Express)        │
│                                                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐  │
│  │ Quality Engine  │ │  Sync Worker    │ │ AI Agent │  │
│  │ (Q01-Q12 Rules) │ │ (State Machine) │ │  (Tools) │  │
│  └────────┬────────┘ └────────┬────────┘ └───┬──────┘  │
│           │                   │              │         │
│  ┌────────▼───────────────────▼──────────────▼──────┐  │
│  │             Repository Layer (DB)                │  │
│  │  Products, Versions, Attributes, SyncJobs, AI    │  │
│  └────────────────────────────┬─────────────────────┘  │
│                               │                        │
│  ┌────────────────────────────▼─────────────────────┐  │
│  │           WooCommerce Store Adapter              │  │
│  │   - Real WooCommerce REST API v3                 │  │
│  │   - In-Process Mock Store with Failure Injection │  │
│  └────────────────────────────┬─────────────────────┘  │
└───────────────────────────────┼────────────────────────┘
                                │ HTTP / Webhooks
                    ┌───────────▼───────────┐
                    │  WooCommerce Store    │
                    │   (Live or Mock)      │
                    └───────────────────────┘
```

## Key Architectural Patterns
1. **Adapter Pattern (`IStoreAdapter`)**: Isolates store-specific REST contracts. Seamlessly swaps between live WooCommerce instances and an in-process mock server with failure injection.
2. **Repository Pattern**: All database interactions are decoupled through interfaces (`IProductRepository`, `ISyncRepository`, `IAttributeRepository`).
3. **State Machine (`SyncStateMachine`)**: Enforces strict transitions (`draft` -> `pending` -> `syncing` -> `synced` / `failed` / `conflict`). Invalid transitions are blocked.
4. **Strict Evidence Validator**: The AI enrichment agent operates via structured tools (`scan_catalog`, `get_product`, `propose_changes`, `validate_proposal`). Any proposed attribute must contain verbatim citations from the source text; unquoted or invented claims are automatically flagged or rejected.
5. **Idempotency & Duplicate Prevention**: Product synchronization tracks remote store IDs and idempotency hashes derived from product versions and SKUs. Timeouts trigger SKU lookups before attempting recreation, preventing duplicate WooCommerce entries.
6. **Read-Back Verification**: A sync job transitions to `synced` only after an explicit read-back call confirms the store state matches the PIM payload.
