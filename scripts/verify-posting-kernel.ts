// scripts/verify-posting-kernel.ts — Task 4 PostgreSQL kernel structural checks.
import { execFileSync } from "node:child_process";

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_minh-tan-phat-supply";
const DATABASE = process.argv[2] ?? "postgres";

const publicFunctions = [
  "post_inventory_movement(jsonb)",
  "reverse_inventory_movement(uuid,text,uuid)",
  "reverse_inventory_command(text,text,uuid)",
  "reserve_stock(jsonb)",
  "release_reservation(uuid,uuid)",
  "consume_reservation(uuid,numeric,uuid)",
  "post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text,uuid)",
  "post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text,uuid)",
  "post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text,uuid)",
  "post_reserved_issue(uuid,numeric,uuid,jsonb,text,uuid)",
  "post_receipt_command(jsonb)",
  "post_direct_issue_command(jsonb)",
  "post_transfer_command(jsonb)",
  "post_return_command(jsonb)",
  "post_defect_command(jsonb)",
  "post_repair_command(jsonb)",
  "post_liquidation_command(jsonb)",
  "post_stocktake_adjustment_command(jsonb)",
];

function sql(query: string) {
  return execFileSync(
    "docker",
    ["exec", CONTAINER, "psql", "-U", "postgres", "-d", DATABASE, "-t", "-A", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

const failures: string[] = [];
for (const signature of publicFunctions) {
  const exists = sql(`select to_regprocedure('public.${signature}') is not null`);
  const anon = sql(`select has_function_privilege('anon','public.${signature}','EXECUTE')`);
  const authenticated = sql(`select has_function_privilege('authenticated','public.${signature}','EXECUTE')`);
  const service = sql(`select has_function_privilege('service_role','public.${signature}','EXECUTE')`);
  const ok = exists === "t" && anon === "f" && authenticated === "f" && service === "t";
  console.log(`${ok ? "PASS" : "FAIL"}  ${signature} exists and is service-role-only`);
  if (!ok) {
    console.log(`        exists=${exists} anon=${anon} authenticated=${authenticated} service=${service}`);
    failures.push(signature);
  }
}

const appendTriggerCount = sql(
  "select count(*) from pg_trigger where tgfoid=(select oid from pg_proc where proname='enforce_movement_append_only')",
);
const oldRuntimeSafe = appendTriggerCount === "0";
console.log(`${oldRuntimeSafe ? "PASS" : "FAIL"}  append-only enforcement remains unattached`);
if (!oldRuntimeSafe) failures.push("append-only boundary");

if (failures.length) {
  console.error(`\n${failures.length} posting-kernel checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${publicFunctions.length + 1} posting-kernel structural checks passed on ${DATABASE}.`);
