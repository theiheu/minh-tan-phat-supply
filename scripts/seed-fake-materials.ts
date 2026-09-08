import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/username";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🚀 Bắt đầu khởi tạo dữ liệu mẫu toàn diện cho Minh Tân Phát Supply...\n");

  // ==========================================
  // 1. DỌN SẠCH DỮ LIỆU CŨ THEO THỨ TỰ KHÓA NGOẠI
  // ==========================================
  console.log("🧹 1. Dọn sạch toàn bộ dữ liệu nghiệp vụ & danh mục cũ...");

  const tablesToClear = [
    "notifications",
    "audit_logs",
    "fuel_movements",
    "fuel_dispenses",
    "fuel_receipts",
    "repair_order_items",
    "repair_orders",
    "exchange_note_items",
    "exchange_notes",
    "defect_note_items",
    "defect_notes",
    "liquidation_items",
    "liquidation_notes",
    "requisition_items",
    "requisitions",
    "issue_items",
    "issues",
    "receipt_items",
    "receipts",
    "stocktake_items",
    "stocktake_sessions",
    "stock_movements",
    "stock_balances",
    "variant_components",
    "variants",
    "products",
    "vehicles",
    "fuel_types",
  ];

  for (const table of tablesToClear) {
    const { error } = await admin
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error && !error.message.includes("does not exist")) {
      console.warn(`  ⚠️ Cảnh báo xóa ${table}:`, error.message);
    }
  }

  console.log("  ✅ Đã dọn sạch dữ liệu cũ!\n");

  // ==========================================
  // 2. TÀI KHOẢN NGƯỜI DÙNG & PHÂN QUYỀN
  // ==========================================
  console.log("👤 2. Đảm bảo các tài khoản người dùng...");

  async function ensureUser(
    username: string,
    pass: string,
    name: string,
    role: "manager" | "requester" | "superuser",
    zoneId: string | null = null,
    isProtected = false
  ) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existing) {
      await admin
        .from("profiles")
        .update({ name, role, zone_id: zoneId, is_active: true, is_protected: isProtected })
        .eq("id", existing.id);
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
      const { data: byEmail } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      return byEmail?.id;
    }

    if (user.user?.id) {
      await admin.from("profiles").upsert({
        id: user.user.id,
        username,
        name,
        role,
        zone_id: zoneId,
        is_active: true,
        is_protected: isProtected,
      });
    }

    return user.user?.id;
  }

  // ==========================================
  // 3. KHU VỰC, KHO, NHÀ CUNG CẤP & KHÁCH HÀNG
  // ==========================================
  console.log("🏢 3. Khởi tạo Khu vực, Kho, Nhà cung cấp & Khách hàng...");

  // Zones
  const zonesData = [
    { name: "Khu 1 (Trại gà thịt A)" },
    { name: "Khu 2 (Trại gà hậu bị B)" },
    { name: "Khu 3 (Khu ấp trứng & xưởng cơ điện)" },
    { name: "Khu 4 (Khu xử lý chất thải & trạm bơm)" },
  ];
  for (const z of zonesData) {
    await admin.from("zones").upsert(z, { onConflict: "name" });
  }
  const { data: allZones } = await admin.from("zones").select("id, name").order("name");
  const zone1 = allZones?.[0]?.id ?? null;
  const zone2 = allZones?.[1]?.id ?? null;
  const zone3 = allZones?.[2]?.id ?? null;
  const zone4 = allZones?.[3]?.id ?? null;

  // Users
  const adminId = await ensureUser("admin", "password123", "Quản trị viên hệ thống", "superuser", null, true);
  const managerId = await ensureUser("manager", "password123", "Trần Quốc Hưng (Quản lý kho)", "manager", null);
  const requesterId = await ensureUser("requester", "password123", "Nguyễn Văn An (Trưởng Khu 1)", "requester", zone1);
  const staffId = await ensureUser("staff", "password123", "Lê Thị Mai (Kỹ thuật Khu 2)", "requester", zone2);
  const staff3Id = await ensureUser("staff3", "password123", "Phạm Hoàng Nam (Kỹ thuật Khu 3)", "requester", zone3);
  const driverId = await ensureUser("driver1", "password123", "Vũ Đình Tài (Tài xế Vận tải)", "requester", null);

  // Stock locations
  const locationsData = [
    { code: "KHO_CHINH", name: "Kho chính Minh Tân Phát", type: "main", is_active: true },
    { code: "KHO_HONG", name: "Kho hỏng tập kết", type: "defect", is_active: true },
    { code: "KHO_DANG_SUA", name: "Kho đang gửi sửa chữa", type: "repair", is_active: true },
  ];
  for (const loc of locationsData) {
    await admin.from("stock_locations").upsert(loc, { onConflict: "code" });
  }
  const { data: locs } = await admin.from("stock_locations").select("id, code, name");
  const mainLoc = locs?.find((l) => l.code === "KHO_CHINH")?.id ?? "";
  const defectLoc = locs?.find((l) => l.code === "KHO_HONG")?.id ?? "";
  const repairLoc = locs?.find((l) => l.code === "KHO_DANG_SUA")?.id ?? "";

  // Suppliers
  const suppliersData = [
    { name: "Công ty TNHH Thức ăn Chăn nuôi Minh Phát", contact_name: "Ô. Hùng", phone: "0901234567" },
    { name: "Công ty Cổ phần Cơ điện Nam Phát", contact_name: "Ô. Nam", phone: "0912345678" },
    { name: "Công ty Thuốc Thú y & Vật tư An Bình", contact_name: "Bà Lan", phone: "0934567890" },
    { name: "Doanh nghiệp Kim khí & Bulong Tiến Đạt", contact_name: "Ô. Đạt", phone: "0978112233" },
    { name: "Tổng đại lý Dầu nhờn Petrolimex Miền Đông", contact_name: "Bà Hương", phone: "0988776655" },
  ];
  for (const s of suppliersData) {
    await admin.from("suppliers").upsert(s, { onConflict: "name" });
  }
  const { data: allSuppliers } = await admin.from("suppliers").select("id, name");
  const supplierMinhPhat = allSuppliers?.find((s) => s.name.includes("Minh Phát"))?.id;
  const supplierNamPhat = allSuppliers?.find((s) => s.name.includes("Nam Phát"))?.id;
  const supplierAnBinh = allSuppliers?.find((s) => s.name.includes("An Bình"))?.id;
  const supplierTienDat = allSuppliers?.find((s) => s.name.includes("Tiến Đạt"))?.id;
  const supplierPetrolimex = allSuppliers?.find((s) => s.name.includes("Petrolimex"))?.id;

  // Customers
  const customersData = [
    { name: "Trang trại Chăn nuôi Ba Vì", phone: "0911223344", address: "Huyện Ba Vì, Hà Nội", is_active: true },
    { name: "Nông trại Gà đẻ Tam Đảo", phone: "0922334455", address: "Huyện Tam Đảo, Vĩnh Phúc", is_active: true },
    { name: "Hợp tác xã Nông nghiệp Hòa Bình", phone: "0933445566", address: "TP. Hòa Bình, Hòa Bình", is_active: true },
    { name: "Xí nghiệp Chăn nuôi Lương Sơn", phone: "0944556677", address: "Huyện Lương Sơn, Hòa Bình", is_active: true },
  ];
  for (const c of customersData) {
    await admin.from("customers").upsert(c, { onConflict: "name" });
  }
  const { data: allCustomers } = await admin.from("customers").select("id, name");
  const customerBaVi = allCustomers?.find((c) => c.name.includes("Ba Vì"))?.id;
  const customerTamDao = allCustomers?.find((c) => c.name.includes("Tam Đảo"))?.id;

  // ==========================================
  // 4. DANH MỤC TIÊU CHUẨN (CATEGORIES)
  // ==========================================
  console.log("📂 4. Khởi tạo 12 Danh mục tiêu chuẩn...");

  const categoriesData = [
    { name: "Điện - Điện tử", icon: "electric", display_order: 1 },
    { name: "Phụ tùng Xe - Máy móc", icon: "machinery", display_order: 2 },
    { name: "Dụng cụ - Bảo hộ", icon: "tools_ppe", display_order: 3 },
    { name: "Thiết bị Chăn nuôi", icon: "livestock", display_order: 4 },
    { name: "Nước - Khí nén", icon: "plumbing_pneumatics", display_order: 5 },
    { name: "Vòng bi - Bạc đạn", icon: "bearings", display_order: 6 },
    { name: "Dây curoa - Nhông xích", icon: "belts_chains", display_order: 7 },
    { name: "Dầu mỡ - Hóa chất", icon: "oil_chemicals", display_order: 8 },
    { name: "Hàn - Cắt - Gia công", icon: "welding_cutting", display_order: 9 },
    { name: "Kim khí - Bulong - Ốc vít", icon: "hardware_fasteners", display_order: 10 },
    { name: "Đóng gói - Bạt - Dây", icon: "packaging_ropes", display_order: 11 },
    { name: "Vật tư Khác", icon: "other", display_order: 12 },
  ];

  for (const cat of categoriesData) {
    await admin.from("categories").upsert(cat, { onConflict: "name" });
  }
  const { data: allCats } = await admin.from("categories").select("id, name");
  const getCatId = (name: string) => allCats?.find((c) => c.name === name)?.id ?? null;

  // ==========================================
  // 5. SẢN PHẨM & BIẾN THỂ (PRODUCTS & VARIANTS)
  // ==========================================
  console.log("📦 5. Tạo Sản phẩm & Biến thể vật tư theo 12 danh mục...");

  interface ProductSeed {
    name: string;
    categoryName: string;
    description: string;
    images: string[];
    options: string[];
    variants: {
      attributes: Record<string, string>;
      price: number;
      unit: string;
      min_stock: number;
      images: string[];
      is_default?: boolean;
    }[];
  }

  const catalogSeeds: ProductSeed[] = [
    // 1. Điện - Điện tử
    {
      name: "Động cơ điện 3 pha Toàn Phát",
      categoryName: "Điện - Điện tử",
      description: "Động cơ điện vỏ nhôm tản nhiệt nhanh, dây đồng 100%, chuyên dùng cho hệ thống quạt hút chuồng trại.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Công suất", "Điện áp"],
      variants: [
        {
          attributes: { "Công suất": "1.5kW", "Điện áp": "380V" },
          price: 1850000,
          unit: "Cái",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Công suất": "2.2kW", "Điện áp": "380V" },
          price: 2450000,
          unit: "Cái",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
        {
          attributes: { "Công suất": "3.7kW", "Điện áp": "380V" },
          price: 3900000,
          unit: "Cái",
          min_stock: 2,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Tủ điều khiển tiểu khí hậu chuồng trại tự động",
      categoryName: "Điện - Điện tử",
      description: "Tủ điều khiển tự động bật/tắt quạt hút, bơm giàn mát theo ngưỡng nhiệt độ và độ ẩm cài đặt.",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
      options: ["Quy mô"],
      variants: [
        {
          attributes: { "Quy mô": "Tủ 4 quạt 1 bơm" },
          price: 4500000,
          unit: "Bộ",
          min_stock: 1,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
          is_default: true,
        },
        {
          attributes: { "Quy mô": "Tủ 8 quạt 2 bơm" },
          price: 7800000,
          unit: "Bộ",
          min_stock: 1,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
        },
      ],
    },
    {
      name: "Cảm biến nhiệt độ & độ ẩm RS485 công nghiệp",
      categoryName: "Điện - Điện tử",
      description: "Đầu dò cảm biến độ chính xác cao SHT30, vỏ bảo vệ chống bụi và khí amoniac (NH3) chuồng trại.",
      images: ["https://images.unsplash.com/photo-1518770660439-4636190af475?w=600"],
      options: ["Kiểu dáng"],
      variants: [
        {
          attributes: { "Kiểu dáng": "Gắn tường" },
          price: 350000,
          unit: "Chiếc",
          min_stock: 6,
          images: ["https://images.unsplash.com/photo-1518770660439-4636190af475?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kiểu dáng": "Đầu dò dây thả 5m" },
          price: 480000,
          unit: "Chiếc",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1518770660439-4636190af475?w=600"],
        },
      ],
    },
    {
      name: "Bóng đèn sưởi úm hồng ngoại Interheat",
      categoryName: "Điện - Điện tử",
      description: "Bóng thủy tinh tôi nhiệt chống nổ khi gặp nước, chuyên dụng sưởi úm gia cầm non đợt rét.",
      images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600"],
      options: ["Công suất"],
      variants: [
        {
          attributes: { "Công suất": "175W đui xoáy E27" },
          price: 75000,
          unit: "Bóng",
          min_stock: 30,
          images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600"],
          is_default: true,
        },
        {
          attributes: { "Công suất": "250W đui xoáy E27" },
          price: 95000,
          unit: "Bóng",
          min_stock: 40,
          images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600"],
        },
      ],
    },
    {
      name: "Khởi động từ Schneider Electric EasyPact TVS",
      categoryName: "Điện - Điện tử",
      description: "Contactor đóng ngắt động cơ điện, cuộn hút 220V/380V độ bền cơ học cao.",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
      options: ["Model"],
      variants: [
        {
          attributes: { "Model": "LC1E1810M5 (18A)" },
          price: 260000,
          unit: "Cái",
          min_stock: 8,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
          is_default: true,
        },
        {
          attributes: { "Model": "LC1E2510M5 (25A)" },
          price: 340000,
          unit: "Cái",
          min_stock: 6,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
        },
      ],
    },

    // 2. Phụ tùng Xe - Máy móc
    {
      name: "Cánh quạt hút composite chuồng trại 1380",
      categoryName: "Phụ tùng Xe - Máy móc",
      description: "Cánh quạt hút gió công nghiệp kích thước khung 1380x1380, lưu lượng 44.000 m3/h.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Chất liệu"],
      variants: [
        {
          attributes: { "Chất liệu": "Inox 430 dập gân" },
          price: 520000,
          unit: "Bộ",
          min_stock: 5,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Chất liệu": "Nhựa POM chống ăn mòn" },
          price: 680000,
          unit: "Bộ",
          min_stock: 3,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Lọc dầu nhớt động cơ xe tải chuyên dụng",
      categoryName: "Phụ tùng Xe - Máy móc",
      description: "Lọc nhớt cao cấp lọc sạch mạt kim loại và cặn bẩn, bảo vệ piston xylanh.",
      images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
      options: ["Dòng xe"],
      variants: [
        {
          attributes: { "Dòng xe": "Isuzu QKR / 4JB1" },
          price: 125000,
          unit: "Cái",
          min_stock: 12,
          images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
          is_default: true,
        },
        {
          attributes: { "Dòng xe": "Hyundai HD72 / D4DB" },
          price: 160000,
          unit: "Cái",
          min_stock: 10,
          images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
        },
      ],
    },
    {
      name: "Lọc gió động cơ máy phát điện công nghiệp 50kVA",
      categoryName: "Phụ tùng Xe - Máy móc",
      description: "Lõi lọc giấy xenlulozo kết hợp lưới thép bảo vệ, lọc bụi công suất lớn cho máy Cummins/Perkins.",
      images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
      options: ["Loại lọc"],
      variants: [
        {
          attributes: { "Loại lọc": "Bộ lọc gió kép Donaldson" },
          price: 450000,
          unit: "Bộ",
          min_stock: 3,
          images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
          is_default: true,
        },
      ],
    },

    // 3. Dụng cụ - Bảo hộ
    {
      name: "Ủng cao su bảo hộ lao động Thùy Dương",
      categoryName: "Dụng cụ - Bảo hộ",
      description: "Ủng cao su chống trơn trượt, kháng hóa chất tẩy rửa chuồng trại và axit nhẹ.",
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
      options: ["Kích cỡ"],
      variants: [
        {
          attributes: { "Kích cỡ": "Size 40 (Đen đế vàng)" },
          price: 85000,
          unit: "Đôi",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích cỡ": "Size 41 (Đen đế vàng)" },
          price: 85000,
          unit: "Đôi",
          min_stock: 20,
          images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
        },
        {
          attributes: { "Kích cỡ": "Size 42 (Đen đế vàng)" },
          price: 85000,
          unit: "Đôi",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"],
        },
      ],
    },
    {
      name: "Bộ quần áo bảo hộ phòng dịch dùng 1 lần Tyvek",
      categoryName: "Dụng cụ - Bảo hộ",
      description: "Chống bụi mịn, vi rút dịch cúm gia cầm và hóa chất phun khử trùng toàn thân.",
      images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
      options: ["Kích cỡ"],
      variants: [
        {
          attributes: { "Kích cỡ": "Size L" },
          price: 48000,
          unit: "Bộ",
          min_stock: 50,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích cỡ": "Size XL" },
          price: 48000,
          unit: "Bộ",
          min_stock: 50,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
        },
      ],
    },
    {
      name: "Găng tay cao su y tế Vglove Nitrile không bột",
      categoryName: "Dụng cụ - Bảo hộ",
      description: "Găng tay dẻo dai chống rách khi tiêm phòng vaccine và mổ khám bệnh phẩm gia súc gia cầm.",
      images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
      options: ["Size"],
      variants: [
        {
          attributes: { "Size": "Hộp 50 đôi Size M" },
          price: 75000,
          unit: "Hộp",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
          is_default: true,
        },
        {
          attributes: { "Size": "Hộp 50 đôi Size L" },
          price: 75000,
          unit: "Hộp",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
        },
      ],
    },
    {
      name: "Máy siết bulong dùng pin Dekton 21V lực 450N.m",
      categoryName: "Dụng cụ - Bảo hộ",
      description: "Động cơ không chổi than mạnh mẽ, 2 pin 4.0Ah, mở ốc khung chuồng và dàn quạt dễ dàng.",
      images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
      options: ["Bộ phụ kiện"],
      variants: [
        {
          attributes: { "Bộ phụ kiện": "Full box kèm 2 pin 4Ah + sạc" },
          price: 1850000,
          unit: "Bộ",
          min_stock: 2,
          images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
          is_default: true,
        },
      ],
    },

    // 4. Thiết bị Chăn nuôi
    {
      name: "Máng ăn tự động chống bới cho gà thịt",
      categoryName: "Thiết bị Chăn nuôi",
      description: "Máng nhựa nguyên sinh chịu va đập, vành chống rơi vãi cám tiết kiệm 5-10% thức ăn.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Dung tích"],
      variants: [
        {
          attributes: { "Dung tích": "Máng vàng 8kg" },
          price: 72000,
          unit: "Chiếc",
          min_stock: 40,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
        {
          attributes: { "Dung tích": "Máng đỏ 10kg" },
          price: 88000,
          unit: "Chiếc",
          min_stock: 40,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
        },
      ],
    },
    {
      name: "Núm uống tự động Inox 360 độ kèm máng hứng",
      categoryName: "Thiết bị Chăn nuôi",
      description: "Núm ti inox 304 không rỉ sét, bi xoay 360 độ nhạy nước, không bị rò rỉ làm ướt đệm lót.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Ren xoáy phi 27 inox 304" },
          price: 19500,
          unit: "Bộ",
          min_stock: 120,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
      ],
    },
    {
      name: "Bộ châm thuốc vaccine tự động Dosatron D25RE2",
      categoryName: "Thiết bị Chăn nuôi",
      description: "Thiết bị định lượng thuốc hòa tan theo lưu lượng nước tự động, tỷ lệ chính xác từ 0.2% đến 2%.",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
      options: ["Model"],
      variants: [
        {
          attributes: { "Model": "Dosatron D25RE2 (Pháp)" },
          price: 7800000,
          unit: "Chiếc",
          min_stock: 2,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
          is_default: true,
        },
      ],
    },
    {
      name: "Tấm lót sàn chuồng bằng nhựa PP nguyên sinh",
      categoryName: "Thiết bị Chăn nuôi",
      description: "Tấm sàn nan dày chịu tải trọng trên 300kg, chống đọng phân và dễ vệ sinh xịt rửa.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Kích thước"],
      variants: [
        {
          attributes: { "Kích thước": "50cm x 100cm (Nan chữ nhật)" },
          price: 95000,
          unit: "Tấm",
          min_stock: 60,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích thước": "50cm x 50cm (Nan tròn)" },
          price: 52000,
          unit: "Tấm",
          min_stock: 60,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
        },
      ],
    },

    // 5. Nước - Khí nén
    {
      name: "Van bi đồng tay gạt Sanwa Thái Lan chính hãng",
      categoryName: "Nước - Khí nén",
      description: "Van đồng đúc dày dặn chống rỉ sét, chịu áp lực nước cao cấp cho đường ống cấp nước uống chuồng.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Đường kính"],
      variants: [
        {
          attributes: { "Đường kính": "DN20 (Phi 27)" },
          price: 85000,
          unit: "Cái",
          min_stock: 20,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Đường kính": "DN25 (Phi 34)" },
          price: 135000,
          unit: "Cái",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
        {
          attributes: { "Đường kính": "DN40 (Phi 49)" },
          price: 245000,
          unit: "Cái",
          min_stock: 8,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Ống mềm cao su bố vải chịu áp lực cao",
      categoryName: "Nước - Khí nén",
      description: "Ống cao su 3 lớp bố vải chịu áp lực 20 bar, dùng cho bơm rửa chuồng và dẫn khí nén.",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Phi 25 (Cuộn 50 mét)" },
          price: 720000,
          unit: "Cuộn",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600"],
          is_default: true,
        },
      ],
    },
    {
      name: "Bơm nước ly tâm trục ngang Pentax Italy 2HP",
      categoryName: "Nước - Khí nén",
      description: "Bơm cánh đồng lưu lượng lớn 6-18 m3/h, dùng bơm trung chuyển bể chứa giàn làm mát.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Model"],
      variants: [
        {
          attributes: { "Model": "Pentax CM100 (2HP - 220V)" },
          price: 5400000,
          unit: "Con",
          min_stock: 2,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
      ],
    },

    // 6. Vòng bi - Bạc đạn
    {
      name: "Vòng bi cầu rãnh sâu SKF chính hãng",
      categoryName: "Vòng bi - Bạc đạn",
      description: "Vòng bi có nắp chắn bụi cao su 2 bên, chịu tốc độ cao cho động cơ quạt hút trang trại.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Mã vòng bi"],
      variants: [
        {
          attributes: { "Mã vòng bi": "SKF 6204-2RSH/C3" },
          price: 58000,
          unit: "Vòng",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Mã vòng bi": "SKF 6205-2RSH/C3" },
          price: 72000,
          unit: "Vòng",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
        {
          attributes: { "Mã vòng bi": "SKF 6306-2RSH/C3" },
          price: 135000,
          unit: "Vòng",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Gối đỡ vòng bi Asahi UCP tiêu chuẩn Nhật Bản",
      categoryName: "Vòng bi - Bạc đạn",
      description: "Gối đỡ trục quạt hút và băng tải chuyển cám, vỏ gang đúc chịu lực va đập.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Mã gối"],
      variants: [
        {
          attributes: { "Mã gối": "Asahi UCP 205 (Trục 25mm)" },
          price: 125000,
          unit: "Bộ",
          min_stock: 12,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Mã gối": "Asahi UCP 207 (Trục 35mm)" },
          price: 195000,
          unit: "Bộ",
          min_stock: 8,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },

    // 7. Dây curoa - Nhông xích
    {
      name: "Dây curoa thang Bando B-Series chịu nhiệt",
      categoryName: "Dây curoa - Nhông xích",
      description: "Dây curoa bản B truyền động puly quạt hút thông gió chuồng gà, chạy êm và bền bỉ.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Bando B52" },
          price: 68000,
          unit: "Sợi",
          min_stock: 20,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Quy cách": "Bando B58" },
          price: 75000,
          unit: "Sợi",
          min_stock: 20,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
        {
          attributes: { "Quy cách": "Bando B64" },
          price: 82000,
          unit: "Sợi",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Xích con lăn công nghiệp đơn KANA Nhật Bản",
      categoryName: "Dây curoa - Nhông xích",
      description: "Xích tải dùng cho dàn tời kéo máng ăn và hệ thống gom trứng tự động.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Mã xích"],
      variants: [
        {
          attributes: { "Mã xích": "KANA 40-1R (Hộp 3.048m)" },
          price: 390000,
          unit: "Hộp",
          min_stock: 6,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Mã xích": "KANA 50-1R (Hộp 3.048m)" },
          price: 560000,
          unit: "Hộp",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },

    // 8. Dầu mỡ - Hóa chất
    {
      name: "Dầu động cơ Diesel Castrol Vecton 15W-40 CK-4",
      categoryName: "Dầu mỡ - Hóa chất",
      description: "Dầu nhớt cao cấp kéo dài chu kỳ thay nhớt lên đến 20%, dùng cho xe tải và máy phát điện.",
      images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
      options: ["Quy cách đóng gói"],
      variants: [
        {
          attributes: { "Quy cách đóng gói": "Xô 18 Lít" },
          price: 1420000,
          unit: "Xô",
          min_stock: 8,
          images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
          is_default: true,
        },
        {
          attributes: { "Quy cách đóng gói": "Phuy 209 Lít" },
          price: 15200000,
          unit: "Phuy",
          min_stock: 2,
          images: ["https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600"],
        },
      ],
    },
    {
      name: "Mỡ bôi trơn bọc kín Sinopec Lithium Complex NLGI 3",
      categoryName: "Dầu mỡ - Hóa chất",
      description: "Mỡ chịu nhiệt độ cao 180°C, kháng nước cực tốt, bảo vệ gối bi quạt và trục máy móc.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Xô 15kg" },
          price: 1250000,
          unit: "Xô",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Quy cách": "Tuýp 500g" },
          price: 82000,
          unit: "Tuýp",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Thuốc sát trùng chuồng trại Vimekon",
      categoryName: "Dầu mỡ - Hóa chất",
      description: "Thuốc khử trùng tiêu độc diệt vi khuẩn, nấm và virus dịch tả, an toàn khi phun có gia cầm.",
      images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
      options: ["Trọng lượng"],
      variants: [
        {
          attributes: { "Trọng lượng": "Gói 1kg" },
          price: 175000,
          unit: "Gói",
          min_stock: 35,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
          is_default: true,
        },
        {
          attributes: { "Trọng lượng": "Xô 5kg" },
          price: 790000,
          unit: "Xô",
          min_stock: 12,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
        },
      ],
    },
    {
      name: "Hóa chất tẩy cặn đường ống nước uống CID 2000",
      categoryName: "Dầu mỡ - Hóa chất",
      description: "Chế phẩm oxy già 50% tẩy sạch màng sinh học biofilm và cặn vôi trong ống nước tự động.",
      images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
      options: ["Dung tích"],
      variants: [
        {
          attributes: { "Dung tích": "Can 10 Lít" },
          price: 890000,
          unit: "Can",
          min_stock: 8,
          images: ["https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600"],
          is_default: true,
        },
      ],
    },

    // 9. Hàn - Cắt - Gia công
    {
      name: "Que hàn điện Kim Tín KT-421 tiêu chuẩn E6013",
      categoryName: "Hàn - Cắt - Gia công",
      description: "Que hàn hồ quang ổn định, mối hàn ngấu đẹp, ít bắn tóe khi gia cố chuồng trại.",
      images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
      options: ["Đường kính"],
      variants: [
        {
          attributes: { "Đường kính": "Phi 2.5mm (Hộp 2.5kg)" },
          price: 88000,
          unit: "Hộp",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
          is_default: true,
        },
        {
          attributes: { "Đường kính": "Phi 3.2mm (Hộp 5.0kg)" },
          price: 165000,
          unit: "Hộp",
          min_stock: 20,
          images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
        },
      ],
    },
    {
      name: "Đá cắt sắt công nghiệp Hải Dương 355",
      categoryName: "Hàn - Cắt - Gia công",
      description: "Đá cắt thép không gỉ và sắt hộp kích thước 355x3x25.4mm, cắt ngọt không cháy phôi.",
      images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
      options: ["Đóng gói"],
      variants: [
        {
          attributes: { "Đóng gói": "Hộp 25 viên (355x3x25.4)" },
          price: 560000,
          unit: "Hộp",
          min_stock: 5,
          images: ["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"],
          is_default: true,
        },
      ],
    },

    // 10. Kim khí - Bulong - Ốc vít
    {
      name: "Bulong lục giác Inox 304 tiêu chuẩn DIN 933",
      categoryName: "Kim khí - Bulong - Ốc vít",
      description: "Bulong không rỉ sét trong môi trường ẩm ướt chuồng trại, kèm tán và long đền phẳng.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Kích thước"],
      variants: [
        {
          attributes: { "Kích thước": "M8 x 30mm (Bịch 50 bộ)" },
          price: 95000,
          unit: "Bịch",
          min_stock: 12,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích thước": "M8 x 50mm (Bịch 50 bộ)" },
          price: 135000,
          unit: "Bịch",
          min_stock: 12,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
        {
          attributes: { "Kích thước": "M12 x 80mm (Bịch 20 bộ)" },
          price: 115000,
          unit: "Bịch",
          min_stock: 10,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },
    {
      name: "Vít tự khoan bắn tôn mạ kẽm nhúng nóng SEC",
      categoryName: "Kim khí - Bulong - Ốc vít",
      description: "Đầu lục giác 8mm có đệm cao su EPDM chống dột nước mái chuồng trại.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "5.5 x 50mm (Bịch 200 con)" },
          price: 130000,
          unit: "Bịch",
          min_stock: 15,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
      ],
    },
    {
      name: "Dây rút nhựa trắng chống tia UV siêu bền",
      categoryName: "Kim khí - Bulong - Ốc vít",
      description: "Dây lạt nhựa buộc cố định đường dây điện và lưới thép chuồng gà.",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
      options: ["Kích cỡ"],
      variants: [
        {
          attributes: { "Kích cỡ": "4 x 200mm (Bịch 100 sợi)" },
          price: 19000,
          unit: "Bịch",
          min_stock: 30,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích cỡ": "5 x 300mm (Bịch 100 sợi)" },
          price: 34000,
          unit: "Bịch",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600"],
        },
      ],
    },

    // 11. Đóng gói - Bạt - Dây
    {
      name: "Bạt nhựa 2 da Xanh Cam che phủ nông nghiệp",
      categoryName: "Đóng gói - Bạt - Dây",
      description: "Bạt tráng phủ chống thấm tuyệt đối, may viền đóng khoen che chắn gió rét cho chuồng hở.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Khổ bạt"],
      variants: [
        {
          attributes: { "Khổ bạt": "Khổ 4m x 50m (Cuộn 200m2)" },
          price: 980000,
          unit: "Cuộn",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
        {
          attributes: { "Khổ bạt": "Khổ 6m x 50m (Cuộn 300m2)" },
          price: 1480000,
          unit: "Cuộn",
          min_stock: 3,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
        },
      ],
    },
    {
      name: "Dây thừng bện xoắn Polypropylene chống mục",
      categoryName: "Đóng gói - Bạt - Dây",
      description: "Dây thừng dẻo dai buộc dàn tời bạt và kéo rèm che chuồng trại.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Kích cỡ"],
      variants: [
        {
          attributes: { "Kích cỡ": "Phi 8mm (Cuộn 200m)" },
          price: 340000,
          unit: "Cuộn",
          min_stock: 6,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
        {
          attributes: { "Kích cỡ": "Phi 12mm (Cuộn 200m)" },
          price: 690000,
          unit: "Cuộn",
          min_stock: 4,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
        },
      ],
    },
    {
      name: "Màng PE quấn hàng pallet công nghiệp",
      categoryName: "Đóng gói - Bạt - Dây",
      description: "Màng co dẻo bọc bao cám và vắc xin bảo quản chống ẩm mốc khi lưu kho.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Trọng lượng"],
      variants: [
        {
          attributes: { "Trọng lượng": "Khổ 50cm (Cuộn 3.2kg)" },
          price: 120000,
          unit: "Cuộn",
          min_stock: 25,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
      ],
    },

    // 12. Vật tư Khác
    {
      name: "Vôi bột sát trùng môi trường chuồng trại",
      categoryName: "Vật tư Khác",
      description: "Vôi tôi hoạt tính cao rắc lối đi, hố sát trùng và xử lý đáy chuồng trước khi vào đàn mới.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Bao 25kg" },
          price: 48000,
          unit: "Bao",
          min_stock: 60,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
      ],
    },
    {
      name: "Men vi sinh đệm lót sinh học Balasa N01",
      categoryName: "Vật tư Khác",
      description: "Men ủ phân và phân hủy mùn cưa trấu đệm lót chuồng, giảm mùi hôi khí amoniac tới 90%.",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
      options: ["Quy cách"],
      variants: [
        {
          attributes: { "Quy cách": "Gói 1kg" },
          price: 68000,
          unit: "Gói",
          min_stock: 30,
          images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600"],
          is_default: true,
        },
      ],
    },
  ];

  let totalProductsCount = 0;
  let totalVariantsCount = 0;

  for (const item of catalogSeeds) {
    const catId = getCatId(item.categoryName);
    const { data: prod, error: pErr } = await admin
      .from("products")
      .insert({
        name: item.name,
        category_id: catId,
        description: item.description,
        images: item.images,
        options: item.options,
      })
      .select("id")
      .single();

    if (pErr || !prod) {
      console.warn(`  ⚠️ Lỗi thêm sản phẩm ${item.name}:`, pErr?.message);
      continue;
    }
    totalProductsCount++;

    for (let i = 0; i < item.variants.length; i++) {
      const v = item.variants[i];
      const isDefault = v.is_default ?? i === 0;
      const { error: vErr } = await admin.from("variants").insert({
        product_id: prod.id,
        attributes: v.attributes,
        price: v.price,
        unit: v.unit,
        min_stock: v.min_stock,
        images: v.images,
        is_default: isDefault,
      });
      if (vErr) {
        console.warn(`  ⚠️ Lỗi thêm biến thể:`, vErr.message);
      } else {
        totalVariantsCount++;
      }
    }
  }

  console.log(`  ✅ Đã tạo thành công ${totalProductsCount} sản phẩm với ${totalVariantsCount} biến thể!\n`);

  // Lấy danh sách toàn bộ variants đã tạo
  const { data: allVariants } = await admin
    .from("variants")
    .select("id, price, unit, attributes, products(name, category_id)")
    .order("id");

  const variants = allVariants ?? [];
  const getProdName = (v: { products?: { name: string } | { name: string }[] | null }) => {
    if (!v?.products) return "";
    if (Array.isArray(v.products)) return v.products[0]?.name ?? "";
    return v.products?.name ?? "";
  };

  // Helper tìm variant theo từ khóa tên
  const findVariant = (keyword: string) =>
    variants.find((v) => getProdName(v).toLowerCase().includes(keyword.toLowerCase()))?.id ?? variants[0]?.id;

  // ==========================================
  // 6. KHỞI TẠO TỒN KHO & SỔ CÁI TỒN KHO
  // ==========================================
  console.log("📊 6. Khởi tạo số dư tồn kho tại Kho chính...");

  for (const v of variants) {
    const qty = Math.floor(Math.random() * 80) + 40; // 40 - 120 món
    await admin.from("stock_balances").insert({
      location_id: mainLoc,
      variant_id: v.id,
      quantity: qty,
    });

    await admin.from("stock_movements").insert({
      variant_id: v.id,
      from_location_id: null,
      to_location_id: mainLoc,
      movement_type: "receipt_in",
      quantity: qty,
      notes: "Khởi tạo số dư đầu kỳ hệ thống",
      created_by: managerId,
    });
  }
  console.log(`  ✅ Đã khởi tạo số dư cho ${variants.length} mã vật tư!\n`);

  // ==========================================
  // 7. PHIẾU BÁO HỎNG, ĐỔI MỚI & SỬA CHỮA
  // ==========================================
  console.log("🛠️ 7. Tạo dữ liệu mẫu Phiếu Báo Hỏng, Đổi Mới & Sửa Chữa...");

  const vMotor = findVariant("Động cơ");
  const vQuat = findVariant("Cánh quạt");
  const vMang = findVariant("Máng ăn");
  const vBong = findVariant("Bóng đèn");
  const vVan = findVariant("Van bi");
  const vUng = findVariant("Ủng");
  const vVimekon = findVariant("Vimekon");

  // 1. HONG-0001: Mới báo hỏng tại chuồng (chưa về kho tập kết)
  const { data: h1 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0001",
      status: "staging",
      source_location_id: mainLoc,
      reported_by: requesterId,
      collected_at: null,
      notes: "Bóng đèn sưởi úm bị đứt tóc sau đợt rét đậm",
      created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    })
    .select("id")
    .single();

  if (h1) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h1.id,
      variant_id: vBong,
      quantity: 3,
      damage_detail: "Đứt tóc sợi đốt bóng úm do chập điện nhánh",
      damage_type: "electrical",
      severity: "medium",
      images: ["https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400"],
    });
  }

  // 2. HONG-0002 & DM-0001: Báo hỏng và đang yêu cầu Đổi Mới (pending)
  const { data: h2 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0002",
      status: "staging",
      source_location_id: mainLoc,
      reported_by: staffId,
      collected_at: null,
      notes: "Quạt thông gió chuồng A2 bị cong vênh cánh inox",
      created_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    })
    .select("id")
    .single();

  if (h2) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h2.id,
      variant_id: vQuat,
      quantity: 1,
      damage_detail: "Cánh quạt bị va quẹt biến dạng gây rung lắc mạnh",
      damage_type: "broken",
      severity: "severe",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
    });

    const { data: dm1 } = await admin
      .from("exchange_notes")
      .insert({
        code: "DM-0001",
        linked_defect_id: h2.id,
        status: "pending",
        created_by: staffId,
        created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      })
      .select("id")
      .single();

    if (dm1) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: dm1.id,
        variant_id: vQuat,
        quantity: 1,
      });
    }
  }

  // 3. HONG-0003 & DM-0002: Đổi mới đã được Quản lý duyệt (approved)
  const { data: h3 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0003",
      status: "staging",
      source_location_id: mainLoc,
      reported_by: requesterId,
      collected_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      collected_by: managerId,
      notes: "Máng ăn tự động bị nứt vỡ vành chống bới",
      created_at: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
    })
    .select("id")
    .single();

  if (h3) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h3.id,
      variant_id: vMang,
      quantity: 4,
      damage_detail: "Nứt vỡ góc máng ăn do va chạm xe cám",
      damage_type: "cracked",
      severity: "medium",
      images: ["https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=400"],
    });

    const { data: dm2 } = await admin
      .from("exchange_notes")
      .insert({
        code: "DM-0002",
        linked_defect_id: h3.id,
        status: "approved",
        created_by: requesterId,
        approved_by: managerId,
        created_at: new Date(Date.now() - 3600 * 1000 * 9).toISOString(),
        approved_at: new Date(Date.now() - 3600 * 1000 * 7).toISOString(),
      })
      .select("id")
      .single();

    if (dm2) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: dm2.id,
        variant_id: vMang,
        quantity: 4,
      });
    }
  }

  // 4. HONG-0004: Đang gửi sửa chữa ngoài & đơn sửa SC-0001
  const { data: h4 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0004",
      status: "in_repair",
      source_location_id: mainLoc,
      reported_by: staff3Id,
      collected_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
      collected_by: managerId,
      notes: "Động cơ quạt 2.2kW bị om dây cháy cuộn khởi động",
      created_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    })
    .select("id")
    .single();

  if (h4) {
    const { data: dni4 } = await admin
      .from("defect_note_items")
      .insert({
        defect_note_id: h4.id,
        variant_id: vMotor,
        quantity: 2,
        damage_detail: "Cháy cuộn dây pha B do sụt áp nguồn",
        damage_type: "electrical",
        severity: "severe",
        images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
      })
      .select("id")
      .single();

    const { data: rep1 } = await admin
      .from("repair_orders")
      .insert({
        code: "SC-0001",
        vendor: "Công ty Cổ phần Cơ điện Nam Phát",
        status: "in_repair",
        sent_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString().split("T")[0],
        expected_return_at: new Date(Date.now() + 3600 * 1000 * 48).toISOString().split("T")[0],
        total_cost: 950000,
        notes: "Gửi quấn lại dây đồng chịu nhiệt Class H cho 2 motor",
        created_by: managerId,
      })
      .select("id")
      .single();

    if (rep1 && dni4) {
      await admin.from("repair_order_items").insert({
        repair_order_id: rep1.id,
        defect_item_id: dni4.id,
        variant_id: vMotor,
        quantity: 2,
        repair_detail: "Quấn lại cuộn dây đồng 100% và thay thế 2 vòng bi SKF 6205",
        cost: 950000,
      });
    }
  }

  // 5. HONG-0005 & DM-0003: Đổi mới hoàn tất đã bàn giao nhận hàng (received)
  const { data: h5 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0005",
      status: "staging",
      source_location_id: mainLoc,
      reported_by: staffId,
      collected_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      collected_by: managerId,
      notes: "Van bi DN25 bị rò rỉ nước tại gioăng làm ướt hành lang",
      created_at: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
    })
    .select("id")
    .single();

  if (h5) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h5.id,
      variant_id: vVan,
      quantity: 5,
      damage_detail: "Rách gioăng teflon chặn bi",
      damage_type: "worn",
      severity: "light",
      images: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"],
    });

    const { data: dm3 } = await admin
      .from("exchange_notes")
      .insert({
        code: "DM-0003",
        linked_defect_id: h5.id,
        status: "received",
        created_by: staffId,
        approved_by: managerId,
        issued_by: managerId,
        received_by: staffId,
        created_at: new Date(Date.now() - 3600 * 1000 * 55).toISOString(),
        approved_at: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
        issued_at: new Date(Date.now() - 3600 * 1000 * 46).toISOString(),
        received_at: new Date(Date.now() - 3600 * 1000 * 44).toISOString(),
      })
      .select("id")
      .single();

    if (dm3) {
      await admin.from("exchange_note_items").insert({
        exchange_note_id: dm3.id,
        variant_id: vVan,
        quantity: 5,
      });
    }
  }

  // 6. HONG-0006: Đã sửa chữa hoàn tất và trả về kho (returned)
  const { data: h6 } = await admin
    .from("defect_notes")
    .insert({
      code: "HONG-0006",
      status: "returned",
      source_location_id: mainLoc,
      reported_by: requesterId,
      collected_at: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
      collected_by: managerId,
      notes: "Bơm chìm xịt rửa chuồng trại bị kẹt rác cánh bơm",
      created_at: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
    })
    .select("id")
    .single();

  if (h6) {
    await admin.from("defect_note_items").insert({
      defect_note_id: h6.id,
      variant_id: findVariant("Bơm nước"),
      quantity: 1,
      damage_detail: "Kẹt phốt cơ khí và mòn cánh bơm đồng",
      damage_type: "worn",
      severity: "medium",
      resolution: "repaired",
      images: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
    });
  }

  console.log("  ✅ Đã tạo các phiếu Báo Hỏng, Đổi Mới và Sửa Chữa hoàn chỉnh!\n");

  // ==========================================
  // 8. PHIẾU YÊU CẦU CẤP PHÁT (REQUISITIONS)
  // ==========================================
  console.log("📝 8. Tạo dữ liệu mẫu Phiếu Yêu Cầu Cấp Phát (Requisitions)...");

  // YC-0001: Trạng thái draft (Nháp)
  const { data: req1 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0001",
      zone_id: zone1,
      requester_id: requesterId,
      status: "draft",
      purpose: "Dự trù vật tư bảo hộ lao động cho đợt tuyển công nhân mới đầu tháng",
      created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    })
    .select("id")
    .single();

  if (req1) {
    await admin.from("requisition_items").insert([
      { requisition_id: req1.id, variant_id: vUng, quantity: 5 },
      { requisition_id: req1.id, variant_id: findVariant("Găng tay"), quantity: 10 },
    ]);
  }

  // YC-0002: Trạng thái pending (Chờ duyệt)
  const { data: req2 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0002",
      zone_id: zone2,
      requester_id: staffId,
      status: "pending",
      purpose: "Cấp phát thuốc sát trùng Vimekon phun xịt khử khuẩn định kỳ chuồng B",
      created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    })
    .select("id")
    .single();

  if (req2) {
    await admin.from("requisition_items").insert([
      { requisition_id: req2.id, variant_id: vVimekon, quantity: 8 },
      { requisition_id: req2.id, variant_id: findVariant("Bộ quần áo bảo hộ"), quantity: 15 },
    ]);
  }

  // YC-0003: Trạng thái approved (Đã duyệt - chờ kho xuất)
  const { data: req3 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0003",
      zone_id: zone3,
      requester_id: staff3Id,
      approved_by: managerId,
      status: "approved",
      purpose: "Vật tư bảo dưỡng thay thế định kỳ hệ thống truyền động quạt hút",
      approved_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    })
    .select("id")
    .single();

  if (req3) {
    await admin.from("requisition_items").insert([
      { requisition_id: req3.id, variant_id: findVariant("Dây curoa"), quantity: 6 },
      { requisition_id: req3.id, variant_id: findVariant("Vòng bi"), quantity: 8 },
      { requisition_id: req3.id, variant_id: findVariant("Mỡ bôi trơn"), quantity: 2 },
    ]);
  }

  // YC-0004: Trạng thái issued (Kho đã xuất - đang chờ người nhận xác nhận)
  const { data: req4 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0004",
      zone_id: zone1,
      requester_id: requesterId,
      approved_by: managerId,
      fulfilled_by: managerId,
      status: "issued",
      purpose: "Cấp bổ sung bóng sưởi úm gia cầm non chuồng A1",
      approved_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
      fulfilled_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    })
    .select("id")
    .single();

  if (req4) {
    await admin.from("requisition_items").insert([
      { requisition_id: req4.id, variant_id: vBong, quantity: 15 },
      { requisition_id: req4.id, variant_id: findVariant("Dây rút"), quantity: 5 },
    ]);
  }

  // YC-0005: Trạng thái received (Đã giao nhận hoàn tất)
  const { data: req5 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0005",
      zone_id: zone2,
      requester_id: staffId,
      approved_by: managerId,
      fulfilled_by: managerId,
      received_by: staffId,
      status: "received",
      purpose: "Cấp vôi bột và bạt phủ cách nhiệt xử lý chuồng trước khi đón gà",
      approved_at: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
      fulfilled_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
      received_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    })
    .select("id")
    .single();

  if (req5) {
    await admin.from("requisition_items").insert([
      { requisition_id: req5.id, variant_id: findVariant("Vôi bột"), quantity: 20 },
      { requisition_id: req5.id, variant_id: findVariant("Bạt nhựa"), quantity: 2 },
    ]);
  }

  // YC-0006: Trạng thái rejected (Từ chối duyệt)
  const { data: req6 } = await admin
    .from("requisitions")
    .insert({
      code: "YC-0006",
      zone_id: zone1,
      requester_id: requesterId,
      approved_by: managerId,
      status: "rejected",
      rejection_reason: "Số lượng yêu cầu vượt định mức tháng, vui lòng kiểm kê lại kho nhánh trước khi đề xuất.",
      approved_at: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 16).toISOString(),
    })
    .select("id")
    .single();

  if (req6) {
    await admin.from("requisition_items").insert([
      { requisition_id: req6.id, variant_id: findVariant("Máy siết bulong"), quantity: 3 },
    ]);
  }

  console.log("  ✅ Đã tạo các phiếu Yêu Cầu Cấp Phát đủ trạng thái!\n");

  // ==========================================
  // 9. PHIẾU NHẬP KHO & ĐẶT HÀNG (RECEIPTS)
  // ==========================================
  console.log("🚚 9. Tạo dữ liệu mẫu Phiếu Nhập Kho & Đặt Hàng (Receipts)...");

  // GRN-0001: draft (Phiếu đặt hàng nháp)
  const { data: rc1 } = await admin
    .from("receipts")
    .insert({
      code: "GRN-0001",
      supplier_id: supplierNamPhat,
      status: "draft",
      created_by: managerId,
      notes: "Đơn đặt hàng phụ tùng cơ điện dự phòng tháng tới",
      created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    })
    .select("id")
    .single();

  if (rc1) {
    await admin.from("receipt_items").insert([
      { receipt_id: rc1.id, variant_id: vMotor, quantity: 5, unit_cost: 2300000 },
      { receipt_id: rc1.id, variant_id: findVariant("Khởi động từ"), quantity: 10, unit_cost: 310000 },
    ]);
  }

  // GRN-0002: approved (Quản lý duyệt đơn hàng, đang chờ giao)
  const { data: rc2 } = await admin
    .from("receipts")
    .insert({
      code: "GRN-0002",
      supplier_id: supplierAnBinh,
      status: "approved",
      created_by: managerId,
      approved_by: managerId,
      approved_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      notes: "Đặt hàng thuốc khử trùng chuồng trại phòng dịch cao điểm",
      created_at: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
    })
    .select("id")
    .single();

  if (rc2) {
    await admin.from("receipt_items").insert([
      { receipt_id: rc2.id, variant_id: vVimekon, quantity: 40, unit_cost: 160000 },
      { receipt_id: rc2.id, variant_id: findVariant("Hóa chất tẩy cặn"), quantity: 10, unit_cost: 820000 },
    ]);
  }

  // GRN-0003: posted (Đã kiểm đếm & hoàn tất nhập kho)
  const { data: rc3 } = await admin
    .from("receipts")
    .insert({
      code: "GRN-0003",
      supplier_id: supplierTienDat,
      status: "posted",
      created_by: managerId,
      approved_by: managerId,
      approved_at: new Date(Date.now() - 3600 * 1000 * 40).toISOString(),
      notes: "Nhập kho kim khí, bulong inox và vật tư gia cố mái chuồng",
      created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    })
    .select("id")
    .single();

  if (rc3) {
    await admin.from("receipt_items").insert([
      {
        receipt_id: rc3.id,
        variant_id: findVariant("Bulong lục giác"),
        quantity: 30,
        unit_cost: 110000,
        batch_no: "TD-2026-08A",
        expiry_date: null,
      },
      {
        receipt_id: rc3.id,
        variant_id: findVariant("Vít tự khoan"),
        quantity: 25,
        unit_cost: 120000,
        batch_no: "TD-2026-08B",
        expiry_date: null,
      },
      {
        receipt_id: rc3.id,
        variant_id: findVariant("Que hàn điện"),
        quantity: 20,
        unit_cost: 150000,
        batch_no: "KT-421-99",
        expiry_date: "2028-12-31",
      },
    ]);
  }

  console.log("  ✅ Đã tạo các phiếu Nhập Kho hoàn chỉnh!\n");

  // ==========================================
  // 10. PHIẾU XUẤT KHO (ISSUES)
  // ==========================================
  console.log("📤 10. Tạo dữ liệu mẫu Phiếu Xuất Kho (Issues)...");

  // XK-0001: draft
  const { data: is1 } = await admin
    .from("issues")
    .insert({
      code: "PXK-0001",
      destination_type: "customer",
      customer_id: customerBaVi,
      zone_id: null,
      creator_id: managerId,
      status: "draft",
      vehicle_plate: "29H-123.45",
      driver_name: "Nguyễn Văn Lái",
      notes: "Phiếu xuất nháp chuẩn bị xuất bán vật tư cho Trang trại Ba Vì",
      created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    })
    .select("id")
    .single();

  if (is1) {
    await admin.from("issue_items").insert([
      { issue_id: is1.id, variant_id: vMang, quantity: 15, unit_price: 85000 },
      { issue_id: is1.id, variant_id: vBong, quantity: 20, unit_price: 90000 },
    ]);
  }

  // XK-0002: posted (Xuất bán Khách hàng Ba Vì)
  const { data: is2 } = await admin
    .from("issues")
    .insert({
      code: "PXK-0002",
      destination_type: "customer",
      customer_id: customerBaVi,
      zone_id: null,
      creator_id: managerId,
      status: "posted",
      vehicle_plate: "29C-889.90",
      driver_name: "Trần Văn Bình",
      notes: "Xuất bán máng ăn và hệ thống núm uống tự động",
      created_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
    })
    .select("id")
    .single();

  if (is2) {
    await admin.from("issue_items").insert([
      { issue_id: is2.id, variant_id: vMang, quantity: 20, unit_price: 88000 },
      { issue_id: is2.id, variant_id: findVariant("Núm uống"), quantity: 50, unit_price: 22000 },
      { issue_id: is2.id, variant_id: findVariant("Tấm lót sàn"), quantity: 30, unit_price: 105000 },
    ]);
  }

  // XK-0003: posted (Xuất điều chuyển nội bộ cho Khu 1)
  const { data: is3 } = await admin
    .from("issues")
    .insert({
      code: "PXK-0003",
      destination_type: "zone",
      zone_id: zone1,
      customer_id: null,
      creator_id: managerId,
      status: "posted",
      vehicle_plate: "61C-123.45",
      driver_name: "Vũ Đình Tài",
      notes: "Xuất điều động vật tư lưới bạt và dây thừng chống bão",
      created_at: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
    })
    .select("id")
    .single();

  if (is3) {
    await admin.from("issue_items").insert([
      { issue_id: is3.id, variant_id: findVariant("Bạt nhựa"), quantity: 3, unit_price: 0 },
      { issue_id: is3.id, variant_id: findVariant("Dây thừng"), quantity: 4, unit_price: 0 },
    ]);
  }

  // XK-0004: posted (Xuất bán Nông trại Tam Đảo)
  const { data: is4 } = await admin
    .from("issues")
    .insert({
      code: "PXK-0004",
      destination_type: "customer",
      customer_id: customerTamDao,
      zone_id: null,
      creator_id: managerId,
      status: "posted",
      vehicle_plate: "88C-567.89",
      driver_name: "Lê Văn Tiến",
      notes: "Xuất bán thiết bị châm thuốc Dosatron và cảm biến nhiệt độ chuồng",
      created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    })
    .select("id")
    .single();

  if (is4) {
    await admin.from("issue_items").insert([
      { issue_id: is4.id, variant_id: findVariant("Dosatron"), quantity: 1, unit_price: 8500000 },
      { issue_id: is4.id, variant_id: findVariant("Cảm biến"), quantity: 4, unit_price: 420000 },
    ]);
  }

  console.log("  ✅ Đã tạo các phiếu Xuất Kho thành công!\n");

  // ==========================================
  // 11. PHIẾU THANH LÝ (LIQUIDATIONS)
  // ==========================================
  console.log("♻️ 11. Tạo dữ liệu mẫu Phiếu Thanh Lý (Liquidations)...");

  const { data: lq1 } = await admin
    .from("liquidation_notes")
    .insert({
      code: "TL-0001",
      status: "completed",
      reason: "Thanh lý máng ăn cũ hỏng vỡ và quạt hỏng nát không thể phục hồi",
      approved_by: managerId,
      approved_at: new Date(Date.now() - 3600 * 1000 * 80).toISOString(),
      completed_at: new Date(Date.now() - 3600 * 1000 * 75).toISOString(),
      created_by: managerId,
      notes: "Đã bán phế liệu thu hồi cho vựa ve chai Lương Sơn",
      created_at: new Date(Date.now() - 3600 * 1000 * 90).toISOString(),
    })
    .select("id")
    .single();

  if (lq1) {
    await admin.from("liquidation_items").insert([
      {
        liquidation_note_id: lq1.id,
        variant_id: vMang,
        quantity: 12,
        method: "sale",
        unit_value: 10000,
        proceeds: 120000,
        notes: "Nhựa vỡ bán tái chế",
      },
      {
        liquidation_note_id: lq1.id,
        variant_id: vQuat,
        quantity: 2,
        method: "sale",
        unit_value: 50000,
        proceeds: 100000,
        notes: "Inox cong vênh phế liệu",
      },
    ]);
  }

  // ==========================================
  // 12. PHIẾU KIỂM KÊ (STOCKTAKES)
  // ==========================================
  console.log("📋 12. Tạo dữ liệu mẫu Phiếu Kiểm Kê Kho (Stocktakes)...");

  // KK-0001: posted (Kiểm kê định kỳ tháng trước đã chốt)
  const { data: st1 } = await admin
    .from("stocktake_sessions")
    .insert({
      code: "KK-0001",
      name: "Kiểm kê định kỳ Kho chính đầu quý 3",
      location_id: mainLoc,
      status: "posted",
      notes: "Kiểm kê toàn bộ vật tư cơ điện và phụ tùng thay thế",
      created_by: managerId,
      posted_at: new Date(Date.now() - 3600 * 1000 * 100).toISOString(),
      created_at: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
    })
    .select("id")
    .single();

  if (st1) {
    const sampleVariants = variants.slice(0, 8);
    for (const sv of sampleVariants) {
      await admin.from("stocktake_items").insert({
        session_id: st1.id,
        variant_id: sv.id,
        system_qty: 50,
        actual_qty: 50,
        checked: true,
        notes: "Khớp số liệu phần mềm",
      });
    }
  }

  // KK-0002: draft (Đợt kiểm kê đột xuất đang tiến hành)
  const { data: st2 } = await admin
    .from("stocktake_sessions")
    .insert({
      code: "KK-0002",
      name: "Kiểm kê đột xuất nhóm Bảo hộ & Hóa chất",
      location_id: mainLoc,
      status: "draft",
      notes: "Đang tiến hành đếm thực tế tại kệ số 3",
      created_by: managerId,
      created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    })
    .select("id")
    .single();

  if (st2) {
    const sampleVariants2 = variants.slice(8, 14);
    for (let i = 0; i < sampleVariants2.length; i++) {
      const sv = sampleVariants2[i];
      await admin.from("stocktake_items").insert({
        session_id: st2.id,
        variant_id: sv.id,
        system_qty: 60,
        actual_qty: i % 2 === 0 ? 60 : 58,
        checked: i < 3,
        notes: i % 2 === 0 ? "Đầy đủ" : "Lệch 2 do đã cấp chưa kịp nhập phiếu",
      });
    }
  }

  // ==========================================
  // 13. KHO DẦU & PHƯƠNG TIỆN (FUEL & VEHICLES)
  // ==========================================
  console.log("⛽ 13. Khởi tạo Phân hệ Kho Dầu, Xe & Cấp phát Nhiên liệu...");

  // Fuel types
  const fuelTypesData = [
    {
      code: "DO-005S",
      name: "Dầu Diesel DO 0.05S-II",
      unit: "lít",
      current_stock: 4500.0,
      min_stock: 1000.0,
      description: "Dầu chạy xe tải, xe xúc lật và máy phát điện dự phòng",
      is_active: true,
    },
    {
      code: "RON-95",
      name: "Xăng không chì RON 95-III",
      unit: "lít",
      current_stock: 850.0,
      min_stock: 200.0,
      description: "Xăng chạy máy cắt cỏ, máy xịt rửa và xe máy tuần tra",
      is_active: true,
    },
    {
      code: "NHOT-15W40",
      name: "Nhớt động cơ Diesel 15W-40",
      unit: "lít",
      current_stock: 320.0,
      min_stock: 50.0,
      description: "Dầu nhớt bôi trơn thay định kỳ cho động cơ xe tải",
      is_active: true,
    },
  ];

  for (const ft of fuelTypesData) {
    await admin.from("fuel_types").upsert(ft, { onConflict: "code" });
  }

  const { data: allFuelTypes } = await admin.from("fuel_types").select("id, code, name");
  const ftDO = allFuelTypes?.find((f) => f.code === "DO-005S")?.id;
  const ftRON = allFuelTypes?.find((f) => f.code === "RON-95")?.id;

  if (ftDO) {
    // Vehicles
    const vehiclesData: Array<Record<string, unknown>> = [
      {
        code: "61C-123.45",
        name: "Xe tải Isuzu 3.5 tấn (Vận chuyển cám)",
        type: "truck" as const,
        zone_id: zone1,
        default_driver: "Vũ Đình Tài",
        fuel_type_id: ftDO,
        current_odo: 45280.0,
        odo_unit: "km" as const,
        fuel_norm: 14.5, // 14.5 lít / 100km
        qr_token: "61C-123.45",
        notes: "Xe chở thức ăn chăn nuôi tuyến Kho chính - Khu 1 - Khu 2",
        is_active: true,
      },
      {
        code: "60H-987.65",
        name: "Xe tải ben Hyundai 5 tấn (Chở phân & phế phụ phẩm)",
        type: "truck" as const,
        zone_id: zone4,
        default_driver: "Trần Văn Bình",
        fuel_type_id: ftDO,
        current_odo: 82150.0,
        odo_unit: "km" as const,
        fuel_norm: 18.0,
        qr_token: "60H-987.65",
        notes: "Chuyên dụng chở chất thải và mùn cưa đệm lót",
        is_active: true,
      },
      {
        code: "XL-01",
        name: "Xe xúc lật Komatsu WA100",
        type: "excavator" as const,
        zone_id: zone4,
        default_driver: "Lê Văn Tiến",
        fuel_type_id: ftDO,
        current_odo: 3420.0,
        odo_unit: "hours" as const,
        fuel_norm: 6.5, // 6.5 lít / giờ
        qr_token: "XL-01",
        notes: "Xúc nguyên liệu ủ phân vi sinh",
        is_active: true,
      },
      {
        code: "MPD-01",
        name: "Máy phát điện dự phòng Cummins 50kVA",
        type: "generator" as const,
        zone_id: zone3,
        default_driver: "Nguyễn Văn An",
        fuel_type_id: ftDO,
        current_odo: 580.0,
        odo_unit: "hours" as const,
        fuel_norm: 11.0, // 11 lít / giờ
        qr_token: "MPD-01",
        notes: "Phát điện dự phòng khi lưới điện quốc gia mất áp",
        is_active: true,
      },
    ];

    for (const v of vehiclesData) {
      await admin.from("vehicles").upsert(v, { onConflict: "code" });
    }

    const { data: allVehicles } = await admin.from("vehicles").select("id, code, name");
    const vTruck = allVehicles?.find((v) => v.code === "61C-123.45")?.id;
    const vGenerator = allVehicles?.find((v) => v.code === "MPD-01")?.id;

    // Phiếu nhập dầu PN-DAU-0001
    const { data: fr1 } = await admin
      .from("fuel_receipts")
      .insert({
        code: "PN-DAU-0001",
        supplier_id: supplierPetrolimex,
        fuel_type_id: ftDO,
        quantity: 5000.0,
        unit_price: 19800.0,
        total_amount: 99000000.0,
        invoice_number: "HD-PLX-88991",
        received_by: managerId,
        notes: "Nhập bồn dầu DO 0.05S-II định kỳ từ Petrolimex",
        status: "completed",
        created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
      })
      .select("id")
      .single();

    if (fr1) {
      await admin.from("fuel_movements").insert({
        fuel_type_id: ftDO,
        movement_type: "receipt_in",
        quantity: 5000.0,
        balance_after: 5000.0,
        ref_type: "fuel_receipt",
        ref_id: fr1.id,
        notes: "Nhập bồn dầu 5.000 lít",
        created_by: managerId,
        created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
      });
    }

    // Phiếu cấp phát dầu PX-DAU-0001 cho xe tải 61C-123.45
    if (vTruck) {
      const { data: fd1 } = await admin
        .from("fuel_dispenses")
        .insert({
          code: "PX-DAU-0001",
          vehicle_id: vTruck,
          zone_id: zone1,
          fuel_type_id: ftDO,
          quantity: 80.0,
          previous_odo: 44730.0,
          current_odo: 45280.0,
          usage_diff: 550.0, // Đi 550 km
          consumption_rate: 14.55, // 14.55 L/100km
          driver_name: "Vũ Đình Tài",
          dispenser_id: managerId,
          notes: "Bơm đầy bình xe tải Isuzu chuyến giao cám Khu 1 & Khu 2",
          status: "completed",
          created_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
        })
        .select("id")
        .single();

      if (fd1) {
        await admin.from("fuel_movements").insert({
          fuel_type_id: ftDO,
          movement_type: "dispense_out",
          quantity: -80.0,
          balance_after: 4920.0,
          ref_type: "fuel_dispense",
          ref_id: fd1.id,
          notes: "Cấp phát 80L dầu DO cho xe 61C-123.45",
          created_by: managerId,
          created_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString(),
        });
      }
    }

    // Phiếu cấp phát dầu PX-DAU-0002 cho máy phát điện MPD-01
    if (vGenerator) {
      const { data: fd2 } = await admin
        .from("fuel_dispenses")
        .insert({
          code: "PX-DAU-0002",
          vehicle_id: vGenerator,
          zone_id: zone3,
          fuel_type_id: ftDO,
          quantity: 120.0,
          previous_odo: 569.0,
          current_odo: 580.0,
          usage_diff: 11.0, // Chạy 11 giờ
          consumption_rate: 10.91, // 10.91 L/giờ
          driver_name: "Nguyễn Văn An",
          dispenser_id: managerId,
          notes: "Bơm tiếp dầu thùng máy phát điện dự phòng chạy đợt mưa bão",
          status: "completed",
          created_at: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
        })
        .select("id")
        .single();

      if (fd2) {
        await admin.from("fuel_movements").insert({
          fuel_type_id: ftDO,
          movement_type: "dispense_out",
          quantity: -120.0,
          balance_after: 4800.0,
          ref_type: "fuel_dispense",
          ref_id: fd2.id,
          notes: "Cấp phát 120L dầu DO cho máy phát điện MPD-01",
          created_by: managerId,
          created_at: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
        });
      }
    }
  }

  console.log("  ✅ Đã khởi tạo dữ liệu Nhiên liệu, Phương tiện & Sổ cái dầu thành công!\n");

  // ==========================================
  // TỔNG KẾT
  // ==========================================
  console.log("=======================================================");
  console.log("🎉 HOÀN TẤT TẠO DỮ LIỆU FAKE ĐẦY ĐỦ CHO REPO!");
  console.log("=======================================================");
  console.log("👉 Tài khoản đăng nhập kiểm tra:");
  console.log("  1. Quản trị viên (Superuser):  username: admin     / pass: password123");
  console.log("  2. Quản lý kho (Manager):      username: manager   / pass: password123");
  console.log("  3. Trưởng Khu 1 (Requester):   username: requester / pass: password123 (Khu 1)");
  console.log("  4. Kỹ thuật Khu 2 (Requester): username: staff     / pass: password123 (Khu 2)");
  console.log("  5. Kỹ thuật Khu 3 (Requester): username: staff3    / pass: password123 (Khu 3)");
  console.log("  6. Tài xế Xe tải (Requester):  username: driver1   / pass: password123");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("❌ Lỗi trong quá trình khởi tạo fake data:", err);
  process.exit(1);
});
