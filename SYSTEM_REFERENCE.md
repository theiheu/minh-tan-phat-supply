# SYSTEM REFERENCE — Hệ thống cũ "Quản lý Vật tư Trại Gà" (K-MTP-PRo / SupplyHub)

> Tài liệu tham chiếu hệ thống cũ, dùng để build lại repo `minh-tan-phat-supply` mà **không cần đọc lại code cũ**.
> Kết hợp với `DESIGN_PLAN.md` (thiết kế mới) để triển khai.

---

## 1. Tổng quan hệ thống

- **Mục đích:** quản lý vật tư trại gà — từ danh mục sản phẩm, phiếu yêu cầu, phiếu nhập kho, phiếu giao nhận và kiểm tra chất lượng.
- **Đối tượng:** 2 vai trò — **Requester (người yêu cầu)** và **Manager (quản lý kho)**.
- **Stack cũ:** React 19 + TypeScript + Vite, Bun, Supabase (PostgreSQL), Gemini AI chatbot, react-hot-toast, heic2any.

## 2. Vai trò & xác thực (bản cũ)

| Vai trò | Quyền | Cách đăng nhập (cũ) |
|---|---|---|
| `requester` | Xem kho, thêm giỏ, tạo phiếu yêu cầu, xem phiếu của mình | Chọn/nhập **tên** trong danh sách `USERS` (không mật khẩu) |
| `manager` | Toàn quyền: quản lý SP/DM/khu vực, phiếu nhập, cấp phát, giao nhận, dashboard | Nhập mật khẩu demo **`admin123`** |

> **Thiết kế mới:** thay bằng **Supabase Auth** (email/password) + bảng `profiles` + RLS. Giữ nguyên ý nghĩa 2 vai trò.

## 3. Danh sách màn hình (views) cũ

| View key | Màn hình | Role |
|---|---|---|
| `dashboard` | Dashboard (thống kê) | cả 2 |
| `shop` | Kho vật tư (catalog + search + danh mục + giỏ) | cả 2 |
| `requisitions` | Danh sách phiếu yêu cầu (+ cấp phát, sửa, xóa) | cả 2 |
| `create-requisition` | Tạo phiếu yêu cầu | requester |
| `receipts` | Danh sách phiếu nhập kho | manager |
| `create-receipt` | Tạo phiếu nhập kho (+ auto cấp phát) | manager |
| `deliveries` | Danh sách phiếu giao nhận (+ xác nhận/từ chối) | manager |
| `create-delivery` | Tạo phiếu giao nhận | manager |
| `admin` | Quản trị: Sản phẩm / Danh mục / Khu vực | manager |

---

## 4. Mô hình dữ liệu (types cũ — hợp đồng dữ liệu)

```ts
export interface ChildComponent { variantId: number; quantity: number; }

export interface Variant {
  id: number;
  attributes: { [key: string]: string };  // VD { "Trọng lượng": "Bao 10kg" }
  stock: number;
  price?: number;
  images?: string[];
  unit?: string;
  components?: ChildComponent[];          // composite product
}

export interface Product {
  id: number;
  name: string;
  description: string;
  images: string[];
  category: string;                        // tên danh mục (không phải FK)
  options: string[];                       // VD ["Trọng lượng", "Liều"]
  variants: Variant[];
}

export interface Category { name: string; icon: string; } // icon = Base64 data URL

export interface CartItem { product: Product; variant: Variant; quantity: number; }

export type Status = "Đang chờ xử lý" | "Đã hoàn thành";

export interface RequisitionForm {
  id: string;                              // "REQ-<timestamp>"
  requesterName: string;
  zone: string;
  purpose: string;
  items: CartItem[];
  status: Status;
  createdAt: string;
  fulfilledBy?: string;
  fulfilledAt?: string;
  fulfillmentNotes?: string;
}

export type UserRole = "requester" | "manager";

export interface Zone { id: string; name: string; description?: string; createdAt: string; }

export interface User { id: string; name: string; role: UserRole; zone?: string; }

export interface ReceiptItem {
  variantId: number;
  productId: number;
  quantity: number;
  productName?: string;                    // chỉ hiển thị
  variantAttributes?: { [key: string]: string };
  unit?: string;
}

export interface GoodsReceiptNote {
  id: string;                              // "GRN-<timestamp>"
  supplier: string;
  items: ReceiptItem[];
  createdAt: string;
  createdBy: string;
  notes?: string;
  linkedRequisitionIds?: string[];         // các phiếu yêu cầu được auto cấp phát
}

export type AdminTab = "products" | "categories" | "zones" | "deliveries";

// ---- Phiếu giao nhận (Delivery Note) ----
export type DeliveryStatus = "pending" | "verified" | "rejected";

export interface DeliveryItem {
  variantId: number;
  productId: number;
  quantity: number;
  actualQuantity?: number;                 // số lượng thực nhận sau kiểm
  qualityIssue?: boolean;
  issueNotes?: string;
  productName?: string;
  variantAttributes?: { [key: string]: string };
  unit?: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  condition?: "good" | "damaged" | "partial";
  damageDescription?: string;
  replacementNeeded?: boolean;
  qualityChecks?: {
    visualInspection: boolean;
    measurementCheck?: boolean;
    functionalTest?: boolean;
    notes?: string;
  };
  trackingInfo?: { location?: string; status?: string; lastUpdate?: string; };
}

export interface DeliveryHistory {
  timestamp: string;
  action: string;
  user: string;
  notes?: string;
  metadata?: { oldValue?: any; newValue?: any; type?: string; };
}

export interface DeliveryVerification {
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
  itemChecks: {
    [itemId: string]: {
      actualQuantity: number;
      hasIssue: boolean;
      issueNote?: string;
      checkedBy: string;
      checkedAt: string;
    };
  };
}

export interface DeliveryNote {
  id: string;                              // "DN-<timestamp>"
  items: DeliveryItem[];
  receiptId: string;                       // tham chiếu phiếu nhập
  shipperId: string;
  status: DeliveryStatus;
  createdBy: string;
  createdAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  history?: DeliveryHistory[];
  hasIssues?: boolean;
  rejectionReason?: string;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  expectedDeliveryDate?: string;
  lastModified?: string;
  verification?: DeliveryVerification;
  batchId?: string;
  processingDuration?: number;             // phút
  quality?: { rating: 1|2|3|4|5; comments?: string; reviewedBy?: string; reviewedAt?: string; };
}

export interface DeliveryStats {
  totalCount: number;
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  withIssuesCount: number;
  completionRate: number;
  averageVerificationTime: number;         // phút
}
```

---

## 5. Quy tắc nghiệp vụ (business rules)

### 5.1 Tính tồn kho (composite product)
- Variant thường: stock = `variant.stock`.
- Variant **composite** (có `components`): tồn = `min(floor(componentStock / component.quantity))` trên mọi component. Thiếu 1 component → tồn = 0.
- Component giả định **không thể** là composite lồng nhau.

### 5.2 Cấp phát phiếu yêu cầu (fulfill)
1. Kiểm tra tồn từng item (dùng `calculateVariantStock`). Thiếu → báo lỗi liệt kê từng món thiếu, không cấp phát.
2. Nếu đủ: trừ stock —
   - Composite: trừ từng component `component.quantity × item.quantity`.
   - Thường: trừ `variant.stock` đúng `item.quantity`.
3. Cập nhật phiếu: `status = "Đã hoàn thành"`, `fulfilledBy`, `fulfillmentNotes`, `fulfilledAt`.

### 5.3 Tạo phiếu nhập kho + auto cấp phát
1. Cộng stock cho từng item phiếu nhập (tìm product→variant, `stock += quantity`).
2. Lấy danh sách phiếu yêu cầu `"Đang chờ xử lý"`, **sắp xếp theo `createdAt` tăng dần** (FIFO).
3. Lần lượt thử cấp phát từng phiếu chờ (dùng luồng 5.2). Thành công → ghi id vào `linkedRequisitionIds`.
4. Tạo phiếu nhập (`GRN-<timestamp>`), lưu `createdBy = tên manager`.

### 5.4 Giỏ hàng
- Thêm item: nếu variant đã có → cộng `quantity`; ngược lại thêm mới.
- Đổi variant trong giỏ: nếu variant mới đã tồn tại → gộp số lượng và xóa dòng cũ; ngược lại thay variant cũ.
- `quantity` luôn ≥ 1.
- "Yêu cầu nhanh" (`handleQuickRequest`) hiện chỉ = thêm vào giỏ (chưa có hành vi riêng).

### 5.5 Quản trị danh mục & khu vực
- **Thêm danh mục:** cấm trùng tên (case-insensitive).
- **Xóa danh mục:** chặn nếu còn sản phẩm thuộc danh mục đó.
- **Đổi tên danh mục:** cấm trùng tên khác; đổi xong → cập nhật `category` của mọi sản phẩm thuộc tên cũ.
- **Sắp xếp danh mục:** reorder trực tiếp (kéo thả).
- **Xóa khu vực:** chặn nếu khu vực đang được phiếu yêu cầu dùng.

### 5.6 Phiếu giao nhận (Delivery)
- **Tạo:** `status = "pending"`, id `DN-<timestamp>`, gắn `receiptId`, `shipperId`.
- **Xác nhận (verify):** `status = "verified"`, `verifiedBy`, `verificationNotes`, `verifiedAt`.
- **Từ chối (reject):** `status = "rejected"`, `verifiedBy`, `verificationNotes = rejectionReason`, `verifiedAt`.
- Hỗ trợ: filter (status/date/shipper/hasIssues/priority/tags/search/batch), sort, history, quality rating, batch operation (chưa đầy đủ).

---

## 6. Luồng nghiệp vụ chi tiết

### 6.1 Đăng nhập → dashboard
1. Requester: nhập tên (khớp `USERS`) → vào app. Manager: nhập `admin123`.
2. `currentUser` lưu `localStorage` key `chicken_farm_user` (cũ).

### 6.2 Requester tạo phiếu yêu cầu
1. Vào **Kho vật tư** → search/lọc danh mục → chọn sản phẩm → chọn biến thể → số lượng → **Thêm vào giỏ**.
2. Mở giỏ → **Tạo phiếu yêu cầu** (nếu giỏ rỗng → cảnh báo).
3. Điền `requesterName`, `zone`, `purpose` → **Gửi** → `status = "Đang chờ xử lý"`, `REQ-<timestamp>`.

### 6.3 Manager cấp phát / nhập kho
1. Xem **Phiếu yêu cầu** → nút **Cấp phát** (luồng 5.2).
2. Hoặc tạo **Phiếu nhập kho**: nhập supplier + items → lưu → **cộng stock + auto cấp phát** các phiếu chờ (5.3).

### 6.4 Giao nhận & kiểm định
1. Manager tạo **Phiếu giao nhận** từ 1 phiếu nhập, gán shipper.
2. Khi hàng về: **kiểm định** từng item (actual quantity, quality checks) → **Xác nhận** hoặc **Từ chối** kèm lý do.

### 6.5 Dashboard
- Card tổng: số sản phẩm, số biến thể, phiếu chờ, phiếu hoàn thành, phiếu nhập.
- Manager có KPI theo kỳ (hôm nay/tuần/tháng): nhập, xuất, net change, top vật tư xuất nhiều.

---

## 7. Schema DB cũ → ánh xạ sang thiết kế mới

| Bảng cũ | Ghi chú cũ | Ánh xạ mới |
|---|---|---|
| `users` | id uuid, name, role, zone | → `profiles` (1-1 `auth.users`) |
| `categories` | id uuid, name unique, icon, display_order | giữ (UUID) |
| `zones` | id uuid, name unique, description | giữ (UUID) |
| `products` | id uuid, images text[], category_id FK, options text[] | giữ; category là FK thật |
| `variants` | stock int, price, images, unit, attributes jsonb | giữ; **bỏ cột `stock`** → dùng `stock_balances`; thêm `min_stock` |
| `variant_components` | parent/child variant, quantity | giữ (UUID) |
| `requisition_forms` | status text tiếng Việt, requester_name text | → `requisitions`: `requester_id` FK, `status` enum EN, `requisition_type`, `linked_defect_id` |
| `requisition_items` | requisition_id, product_id, variant_id, quantity | giữ (bỏ product_id thừa nếu cần) |
| `goods_receipt_notes` | supplier, linked_requisition_ids text[] | → `receipts` (`linked_requisition_ids uuid[]`) |
| `receipt_items` | receipt_id, variant_id, quantity | giữ + **`unit_cost`** |
| `delivery_notes` | nhiều cột (status, priority, tags, batch...) | → Phase 9 (defer) |
| `delivery_items` / `delivery_history` / `delivery_verification` / `delivery_quality` | — | → Phase 9 (defer) |
| *(mới)* | — | `stock_locations`, `stock_balances`, `stock_movements` |
| *(mới)* | — | `defect_notes`, `defect_note_items`, `repair_orders`, `repair_order_items`, `liquidation_notes`, `liquidation_items` |

> **Lỗi cũ cần tránh:** `supabaseService.ts` dùng `parseInt(p.id)` trên UUID (sai kiểu). Thiết kế mới dùng **UUID (`string`) xuyên suốt**.

---

## 8. Seed data (dữ liệu mẫu cũ)

### Danh mục (8)
1. Thức ăn chăn nuôi · 2. Thuốc & Vắc-xin · 3. Dụng cụ chăn nuôi · 4. Hệ thống chuồng trại · 5. Vệ sinh & Sát trùng · 6. Bảo hộ lao động · 7. Phụ tùng & Sửa chữa · 8. Khác

### Người dùng demo
| id | Tên | Role | Khu vực |
|---|---|---|---|
| requester-1 | Nguyễn Văn An | requester | Khu 1 |
| requester-2 | Trần Thị Bình | requester | Khu 2 |
| requester-3 | Lê Văn Cường | requester | Khu 3 |
| requester-4 | Phạm Thị Dung | requester | Khu 4 |
| manager-1 | Quản lý Kho | manager | — |

### Khu vực mặc định: Khu 1, Khu 2, Khu 3, Khu 4

### Sản phẩm (12) — tóm tắt
| # | Tên | Danh mục | Options | Ghi chú |
|---|---|---|---|---|
| 1 | Cám gà con | Thức ăn chăn nuôi | Trọng lượng | 2 variant (Bao 10kg/25kg) |
| 2 | Vắc-xin Newcastle | Thuốc & Vắc-xin | Liều | 2 variant (Lọ 100/500 liều) |
| 3 | Máng ăn dài cho gà | Dụng cụ chăn nuôi | Chiều dài | 3 variant (50/75/100 cm) |
| 4 | Quạt thông gió công nghiệp | Hệ thống chuồng trại | — | 1 variant |
| 5 | Thuốc sát trùng Vimekon | Vệ sinh & Sát trùng | Dung tích | 1 variant (Chai 1L) |
| 6 | Ủng bảo hộ cao su | Bảo hộ lao động | Kích cỡ | 4 variant (39–42) |
| 7 | Bóng đèn úm hồng ngoại | Phụ tùng & Sửa chữa | Công suất | 3 variant (100/150/250W) |
| 8 | Men tiêu hóa gia cầm | Thuốc & Vắc-xin | — | 1 variant (Gói) |
| 9 | Tấm lót chuồng trấu | Hệ thống chuồng trại | — | 1 variant (Bao) |
| 10 | Xẻng xúc cám | Dụng cụ chăn nuôi | Loại | 2 variant (Nhựa/Inox) |
| 11 | Bộ máng uống núm tự động | Dụng cụ chăn nuôi | Loại | **Composite**: Bộ hoàn chỉnh = 1 Núm + 1 Cốc |
| 12 | Vôi bột khử trùng | Vệ sinh & Sát trùng | — | 1 variant (Bao) |

---

## 9. Component inventory (bản cũ)

| Component | Mục đích |
|---|---|
| `LoginPage` | Đăng nhập 2 vai trò |
| `Dashboard` | Thống kê tổng + KPI theo kỳ |
| `ProductList` / `ProductCard` / `SearchBar` / `CategoryNav` | Catalog + search + lọc danh mục |
| `VariantSelectorModal` | Chọn biến thể + số lượng trước khi thêm giỏ |
| `Cart` / `CartItem` | Giỏ hàng (drawer) |
| `CreateRequisitionPage` / `EditRequisitionPage` / `RequisitionListPage` / `RequisitionCard` / `RequisitionDetailModal` / `RequisitionModal` / `FulfillRequisitionModal` | Vòng đời phiếu yêu cầu |
| `CreateReceiptPage` / `ReceiptList` / `ReceiptCard` | Phiếu nhập kho |
| `CreateDeliveryNote` / `CreateDeliveryNoteForm` / `DeliveryNoteList` / `QualityChecks` / `VerificationDetails` | Phiếu giao nhận + kiểm định |
| `AdminPage` / `ProductFormModal` / `CategoryFormModal` / `ZoneFormModal` / `ZoneListSection` | Quản trị |
| `Header` / `BottomNav` / `DesktopNav` | Điều hướng |
| `Chatbot` | AI chatbot (Gemini) |
| `ImageGalleryModal` / `ImageWithPlaceholder` / `AddItemModal` | Ảnh sản phẩm |
| `FilterSidebar` / `FilterSortControls` / `MobileFilterSortDrawer` / `Pagination` / `ConfirmationModal` / `ErrorBoundary` | UI phụ trợ |

## 10. Tech debt bản cũ (tránh lặp lại)

1. `App.tsx` ~1258 dòng — gom state + điều hướng + business logic.
2. **Trộn localStorage + Supabase** (localStorage là nguồn chính, Supabase chỉ phụ + script migrate).
3. `parseInt(p.id)` trên UUID trong `supabaseService.ts` (bug kiểu dữ liệu).
4. Nhiều file rỗng/stub: `useAppState.ts`, `useCart.ts`, `useLocalStorage.ts`, `storageUtils.ts`, `LoadingSpinner.tsx`, `SetupPage.tsx`.
5. Component quá lớn: `ProductFormModal.tsx` (~57KB), `DeliveryNoteList.tsx` (~39KB), `AdminPage.tsx` (~36KB).
6. Auth giả (chọn tên / mật khẩu cứng `admin123`), RLS bị tắt.
7. Status lưu chuỗi tiếng Việt trong DB.
8. Gemini API key nhúng phía client (`VITE_GEMINI_API_KEY`).

## 11. Ánh xạ nhanh cũ → mới (khi triển khai)

| Khái niệm cũ | Thiết kế mới |
|---|---|
| View `ViewKey` switch trong App.tsx | App Router routes (`/dashboard`, `/products`, `/requisitions`, ...) |
| State trong App.tsx + localStorage | TanStack Query (server state) + Zustand (UI state) |
| `services/supabaseService.ts` (parseInt UUID) | Supabase gen types + Server Actions |
| `requester_name` (text) | `profiles` + `requester_id` FK |
| `status` tiếng Việt | enum tiếng Anh + label map |
| `variants.stock` | `stock_balances` (theo `stock_locations`) |
| Cấp phát trừ stock trực tiếp | `stock_movements` ledger + transaction |
| `delivery_notes` (đầy đủ) | Phase 9 (defer) |
| Chatbot gọi Gemini từ client | Server Action/route handler (key server-side) |
