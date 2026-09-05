// scripts/verify-return-history.ts — kiểm chứng luồng trả lại vật tư ghi lịch sử.
// Chạy: bun run scripts/bootstrap.ts && bun run scripts/verify-return-history.ts
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}
function ok(c: boolean, m: string) {
  console.log(c ? "ok:" : "FAIL:", m);
  if (!c) process.exit(1);
}

const api = createClient(URL, ANON);
const r = await api.auth.signInWithPassword({ email: "requester@mtp.local", password: "password123" });
const m = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
if (r.error || m.error) throw new Error("sign-in failed");
const rc = client(r.data.session!.access_token);
const mc = client(m.data.session!.access_token);
const requesterId = r.data.user!.id;
const managerId = m.data.user!.id;

const { data: zone } = await rc.from("zones").select("id").limit(1).single();
const { data: variant } = await rc.from("variants").select("id").limit(1).single();
ok(!!zone?.id && !!variant?.id, "có zone + variant");

const created = await rc.rpc("create_requisition", {
  p_items: [{ variant_id: variant!.id, quantity: 5 }],
  p_zone_id: zone!.id,
  p_purpose: "Verify lịch sử trả lại",
  p_type: "new_supply",
  p_linked_defect_id: null,
  p_requester_id: requesterId,
});
if (created.error) throw created.error;
const rid = created.data as string;
if ((await rc.rpc("submit_requisition", { p_id: rid })).error) throw new Error("submit fail");
if ((await mc.rpc("approve_requisition", { p_id: rid, p_by: managerId })).error) throw new Error("approve fail");
if ((await mc.rpc("fulfill_requisition", { p_id: rid, p_by: managerId, p_notes: "verify" })).error)
  throw new Error("fulfill fail");

// Trả 2/5 (requester — owner được quyền trả theo 0023)
const ret = await rc.rpc("return_requisition_items", {
  p_requisition_id: rid,
  p_items: [{ variant_id: variant!.id, quantity: 2 }],
  p_by: requesterId,
});
if (ret.error) throw ret.error;
console.log("đã trả 2/5");

// Trả vượt (4 > còn lại 3) phải bị chặn
const over = await rc.rpc("return_requisition_items", {
  p_requisition_id: rid,
  p_items: [{ variant_id: variant!.id, quantity: 4 }],
  p_by: requesterId,
});
ok(!!over.error, "trả vượt số còn lại bị chặn: " + (over.error?.message ?? ""));

// Lịch sử: requester (owner) đọc được
const { data: events, error: evErr } = await rc
  .from("requisition_returns")
  .select("id, returned_by, items:requisition_return_items(variant_id, quantity)")
  .eq("requisition_id", rid);
ok(!evErr, "requester đọc được requisition_returns");
ok(events?.length === 1, `có đúng 1 sự kiện trả (thực tế ${events?.length})`);
const totalReturned = (events?.[0] as { items?: { quantity: number }[] } | undefined)?.items?.reduce(
  (n, x) => n + x.quantity, 0);
ok(totalReturned === 2, `tổng số lượng trả = 2 (thực tế ${totalReturned})`);

// stock_movements có return_in đúng 2
const { data: mv } = await mc
  .from("stock_movements")
  .select("movement_type, quantity")
  .eq("ref_type", "requisition")
  .eq("ref_id", rid)
  .eq("movement_type", "return_in");
ok((mv ?? []).reduce((n, x) => n + x.quantity, 0) === 2, "stock_movements return_in tổng = 2");

console.log("PASS");
