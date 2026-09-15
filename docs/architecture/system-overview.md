# 🏗️ KIẾN TRÚC TỔNG QUAN HỆ THỐNG — MINH TÂN PHÁT SUPPLY

Tài liệu kỹ thuật tổng quan về kiến trúc phần mềm, cấu trúc thư mục, luồng dữ liệu và các thành phần cốt lõi của hệ thống **Minh Tân Phát Supply**.

---

## 1. CÔNG NGHỆ & NGĂN XẾP KỸ THUẬT (TECH STACK)

```
┌────────────────────────────────────────────────────────────────────────┐
│ FRONTEND & UI LAYER                                                    │
│ • Next.js 15.5+ (App Router, React Server Components, Server Actions)  │
│ • React 19 + TypeScript (Strict Type Checking)                        │
│ • Tailwind CSS 3.4 + Radix UI Primitives + Lucide Icons                │
│ • PWA Support (Serwist Service Worker, IndexedDB Cache, Web Share)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC & SERVER ACTIONS (`src/features/*`)                    │
│ • Zod Validation Schemas (Input parsing & sanitization)                │
│ • Server Actions with Granular RBAC Permissions Check (`src/lib/auth`) │
│ • Next.js Data Cache & Tagged Revalidation (`revalidatePath`)          │
│ • Resend / Nodemailer SMTP Enterprise Email Service                    │
│ • PDFKit / Canvas / jsPDF Vector Printing Engine                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DATABASE & SECURITY LAYER (Supabase / PostgreSQL 15+)                  │
│ • Row Level Security (RLS Policies on all public tables)               │
│ • Security Definer RPCs (Transactional stock adjustments, RBAC RPCs)   │
│ • PostgreSQL Triggers (Prevent identity changes, system protections)   │
│ • GoTrue Auth (Session tokens, password hashing, admin API)            │
│ • Supabase Storage (Invoices, Receipts, Equipment Photos)              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

Mã nguồn được tổ chức theo mô hình **Feature-Driven Architecture**:

```
minh-tan-phat-supply/
├── docs/                             # Toàn bộ tài liệu kiến trúc, hướng dẫn và vận hành
│   ├── README.md                     # Bản đồ điều hướng tài liệu trung tâm
│   ├── architecture/                 # Kiến trúc hệ thống, phân quyền, ERD database
│   ├── user-guide/                   # Hướng dẫn sử dụng 12 nghiệp vụ chi tiết
│   └── operations/                   # Sổ tay vận hành, triển khai, troubleshooting
├── public/                           # Static assets, PWA icons, manifest, fonts
├── scripts/                          # Script seed dữ liệu, kiểm tra quyền, script dev
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (app)/                    # Protected routes (yêu cầu đăng nhập)
│   │   │   ├── admin/                # Quản trị danh mục, người dùng, xe cộ, khu vực
│   │   │   ├── defects/              # Báo hỏng và đổi 1-1
│   │   │   ├── fuel/                 # Kho dầu và trạm quét QR xe
│   │   │   ├── issues/               # Xuất kho nội bộ
│   │   │   ├── products/             # Danh mục hàng hóa & mã QR
│   │   │   ├── receipts/             # Nhập kho NCC
│   │   │   ├── reports/              # Báo cáo tổng hợp & phân tích
│   │   │   ├── requisitions/         # Yêu cầu vật tư chuồng trại
│   │   │   ├── stocktake/            # Kiểm kê kho
│   │   │   ├── tools/                # Mượn trả dụng cụ đồ nghề
│   │   │   └── transfers/            # Điều chuyển kho
│   │   ├── (auth)/                   # Login page & Auth flows
│   │   └── api/                      # REST Endpoints (upload, webhooks, healthcheck)
│   ├── components/                   # UI primitives, layout (sidebar, header, offline bar)
│   ├── features/                     # Feature modules (Actions, Components, Schemas, Tests)
│   │   ├── admin/                    # Quản lý zones, locations, suppliers, categories
│   │   ├── auth/                     # Quản lý người dùng, phân quyền, profile, email
│   │   ├── defects/                  # Báo hỏng, đổi 1-1 cấp tốc
│   │   ├── fuel/                     # Quản lý cấp dầu, định mức xe
│   │   ├── issues/                   # Xuất kho, phiếu xuất
│   │   ├── pdf/                      # In phiếu chuẩn A4/A5, in tem nhãn QR
│   │   ├── products/                 # Sản phẩm, biến thể, tồn kho
│   │   ├── receipts/                 # Nhập kho, hóa đơn VAT
│   │   ├── reports/                  # Báo cáo chi phí, xuất Excel
│   │   ├── requisitions/             # Phiếu yêu cầu, duyệt cấp
│   │   ├── stocktake/                # Phiên kiểm kê, cân bằng tồn
│   │   └── tools/                    # Quản lý dụng cụ, mượn trả
│   └── lib/                          # Core helpers (auth, labels, types, cached metadata)
└── supabase/
    └── migrations/                   # 67+ SQL migrations, RLS policies, RPCs, triggers
```

---

## 3. LUỒNG XỬ LÝ DỮ LIỆU & GIAO DỊCH KHO (TRANSACTION PATTERN)

Mọi biến động kho (`stock_movements`) đều tuân thủ nguyên tắc **Double-Entry & Immutable Ledger** (Bất biến sổ cái):

1. **Không sửa đổi trực tiếp tồn kho:** Không chạy câu lệnh `update products set stock = stock + x`.
2. **Ghi sổ biến động (`stock_movements`):** 
   * Mỗi lần nhập/xuất/chuyển/đổi trả/kiểm kê đều tạo 1 dòng ghi nhận trong `stock_movements` chứa: `variant_id`, `from_location_id`, `to_location_id`, `quantity`, `unit_price`, `created_by`.
3. **Cập nhật tồn kho qua RPC Transaction (`adjust_stock` / `_move_stock`):**
   * Đảm bảo tính toán tồn kho trong 1 Database Transaction duy nhất, chống Race Condition khi nhiều nhân sự cùng xuất kho một thời điểm.

---

## 4. CƠ CHẾ OFFLINE & PWA CHO TRANG TRẠI

Tại các khu chuồng ở xa không có sóng Wi-Fi/4G:
* **Service Worker (Serwist):** Cache giao diện, danh mục sản phẩm và bảng giá vào IndexedDB.
* **Hàng đợi ngoại tuyến (Offline Queue):** Cho phép nhân viên chuồng bấm tạo phiếu yêu cầu hoặc quét mã kiểm kê khi không có mạng; khi điện thoại có kết nối trở lại, hệ thống tự động đồng bộ lên server.
