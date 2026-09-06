// scripts/verify-issue-flow.ts — kiểm tra phiếu xuất kho: create/post/cancel,
// trừ tồn + ledger issue_out, chặn post quá tồn, state machine draft→posted/cancelled.
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

  // 0) chuẩn bị: main location (KHO_CHINH), 1 variant lá có tồn > 0
  const { data: mainLoc } = await mc.from("stock_locations").select("id").eq("code", "KHO_CHINH").single();
  if (!mainLoc) throw new Error("không tìm thấy KHO_CHINH");
  const { data: parents } = await mc.from("variant_components").select("parent_variant_id");
  const parentSet = new Set((parents ?? []).map((r) => r.parent_variant_id as string));
  const { data: stockRows } = await mc
    .from("stock_balances")
    .select("variant_id, quantity")
    .eq("location_id", mainLoc.id)
    .gt("quantity", 10);
  const cand = (stockRows ?? [])
    .filter((s) => !parentSet.has(s.variant_id as string))
    .sort((a, b) => (b.quantity as number) - (a.quantity as number))[0];
  if (!cand) throw new Error("không có variant lá nào tồn > 10 tại KHO_CHINH");
  const variantId = cand.variant_id as string;
  const balanceAt = async () => {
    const { data } = await mc
      .from("stock_balances")
      .select("quantity")
      .eq("variant_id", variantId)
      .eq("location_id", mainLoc.id)
      .single();
    return data?.quantity as number;
  };
  console.log(`setup: variant ${variantId} @ KHO_CHINH, tồn = ${await balanceAt()}`);

  // 1) tạo khách hàng (insert trực tiếp — manager)
  const { data: cust, error: custErr } = await mc
    .from("customers")
    .insert({ name: `Khách kiểm thử ${Date.now()}`, phone: "0900000000", address: "TP.HCM" })
    .select("id")
    .single();
  if (custErr) throw custErr;
  const customerId = cust!.id as string;
  check("tạo khách hàng qua insert trực tiếp", !!customerId, customerId);

  // 2) create_issue draft (destination customer, unit_price 15000)
  const ISSUE_QTY = 2;
  const beforeCreate = await balanceAt();
  const created = await mc.rpc("create_issue", {
    p_items: [{ variant_id: variantId, quantity: ISSUE_QTY, unit_price: 15000 }],
    p_destination_type: "customer",
    p_zone_id: null,
    p_customer_id: customerId,
    p_vehicle_plate: "51A-123.45",
    p_driver_name: "Tài xế A",
    p_notes: "verify issue flow",
    p_by: mgrId,
  });
  if (created.error) throw created.error;
  const issueId = created.data as string;
  const issueRow = await mc.from("issues").select("code, status, destination_type, customer_id").eq("id", issueId).single();
  const code = issueRow.data?.code ?? "";
  check("create_issue trả code PXK-xxxx", /^PXK-\d{4}$/.test(code), code);
  check("phiếu draft, destination customer", issueRow.data?.status === "draft" && issueRow.data?.destination_type === "customer" && issueRow.data?.customer_id === customerId);
  const afterCreate = await balanceAt();
  check("tạo draft không đổi tồn", afterCreate === beforeCreate, `${beforeCreate} → ${afterCreate}`);
  const item = await mc.from("issue_items").select("variant_id, quantity, unit_price").eq("issue_id", issueId).single();
  check("issue_items ghi đúng item + unit_price 15000", item.data?.variant_id === variantId && item.data?.quantity === ISSUE_QTY && Number(item.data?.unit_price) === 15000, JSON.stringify(item.data));

  // 3) post_issue → trừ tồn đúng qty + ledger issue_out + status posted
  const beforePost = await balanceAt();
  const posted = await mc.rpc("post_issue", { p_id: issueId, p_by: mgrId });
  if (posted.error) throw posted.error;
  const afterPost = await balanceAt();
  check("post_issue: tồn giảm đúng ISSUE_QTY", afterPost === beforePost - ISSUE_QTY, `${beforePost} → ${afterPost}`);
  const led = await mc.from("stock_movements").select("movement_type, ref_type, ref_id, quantity").eq("ref_id", issueId);
  const ledOk = (led.data ?? []).some(
    (m) => m.movement_type === "issue_out" && m.ref_type === "issue" && m.ref_id === issueId && m.quantity === ISSUE_QTY
  );
  check("stock_movements có dòng issue_out/issue/issue_id", ledOk, JSON.stringify(led.data));
  const postedRow = await mc.from("issues").select("status").eq("id", issueId).single();
  check("phiếu chuyển sang posted", postedRow.data?.status === "posted");

  // 4) post_issue lần 2 phải fail (status không còn draft)
  const repost = await mc.rpc("post_issue", { p_id: issueId, p_by: mgrId });
  check("post_issue lần 2 fail (không phải draft)", !!repost.error, repost.error?.message ?? "no error");

  // 5) phiếu xuất destination zone vượt tồn → post fail, tồn không đổi, vẫn draft
  const { data: zone } = await mc.from("zones").select("id").limit(1).single();
  if (!zone) throw new Error("không tìm thấy zone");
  const balNow = await balanceAt();
  const overQty = balNow + 5; // chắc chắn vượt tồn hiện tại
  const zoneIssue = await mc.rpc("create_issue", {
    p_items: [{ variant_id: variantId, quantity: overQty, unit_price: 10000 }],
    p_destination_type: "zone",
    p_zone_id: zone.id,
    p_customer_id: null,
    p_vehicle_plate: null,
    p_driver_name: null,
    p_notes: "verify vượt tồn",
    p_by: mgrId,
  });
  if (zoneIssue.error) throw zoneIssue.error;
  const zoneIssueId = zoneIssue.data as string;
  const balPreFail = await balanceAt();
  const overPost = await mc.rpc("post_issue", { p_id: zoneIssueId, p_by: mgrId });
  check("post phiếu vượt tồn fail", !!overPost.error, overPost.error?.message ?? "no error");
  check("lỗi đúng 'Không đủ tồn'", /Không đủ tồn/.test(overPost.error?.message ?? ""), overPost.error?.message ?? "no error");
  const balPostFail = await balanceAt();
  check("tồn không đổi khi post fail", balPostFail === balPreFail, `${balPreFail} → ${balPostFail}`);
  const zoneRow = await mc.from("issues").select("status, destination_type, zone_id").eq("id", zoneIssueId).single();
  check("phiếu vượt tồn vẫn draft (zone)", zoneRow.data?.status === "draft" && zoneRow.data?.destination_type === "zone" && zoneRow.data?.zone_id === zone.id);

  // 6) cancel draft OK → cancelled; cancel posted fail
  const cancDraft = await mc.rpc("cancel_issue", { p_id: zoneIssueId, p_by: mgrId });
  check("cancel phiếu draft OK", !cancDraft.error, cancDraft.error?.message ?? "");
  const cancRow = await mc.from("issues").select("status").eq("id", zoneIssueId).single();
  check("phiếu draft → cancelled", cancRow.data?.status === "cancelled");
  const cancPosted = await mc.rpc("cancel_issue", { p_id: issueId, p_by: mgrId });
  check("cancel phiếu posted fail", !!cancPosted.error, cancPosted.error?.message ?? "no error");

  console.log(`--- kết quả: ${failures === 0 ? "TẤT CẢ PASS" : `${failures} BƯỚC FAIL`} ---`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
