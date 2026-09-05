// scripts/verify-defect-flow.ts — kiểm tra hỏng → sửa → nhập lại kho
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

async function main() {
  const api = createClient(URL, ANON);
  const mgr = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  if (mgr.error) throw new Error("sign-in failed");
  const mc = client(mgr.data.session!.access_token);
  const managerId = mgr.data.user!.id;

  const { data: variant } = await mc.from("variants").select("id").limit(1).single();
  const { data: main } = await mc.from("stock_locations").select("id").eq("code", "KHO_CHINH").single();
  const { data: hong } = await mc.from("stock_locations").select("id").eq("code", "KHO_HONG").single();
  const { data: sua } = await mc.from("stock_locations").select("id").eq("code", "KHO_DANG_SUA").single();

  async function bal(locId: string) {
    const r = await mc.from("stock_balances").select("quantity").eq("variant_id", variant!.id).eq("location_id", locId).maybeSingle();
    return r.data?.quantity ?? 0;
  }

  const mainBefore = await bal(main!.id);
  console.log("main before:", mainBefore);

  // 1. record defect (5)
  const defect = await mc.rpc("record_defect", {
    p_items: [{ variant_id: variant!.id, quantity: 5, damage_detail: "nứt", damage_type: "cracked", severity: "medium", images: [] }],
    p_source_loc: main!.id,
    p_by: managerId,
  });
  if (defect.error) throw defect.error;
  const defectId = defect.data as string;
  const { data: items } = await mc.from("defect_note_items").select("id").eq("defect_note_id", defectId);
  const itemId = items![0].id;
  console.log("1. defect recorded, main:", await bal(main!.id), "hong:", await bal(hong!.id));

  // 2. send to repair
  const rep = await mc.rpc("send_to_repair", {
    p_defect_item_ids: [itemId],
    p_vendor: "Xưởng sửa chữa ABC",
    p_sent_at: "2026-09-05",
    p_expected_return_at: "2026-09-10",
    p_by: managerId,
  });
  if (rep.error) throw rep.error;
  const repairId = rep.data as string;
  console.log("2. sent to repair, hong:", await bal(hong!.id), "sua:", await bal(sua!.id));

  // 3. complete repair → returned_to_stock
  const { data: repairItems } = await mc.from("repair_order_items").select("id").eq("repair_order_id", repairId);
  const done = await mc.rpc("complete_repair", {
    p_repair_id: repairId,
    p_outcomes: [{ repair_item_id: repairItems![0].id, outcome: "returned_to_stock", cost: 50000 }],
    p_by: managerId,
  });
  if (done.error) throw done.error;
  console.log("3. completed, main:", await bal(main!.id), "sua:", await bal(sua!.id));

  const led = await mc.from("stock_movements").select("movement_type").eq("variant_id", variant!.id).order("created_at", { ascending: false }).limit(3);
  console.log("ledger (3 gần nhất):", JSON.stringify(led.data?.map((l) => l.movement_type)));
  const ok = mainBefore === (await bal(main!.id));
  console.log(ok ? "PASS (stock về đúng)" : "FAIL");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
