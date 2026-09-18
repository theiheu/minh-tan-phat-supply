# Catalog Consumer and Database Object Matrix

**Workstream:** Full Material Catalog Replacement  
**Task:** Task 1 — consumer/data inventory  
**Status:** Local inventory complete; production-clone inventory required before Task 2 acceptance  
**Authority:** `docs/superpowers/plans/2026-09-16-full-material-catalog-replacement.md`

## Dispositions

- `preserve`: retain business behavior/data under the new owner.
- `migrate`: transform payload/schema/query.
- `replace`: new implementation takes ownership.
- `retire-at-cutover`: revoke/delete executable old owner in Task 13.
- `retain-historical`: immutable migration/evidence only.
- `external-confirmation`: resolve to migrated, terminated, or separately approved exception; otherwise NO-GO.

## Local baseline

| Metric | Value |
|---|---:|
| Products | 423 |
| Current Variant rows / future SKU identities | 825 |
| Products without SKU | 0 |
| Single-SKU / multi-SKU Products | 354 / 69 |
| Maximum SKUs per Product | 22 |
| Legacy option/attribute labels | 53 |
| Legacy unit spellings | 26 |
| Component rows / parents | 20 / 8 |
| Component classification | 20 assembly, 0 unit_conversion |
| Stock balances / positive balances | 816 / 0 |
| Stock movements | 0 |
| Receipt items / lot / expiry | 0 / 0 / 0 |
| SKU UUID checksum | `9c8d60682db7392018b3fd8ae006de62` |

Local audit reports zero contract violations, duplicate combinations/defaults, invalid/nested components, negative balances and orphan references. Production remains unverified.

## Database owner manifest

| Current object | Disposition | Target owner/action | Task |
|---|---|---|---:|
| `products` | preserve+migrate | keep UUID/core metadata; add lifecycle; retire `options` later | 2,13,17 |
| `variants` | migrate+rename | populate SKU fields in place, rename to `skus`, preserve UUID set | 2,13 |
| `variants.attributes` | migrate | typed `sku_attribute_values`; disable old reads/writes | 2,13,17 |
| `variants.unit` | migrate | base unit plus `sku_transaction_units` | 2,13,17 |
| `variants.price` | migrate | `sku_prices` with explicit basis | 2,7,13 |
| `variants.min_stock` | migrate | decimal SKU minimum stock | 2,13 |
| `variants.is_trackable_lot` | migrate | tracking policy | 2,3,13 |
| `variant_components` | migrate | BOM or SKU UOM, then data retirement | 2,13,17 |
| `stock_balances` | migrate+rename | `sku_id`, numeric summary balance | 3,13 |
| `stock_movements` | preserve+migrate | numeric append-only ledger with snapshots/idempotency/reversal | 3,4,13 |
| all document item `variant_id` columns | migrate+rename | `sku_id` plus entered/base snapshots | 3,7–10,13 |

### Foreign-key tables

`defect_note_items`, `exchange_note_items`, `issue_items`, `liquidation_items`, `receipt_items`, `repair_order_items`, `requisition_items`, `requisition_return_items`, `stock_balances`, `stock_movements`, `stocktake_items`, `tool_borrowing_items`, and both parent/child keys in `variant_components`.

### Views, triggers, policies and indexes

| Objects | Disposition |
|---|---|
| `variant_stock`, `location_stock` | replace with SKU availability views; retire at cutover |
| `trg_variants_updated` | recreate on `skus` |
| component integrity trigger | replace with BOM/UOM constraints |
| eight Variant/component RLS policies | replace broad `is_manager()` with capability policies |
| Variant/default/attribute indexes | replace with SKU code/default/typed-axis constraints |
| balance/movement indexes | rename and add snapshot/idempotency/reversal indexes |
| component indexes | retire after BOM/UOM migration |

## Effective RPC inventory

### Replace catalog/component owners

`_validate_variant_attributes`, `canonical_variant_attributes`, `create_variant_with_contract`, `update_variant_with_contract`, `update_product_options`, `save_variant_components`, `_check_variant_components_integrity`, `search_catalog`, and `ai_get_stock_summary`.

### Replace stock posting/expansion owners

`_expand_variant_demand`, `_effective_demand`, `_move_stock`, `_revert_movements`, `adjust_stock`, and `transfer_stock`. `_revert_movements` must lose runtime authority before append-only enforcement activates.

### Migrate document functions

- Receipts: `create_receipt`, `update_receipt`, `post_receipt`.
- Requisitions: `create_requisition`, `fulfill_requisition`, `return_requisition_items`.
- Issues: `create_issue`, `post_issue`.
- Stocktake: both `create_stocktake` overloads and `post_stocktake`.
- Defect/exchange: `record_defect`, `create_exchange`, `issue_exchange`.
- Repair/liquidation: `send_to_repair`, `complete_repair`, `cancel_repair`, `revert_repair`, `create_liquidation`, `complete_liquidation`.
- Tools: both `create_tool_borrowing` overloads, `return_tool_borrowing`, `cancel_tool_borrowing`.

### Immutable user-history boundary

`admin_purge_user_data` and `src/features/auth/actions/delete-user.ts` must be replaced/revoked so user administration cannot delete posted movement history.

## Runtime consumer groups

| Group | Paths/owners | Disposition / task | Verification |
|---|---|---|---|
| Catalog UI | `src/app/(app)/admin/products/**`, `src/app/(app)/products/**`, `src/features/products/**` | replace in Tasks 5,6,13 | browser workflows; old UI absent |
| Cart/QR/cache | `src/stores/cart-store.ts`, QR parser/components, `src/lib/{attributes,labels,cached-metadata,types}.ts` | migrate/retire inference in Tasks 5,6,8,12,13 | payload/QR/cache tests |
| Receipts | `src/features/receipts/**`, receipt pages/PDF/script | Task 7 | receipt E2E and SQL snapshots |
| Requisitions/returns/offline | requisition feature/pages/PDF, `offline-queue-store`, `src/components/offline/**` | Task 8 | reservation race, partial issue/return, legacy payload block |
| Issues/transfers/stocktake | corresponding features/pages/PDF/scripts | Task 9 | FEFO, transfer identity, count reconciliation |
| Defect/exchange/repair/liquidation/tools | corresponding features/pages/PDF/scripts | Task 10 | workflow scripts and tracking tests |
| Reports/export/PDF | `src/features/reports/**`, export/report APIs, all material PDFs | Task 12 | query, Excel and PDF smoke |
| QR/barcode | QR APIs/pages/parser | Tasks 5,12 | SKU/UOM/barcode/serial round trip |
| AI/RAG | inventory tools/tests, `scripts/ai-sync-knowledge.ts` | Task 12 | AI integration and reindex |
| Import/seed/types | import/seed scripts, `database.types.ts` | Tasks 2,3,12,13 | preview/rollback, DB reset, typecheck |
| Operations | backup/deploy/cutover scripts and docs | Tasks 14–16 | restore/cutover drill |

## External/platform consumers

| Surface | Evidence | Disposition |
|---|---|---|
| Browser offline queue / IndexedDB | confirmed internal | migrate in Task 8 |
| AI/RAG index | confirmed internal | regenerate in Task 12 |
| External SQL/API/report consumers | not established | `external-confirmation`; NO-GO until resolved |
| PostgreSQL publications/subscriptions | production clone query required | `external-confirmation` |
| PostgREST clients outside repo | unknown | `external-confirmation` |

## Evidence and gates

- Profile: `scripts/catalog-profile.sql`.
- Audit: `scripts/catalog-audit.sql`.
- Local profile: `docs/superpowers/evidence/2026-09-16-local-catalog-profile.txt`.
- Local audit: `docs/superpowers/evidence/2026-09-16-local-catalog-audit.txt`.
- Local identity comparison: `docs/superpowers/evidence/2026-09-16-local-catalog-identity-check.txt`.
- Intentional mismatch proof: `docs/superpowers/evidence/2026-09-16-local-catalog-identity-negative.txt` records a non-zero psql exit.
- Production-clone evidence: missing and required before Task 2 acceptance.
- Task 13 dependency manifest must be regenerated from the production clone.

## Task 1 stop assessment

Local inventory has no integrity blocker. Task 2 cannot be accepted until a production backup is restored to an isolated clone, profile/audit pass there, all external consumers/publications/subscriptions are classified, and every live database object has a cutover disposition.
