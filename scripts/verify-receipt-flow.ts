// scripts/verify-receipt-flow.ts — kiểm tra nhập kho + auto cấp phát + ledger
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
  const { data: variant } = await rc.from("variants").select("id").limit(1).single();
  const stockBefore = await rc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();

  // requester tạo + gửi phiếu yêu cầu 10
  const created = await rc.rpc("create_requisition", {
    p_items: [{ variant_id: variant!.id, quantity: 10 }],
    p_zone_id: zone!.id,
    p_purpose: "Nhập để cấp phát",
    p_type: "new_supply",
    p_linked_defect_id: null,
    p_requester_id: req.data.user!.id,
  });
  if (created.error) throw created.error;
  const rid = created.data as string;
  await rc.rpc("submit_requisition", { p_id: rid });
  console.log("requisition pending:", rid);

  // manager tạo + post phiếu nhập 50 (kèm ghi chú)
  const NOTE = "Nhập bổ sung cho khu vực cấp phát — kiểm thử ghi chú";
  const receipt = await mc.rpc("create_receipt", {
    p_items: [{ variant_id: variant!.id, quantity: 50, unit_cost: 1000, batch_no: null, expiry_date: null }],
    p_supplier_id: null,
    p_notes: NOTE,
    p_by: mgr.data.user!.id,
  });
  if (receipt.error) throw receipt.error;
  const receiptId = receipt.data as string;
  const posted = await mc.rpc("post_receipt", { p_id: receiptId, p_by: mgr.data.user!.id });
  if (posted.error) throw posted.error;
  console.log("receipt posted, linked requisitions:", JSON.stringify(posted.data));

  // --- kiểm tra nội dung phục vụ trang chi tiết phiếu nhập ---
  const detailRow = await mc
    .from("receipts")
    .select("status, notes, linked_requisition_ids")
    .eq("id", receiptId)
    .single();
  const notesOk = (detailRow.data?.notes ?? null) === NOTE;
  const linkedOk = (detailRow.data?.linked_requisition_ids ?? []).includes(rid);
  const audit = await mc
    .from("audit_logs")
    .select("action")
    .eq("entity_type", "receipt")
    .eq("entity_id", receiptId)
    .in("action", ["receipt.create", "receipt.post"]);
  const auditOk = (audit.data ?? []).some((a) => a.action === "receipt.post");
  console.log("receipt notes:", JSON.stringify(detailRow.data?.notes ?? null), "(expected saved:", NOTE, ")");
  console.log("linked_requisition_ids:", JSON.stringify(detailRow.data?.linked_requisition_ids ?? []), "includes rid:", linkedOk);
  console.log("audit receipt events:", JSON.stringify((audit.data ?? []).map((a) => a.action)), "has post:", auditOk);

  // Regression: gọi create_receipt KHÔNG kèm p_notes (3 tham số) — trước đây bị
  // lỗi overload 'Could not choose the best candidate function'.
  const noNotes = await mc.rpc("create_receipt", {
    p_items: [{ variant_id: variant!.id, quantity: 1, unit_cost: null, batch_no: null, expiry_date: null }],
    p_supplier_id: null,
    p_by: mgr.data.user!.id,
  });
  if (noNotes.error) throw noNotes.error;
  const noNotesId = noNotes.data as string;
  const cancelled = await mc.rpc("cancel_receipt", { p_id: noNotesId, p_by: mgr.data.user!.id });
  if (cancelled.error) throw cancelled.error;
  console.log("create_receipt without p_notes (3 args): OK");

  const stockAfter = await rc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();
  const reqRow = await rc.from("requisitions").select("status").eq("id", rid).single();
  const receiptRow = await mc.from("receipts").select("status").eq("id", receiptId).single();
  const led = await mc.from("stock_movements").select("movement_type, quantity").eq("ref_id", receiptId);

  console.log("--- kết quả ---");
  console.log("stock:", stockBefore.data?.quantity, "→", stockAfter.data?.quantity, "(+50 nhập, -10 cấp phát)");
  console.log("requisition status:", reqRow.data?.status, "(expected issued)");
  console.log("receipt status:", receiptRow.data?.status, "(expected posted)");
  console.log("receipt ledger:", JSON.stringify(led.data));
  const ok =
    stockBefore.data!.quantity + 40 === stockAfter.data!.quantity &&
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
