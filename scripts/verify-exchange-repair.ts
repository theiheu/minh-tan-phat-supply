// scripts/verify-exchange-repair.ts — kiểm tra phiếu Đổi Mới (DM) + đề nghị sửa
// Chạy: bun run scripts/bootstrap.ts (1 lần) rồi bun run scripts/verify-exchange-repair.ts
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function client(token: string) {
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

let fails = 0;
function ok(cond: boolean, msg: string) {
  console.log(cond ? "ok:" : "FAIL:", msg);
  if (!cond) fails++;
}

async function main() {
  const api = createClient(URL, ANON);
  const req = await api.auth.signInWithPassword({ email: "requester@mtp.local", password: "password123" });
  const mgr = await api.auth.signInWithPassword({ email: "manager@mtp.local", password: "password123" });
  if (req.error || mgr.error) throw new Error("sign-in failed");
  const rc = client(req.data.session!.access_token);
  const mc = client(mgr.data.session!.access_token);
  const requesterId = req.data.user!.id;
  const managerId = mgr.data.user!.id;

  // Dữ liệu nền: variant có tồn + kho chính
  const { data: variant } = await rc.from("variants").select("id").limit(1).single();
  const { data: mainLoc } = await mc.from("stock_locations").select("id").eq("code", "KHO_CHINH").single();
  const { data: srcLoc } = await mc
    .from("stock_locations")
    .select("id")
    .eq("code", "KHO_CHINH")
    .single();

  // Bơm tồn cho variant (nếu thiếu) qua RPC adjust_stock để chắc chắn đủ
  await mc.rpc("adjust_stock", {
    p_variant_id: variant!.id,
    p_location_id: mainLoc!.id,
    p_delta: 100,
    p_reason: "verify-exchange-repair seed",
    p_by: managerId,
  });

  // 1. Lập HONG staging đủ ảnh
  const defect = await rc.rpc("record_defect", {
    p_items: [{ variant_id: variant!.id, quantity: 2, damage_detail: "Nứt vỡ", damage_type: "broken", severity: "medium", images: ["https://example.com/broken.jpg"] }],
    p_source_loc: srcLoc!.id,
    p_by: requesterId,
  });
  if (defect.error) throw defect.error;
  const noteId = defect.data as string;
  ok(!!noteId, "tạo HONG staging");

  // 2. Tạo phiếu Đổi Mới (requester)
  const ex = await rc.rpc("create_exchange", { p_defect_id: noteId, p_by: requesterId });
  ok(!ex.error, "create_exchange: " + (ex.error?.message ?? "ok"));
  const exId = ex.data as string;
  const { data: exRow } = await rc.from("exchange_notes").select("code, status").eq("id", exId).single();
  ok(exRow?.status === "pending" && /^DM-/.test(exRow?.code ?? ""), `DM pending với mã ${exRow?.code}`);

  // 3. Trùng: tạo DM lần 2 phải bị chặn (unique)
  const dup = await rc.rpc("create_exchange", { p_defect_id: noteId, p_by: requesterId });
  ok(!!dup.error, "create_exchange lần 2 bị chặn: " + (dup.error?.message ?? "UNEXPECTED SUCCESS"));

  // 4. Đề nghị sửa khi đang có DM sống → bị chặn
  const reqRepairBlocked = await rc.rpc("request_repair", { p_id: noteId, p_by: requesterId });
  ok(!!reqRepairBlocked.error, "request_repair bị chặn khi có DM: " + (reqRepairBlocked.error?.message ?? "UNEXPECTED SUCCESS"));

  // 5. Manager duyệt
  const approve = await mc.rpc("approve_exchange", { p_id: exId, p_by: managerId });
  ok(!approve.error, "approve_exchange");
  // 6. Requester không duyệt được (manager-only)
  const approveReq = await rc.rpc("approve_exchange", { p_id: exId, p_by: requesterId });
  ok(!!approveReq.error, "requester không duyệt được: " + (approveReq.error?.message ?? "UNEXPECTED SUCCESS"));

  // 7. Cấp phát → stock Kho chính giảm 2
  const stockBefore = await mc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();
  const issue = await mc.rpc("issue_exchange", { p_id: exId, p_by: managerId });
  ok(!issue.error, "issue_exchange: " + (issue.error?.message ?? "ok"));
  const stockAfter = await mc.from("variant_stock").select("quantity").eq("variant_id", variant!.id).single();
  ok(stockBefore.data!.quantity - 2 === stockAfter.data!.quantity, "stock Kho chính giảm đúng 2");

  // 8. Ledger exchange_out
  const { data: led } = await mc.from("stock_movements").select("movement_type").eq("ref_id", exId).eq("ref_type", "exchange");
  ok((led ?? []).length > 0 && led![0].movement_type === "exchange_out", "ledger ghi exchange_out");

  // 9. Nhận (manager xác nhận)
  const recv = await mc.rpc("receive_exchange", { p_id: exId, p_by: managerId });
  ok(!recv.error, "receive_exchange");
  const { data: finalRow } = await mc.from("exchange_notes").select("status").eq("id", exId).single();
  ok(finalRow?.status === "received", "DM kết thúc ở received");

  // 10. HONG khác: đề nghị sửa → xác nhận sửa (send_to_repair) xoá cờ
  const defect2 = await rc.rpc("record_defect", {
    p_items: [{ variant_id: variant!.id, quantity: 1, damage_detail: "Hỏng điện", damage_type: "electrical", severity: "light", images: ["https://example.com/b2.jpg"] }],
    p_source_loc: srcLoc!.id,
    p_by: requesterId,
  });
  const noteId2 = defect2.data as string;
  const rq = await rc.rpc("request_repair", { p_id: noteId2, p_by: requesterId });
  ok(!rq.error, "request_repair: " + (rq.error?.message ?? "ok"));
  const { data: withFlag } = await mc.from("defect_notes").select("repair_requested_at").eq("id", noteId2).single();
  ok(!!withFlag?.repair_requested_at, "HONG có cờ đề nghị sửa");

  const { data: dItems2 } = await mc.from("defect_note_items").select("id").eq("defect_note_id", noteId2);
  const sent = await mc.rpc("send_to_repair", {
    p_defect_item_ids: dItems2!.map((d) => d.id),
    p_vendor: "Cty Sửa A",
    p_sent_at: "2026-09-06",
    p_expected_return_at: "2026-09-20",
    p_by: managerId,
  });
  ok(!sent.error, "send_to_repair: " + (sent.error?.message ?? "ok"));
  const { data: cleared } = await mc.from("defect_notes").select("repair_requested_at, status").eq("id", noteId2).single();
  ok(cleared?.repair_requested_at == null && cleared?.status === "in_repair", "send_to_repair xoá cờ + HONG in_repair");

  // 11. RLS: requester thấy DM của HONG mình nhưng không thấy DM khác (kiểm select policy không lỗi)
  const ownEx = await rc.from("exchange_notes").select("id").eq("id", exId).single();
  ok(!ownEx.error, "requester đọc được DM của HONG mình (RLS)");

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
