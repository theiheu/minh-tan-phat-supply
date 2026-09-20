# Report Center Redesign — Intent and Baseline

## TaskIntentDraft
- Outcome: Implement the approved three-section report center with management overview first.
- Success evidence: focused reports tests, typecheck, lint, build, desktop/mobile browser checks.
- Stop condition: done, needs-verification, blocked, or scope-exceeded if schema/permission/ledger changes become necessary.
- Non-goals: new schema, permission changes, new chart engine, ledger formula changes.

## BaselineReadSetHint
- docs/superpowers/specs/2026-09-08-reports-and-analytics-design.md
- docs/aegis/plans/2026-09-20-report-center-redesign.md
- docs/aegis/BASELINE-GOVERNANCE.md
- current src/features/reports owners

## BaselineUsageDraft
- Required refs: all listed above.
- Acknowledged refs: all read before execution.
- Cited refs: spec and plan.
- Missing refs: Hindsight unavailable (API token absent), no source-local blocker.
- Decision: continue.

## ImpactStatementDraft
- Layers: reports types/lib/queries/actions/components/page/tests/docs.
- Owner: src/features/reports; Metabase signing stays src/lib/metabase.ts.
- Compatibility: preserve route, auth, ledger, exports, existing dirty Metabase work.
- Retirement: remove seven-tab top navigation; no fallback duplicate.

## Execution Readiness View
- Intent Lock: native management overview is default.
- Scope Fence: reports feature only, no schema/permission/formula changes.
- Baseline Lock: approved spec and plan.
- Compatibility Boundary: route/auth/export/current reports preserved.
- Retirement Boundary: old navigation removed.
- Test Obligations: reports tests, typecheck, lint, build, browser.
- Drift rule: stop on schema, permission, new BI engine, or unsupported business rule.
