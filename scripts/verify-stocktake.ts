// scripts/verify-stocktake.ts — kiểm kê tạo điều chỉnh đúng
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

async function main() {
  const api = createClient(URL, ANON);
  const mgr = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  if (mgr.error) throw new Error("sign-in failed");
  const mc = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${mgr.data.session!.access_token}` } } });

  const { data: main } = await mc.from("stock_locations").select("id").eq("code", "KHO_CHINH").single();
  const created = await mc.rpc("create_stocktake", { p_location_id: main!.id, p_name: `Verify ${new Date().toISOString()}`, p_by: mgr.data.user!.id });
  if (created.error) throw created.error;
  const sessionId = created.data as string;
  const { data: items } = await mc.from("stocktake_items").select("id, variant_id, system_qty").eq("session_id", sessionId).limit(1);
  const item = items![0];

  const before = await mc.from("variant_stock").select("quantity").eq("variant_id", item.variant_id).single();

  await mc.from("stocktake_items").update({ checked: true, actual_qty: item.system_qty + 5 }).eq("id", item.id);
  const posted = await mc.rpc("post_stocktake", { p_session_id: sessionId, p_by: mgr.data.user!.id });
  if (posted.error) throw posted.error;

  const after = await mc.from("variant_stock").select("quantity").eq("variant_id", item.variant_id).single();
  const session = await mc.from("stocktake_sessions").select("status").eq("id", sessionId).single();
  const led = await mc.from("stock_movements").select("movement_type, quantity").eq("ref_id", sessionId);

  console.log("stock:", before.data?.quantity, "→", after.data?.quantity, "(+5 điều chỉnh)");
  console.log("session status:", session.data?.status);
  console.log("ledger:", JSON.stringify(led.data));
  console.log(before.data!.quantity + 5 === after.data!.quantity && session.data?.status === "posted" ? "PASS" : "FAIL");
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
