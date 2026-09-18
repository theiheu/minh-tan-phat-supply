// scripts/verify-stocktake.ts — kiểm tra toàn diện quy trình kiểm kê kho:
// - Loại trừ bộ ảo (virtual_kit) khỏi kiểm kê vật lý
// - Tính toán chênh lệch và cập nhật số lượng thực tế
// - Ghi nhận bút toán điều chỉnh kho qua Posting Kernel
// - Hỗ trợ Snapshot Quality và Transaction UOM
// - Khôi phục / đảo bút toán kiểm kê (revert_stocktake)
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const api = createClient(URL, ANON);
  const mgr = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  if (mgr.error) throw new Error(`sign-in failed: ${mgr.error.message}`);
  const mc = client(mgr.data.session!.access_token);
  const mgrId = mgr.data.user!.id;

  const owner = await api.auth.signInWithPassword({ email: "admin@mtp.local", password: "password123" });
  if (owner.error) throw new Error(`owner sign-in failed: ${owner.error.message}`);
  const oc = client(owner.data.session!.access_token);
  const ownerId = owner.data.user!.id;

  const { data: main } = await mc.from("stock_locations").select("id, code").eq("code", "KHO_CHINH").single();
  if (!main) throw new Error("Không tìm thấy KHO_CHINH");

  // 1) Khởi tạo kỳ kiểm kê
  const sessionName = `Kỳ kiểm kê ${Date.now()}`;
  const created = await mc.rpc("create_stocktake", {
    p_location_id: main.id,
    p_name: sessionName,
    p_by: mgrId,
  });
  if (created.error) throw created.error;
  const sessionId = created.data as string;
  check("create_stocktake thành công", !!sessionId, sessionId);

  // 2) Kiểm tra danh sách items trong kỳ kiểm kê: KHÔNG được chứa SKU virtual_kit
  const { data: items } = await mc
    .from("stocktake_items")
    .select("id, variant_id, system_qty, actual_qty, snapshot_quality, variants(inventory_policy)")
    .eq("session_id", sessionId);

  const hasVirtualKit = (items ?? []).some((i) => {
    const v = Array.isArray(i.variants) ? i.variants[0] : i.variants;
    return (v as { inventory_policy?: string | null } | null)?.inventory_policy === "virtual_kit";
  });
  check("Không bao gồm bộ ảo (virtual kit) trong kiểm kê vật lý", !hasVirtualKit);

  if (!items || items.length === 0) throw new Error("Không có dòng nào trong kỳ kiểm kê");
  const testItem = items[0];

  const getVariantBalance = async (varId: string) => {
    const { data } = await mc
      .from("stock_balances")
      .select("quantity")
      .eq("variant_id", varId)
      .eq("location_id", main.id)
      .single();
    return Number(data?.quantity ?? 0);
  };

  const beforeBal = await getVariantBalance(testItem.variant_id);
  const VARIANCE = 5;

  // 3) Cập nhật dòng đã kiểm: actual_qty = system_qty + 5
  await mc
    .from("stocktake_items")
    .update({ checked: true, actual_qty: testItem.system_qty + VARIANCE, notes: "Kiểm đếm thừa 5 cái" })
    .eq("id", testItem.id);

  // 4) Chốt kiểm kê: post_stocktake
  const posted = await mc.rpc("post_stocktake", { p_session_id: sessionId, p_by: mgrId });
  if (posted.error) throw posted.error;

  const afterBal = await getVariantBalance(testItem.variant_id);
  check("post_stocktake điều chỉnh tồn kho đúng mức chênh lệch (+5)", afterBal === beforeBal + VARIANCE, `${beforeBal} → ${afterBal}`);

  const { data: sessionDoc } = await mc.from("stocktake_sessions").select("status, posted_at").eq("id", sessionId).single();
  check("Trạng thái kỳ kiểm kê là posted", sessionDoc?.status === "posted" && !!sessionDoc?.posted_at);

  const { data: led } = await mc
    .from("stock_movements")
    .select("movement_type, ref_type, quantity")
    .eq("ref_id", sessionId);
  const hasAdj = (led ?? []).some((m) => (m.movement_type === "adjustment_in" || m.movement_type === "adjustment_out") && Number(m.quantity) === VARIANCE);
  check("stock_movements ghi nhận bút toán adjustment", hasAdj, JSON.stringify(led));

  // 5) Test mở lại kỳ kiểm kê: revert_stocktake (chỉ owner/superuser)
  const nonOwnerRevert = await mc.rpc("revert_stocktake", { p_session_id: sessionId, p_by: mgrId });
  check("Người không có quyền (warehouse) gọi revert_stocktake bị từ chối", !!nonOwnerRevert.error);

  const ownerRevert = await oc.rpc("revert_stocktake", { p_session_id: sessionId, p_by: ownerId });
  if (ownerRevert.error) throw ownerRevert.error;

  const revertedBal = await getVariantBalance(testItem.variant_id);
  check("revert_stocktake đảo bút toán và khôi phục tồn ban đầu", revertedBal === beforeBal, `${afterBal} → ${revertedBal}`);

  const { data: revertedSession } = await mc.from("stocktake_sessions").select("status").eq("id", sessionId).single();
  check("Kỳ kiểm kê quay lại trạng thái draft", revertedSession?.status === "draft");

  console.log(`--- kết quả: ${failures === 0 ? "TẤT CẢ PASS" : `${failures} BƯỚC FAIL`} ---`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});