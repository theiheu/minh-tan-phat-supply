// scripts/verify-transfers.ts — kiểm tra điều chuyển kho nội bộ & điều chỉnh tồn kho thủ công
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
  if (mgr.error) throw new Error(`manager sign-in failed: ${mgr.error.message}`);
  const mc = client(mgr.data.session!.access_token);
  const mgrId = mgr.data.user!.id;

  // 1) Lấy kho chính (KHO_CHINH) và kho hỏng/phụ (KHO_HONG hoặc kho khác)
  const { data: locs } = await mc.from("stock_locations").select("id, code, name").order("code");
  const mainLoc = locs?.find((l) => l.code === "KHO_CHINH");
  const destLoc = locs?.find((l) => l.id !== mainLoc?.id);
  if (!mainLoc || !destLoc) throw new Error("Không tìm thấy đủ 2 vị trí kho để test transfer");

  // 2) Chọn 1 SKU tiêu chuẩn có tồn > 10 tại kho chính
  const { data: stockRows } = await mc
    .from("stock_balances")
    .select("variant_id, quantity, variants(inventory_policy, tracking_policy, products(name))")
    .eq("location_id", mainLoc.id)
    .gt("quantity", 10);

  const cand = (stockRows ?? []).find((s) => {
    const v = Array.isArray(s.variants) ? s.variants[0] : s.variants;
    const policy = (v as { inventory_policy?: string | null } | null)?.inventory_policy;
    return policy === "normal" || !policy;
  });
  if (!cand) throw new Error("Không có SKU tiêu chuẩn nào tồn > 10 tại KHO_CHINH");
  const skuId = cand.variant_id;

  const getBalance = async (locId: string) => {
    const { data } = await mc
      .from("stock_balances")
      .select("quantity")
      .eq("variant_id", skuId)
      .eq("location_id", locId)
      .maybeSingle();
    return Number(data?.quantity ?? 0);
  };

  const TRANSFER_QTY = 3;
  const beforeSource = await getBalance(mainLoc.id);
  const beforeDest = await getBalance(destLoc.id);

  console.log(`Setup transfer: SKU ${skuId} from ${mainLoc.code} (${beforeSource}) to ${destLoc.code} (${beforeDest})`);

  // 3) Thực hiện transfer_stock
  const tfRes = await mc.rpc("transfer_stock", {
    p_items: [{ sku_id: skuId, entered_quantity: TRANSFER_QTY }],
    p_from_loc: mainLoc.id,
    p_to_loc: destLoc.id,
    p_by: mgrId,
  });
  if (tfRes.error) throw tfRes.error;

  const afterSource = await getBalance(mainLoc.id);
  const afterDest = await getBalance(destLoc.id);

  check("transfer_stock giảm đúng số lượng ở kho nguồn", afterSource === beforeSource - TRANSFER_QTY, `${beforeSource} → ${afterSource}`);
  check("transfer_stock tăng đúng số lượng ở kho đích", afterDest === beforeDest + TRANSFER_QTY, `${beforeDest} → ${afterDest}`);

  // 4) Kiểm tra sổ kho stock_movements
  const { data: movements } = await mc
    .from("stock_movements")
    .select("movement_type, ref_type, quantity, from_location_id, to_location_id")
    .eq("variant_id", skuId)
    .order("created_at", { ascending: false })
    .limit(5);

  const hasTransferMovements = (movements ?? []).some(
    (m) => m.ref_type === "transfer" && Number(m.quantity) === TRANSFER_QTY
  );
  check("stock_movements ghi nhận bút toán transfer", hasTransferMovements, JSON.stringify(movements?.slice(0, 2)));

  // 5) Negative test: chuyển kho vượt tồn khả dụng -> phải fail
  const overTf = await mc.rpc("transfer_stock", {
    p_items: [{ sku_id: skuId, entered_quantity: afterSource + 999 }],
    p_from_loc: mainLoc.id,
    p_to_loc: destLoc.id,
    p_by: mgrId,
  });
  check("transfer vượt tồn fail", !!overTf.error, overTf.error?.message);

  // 6) Negative test: chuyển kho cùng 1 vị trí (from == to) -> phải fail
  const sameLocTf = await mc.rpc("transfer_stock", {
    p_items: [{ sku_id: skuId, entered_quantity: 1 }],
    p_from_loc: mainLoc.id,
    p_to_loc: mainLoc.id,
    p_by: mgrId,
  });
  check("transfer cùng kho nguồn và đích fail", !!sameLocTf.error, sameLocTf.error?.message);

  // 7) Test adjust_stock (điều chỉnh thủ công)
  const preAdjust = await getBalance(destLoc.id);
  const ADJUST_DELTA = 2;
  const adjRes = await mc.rpc("adjust_stock", {
    p_variant_id: skuId,
    p_location_id: destLoc.id,
    p_delta: ADJUST_DELTA,
    p_reason: "Kiểm tra điều chỉnh thủ công tăng 2",
    p_by: mgrId,
  });
  if (adjRes.error) throw adjRes.error;
  const postAdjust = await getBalance(destLoc.id);
  check("adjust_stock tăng đúng delta", postAdjust === preAdjust + ADJUST_DELTA, `${preAdjust} → ${postAdjust}`);

  // 8) Test adjust_stock giảm
  const adjNegRes = await mc.rpc("adjust_stock", {
    p_variant_id: skuId,
    p_location_id: destLoc.id,
    p_delta: -ADJUST_DELTA,
    p_reason: "Kiểm tra điều chỉnh thủ công giảm 2",
    p_by: mgrId,
  });
  if (adjNegRes.error) throw adjNegRes.error;
  const postNegAdjust = await getBalance(destLoc.id);
  check("adjust_stock giảm đúng delta", postNegAdjust === postAdjust - ADJUST_DELTA, `${postAdjust} → ${postNegAdjust}`);

  // 9) Negative test: adjust thiếu lý do
  const noReasonAdj = await mc.rpc("adjust_stock", {
    p_variant_id: skuId,
    p_location_id: destLoc.id,
    p_delta: 1,
    p_reason: "   ",
    p_by: mgrId,
  });
  check("adjust_stock thiếu lý do fail", !!noReasonAdj.error, noReasonAdj.error?.message);

  console.log(`--- kết quả: ${failures === 0 ? "TẤT CẢ PASS" : `${failures} BƯỚC FAIL`} ---`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});