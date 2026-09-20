# Report Center Redesign — Evidence

## Verified slices
- Management insight rules, three-section hub/URL state, Metabase panel and all existing report details.
- Independent review found security, alert, stale-data, URL and accessibility defects; must-fix items were repaired.

## Commands
- `pnpm exec vitest run src/features/reports --maxWorkers=1`: PASS — 13 files, 93 tests (latest post-review run).
- `pnpm typecheck`: PASS (latest post-review run).
- Scoped ESLint for report/Metabase source: PASS after removing the final unused binding.
- `git diff --check`: PASS.
- Security search for hard-coded Metabase password/secret and broad table grants: no matches.
- Full `pnpm lint`: blocked by unrelated pre-existing `src/lib/ai/providers/dify.test.ts` unused `vi` import.
- `pnpm build`: compilation succeeded, then blocked by the same unrelated Dify lint error.
- Browser automation: unavailable after resume because browser plugin tools were not registered; no visual smoke evidence claimed.

## Security and correctness repairs
- Metabase embedding now fails closed without configured URL/secret; invalid dashboards reject and arbitrary filter signing is removed.
- BI migration no longer stores a password or grants all current/future public tables; access is restricted to seven curated views.
- Removed fabricated open-defect alert and corrected fuel variance percentage semantics.
- Failed requests clear active report data instead of presenting stale values under new filters.
- Invalid history URLs normalize to overview; tab keyboard Arrow/Home/End navigation added.
- Removed credentials/topology from user guide.

## Residual follow-ups
- Visual desktop/mobile smoke remains pending until browser plugin access is available.
- Partial overview blocks and filter-keyed cache remain deferred enhancements; current failure mode is explicit and safe (no stale data).
- Full repository lint/build remain externally blocked by an unrelated dirty Dify test file.
