// scripts/verify-receipt-flow.ts — kiểm tra nhập kho + auto cấp phát + ledger
// Quy tắc mới: post_receipt CHỈ tự động cấp phát các phiếu yêu cầu ĐÃ ĐƯỢC DUYỆT (approved).
// Các phiếu yêu cầu đang chờ (pending) bắt buộc phải qua bước Quản kho duyệt trước.
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
  const rc = client(req.data.session!.access_token);
  const mc = client(mgr.data.session!.access_token);

  const { data: zone } = await rc.from("zones").select("id").limit(1).single();
  const { data: variant } = await rc.from("skus").select("id").limit(1).single();
  const { data: tuom } = await rc.from("sku_transaction_units").select("id, factor_to_base").eq("sku_id", variant!.id).eq("is_base", true).limit(1).single();
  // Pre-test cleanup: cancel all previously-approved requisitions for test isolation
  const { data: leftoverApproved } = await mc.from("requisitions")
    .select("id").eq("status","approved");
  for (const r of leftoverApproved ?? []) {
    await mc.rpc("cancel_requisition", { p_id: r.id, p_by: mgr.data.user!.id });
  }
  const { data: leftoverPendingReqs } = await rc.from("requisitions")
    .select("id").eq("status","pending");
  for (const r of leftoverPendingReqs ?? []) {
    await rc.rpc("cancel_requisition", { p_id: r.id, p_by: req.data.user!.id });
  }

  const stockInitial = await rc.from("sku_stock").select("quantity").eq("sku_id", variant!.id).single();

  // 1. requester tạo + gửi phiếu yêu cầu 10 (chờ duyệt - pending)
  const created = await rc.rpc("create_requisition", {
    p_items: [{ sku_id: variant!.id, entered_quantity: 10, transaction_unit_id: tuom!.id }],
    p_zone_id: zone!.id,
    p_purpose: "Nhập để cấp phát",
    p_type: "new_supply",
    p_linked_defect_id: null,
    p_requester_id: req.data.user!.id,
    p_sub_zone_id: null,
  });
  if (created.error) throw created.error;
  const rid = created.data as string;
  await rc.rpc("submit_requisition", { p_id: rid });
  console.log("1. Requisition submitted (pending):", rid);

  // 2. manager tạo + post phiếu nhập 20 KHI PHIẾU YÊU CẦU CHƯA DUYỆT (pending)
  // Kết quả mong đợi: post_receipt KHÔNG tự động duyệt hay cấp phát phiếu pending này.
  const NOTE = "Nhập bổ sung cho khu vực cấp phát — kiểm thử ghi chú";
  const receipt1 = await mc.rpc("create_receipt", {
    p_items: [{ sku_id: variant!.id, entered_quantity: 20, transaction_unit_id: tuom!.id, unit_cost: 1000, allocations: null }],
    p_supplier_id: null,
    p_notes: NOTE,
    p_by: mgr.data.user!.id,
  });
  if (receipt1.error) throw receipt1.error;
  const receipt1Id = receipt1.data as string;
  const posted1 = await mc.rpc("post_receipt", { p_id: receipt1Id, p_by: mgr.data.user!.id });
  if (posted1.error) throw posted1.error;
  console.log("2. Receipt 1 posted (while req pending), linked requisitions:", JSON.stringify(posted1.data));

  const reqRowPending = await rc.from("requisitions").select("status").eq("id", rid).single();
  const linkedNotIncluded = !(posted1.data ?? []).includes(rid);
  console.log("   Req status remains pending:", reqRowPending.data?.status === "pending", "(status:", reqRowPending.data?.status, ")");

  // 3. Quản kho xem xét và BẤM DUYỆT PHIẾU YÊU CẦU (approve_requisition) -> status = 'approved'
  const approved = await mc.rpc("approve_requisition", { p_id: rid, p_by: mgr.data.user!.id });
  if (approved.error) throw approved.error;
  console.log("3. Manager approved requisition -> status = approved");

  // 4. Nhập tiếp phiếu nhập 2 (quantity: 30). Lúc này phiếu yêu cầu ĐÃ DUYỆT (approved).
  // Kết quả mong đợi: post_receipt tự động cấp phát phiếu yêu cầu đã duyệt này!
  const receipt2 = await mc.rpc("create_receipt", {
    p_items: [{ sku_id: variant!.id, entered_quantity: 30, transaction_unit_id: tuom!.id, unit_cost: 1000, allocations: null }],
    p_supplier_id: null,
    p_notes: NOTE,
    p_by: mgr.data.user!.id,
  });
  if (receipt2.error) throw receipt2.error;
  const receipt2Id = receipt2.data as string;
  const posted2 = await mc.rpc("post_receipt", { p_id: receipt2Id, p_by: mgr.data.user!.id });
  if (posted2.error) throw posted2.error;
  console.log("4. Receipt 2 posted (while req approved), linked requisitions:", JSON.stringify(posted2.data));

  // --- kiểm tra nội dung phục vụ trang chi tiết phiếu nhập ---
  const detailRow = await mc
    .from("receipts")
    .select("status, notes, linked_requisition_ids")
    .eq("id", receipt2Id)
    .single();
  const notesOk = (detailRow.data?.notes ?? null) === NOTE;
  const linkedOk = (detailRow.data?.linked_requisition_ids ?? []).includes(rid);
  const audit = await mc
    .from("audit_logs")
    .select("action")
    .eq("entity_type", "receipt")
    .eq("entity_id", receipt2Id)
    .in("action", ["receipt.create", "receipt.post"]);
  const auditOk = (audit.data ?? []).some((a) => a.action === "receipt.post");
  console.log("receipt notes:", JSON.stringify(detailRow.data?.notes ?? null), "(expected saved:", NOTE, ")");
  console.log("linked_requisition_ids:", JSON.stringify(detailRow.data?.linked_requisition_ids ?? []), "includes rid:", linkedOk);
  console.log("audit receipt events:", JSON.stringify((audit.data ?? []).map((a) => a.action)), "has post:", auditOk);

  // Regression: gọi create_receipt KHÔNG kèm p_notes (3 tham số)
  const noNotes = await mc.rpc("create_receipt", {
    p_items: [{ sku_id: variant!.id, entered_quantity: 1, transaction_unit_id: tuom!.id, unit_cost: null, allocations: null }],
    p_supplier_id: null,
    p_by: mgr.data.user!.id,
  });
  if (noNotes.error) throw noNotes.error;
  const noNotesId = noNotes.data as string;
  const cancelled = await mc.rpc("cancel_receipt", { p_id: noNotesId, p_by: mgr.data.user!.id });
  if (cancelled.error) throw cancelled.error;
  console.log("create_receipt without p_notes (3 args): OK");

  const stockAfter = await rc.from("sku_stock").select("quantity").eq("sku_id", variant!.id).single();
  const reqRow = await rc.from("requisitions").select("status").eq("id", rid).single();
  const receiptRow = await mc.from("receipts").select("status").eq("id", receipt2Id).single();
  const led = await mc.from("stock_movements").select("movement_type, quantity").eq("ref_id", receipt2Id);

  console.log("--- kết quả ---");
  console.log("stock:", stockInitial.data?.quantity, "→", stockAfter.data?.quantity, "(+20 nhập 1, +30 nhập 2, -10 cấp phát = +40)");
  console.log("requisition final status:", reqRow.data?.status, "(expected issued)");
  console.log("receipt final status:", receiptRow.data?.status, "(expected posted)");
  console.log("receipt ledger:", JSON.stringify(led.data));
  const ok =
    stockInitial.data!.quantity + 40 === stockAfter.data!.quantity &&
    reqRowPending.data?.status === "pending" &&
    linkedNotIncluded &&
    reqRow.data?.status === "issued" &&
    receiptRow.data?.status === "posted" &&
    (led.data?.length ?? 0) >= 1 &&
    notesOk &&
    linkedOk &&
    auditOk;
  console.log(ok ? "PASS" : "FAIL");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
