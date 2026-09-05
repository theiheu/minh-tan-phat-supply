// scripts/verify-requisition-flow.ts — kiểm tra luồng draft→pending→approved→issued→received
// Chạy: bun run scripts/verify-requisition-flow.ts
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

async function main() {
  const api = createClient(URL, ANON);
  const req = await api.auth.signInWithPassword({ email: "requester@mtp.local", password: "password123" });
  const mgr = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  if (req.error || mgr.error) throw new Error("sign-in failed");

  const reqToken = req.data.session!.access_token;
  const mgrToken = mgr.data.session!.access_token;
  const requesterId = req.data.user!.id;
  const managerId = mgr.data.user!.id;

  const rc = client(reqToken);
  const mc = client(mgrToken);

  const { data: zone } = await rc.from("zones").select("id").limit(1).single();
  const { data: variant } = await rc.from("variants").select("id").limit(1).single();
  const stockBefore = await rc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();

  // 1. create draft
  const created = await rc.rpc("create_requisition", {
    p_items: [{ variant_id: variant!.id, quantity: 5 }],
    p_zone_id: zone!.id,
    p_purpose: "Kiểm tra luồng",
    p_type: "new_supply",
    p_linked_defect_id: null,
    p_requester_id: requesterId,
  });
  if (created.error) throw created.error;
  const rid = created.data as string;
  console.log("1. draft created:", rid);

  // 2. submit
  const s = await rc.rpc("submit_requisition", { p_id: rid });
  if (s.error) throw s.error;
  console.log("2. submitted");

  // 3. approve (manager)
  const a = await mc.rpc("approve_requisition", { p_id: rid, p_by: managerId });
  if (a.error) throw a.error;
  console.log("3. approved");

  // 4. fulfill (manager)
  const f = await mc.rpc("fulfill_requisition", { p_id: rid, p_by: managerId, p_notes: "test" });
  if (f.error) throw f.error;
  console.log("4. fulfilled");

  // double fulfill must fail
  const f2 = await mc.rpc("fulfill_requisition", { p_id: rid, p_by: managerId, p_notes: "" });
  console.log("   double fulfill rejected:", f2.error?.message ?? "UNEXPECTED SUCCESS");

  // 5. receive (requester)
  const r = await rc.rpc("receive_requisition", { p_id: rid, p_by: requesterId });
  if (r.error) throw r.error;
  console.log("5. received");

  const stockAfter = await rc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();
  const reqRow = await rc.from("requisitions").select("status").eq("id", rid).single();
  const led = await rc.from("stock_movements").select("movement_type, quantity").eq("ref_id", rid);

  console.log("--- kết quả ---");
  console.log("stock before:", stockBefore.data?.quantity, "→ after:", stockAfter.data?.quantity, "(trừ 5)");
  console.log("final status:", reqRow.data?.status);
  console.log("ledger:", JSON.stringify(led.data));
  console.log(stockBefore.data!.quantity - 5 === stockAfter.data!.quantity && reqRow.data?.status === "received" ? "PASS" : "FAIL");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
