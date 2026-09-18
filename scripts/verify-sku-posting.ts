// scripts/verify-sku-posting.ts — Task 3 foundation invariants for the SKU posting kernel.
//
// Read-only verification. It proves the additive decimal/tracking/ledger
// foundation exists and that append-only enforcement is still DISABLED for the
// old runtime. It intentionally does not post anything: the canonical posting
// kernel arrives in Task 4.
//
// Usage: npx tsx scripts/verify-sku-posting.ts [database]
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
    metric: "stock_balances.quantity is numeric",
    expected: "numeric",
    query:
      "select data_type from information_schema.columns where table_schema='public' and table_name='stock_balances' and column_name='quantity'",
  },
  {
    metric: "stock_movements.quantity is numeric",
    expected: "numeric",
    query:
      "select data_type from information_schema.columns where table_schema='public' and table_name='stock_movements' and column_name='quantity'",
  },
  {
    metric: "all 9 document quantity columns are numeric",
    expected: "9",
    query:
      "select count(*)::text from information_schema.columns where table_schema='public' and table_name in ('receipt_items','issue_items','requisition_items','requisition_return_items','defect_note_items','exchange_note_items','liquidation_items','repair_order_items','tool_borrowing_items') and column_name='quantity' and data_type='numeric'",
  },
  {
    metric: "no negative balances",
    expected: "0",
    query: "select count(*)::text from public.stock_balances where quantity < 0",
  },
  {
    metric: "no negative reservations",
    expected: "0",
    query: "select count(*)::text from public.stock_balances where reserved_quantity < 0",
  },
  {
    metric: "no missing document entered_quantity",
    expected: "0",
    query:
      "select count(*)::text from (select id from public.receipt_items where entered_quantity is null union all select id from public.issue_items where entered_quantity is null union all select id from public.requisition_items where entered_quantity is null union all select id from public.requisition_return_items where entered_quantity is null union all select id from public.defect_note_items where entered_quantity is null union all select id from public.exchange_note_items where entered_quantity is null union all select id from public.liquidation_items where entered_quantity is null union all select id from public.repair_order_items where entered_quantity is null union all select id from public.tool_borrowing_items where entered_quantity is null) x",
  },
  {
    metric: "movement idempotency unique index exists",
    expected: "1",
    query: "select count(*)::text from pg_indexes where schemaname='public' and indexname='stock_movements_idempotency_key_unique'",
  },
  {
    metric: "tracking tables exist",
    expected: "6",
    query:
      "select count(*)::text from information_schema.tables where table_schema='public' and table_name in ('inventory_lots','lot_stock_balances','serial_items','stock_movement_allocations','stock_reservations','stock_reservation_allocations')",
  },
  {
    metric: "reservation uniqueness constraint exists",
    expected: "1",
    query:
      "select count(*)::text from pg_constraint where conrelid='public.stock_reservations'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%source_document_line_id%' and pg_get_constraintdef(oid) ilike '%sku_id%'",
  },
  {
    metric: "append-only enforcement function installed",
    expected: "true",
    query: "select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='enforce_movement_append_only')::text",
  },
  {
    metric: "append-only enforcement NOT attached (old runtime boundary)",
    expected: "0",
    query: "select count(*)::text from pg_trigger where tgfoid=(select oid from pg_proc where proname='enforce_movement_append_only')",
  },
];

function psql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", CONTAINER, "psql", "-U", "postgres", "-d", DATABASE, "-t", "-A", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function main() {
  const failures: string[] = [];
  for (const check of CHECKS) {
    let actual: string;
    try {
      actual = psql(check.query);
    } catch (error) {
      actual = `ERROR: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
    }
    const ok = actual === check.expected;
    console.log(`${ok ? "PASS" : "FAIL"}  ${check.metric}`);
    if (!ok) {
      console.log(`        expected ${check.expected}, got ${actual}`);
      failures.push(check.metric);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`\nAll ${CHECKS.length} SKU posting foundation checks passed on ${DATABASE}.`);
}

main();
