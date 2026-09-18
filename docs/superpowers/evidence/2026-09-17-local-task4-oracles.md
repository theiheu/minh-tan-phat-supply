# Task 4 local posting-kernel oracles

All probes run inside explicit transactions and roll back. Local actor: active superuser fixture.

| Oracle | Observed |
|---|---|
| Decimal UOM + idempotency | 2 × 12,000 produced quantity/base_quantity 24,000 and retry returned the same movement |
| Reversal | original row retained, one linked reversal created, final balance returned to 0 |
| FEFO | issue 5 allocated 3 from earlier expiry and 2 from later expiry |
| Serial | quantity 2 required two serial allocations; quantity 2 on one serial exited 1 |
| Reservation | first reservation 7 succeeded; second reservation 5 against total 10 exited 1 with available 3 |
| Virtual kit shortage | exited 1; movement count before/after both 0 |
| Assembly failure injection | exited 1; movement count before/after both 0 |
| Nested BOM | activation rejected with exit 1 |
| Access boundary | 17 public commands are service-role-only; append-only trigger remains unattached |

Evidence files:
- `2026-09-17-local-task4-serial-negative.txt`
- `2026-09-17-local-task4-reservation-negative.txt`
- `2026-09-17-local-task4-kit-rollback.txt`
- `2026-09-17-local-task4-assembly-rollback.txt`
- `2026-09-17-local-task4-kernel-structure.txt`

Remaining pre-production gates: production clone, true two-session concurrency harness, full tracked inbound creation UX, and consumer-specific document validation during Tasks 7–11.
