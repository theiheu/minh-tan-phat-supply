# Full Material Catalog Replacement Implementation Plan

**Goal:** Replace the current material/variant implementation completely with the approved Product → SKU → UOM → Tracking → BOM → Stock Ledger architecture, migrate every internal consumer, perform one controlled runtime cutover, and retire old code without a long-lived fallback.

**Architecture:** Keep Product as catalog identity; rename current `variants` rows in place to `skus` at cutover to preserve UUIDs; normalize attributes, units, tracking, reservations and BOM in dedicated tables; route every inventory mutation through one append-only posting kernel with idempotency, allocations and reversal; prepare normalized schema/backfill on clones before switching the runtime; remove old code immediately after the runtime switch; defer destructive legacy-column/table drops to a separately confirmed retirement step.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase/PostgreSQL 17, PostgreSQL RPC/RLS, Zod, Zustand offline queue, Vitest/Testing Library, Docker, BrowserSkill.

**Baseline/Authority Refs:**
- `docs/superpowers/specs/2026-09-16-unified-product-variant-workflow-design.md` — approved replacement design including §28 decisions.
- `supabase/migrations/0004_catalog.sql` — current Product/Variant/Component baseline.
- `supabase/migrations/0005_inventory.sql` and latest RPC replacements — current balances/movements/posting baseline.
- `docs/architecture/rbac-and-roles.md` — canonical seven-role authority.
- `docs/superpowers/specs/2026-09-09-unit-conversion-design.md` — superseded UOM implementation but retained business examples.
- `docs/operations/backup-and-recovery.md` and `scripts/deploy.sh` — current backup/deploy limitations that this plan must strengthen.

**Compatibility Boundary:** Preserve Product and current Variant/SKU UUIDs, all document relationships, existing balances/movements, images, valid barcodes, user-facing `/products` and `/admin/products` URLs, and current accounting cost behavior. Do not preserve internal variant terminology, JSON catalog contracts, component/RPC APIs, old modals, or inferred composite behavior. Existing historical fields that were never stored are reported as unknown, never fabricated.

**TDD Route:**
- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Strict signals: schema, persistence, stock posting, concurrency, migration and cross-consumer behavior
- Light eligibility: not eligible
- TDD-fit exception: none
- Test posture: post-change contract/regression tests, SQL invariant tests, clone rehearsal, failure injection and browser smoke tests
- Reason: strict TDD was not explicitly requested; each coherent slice still requires fresh falsifying verification before acceptance
- Verification: focused Vitest, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, SQL audits, verification scripts, clone rehearsal, restore drill and BrowserSkill smoke matrix

## Plan Basis

The approved design replaces rather than extends the current catalog. Repository evidence shows at least 391 direct content matches around `variant_id`, options, attributes and component semantics, with current owner files already overloaded (for example the old product form exceeds 1,100 lines and reports queries exceed 900 lines). The current ledger uses integer quantities and destructive movement deletion on some revert paths. Therefore this work must be executed as bounded, gated slices with one canonical posting owner, not as edits inside existing dialogs or one destructive migration.

Current local profiling evidence on 2026-09-16:

- 423 Products.
- 825 current Variant rows to preserve as SKU UUIDs.
- 20 component rows across 8 parents, all currently marked `assembly`.
- 816 stock-balance rows, all quantity 0.
- 0 stock movements.
- 0 receipt rows with lot or expiry data.
- 0 orphan document SKU references in the checked document tables.

These counts are evidence for the present local database only, not a production assumption. Production clone profiling remains a hard gate.

## Baseline Usage

- Required refs: approved replacement spec, catalog/inventory migrations, latest effective RPC definitions, RBAC matrix, backup/deploy runbooks.
- Acknowledged before planning: all required refs above.
- Cited in plan: all required refs above.
- Missing refs: no complete external-integration inventory and no timed production-clone migration/restore evidence yet.
- Decision: continue with implementation plan, but production execution remains gated by Tasks 1, 15 and 16.

## Requirement Ready Check

- Requirement source: direct user approvals plus approved design spec and §28 amendment.
- Goal/scope: complete internal replacement; no V2 runtime and no long-lived fallback.
- Scenarios: catalog, UOM, tracking, BOM, every stock/document consumer, offline replay, reporting, cutover, rollback and retirement.
- Acceptance: design §25 and executable oracles in §28.15.
- Open blocker questions: none for implementation development; production maintenance budget and destructive drop permission intentionally depend on rehearsal evidence.
- Decision: ready for development and rehearsal; production cutover and persistent-state drops require later scoped authorization.

## Change Necessity

- User-visible need: current add/edit flows and underlying representation cannot compose attributes, packaging, tracking and kits safely.
- No-change option: documentation or UI-only changes cannot fix persistence ownership, snapshots, decimal quantities, reversal, reservations or BOM semantics.
- Why code change is necessary: every producer/consumer currently targets the old Variant/JSON/component contract.
- Minimum boundary: schema, posting kernel, normalized domain repositories, all named consumers, cutover tooling and code retirement.
- Decision: code-change.

## Existence Check

- Proposed new surfaces: normalized attribute/UOM/tracking/BOM/reservation tables; append-only posting kernel; Product/SKU admin workflow; assembly/disassembly operations.
- Existing reuse candidates: Products, current Variant UUIDs, stock locations, document headers, audit logs, role helpers and current user-facing URLs.
- Why existing surfaces are insufficient: JSON and `variant_components` combine unrelated responsibilities; movement schema lacks snapshots/idempotency/reversal/allocations; old dialogs cannot own workflow-scale drafts.
- Creation proof: each new owner maps one approved domain responsibility and replaces at least one old responsibility.
- Entropy/retirement impact: new owners are accepted only with explicit removal of old runtime owners and lingering-reference checks.
- Decision: add-with-proof.

## Architecture Integrity Lens

- Invariant: one SKU identity and one stock-posting authority must explain every inventory quantity and historical document.
- Canonical owners: normalized SKU/UOM/tracking/BOM tables and one posting kernel; no caller writes balances/movements directly.
- Responsibility overlap to remove: JSON options/attributes, component-based UOM expansion, caller-specific balance mutation and delete-on-revert helpers.
- Higher-level simplification: consumers submit typed commands; the posting kernel owns validation, locks, snapshots, allocations, balance deltas, idempotency and reversal.
- Retirement/falsifier: any remaining production path that writes old columns/components or directly mutates ledger invalidates cutover readiness.
- Verdict: proceed with owner extraction and mandatory retirement track.

## Plan Pressure Test

- Owner/contract/retirement: explicit in schema, posting kernel, consumer matrix and Tasks 13/16.
- Higher-level path: central posting kernel prevents one RPC rewrite per local symptom.
- Verification: unit/component tests alone are insufficient; SQL/concurrency/rehearsal/browser evidence is required.
- Executability: development is split by owner and consumer vertical slices; production switch is separate.
- Pressure result: proceed.

## Complexity Budget

- Artifact class: persistence core + cross-module workflows + large UI.
- Current pressure: `product-form-dialog.tsx` 1,100+ lines, product actions 500+ lines, reports queries 900+ lines, monolithic historical RPC migration.
- Projected pressure without governance: over-budget.
- Planned governance: do not extend old dialogs; create small domain modules and route pages; add new numbered migrations rather than editing history; split consumer work by workflow; keep coordinator as sole integration owner.
- Budget result: within-budget only with the boundaries below.


## Environment and Deployment Applicability

| Task | Source/local | Disposable clone | Production while old app serves | Maintenance-only production |
|---|---:|---:|---:|---:|
| 1 inventory/profile | yes | required | read-only profile only after operator approval | no |
| 2 normalized catalog foundation | yes | required | only additive objects/nullable columns proven old-runtime compatible | backfill if locks exceed measured safe threshold |
| 3 decimal/tracking/ledger foundation | yes | required | no quantity-type, RLS, movement-mutability or callable-RPC changes | yes |
| 4 posting kernel | yes | required | functions may be installed revoked from runtime roles only | grant/switch in Task 13 |
| 5–12 application/consumer development | yes | integration clone | no runtime switch | deploy paired artifact in Task 16 |
| 13 code/schema cutover | yes | required | no | yes, atomic with app switch |
| 14 operational docs/scripts | yes | dry run required | no behavior change | supports Tasks 15/16 |
| 15 rehearsal | no | required | no | rehearsal environment only |
| 16 production cutover | no | evidence input | no | explicit scoped approval required |
| 17 data-bearing retirement | no | rehearsal required | no | separate destructive approval required |

No migration that changes quantity types, active RLS, movement mutability, effective RPC behavior or old-app-readable schema may be pushed while the old artifact serves traffic without a recorded compatibility proof from Task 1.

## Lifecycle and Database Constraint Contract

- Product transitions: `draft → active → archived`; reverse transitions require explicit action and audit. Activation requires at least one valid active SKU. Archived Product cannot create new transactions.
- SKU transitions: `draft → active → inactive`; active/inactive cannot return to draft. Inactive SKU resolves historical reads but selectors exclude it.
- Product with zero variant-axis attributes has at most one active SKU, enforced by deferred transaction validation.
- Active SKU combinations are unique by typed axis-value canonical key.
- SKU in a draft document, active reservation or active BOM cannot become inactive.
- Attribute-contract removal/addition for an active Product uses a dedicated conversion command; ordinary metadata actions reject it.
- BOM versions use UTC `tstzrange` with an exclusion constraint preventing overlap per SKU; status is `draft | scheduled | active | retired`.
- BOM version that has been referenced by a reservation/order/movement is immutable.
- All BOM items are mandatory in this release; nested BOM is rejected both when saving and again when activating/posting.
- Axis-value change on an SKU with history requires reason and before/after audit; duplicate canonical key is rejected.
- Incoming remains a read projection from eligible open receipt documents, never a stored balance.

## Legacy Data Status Vocabulary

- `snapshot_quality = 'complete' | 'legacy_unknown'` describes snapshot fields that cannot be reconstructed.
- `lot_migration_status = 'resolved' | 'legacy_unresolved'` describes batch/expiry source rows that cannot form a valid lot entity.
- `history_recovery_status = 'present' | 'legacy_history_not_recoverable'` records known classes of old movements already deleted before migration; it does not create replacement movements.
- Audits report each category separately with counts and source identifiers. Production go-live requires zero `legacy_unresolved`; `legacy_unknown` and unrecoverable history may remain only with an accepted evidence report because the source facts never existed.

## External Consumer Decision

Preferred and default: every proven external consumer must migrate or terminate before cutover; otherwise go/no-go is NO-GO. Task 1 disposition `external-confirmation` must resolve to `migrated`, `terminated`, or a separately approved compatibility exception. A compatibility exception requires a design/plan amendment naming exact alias/API, consumer, owner, telemetry, expiry date and deletion trigger; it cannot be inferred from this plan.

## Target File/Owner Map

### New domain owners

- `src/features/catalog/domain/types.ts`
- `src/features/catalog/domain/quantity.ts`
- `src/features/catalog/domain/labels.ts`
- `src/features/catalog/schema.ts`
- `src/features/catalog/data.ts`
- `src/features/catalog/actions.ts`
- `src/features/catalog/components/sku-selector.tsx`
- `src/features/catalog/components/transaction-uom-select.tsx`
- `src/features/catalog/components/tracking-allocation-editor.tsx`
- `src/features/catalog/components/product-workflow/*`
- `src/features/assemblies/*`
- `src/features/inventory-posting/*` for TypeScript command/read models only; PostgreSQL remains mutation owner.

### New migrations/scripts

- `supabase/migrations/0074_sku_catalog_foundation.sql`
- `supabase/migrations/0075_sku_catalog_backfill.sql`
- `supabase/migrations/0076_inventory_posting_foundation.sql`
- `supabase/migrations/0077_inventory_document_snapshots.sql`
- `supabase/migrations/0078_sku_posting_rpcs.sql`
- `supabase/migrations/0079_sku_cutover.sql`
- `scripts/catalog-profile.sql`
- `scripts/catalog-audit.sql`
- `scripts/rehearse-catalog-cutover.sh`
- `scripts/verify-sku-posting.ts`
- `scripts/verify-catalog-consumers.ts`
- `scripts/cutover-catalog.sh`
- `scripts/rollback-catalog-preopen.sh`

Migration numbers must be rebased to the next available numbers if another migration lands first.


### Workflow persistence added by foundation migrations

- `catalog_drafts` stores server-backed Product/SKU workflow JSON, `revision bigint`, owner, timestamps and draft status; update requires expected revision and rejects conflicts.
- `sku_prices` stores purchase/sale/reference price plus `price_basis = base_uom | transaction_uom`, currency, effective range and source.
- Existing `audit_logs` remains the field-change owner; Product/SKU/UOM/BOM actions must write before/after JSON and reason. If profiling proves its shape insufficient, Task 1 must amend the spec before adding another audit owner.
- `assembly_orders` and `assembly_order_items` store finished SKU, locked BOM version, planned/actual quantities, location, state, actor and wastage reason.
- `disassembly_orders` and `disassembly_order_items` store expected, recovered, damaged and lost base quantities and linked defect movement/note.
- State constraints and generated DB types for these owners belong to migrations 0074/0076, not implicit UI state.

### Exact numeric contract

- Quantities, BOM, reservation and document base quantities: `numeric(20,6)`.
- UOM factor: `numeric(20,9) > 0`.
- Money: `numeric(18,2)`; base unit cost: `numeric(20,6)`.
- `decimal_scale` is 0..6. Reject excess entered precision; round product to base scale and reject any non-zero residual; serial/indivisible units require scale 0.
- Fixtures include maximum six decimals, factor precision nine, invalid residual and fractional serial rejection.

### Posting RPC role matrix

| Command | Allowed roles enforced in PostgreSQL |
|---|---|
| Receipt create/post/reverse | superuser, owner, accountant, warehouse |
| Reservation create/release via approval/cancel | superuser, owner, accountant, warehouse; technician only where current requisition approval scope permits and never posts stock |
| Direct/reserved issue, return, transfer | superuser, owner, accountant, warehouse |
| Stocktake count | superuser, owner, accountant, warehouse |
| Stocktake adjustment approval | superuser, owner, accountant |
| Defect/exchange/repair movement | superuser, owner, warehouse, technician according to existing state transition; accountant has read/financial access but no physical post |
| Liquidation stock post | superuser, owner, warehouse; financial approval remains owner per current matrix |
| Assembly/disassembly post | superuser, owner, warehouse |
| BOM draft | superuser, owner, warehouse, technician |
| BOM activate | superuser, owner, warehouse |

Introduce explicit role helper functions by capability (for example `can_post_inventory`, `can_approve_stocktake_adjustment`, `can_edit_bom`) instead of reusing broad `is_manager()`. Add positive/negative SQL fixtures for every row.

### Immutable history and user force-purge

`admin_purge_user_data` and `src/features/auth/actions/delete-user.ts` are mandatory consumers. After cutover, a user referenced by posted ledger history cannot be hard-deleted and movement history is never deleted. The action archives/deactivates the profile or anonymizes only allowed non-identity presentation fields according to an explicit audit event; protected account rules remain. Task 13 revokes the old force-purge signature. Verification proves posted movements survive every user administration path.

### Existing consumer groups

1. Catalog/UI: `src/app/(app)/products/**`, `src/app/(app)/admin/products/**`, `src/features/products/**`, cart store and product QR components.
2. Receipts: receipt routes, actions, forms, edit/detail pages, verification script and PDF.
3. Requisitions/returns/offline: routes, actions, forms/dialogs, material item views, offline queue/store/provider and PDFs.
4. Issues/transfers/stocktake: pages, actions, types/grouping, reports and PDFs.
5. Defects/exchange/repair/liquidation/tools: feature actions/pages/dialogs, verification scripts and PDFs.
6. Reports/export/QR/AI: report queries/calculations/Excel, API exports/PDFs, QR parser/routes, cached metadata, AI inventory tools/RAG sync.
7. Operations: import/seed scripts, generated DB types, docs, deployment/backup scripts.

## Task 1 — Freeze a complete consumer and production-data inventory

**Files:** create `docs/superpowers/evidence/catalog-consumer-matrix.md`, `scripts/catalog-profile.sql`, `scripts/catalog-audit.sql`; inspect all migration/app groups above.

**Why:** “All consumers” and “no data loss” are not executable until every owner and relationship has a named disposition.

**Change Necessity:** read-only scripts/docs are required because grep output and ad-hoc shell history are not durable cutover evidence.

**Impact/Compatibility:** no runtime or data mutation.

**Steps:**
1. Record every table/column/FK/constraint, effective function signature and caller, view/materialized view, trigger, index, RLS policy/grant, publication/subscription, route, action, component, cache/offline payload, report/export/PDF, QR, AI tool, import/seed script and external integration touching old catalog semantics. For each database object prescribe dependency order and `rename | recreate | revoke | drop-at-cutover | retain-historical` disposition; cutover preflight fails on any unclassified live object.
2. For each entry record `preserve | migrate | replace | retire | external-confirmation`, new owner, task number and verification.
3. Write `catalog-profile.sql` for counts, types, nulls, duplicates, component classification, UOM strings, quantity ranges, lot/expiry usage, orphan refs, direct movement/balance writes and ambiguous rows.
4. Write `catalog-audit.sql` with machine-failing zero-count gates and before/after checksum queries.
5. Run both against local DB read-only; save sanitized output under `docs/superpowers/evidence/`.
6. Run on a restored production clone before Task 2 is accepted.

**Verification:**
`docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < scripts/catalog-profile.sql`
`docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < scripts/catalog-audit.sql`
Expected: scripts exit 0; consumer matrix has no unowned entry; unresolved data is explicit, not silently skipped.

**Stop:** any unknown external writer, orphan reference, unclassifiable component, non-zero balance/movement behavior not covered by fixtures, or un-restorable backup returns to design/data cleanup before implementation continues.

## Task 2 — Add normalized catalog foundation without switching runtime

**Files:** create migrations 0074/0075, catalog SQL tests/audits, regenerate `src/types/database.types.ts`.

**Why:** Normalize attributes, UOM, barcode namespace, tracking policy and BOM while preserving existing UUIDs.

**Schema boundary:** add `units`, `attribute_definitions`, `attribute_option_values`, `product_attribute_definitions`, `sku_attribute_values`, `sku_transaction_units`, `barcode_registry`, `bom_headers`, `bom_versions`, `bom_items`; add target columns to current `variants` needed before rename. New FK columns may be named `sku_id` while referencing `variants(id)` until cutover.

**Steps:**
1. Define enums/checks from spec §28, numeric precision and unique constraints.
2. Seed canonical physical units and dimensions deterministically by stable code.
3. Add Product/SKU statuses, SKU code, base UOM, tracking and inventory policy columns without changing old app reads.
4. Populate new SKU columns and normalized child records for every existing `variants` row in place; do not insert a second identity row. Assert identical row count and UUID set before/after. Task 13 later renames the existing table and FK columns.
5. Map existing unit strings into canonical units; emit unresolved report instead of guessing.
6. Map option/attribute JSON into definitions and typed values; preserve original text in migration evidence for traceability.
7. Classify every component as BOM/UOM/unresolved using explicit rules; local evidence currently expects 20 assembly rows but clone result is authoritative.
8. Add BOM v1 for classified assemblies and transaction UOM rows only for proven packaging relations.
9. Regenerate types.

**Verification:** local DB reset from scratch; migration applied to clone; `catalog-audit.sql` reports zero missing UUID mappings, duplicate SKU codes/barcodes, invalid typed values, ambiguous component rows and BOM cycles. Compare Product/SKU/component counts and UUID checksums before/after.

**Rollback:** additive objects can be removed on disposable clone; production runtime is not switched in this task.

## Task 3 — Build decimal, tracked, append-only inventory foundation

**Files:** migrations 0076/0077; `scripts/verify-sku-posting.ts`; focused SQL fixtures.

**Why:** Current integer balances/movements and delete-on-revert behavior cannot support decimal UOM, lot/serial allocations, reservations or immutable history.

**Schema boundary:** alter quantity columns to `numeric(20,6)`; add movement snapshots, quality, idempotency and reversal fields; add `inventory_lots`, `lot_stock_balances`, `serial_items`, `stock_movement_allocations`, `stock_reservations`, `stock_reservation_allocations`; add entered/base quantity and snapshot fields to all document item tables identified in Task 1.

**Steps:**
1. Convert integer quantity columns using safe `USING quantity::numeric` and audit equality.
2. Add append-only enforcement functions/triggers in a disabled/not-attached form for clone verification only. Do not activate them in any environment served by the old runtime; activation occurs atomically in Task 13 after old revert/force-purge paths are revoked.
3. Add allocation sum constraints through deferred validation in posting RPC, because cross-row sums cannot be a plain CHECK.
4. Add reservation uniqueness and lifecycle constraints.
5. Backfill historical snapshots only from deterministic sources; mark unknown fields `legacy_unknown`.
6. Preserve receipt batch/expiry strings and map only deterministic lot rows.
7. Add indexes for SKU/location, lot expiry, serial code/status, source document and idempotency.
8. Add RLS policies matching canonical roles.

**Verification:** exact integer→numeric equality, no negative balances, allocation/balance reconciliation, no duplicate serial/barcode/idempotency keys, RLS positive/negative tests, and legacy-quality report. Do not claim recovered deleted history.

## Task 4 — Implement one canonical PostgreSQL posting kernel

**Files:** migration 0078; `src/features/inventory-posting/{types,commands}.ts`; `scripts/verify-sku-posting.ts`.

**Why:** Every caller-specific RPC currently mutates balances differently; centralization is required to guarantee locks, snapshots, tracking, idempotency and reversal.

**Canonical functions:** private validation/allocation helpers plus operation-authorized command RPCs for receipt in, direct issue, reserved issue, transfer, stocktake adjustment, defect moves, repair moves, liquidation, return, virtual-kit issue, assembly and disassembly. PostgreSQL checks explicit roles per the RBAC matrix below; callers never write balances or movements directly.

**Steps:**
1. Define typed command JSON schema with document/source line, entered UOM/quantity, optional explicit lot/serial allocations and idempotency key.
2. Lock SKU, UOM, balance, lot/serial and reservation rows in deterministic UUID order.
3. Validate status, scale, factor, availability, tracking, BOM version and role before mutation.
4. Insert immutable movement and allocations, then update summary/detail balances in one transaction.
5. Implement reversal from original movement snapshots/allocations; never re-read current UOM/BOM semantics.
6. Implement virtual-kit explosion at one level and stocked assembly/disassembly.
7. Implement reservation create/consume/release commands with partial issue.
8. Remove movement-delete behavior from all new paths. On clones, prove replacement coverage; on production, old delete-based helpers remain in use only until the atomic Task 13 cutover, where they are revoked before append-only enforcement is activated. Never apply append-only enforcement while an old artifact is serving traffic.

**Verification oracles at this stage:** execute posting-kernel scenarios §28.15.1–7: decimal UOM/idempotency, reversal, FEFO, serial validation, reservation race, virtual-kit locked BOM/shortage rollback, and assembly failure injection. Expected: exact movement/allocation rows and zero partial balance changes. Offline replay, migration audit and timed cutover rehearsal (§28.15.8–10) are gated in Tasks 8 and 15 after their owners exist; Task 15 reruns the complete ten-scenario suite.

## Task 5 — Create normalized catalog read/write API and shared SKU selector

**Files:** new `src/features/catalog/**`, focused tests; modify cache helpers and shared domain labels.

**Why:** Consumers need one typed contract independent of old JSON and component inference.

**Steps:**
1. Define `CatalogProduct`, `CatalogSku`, `TransactionUom`, tracking/BOM summaries and command schemas.
2. Implement server reads for Product list/detail, SKU search, barcode resolution, UOM options, availability and tracking allocations.
3. Implement Product/SKU draft, activation, metadata, attribute-contract, UOM and BOM actions with exact RBAC.
4. Implement reusable SKU selector and transaction-UOM selector with search by Product, SKU code, typed attributes, alias, barcode and serial when the workflow permits it. Serial lookup enforces role visibility, returns one unambiguous SKU/serial, labels issued/defect/repair/liquidated state, and blocks unavailable states from new issue selection.
5. Implement Vietnamese labels without re-parsing JSON.
6. Replace cached variant options with versioned SKU option cache and explicit invalidation tags.

**Verification:** schema tests; duplicate/invalid-state/RBAC tests; selector component tests including 423/825-scale fixture; barcode collision tests; no imports from old product contract modules in new owner.

## Task 6 — Replace catalog administration and end-user Product browsing

**Files:** replace `src/app/(app)/admin/products/page.tsx`; create `new/page.tsx`, `[productId]/page.tsx` and workflow components; replace `src/app/(app)/products/page.tsx`; migrate Product card/detail/search/QR tests.

**Why:** The user explicitly rejected current add/edit flows; old modals must not remain accessible.

**Steps:**
1. Make `/admin/products` list Products/SKUs from normalized owner and link to route pages.
2. Implement five-step server-backed draft workflow with revision conflict detection, duplicate-Product suggestions and source-linked review errors. Support one-SKU, multi-SKU and Excel-import starting modes; row duplication; Excel paste; reviewed combination generation without default Cartesian expansion; bulk UOM/minimum-stock/tracking application; editable generated SKU codes; and per-row validation.
3. Implement Product detail tabs: overview, SKU/attributes, UOM, BOM, stock and audit.
4. Implement SKU drawer/page for safe mutable fields; disable out-of-scope conversion operations from spec §28.9.
5. Replace public Product browsing and quick-add with SKU/UOM selector.
6. Route QR/barcode through registry.
7. Remove all UI entry points to ProductFormDialog/ProductVariantsDialog.

**Verification:** focused RTL and BrowserSkill tests for one-SKU and multi-SKU starts, row clone, Excel paste, reviewed combination generation, bulk edits, editable codes, duplicate suggestions, linked errors, decimal UOM, virtual kit and stocked assembly; refresh/resume/conflict; permission checks; no old modal text/control reachable.

## Task 7 — Migrate receipts end to end

**Files:** receipt actions/forms/pages/PDF; effective receipt RPC replacement; `scripts/verify-receipt-flow.ts`.

**Steps:**
1. Replace `variantId/quantity` payloads with SKU, transaction UOM, entered quantity, factor/base snapshots and tracking allocations.
2. Preserve invoice, supplier, VAT and approval behavior.
3. Post via canonical kernel; map lot/expiry/serial.
4. Preserve cost behavior and move latest price to canonical SKU/UOM price owner.
5. Update detail/edit/PDF to render snapshots.
6. Test cancel via reversal and idempotent retry.

**Verification:** receipt verification script plus UI tests; exact balance/movement/snapshot SQL assertions; old receipt remains readable with legacy-quality labels.

## Task 8 — Migrate requisitions, returns, reservations and offline payloads

**Files:** requisition actions/forms/dialogs/pages/PDF; return flows; cart/offline stores/providers/tests; effective requisition RPCs.

**Steps:**
1. Introduce versioned offline/cart item schema using `skuId`, UOM, entered/base quantities and catalog revision.
2. Reject old payload versions with user-visible reselect message; do not silently replay.
3. Create reservation on approval, including virtual-kit component allocations and BOM version.
4. Support partial issue/remaining reservation and atomic release on reject/cancel.
5. Migrate returns to original SKU/UOM/tracking snapshots and canonical posting.
6. Preserve approval-state behavior and auto-fulfillment only after reservation semantics are proven.

**Verification:** offline queue tests, approval race test, partial issue/return tests, virtual-kit reservation test, verify-requisition and return-history scripts.

## Task 9 — Migrate direct issues, transfers and stocktake

**Files:** issue routes/actions/forms/PDF; transfer actions/page; stocktake actions/types/grouping/components/PDF; effective RPC replacements and scripts.

**Steps:**
1. Use shared selector/UOM/tracking editors.
2. Post direct issues with FEFO/FIFO default and authorized override reason.
3. Transfer exact lot/serial identity and base quantity.
4. Exclude virtual kits from physical stocktake; count stocked assemblies normally.
5. Snapshot scanned transaction-UOM factor in stocktake inputs.
6. Replace direct old balance/movement writes with kernel commands.

**Verification:** issue/transfer/stocktake scripts and tests; lot/serial transfer reconciliation; virtual-kit negative checks; reversal assertions.

## Task 10 — Migrate defects, exchange, repair, liquidation and tools

**Files:** corresponding feature actions/pages/components/PDFs and verification scripts.

**Steps:**
1. Replace every variant payload/query with SKU and historical snapshots.
2. Require lot/serial selection where policy demands it.
3. Model defect/repair locations through canonical posting commands.
4. Support stocked-assembly defect; virtual-kit incident selects actual damaged components.
5. Preserve cross-Product exchange only with reason/approval.
6. Migrate tool borrowing/return and overdue displays to SKU/base quantity.
7. Remove caller-specific movement mutation/revert code.

**Verification:** existing defect/exchange/repair/tool scripts plus new serial genealogy and virtual-kit negative cases.

## Task 11 — Implement assembly/disassembly workflows

**Files:** create `src/app/(app)/assemblies/**`, `src/features/assemblies/**`, PDF if operationally required, nav/RBAC tests.

**Steps:**
1. Create assembly order draft/released/posted/cancelled state machine.
2. Lock BOM version at release and show required/available components.
3. Post actual component consumption, wastage reason and finished SKU increase atomically.
4. Create disassembly flow recording expected, recovered, damaged and lost quantities.
5. Route damaged recovery to defect location/note when selected.
6. Forbid nested BOM and unauthorized technician activation/posting.

**Verification:** component tests, RPC scenario tests, failure injection and BrowserSkill smoke for assemble/disassemble/cancel.

## Task 12 — Migrate reports, exports, PDF/QR, AI, import and seed producers

**Files:** reports queries/calculations/components/Excel/API routes; all material PDFs; QR routes/parser; AI inventory tools/RAG sync; import/seed scripts.

**Steps:**
1. Replace attribute JSON projection with typed SKU labels and snapshots.
2. Report on base quantity while presenting selected display UOM explicitly.
3. Preserve cost/report visibility by role.
4. Generate QR/barcode for SKU or transaction UOM with unambiguous registry resolution.
5. Update AI tools to return Product/SKU/UOM/availability rather than variants/attributes.
6. Replace import workbook with Products/SKUs/Transaction Units/BOM validation and atomic per-Product writes.
7. Replace seed generators and future import SQL; do not execute destructive re-import.

**Verification:** report query/calculation/Excel tests, all PDF route smoke tests, QR round trips, AI integration tests, import preview/rollback tests.

## Task 13 — Perform code cutover and retire old runtime owners

**Files:** migration 0079; all old Product components/actions/helpers/tests; generated types; consumer matrix.

**Why:** No parallel runtime or fallback is permitted.

**Steps:**
1. In cutover migration, rename `variants → skus` and every internal `variant_id → sku_id`, preserving constraints/UUIDs; recreate final views/functions/indexes/RLS with SKU names.
2. Switch all app imports/types/routes to catalog owner.
3. Delete old ProductFormDialog, ProductVariantsDialog, option editors, catalog-contract, free-form variant fields and obsolete tests.
4. Delete old component-expansion/UOM helpers and destructive movement-revert helpers after replacements pass.
5. Revoke and drop executable old RPCs, triggers, writable compatibility views and old write policies in the cutover migration; do not postpone runtime authority retirement to Task 17. If a proven compatibility exception physically retains an object, revoke write authority, add access telemetry and bind its expiry/deletion trigger to the approved amendment.
6. Activate append-only movement enforcement only after old revert and force-purge functions are revoked. Pre-cutover SQL must prove no executable function body can update/delete stock_movements; post-cutover negative tests prove direct UPDATE/DELETE and every old revert signature fail.
7. Run semantic lingering-reference checks: maintained-code grep with checked-in allowlist/reason, application import/call scan, and PostgreSQL catalog queries for functions/triggers/policies/views/grants/writable old columns. Add negative runtime tests for every retired route/action/RPC and zero-access telemetry for any physically retained read-only object.
8. Mark every consumer-matrix row closed with evidence.

**Verification:** textual and semantic scans are zero outside justified historical/migration allowlist; full static/test/build checks pass; DB schema contains final owner names and no unapproved compatibility alias; old entry points and movement deletion fail; UUID sets and row counts are identical across rename.

**Rollback:** on development/rehearsal clone only, run pre-open rollback/restore. Do not deploy this task independently from prepared app artifact.

## Task 14 — Update documentation and operational controls

**Files:** architecture/database schema, DB/RPC references, route map, user guides, backup/recovery, deployment runbook, changelog, spec status.

**Steps:**
1. Replace old catalog/UOM/BOM documentation with current state.
2. Document exact role matrix and lifecycle transitions.
3. Document backup artifact, clone restore, migration, audit, app deploy and pre-open rollback sequence.
4. Add post-open forward-fix boundary; explicitly prohibit full restore after new transactions.
5. Update deploy script or create catalog cutover wrapper so schema/app versions are paired and maintenance mode is enforced.
6. Record schema version, app commit and evidence artifact format.

**Verification:** doc link checks where available; shellcheck/bash syntax for scripts; dry-run cutover command on clone.

## Task 15 — Rehearse full cutover and obtain go/no-go evidence

**Files:** rehearsal/cutover/rollback scripts and dated evidence report under `docs/superpowers/evidence/`.

**Steps:**
1. Restore the latest sanitized production backup into an isolated database/stack.
2. Record restore duration and checksum baseline.
3. Build the exact app artifact before maintenance rehearsal.
4. Run migrations and time each lock/phase.
5. Execute catalog audit and all verification scripts.
6. Run full test/typecheck/lint/build.
7. Run BrowserSkill smoke matrix for every consumer group and role boundary.
8. Exercise pre-open rollback and verify old app + restored DB.
9. Re-run cutover, open rehearsal, create post-cutover transactions, then exercise documented forward-fix boundary rather than full restore.
10. Set maintenance budget from measured p95 plus safety margin and publish go/no-go checklist.

**Verification:** unresolved/ambiguous/orphan/duplicate counts are zero; checksum and balance oracles pass; all consumer rows closed; restore and forward-fix drills pass; measured duration is accepted by operator.

**Stop:** any missing external-consumer confirmation, non-zero unresolved row, failed restore, unmatched balance, old runtime reference, or untested workflow blocks production cutover.

## Task 16 — Production cutover (separate scoped authorization)

**Permission boundary:** This task changes live persistent state and service availability. Do not execute from plan approval alone. Require explicit approval naming environment, backup artifact, maintenance window and exact migration/app versions.

**Sequence:** freeze catalog/writes → maintenance mode → final backup and restore verification → assert baseline checksum → migrate → audit → deploy paired app → smoke roles/workflows → record opening timestamp → reopen.

**Pre-open failure:** restore DB backup and deploy old artifact.

**Post-open failure:** maintenance mode and forward-fix/reversal only; never restore full snapshot over new transactions without a separate data-loss decision.

## Task 17 — Destructive schema retirement (separate plan and confirmation)

**Deletion class:** persistent-state/contract-carrying code.

**Candidates:** only data-bearing legacy columns/tables such as old Product option/attribute JSON columns and `variant_components`, plus other irreversible source-of-truth objects proven redundant. Executable RPCs/triggers/write policies and runtime compatibility views are already revoked/dropped in Task 13 and are not deferred here.

**Guard:** the observation duration is set in the Task 15 go/no-go artifact from measured telemetry and business risk; it cannot be an oral placeholder. After that window, require zero lingering consumers and produce the exact data-object list, backup/rollback note and query evidence. Ask for explicit scoped confirmation. Only then create a new retirement migration. No data-bearing `DROP` is authorized by this plan.


## Acceptance Traceability

| Requirement | Owner task | Fixture / assertion | Expected evidence |
|---|---:|---|---|
| §25.1 one-SKU Product | 6 | create one-SKU draft, activate, SQL count | one Product, one active SKU, no special type branch |
| §25.2 multi-SKU typed attributes | 2,5,6 | Hãng/Công suất/Điện áp fixture | typed values and ordered axis display |
| §25.3 duplicate combination/code | 2,5 | concurrent duplicate commands | unique violation mapped to actionable error |
| §25.4 add SKU after activation | 5,6 | active Product with axes, add unique SKU | SKU active; Product identity unchanged |
| §25.5 SKU history deletion guard | 5,13 | movement-backed SKU delete/inactivate | delete denied; valid inactive transition audited |
| §25.6 multi-UOM | 2,5,7 | base ml + chai/thùng | selectable UOMs resolve exact factor |
| §25.7 base stock correctness | 3,4 | exact starting balance and decimal post | expected numeric balance and movement delta |
| §25.8 factor history | 3,7 | post then change future factor | old document/movement snapshots unchanged |
| §25.9 barcode UOM resolution | 2,5,12 | SKU/UOM collision and success fixtures | global uniqueness; one exact target |
| §25.10 lot/FEFO/serial | 3,4,7,9 | two expiries; serial set | earliest eligible lot; exact serial allocations |
| §25.11 virtual-kit availability | 2,4,6 | component balances and BOM quantities | floor/min availability by mandatory component |
| §25.12 virtual-kit atomic issue/reverse | 4,8,9 | insufficient then sufficient fixture | zero partial write; exact reversal allocations |
| §25.13 stocked assembly | 4,11 | assemble order with actual consumption | components down, finished SKU up atomically |
| §25.14 disassembly recovery | 4,11 | recovered/damaged/lost fixture | exact locations/deltas and reason |
| §25.15 BOM versioning | 2,4,11 | overlap/scheduled/used-version mutation | overlap/mutation denied; locked version retained |
| §25.16 all stock workflows use SKU/base | 7–12 | consumer matrix + SQL source assertions | no Product-level stock or old variant payload |
| §25.17 reservation vs on-hand | 4,8 | approval/partial/release fixture | on_hand unchanged; available reduced/restored |
| §25.18 reversal movement | 3,4 | cancel posted command | original remains, linked inverse added |
| §25.19 orphan/double-post | 4,13 | FK audit + same idempotency retry | zero orphan; one post result |
| §25.20 historical snapshot | 3,7–12 | rename/factor/BOM changes after post | historical render unchanged or marked legacy_unknown |
| §25.21 UUID mapping | 2,13 | before/after sorted UUID checksum | identical set/count |
| §25.22 no relationship/data loss | 1,2,13,15 | FK/balance/movement/image/barcode/lot audits | exact equality or explicit accepted legacy gap |
| §25.23 every consumer new owner | 1,7–13 | closed consumer matrix | no unowned/migrate-pending row |
| §25.24 old UI/action unreachable | 6,13 | browser and negative action/RPC tests | 404/denied/absent UI |
| §25.25 no old main-path reference | 13 | source call scan + pg_catalog scan | zero outside checked allowlist |
| §25.26 quality/rehearsal gates | 15 | full commands and evidence bundle | all exit 0; timed restore/cutover pass |
| §25.27 destructive guard | 17 | exact target card and approval record | no DROP without scoped confirmation |
| §28.15.1 decimal UOM/idempotency | 4,7 | 2 × 12,000 ml, repeated key | +24,000 once |
| §28.15.2 reversal | 4 | known initial balance | returns exactly to initial |
| §28.15.3 FEFO | 4,9 | two lot expiries | earlier eligible expiry allocated |
| §28.15.4 serial | 3,4 | qty 2 / duplicate / fractional | two unique serials; invalid inputs denied |
| §28.15.5 reservation race | 4,8 | two concurrent approvals | reserved never exceeds available |
| §28.15.6 virtual kit version | 4,8 | locked BOM then active version changes | old locked version posts; shortage rolls back |
| §28.15.7 assembly failure | 4,11 | injected error between deltas | no partial movement/balance |
| §28.15.8 migration audit | 1,2,13 | exact SQL oracle bundle | expected zero/non-zero counts recorded |
| §28.15.9 offline version | 8 | legacy queue payload | blocked/recovery prompt; no post |
| §28.15.10 rehearsal | 15 | restore/cutover/rollback clocks | evidence sets maintenance budget |

Additional lifecycle fixtures owned by Tasks 2/5/6 verify Product `draft→active→archived`, SKU `draft→active→inactive`, historical resolution of inactive SKU, blocking inactive selection, blocking inactive with draft/reservation/BOM dependencies, the one-active-SKU no-axis rule, attribute-contract conversion guard, incoming as projection, and SKU/UOM price-basis cost preservation.

## Verification Matrix

For every coherent task run its focused checks. Before Tasks 15/16 additionally run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
# Then all scripts/verify-*.ts relevant to the consumer matrix
```

Database evidence must include exact SQL outputs for UUID/FK coverage, balance sums, movement/allocation reconciliation, reservation availability, lot/serial totals, BOM cycles/effective overlap, duplicate barcode/SKU codes, legacy snapshot quality and unresolved rows.

Browser evidence must cover desktop and mobile add/manage Product, SKU/UOM selection, receipt, requisition/reservation/return, direct issue, transfer, stocktake, defect/exchange/repair/liquidation/tools, virtual kit, assembly/disassembly, reports/PDF/QR and role denial.

## Risks and Rollback

- **Historical gaps:** report `legacy_unknown`; never synthesize facts.
- **Decimal conversion:** reject precision loss; compare integer-era balances exactly.
- **Concurrent stock:** deterministic locks + idempotency + concurrency tests.
- **Offline replay:** schema-version gate and explicit user recovery.
- **Migration duration:** measured clone rehearsal determines window.
- **Dirty workspace:** preserve all pre-existing changes; coordinator stages only task-owned paths and does not reset/stash/clean.
- **External integrations:** confirmed or cutover is NO-GO.
- **Destructive retirement:** separate confirmation after evidence.

## Retirement Track

- Old UI owners become unreachable in Task 6 and deleted in Task 13.
- Old JSON/component/action/RPC logic becomes non-owner in Tasks 2–12 and is deleted in Task 13.
- No internal fallback or alias survives cutover.
- Historical migration files remain immutable evidence.
- Persistent old schema survives only until Task 17 authorization; it is read/write-inactive and monitored for zero access.

## Execution Readiness View

- **Intent Lock:** full replacement, not enhancement or V2.
- **Scope Fence:** approved Product/SKU/UOM/tracking/BOM/ledger architecture and every internal consumer; conversion tools deferred per spec §28.9.
- **Baseline Lock:** approved spec + §28 amendment, current schema/RPC/RBAC/ops evidence.
- **Approved Behavior:** typed attributes, SKU-specific UOM, tracked stock, one-level versioned BOM, append-only posting, reservations and complete old-owner retirement.
- **Owner Constraints:** PostgreSQL posting kernel is the only mutation owner; normalized catalog is the only read/write owner after cutover.
- **Compatibility:** preserve UUIDs/history/URLs/accounting behavior; do not preserve internal APIs/terms.
- **Retirement Boundary:** code retirement is mandatory; schema deletion needs later confirmation.
- **Task Batches:** discovery → schema/backfill → posting kernel → catalog API/UI → consumer slices → assembly → secondary consumers → code cutover → rehearsal → production → destructive retirement.
- **Test Obligations:** focused tests per task, full quality suite, SQL oracles, concurrency/failure injection, restore/forward-fix drill, browser matrix.
- **Review Gates:** Tasks 1, 4, 13 and 15 require independent architecture/code review before advancing.
- **Drift/Rewind:** any unresolved production data, external consumer, duplicate owner, precision loss or failed restore returns to spec/preflight; do not add fallback.
- **Evidence Required:** closed consumer matrix, zero unresolved audit, preserved checksums/UUID/FKs/balances, full tests/build, timed rehearsal and scoped production authorization.
- **Advisory Boundary:** this plan is execution guidance, not completion or destructive-action authority.

## Execution Route

- Decision: subagent-driven for bounded consumer slices, coordinated inline for schema/posting/cutover owners.
- Evidence: consumer slices are independently reviewable after the shared contract lands; persistence and production steps share transaction/state and must remain coordinator-owned.
- Fallback: execute inline by task batches if delegation cannot preserve shared workspace ownership.
- User confirmation required: no for development Tasks 1–15; yes for live production Task 16 and destructive Task 17.
