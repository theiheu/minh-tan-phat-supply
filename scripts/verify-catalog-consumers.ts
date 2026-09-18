// scripts/verify-catalog-consumers.ts — Comprehensive catalog consumer invariant checks
//
// Usage: npx tsx scripts/verify-catalog-consumers.ts [database]
//   database defaults to "postgres"; pass a clone name for rehearsal.

import { execFileSync } from "node:child_process";

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_minh-tan-phat-supply";
const DATABASE = process.argv[2] ?? "postgres";

interface Check {
  metric: string;
  expected: string;
  query: string;
}

const CHECKS: Check[] = [
  {
    metric: "All products have valid SKU rows",
    expected: "0",
    query: "select count(*)::text from public.products p where not exists (select 1 from public.variants v where v.product_id = p.id)",
  },
  {
    metric: "No orphan document item references",
    expected: "0",
    query: `select count(*)::text from (
      select id from public.receipt_items ri where not exists (select 1 from public.variants v where v.id = ri.variant_id)
      union all select id from public.issue_items ii where not exists (select 1 from public.variants v where v.id = ii.variant_id)
      union all select id from public.requisition_items reqi where not exists (select 1 from public.variants v where v.id = reqi.variant_id)
      union all select id from public.requisition_return_items rri where not exists (select 1 from public.variants v where v.id = rri.variant_id)
      union all select id from public.defect_note_items dni where not exists (select 1 from public.variants v where v.id = dni.variant_id)
      union all select id from public.exchange_note_items eni where not exists (select 1 from public.variants v where v.id = eni.variant_id)
      union all select id from public.repair_order_items roi where not exists (select 1 from public.variants v where v.id = roi.variant_id)
      union all select id from public.liquidation_items li where not exists (select 1 from public.variants v where v.id = li.variant_id)
      union all select id from public.tool_borrowing_items tbi where not exists (select 1 from public.variants v where v.id = tbi.variant_id)
      union all select id from public.stocktake_items sti where not exists (select 1 from public.variants v where v.id = sti.variant_id)
    ) orphans`,
  },
  {
    metric: "No orphan stock balance references",
    expected: "0",
    query: "select count(*)::text from public.stock_balances sb where not exists (select 1 from public.variants v where v.id = sb.variant_id)",
  },
  {
    metric: "No orphan stock movement references",
    expected: "0",
    query: "select count(*)::text from public.stock_movements sm where not exists (select 1 from public.variants v where v.id = sm.variant_id)",
  },
  {
    metric: "Active BOM headers have valid active versions",
    expected: "0",
    query: "select count(*)::text from public.bom_headers bh where bh.active_version_id is not null and not exists (select 1 from public.bom_versions bv where bv.id = bh.active_version_id)",
  },
  {
    metric: "All SKU transaction units have valid SKU references",
    expected: "0",
    query: "select count(*)::text from public.sku_transaction_units stu where not exists (select 1 from public.variants v where v.id = stu.sku_id)",
  },
  {
    metric: "All SKU attribute values have valid SKU references",
    expected: "0",
    query: "select count(*)::text from public.sku_attribute_values sav where not exists (select 1 from public.variants v where v.id = sav.sku_id)",
  },
  {
    metric: "No invalid BOM item loops",
    expected: "0",
    query: "select count(*)::text from public.bom_items bi join public.bom_versions bv on bv.id = bi.bom_version_id join public.bom_headers bh on bh.id = bv.bom_header_id where bh.sku_id = bi.component_sku_id",
  },
];

function psql(query: string): string {
  const result = execFileSync(
    "docker",
    [
      "exec",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      DATABASE,
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { encoding: "utf8" }
  );
  return result.trim();
}

let failed = 0;
for (const check of CHECKS) {
  let actual: string;
  try {
    actual = psql(check.query);
  } catch (error) {
    console.error(`FAIL  ${check.metric}`);
    console.error(`      query threw: ${String(error)}`);
    failed += 1;
    continue;
  }
  if (actual === check.expected) {
    console.log(`PASS  ${check.metric}`);
  } else {
    console.error(`FAIL  ${check.metric}`);
    console.error(`      expected ${check.expected}, got ${actual}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed on database ${DATABASE}.`);
  process.exit(1);
} else {
  console.log(`\nAll ${CHECKS.length} catalog consumer checks passed on ${DATABASE}.`);
}
