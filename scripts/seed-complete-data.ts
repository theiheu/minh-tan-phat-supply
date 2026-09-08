import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/username";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("🧹 1. Dọn sạch toàn bộ dữ liệu nghiệp vụ cũ...");

  // Xóa các bảng giao dịch theo thứ tự khóa ngoại
  await admin.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("repair_order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("repair_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("exchange_note_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("exchange_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("defect_note_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("defect_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("liquidation_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("liquidation_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("requisition_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("requisitions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("issue_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("issues").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("receipt_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("receipts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("stocktake_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("stocktakes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("stock_balances").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("✅ Đã dọn sạch dữ liệu cũ!");

  console.log("👤 2. Đảm bảo tài khoản người dùng...");
  async function ensureUser(
    username: string,
    pass: string,
    name: string,
    role: "manager" | "requester" | "superuser",
    zoneId: string | null,
  ) {
    const { data: existing } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (existing) {
      await admin.from("profiles").update({ name, role, zone_id: zoneId, is_active: true }).eq("id", existing.id);
      return existing.id;
    }
    const email = internalEmailForUsername(username);
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { name, role, zone_id: zoneId, username },
    });
    if (error) {
      console.warn("Lỗi tạo user:", username, error.message);
      const { data: byEmail } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      return byEmail?.id;
    }
    return user.user?.id;
  }

  const { data: zones } = await admin.from("zones").select("id, name").order("name");
  const zone1 = zones?.find((z) => z.name.includes("1"))?.id ?? zones?.[0]?.id ?? null;
  const zone2 = zones?.find((z) => z.name.includes("2"))?.id ?? zones?.[1]?.id ?? null;

  const managerId = await ensureUser("manager", "password123", "Trần Quốc Hưng (Quản lý kho)", "manager", null);
  const requesterId = await ensureUser("requester", "password123", "Nguyễn Văn An (Trưởng Khu 1)", "requester", zone1);
  const staffId = await ensureUser("staff", "password123", "Lê Thị Mai (Kỹ thuật Khu 2)", "requester", zone2);
  const adminId = await ensureUser("admin", "password123", "Quản trị viên hệ thống", "superuser", null);

  console.log("🏢 3. Lấy thông tin kho và danh mục...");
  const { data: locs } = await admin.from("stock_locations").select("id, code, name");
  const mainLoc = locs?.find((l) => l.code === "KHO_CHINH")?.id ?? "";

  const { data: customers } = await admin.from("customers").select("id, name").limit(2);
  let customerId = customers?.[0]?.id;
  if (!customerId) {
    const { data: newCust } = await admin.from("customers").insert({ name: "Trang trại Ba Vì", phone: "0912345678", address: "Hà Nội" }).select("id").single();
    customerId = newCust?.id;
  }

  const { data: suppliers } = await admin.from("suppliers").select("id, name").limit(2);
  const supplierId = suppliers?.[0]?.id;

  const { data: allVariants } = await admin.from("variants").select("id, price, unit, attributes, products(name)").order("id");
  const variants = allVariants ?? [];

  console.log("📦 4. Khởi tạo số dư tồn kho ban đầu tại Kho chính...");
  for (const v of variants) {
    const qty = 100;
    await admin.from("stock_balances").insert({
      location_id: mainLoc,
      variant_id: v.id,
      quantity: qty,
    });
    await admin.from("stock_movements").insert({
      variant_id: v.id,
      from_location_id: null,
      to_location_id: mainLoc,
      quantity: qty,
      type: "initial",
      created_by: managerId,
    });
  }

  console.log("📋 5. Tạo dữ liệu mẫu Phiếu Báo Hỏng & Đổi Mới...");

  const v1 = variants[0]?.id;
  const getProductName = (v: any) => {
    if (Array.isArray(v.products)) return v.products[0]?.name ?? "";
    return v.products?.name ?? "";
  };
  const v2 = variants.find((v) => getProductName(v).includes("Quạt"))?.id ?? variants[1]?.id;
  const v3 = variants.find((v) => getProductName(v).includes("Máng"))?.id ?? variants[2]?.id;
  const v4 = variants.find((v) => getProductName(v).includes("Bóng đèn"))?.id ?? variants[3]?.id;
  const v5 = variants.find((v) => getProductName(v).includes("Vòi"))?.id ?? variants[4]?.id;
  const v6 = variants.find((v) => getProductName(v).includes("Ủng"))?.id ?? variants[5]?.id;

  // 1. HONG-0001: Mới báo hỏng -> [Chưa về kho]
  const { data: h1 } = await admin.from("defect_notes").insert({
    code: "HONG-0001",
    status: "staging",
    source_location_id: mainLoc,
    reported_by: requesterId,
    collected_at: null,
    created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
  }).select("id").single();
  if (h1) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h1.id,
      variant_id: v4,
      quantity: 2,
      damageDetail: "Đứt tóc bóng úm đợt lạnh vừa rồi",
      note: "Cần đổi mới bóng úm sưởi ấm gà",
      images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400"],
    });
  }

  // 2. HONG-0002: Đang đổi mới (pending) -> [Chưa về kho / Đang đổi mới]
  const { data: h2 } = await admin.from("defect_notes").insert({
    code: "HONG-0002",
    status: "staging",
    source_location_id: mainLoc,
    reported_by: staffId,
    collected_at: null,
    created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  }).select("id").single();
  if (h2) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h2.id,
      variant_id: v2,
      quantity: 1,
      damageDetail: "Cháy tụ khởi động quạt chuồng A2",
      note: "Đã tháo quạt chờ đổi cái mới",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
    });
    const { data: ex1 } = await admin.from("exchange_notes").insert({
      code: "DM-0001",
      linked_defect_id: h2.id,
      status: "pending",
      created_by: staffId,
      created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    }).select("id").single();
    if (ex1) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: ex1.id,
        variant_id: v2,
        quantity: 1,
      });
    }
  }

  // 3. HONG-0003: Đang đổi mới (approved, chờ cấp phát) -> [Đã về kho / Đang đổi mới]
  const { data: h3 } = await admin.from("defect_notes").insert({
    code: "HONG-0003",
    status: "staging",
    source_location_id: mainLoc,
    reported_by: requesterId,
    collected_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    collected_by: managerId,
    created_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
  }).select("id").single();
  if (h3) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h3.id,
      variant_id: v3,
      quantity: 3,
      damageDetail: "Nứt vỡ góc máng ăn do va chạm xe cám",
      note: "Gà làm rơi vãi thức ăn",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=400"],
    });
    const { data: ex2 } = await admin.from("exchange_notes").insert({
      code: "DM-0002",
      linked_defect_id: h3.id,
      status: "approved",
      created_by: requesterId,
      approved_by: managerId,
      created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      approved_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    }).select("id").single();
    if (ex2) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: ex2.id,
        variant_id: v3,
        quantity: 3,
      });
    }
  }

  // 4. HONG-0004: Đang chờ xác nhận gửi sửa -> [Đã về kho / Đang sửa]
  const { data: h4 } = await admin.from("defect_notes").insert({
    code: "HONG-0004",
    status: "staging",
    source_location_id: mainLoc,
    reported_by: staffId,
    collected_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    collected_by: managerId,
    repair_requested_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  }).select("id").single();
  if (h4) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h4.id,
      variant_id: v2,
      quantity: 1,
      damageDetail: "Hỏng trục cánh quạt kêu to",
      note: "Đề nghị gửi thợ cơ điện sửa",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
    });
  }

  // 5. HONG-0005: Đang gửi sửa ngoài (in_repair) -> [Đã về kho / Đang sửa]
  const { data: h5 } = await admin.from("defect_notes").insert({
    code: "HONG-0005",
    status: "in_repair",
    source_location_id: mainLoc,
    reported_by: requesterId,
    collected_at: new Date(Date.now() - 3600 * 1000 * 22).toISOString(),
    collected_by: managerId,
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  }).select("id").single();
  if (h5) {
    const { data: item5 } = await admin.from("defect_note_items").insert({
      defect_note_id: h5.id,
      variant_id: v2,
      quantity: 1,
      damageDetail: "Cháy bạc đạn động cơ",
      note: "Gửi sửa Nam Phát",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
    }).select("id").single();

    const { data: rep } = await admin.from("repair_orders").insert({
      code: "SC-0001",
      vendor: "Công ty Cơ Điện Nam Phát",
      status: "in_repair",
      sent_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
      expected_return_at: new Date(Date.now() + 3600 * 1000 * 48).toISOString(),
      created_by: managerId,
    }).select("id").single();

    if (rep && item5) {
      await admin.from("repair_order_items").insert({
        repair_order_id: rep.id,
        defect_item_id: item5.id,
        quantity: 1,
      });
    }
  }

  // 6. HONG-0006: Đã đổi mới hoàn tất (received) -> [Đã về kho / Đã hoàn tất]
  const { data: h6 } = await admin.from("defect_notes").insert({
    code: "HONG-0006",
    status: "staging",
    source_location_id: mainLoc,
    reported_by: requesterId,
    collected_at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
    collected_by: managerId,
    created_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
  }).select("id").single();
  if (h6) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h6.id,
      variant_id: v5,
      quantity: 5,
      damageDetail: "Rò rỉ ren van nước",
      note: "Đã đổi mới xong",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"],
    });
    const { data: ex3 } = await admin.from("exchange_notes").insert({
      code: "DM-0003",
      linked_defect_id: h6.id,
      status: "received",
      created_by: requesterId,
      approved_by: managerId,
      issued_by: managerId,
      received_by: requesterId,
      created_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
      approved_at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
      issued_at: new Date(Date.now() - 3600 * 1000 * 25).toISOString(),
      received_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    }).select("id").single();
    if (ex3) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: ex3.id,
        variant_id: v5,
        quantity: 5,
      });
    }
  }

  // 7. HONG-0007: Đã sửa chữa xong về kho -> [Đã về kho / Đã hoàn tất]
  const { data: h7 } = await admin.from("defect_notes").insert({
    code: "HONG-0007",
    status: "returned",
    source_location_id: mainLoc,
    reported_by: staffId,
    collected_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    collected_by: managerId,
    created_at: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
  }).select("id").single();
  if (h7) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h7.id,
      variant_id: v3,
      quantity: 2,
      damageDetail: "Hàn gia cố mối ghép",
      note: "Đã sửa xong về kho",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=400"],
    });
  }

  console.log("📝 6. Tạo dữ liệu mẫu Phiếu Yêu Cầu Cấp Phát (Requisitions)...");
  // YC-0001: pending
  const { data: req1 } = await admin.from("requisitions").insert({
    code: "YC-0001",
    zone_id: zone1,
    requester_id: requesterId,
    status: "pending",
    purpose: "Cấp cám ăn cho đàn gà con chuồng 1",
    created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
  }).select("id").single();
  if (req1) {
    await admin.from("requisition_items").insert({
      requisition_id: req1.id,
      variant_id: v1,
      quantity: 10,
    });
  }

  // YC-0002: approved
  const { data: req2 } = await admin.from("requisitions").insert({
    code: "YC-0002",
    zone_id: zone2,
    requester_id: staffId,
    approved_by: managerId,
    status: "approved",
    purpose: "Phun sát trùng định kỳ khu 2",
    approved_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
  }).select("id").single();
  if (req2) {
    await admin.from("requisition_items").insert({
      requisition_id: req2.id,
      variant_id: variants.find((v) => getProductName(v).includes("Vimekon"))?.id ?? v1,
      quantity: 5,
    });
  }

  // YC-0003: issued (đã xuất chờ nhận)
  const { data: req3 } = await admin.from("requisitions").insert({
    code: "YC-0003",
    zone_id: zone1,
    requester_id: requesterId,
    approved_by: managerId,
    fulfilled_by: managerId,
    status: "issued",
    purpose: "Cấp phát ủng bảo hộ lao động cho công nhân mới",
    approved_at: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
    fulfilled_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  }).select("id").single();
  if (req3) {
    await admin.from("requisition_items").insert({
      requisition_id: req3.id,
      variant_id: v6,
      quantity: 2,
    });
  }

  // YC-0004: received (đã nhận hoàn tất)
  const { data: req4 } = await admin.from("requisitions").insert({
    code: "YC-0004",
    zone_id: zone2,
    requester_id: staffId,
    approved_by: managerId,
    fulfilled_by: managerId,
    received_by: staffId,
    status: "received",
    purpose: "Cấp vắc-xin tiêm định kỳ",
    approved_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
    fulfilled_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    received_at: new Date(Date.now() - 3600 * 1000 * 16).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  }).select("id").single();
  if (req4) {
    await admin.from("requisition_items").insert({
      requisition_id: req4.id,
      variant_id: variants.find((v) => getProductName(v).includes("Vắc-xin"))?.id ?? v1,
      quantity: 20,
    });
  }

  console.log("🚚 7. Tạo dữ liệu mẫu Đơn Nhập & Phiếu Xuất...");
  // Đơn đặt hàng / Nhập kho
  const { data: rc1 } = await admin.from("receipts").insert({
    code: "GRN-0001",
    supplier_id: supplierId,
    status: "posted",
    created_by: managerId,
    notes: "Nhập kho đợt cám gà con đầu tháng",
    created_at: new Date(Date.now() - 3600 * 1000 * 15).toISOString(),
  }).select("id").single();
  if (rc1) {
    await admin.from("receipt_items").insert({
      receipt_id: rc1.id,
      variant_id: v1,
      quantity: 50,
      unit_cost: 380000,
    });
  }

  // Phiếu xuất kho / Xuất bán
  const { data: is1 } = await admin.from("issues").insert({
    code: "XK-0001",
    destination_type: "customer",
    customer_id: customerId,
    creator_id: managerId,
    status: "posted",
    notes: "Xuất bán vật tư nông trại Ba Vì",
    created_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
  }).select("id").single();
  if (is1) {
    await admin.from("issue_items").insert({
      issue_id: is1.id,
      variant_id: v1,
      quantity: 20,
      unit_price: 420000,
    });
  }

  // Phiếu thanh lý TL-0001
  const { data: lq1 } = await admin.from("liquidation_notes").insert({
    code: "TL-0001",
    status: "completed",
    created_by: managerId,
    notes: "Thanh lý máng ăn cũ hỏng nát không thể tái sử dụng",
    created_at: new Date(Date.now() - 3600 * 1000 * 40).toISOString(),
  }).select("id").single();
  if (lq1) {
    await admin.from("liquidation_items").insert({
      liquidation_note_id: lq1.id,
      variant_id: v3,
      quantity: 10,
    });
  }

  console.log("🎉 XONG! Dữ liệu mới đã được tạo đầy đủ và hoàn chỉnh.");
  console.log("-------------------------------------------------------");
  console.log("👉 Đăng nhập test:");
  console.log("  - Quản lý kho:      username: manager   / pass: password123");
  console.log("  - Người yêu cầu 1:  username: requester / pass: password123 (Khu 1)");
  console.log("  - Kỹ thuật viên 2:  username: staff     / pass: password123 (Khu 2)");
  console.log("  - Quản trị viên:    username: admin     / pass: password123");
  console.log("-------------------------------------------------------");
}

run().catch((e) => {
  console.error("❌ Lỗi khởi tạo dữ liệu:", e);
  process.exit(1);
});
