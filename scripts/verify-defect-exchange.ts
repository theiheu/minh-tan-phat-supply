// scripts/verify-defect-exchange.ts — kiểm chứng nền dữ liệu cho luồng đổi vật tư hỏng.
// Chạy: bun run scripts/bootstrap.ts && bun run scripts/verify-defect-exchange.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SRV =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } });

function ok(c: boolean, m: string) {
  console.log(c ? "ok:" : "FAIL:", m);
  if (!c) process.exit(1);
}

const { data: reqs } = await admin.from("profiles").select("id, zone_id").eq("role", "requester").limit(1);
ok(!!reqs?.[0], "có requester (chạy scripts/bootstrap.ts trước nếu chưa)");

const { data: variants } = await admin.from("variants").select("id").limit(1);
ok((variants?.length ?? 0) > 0, "có biến thể vật tư");

const { data: locs } = await admin.from("stock_locations").select("id, name").limit(10);
ok((locs?.length ?? 0) > 0, "có kho/vị trí");

const { data: stock } = await admin
  .from("stock_balances")
  .select("variant_id, location_id, quantity")
  .gt("quantity", 0)
  .limit(1);
ok((stock?.length ?? 0) > 0, "có tồn kho > 0 (cho luồng ghi nhận hỏng/cấp phát)");

const { data: buckets } = await admin.storage.listBuckets();
ok(!!buckets?.some((b) => b.id === "defect-images"), "bucket defect-images tồn tại");

console.log("Nền dữ liệu OK — requester, variant, kho, tồn kho, bucket đều có.");
