# Minh Tân Phát Supply — Hệ Thống Quản Lý Kho & Vận Hành Trại Gà

Phần mềm ERP chuyên dụng phục vụ vận hành thực tế tại **Trang Trại Gà Đẻ Trứng Lê Văn Dương** (Minh Tân, Dầu Tiếng, Bình Dương). Hệ thống số hóa và tự động hóa 100% vòng đời vật tư, kiểm soát tài sản, quản lý trạm nhiên liệu, điều độ xe cơ giới, cấp phát theo dãy trại và phân tích chi phí vận hành theo thời gian thực.

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_(Strict)-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17_%2B_RLS-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-PowerSync_Offline_First-orange?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-626_passed_|_117_suites-success?style=flat-square)

---

## ⚡ Hướng dẫn Bắt đầu Nhanh (Developer Guide)

```bash
# 1. Cài đặt toàn bộ dependencies
pnpm install

# 2. Cấu hình biến môi trường
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Chạy Dev Server (Port 3001, tách biệt với Production)
pnpm dev              # hoặc bash scripts/dev-up.sh

# 4. Chạy toàn bộ 626 unit/integration tests
pnpm test

# 5. Triển khai lên Production (Port 3000, zero-downtime)
pnpm deploy:prod      # = bash scripts/deploy.sh
```

---

## 🚀 Công Nghệ & Nền Tảng (Tech Stack)

| Tầng Kiến Trúc | Công Nghệ Chính | Đặc Điểm & Vai Trò |
|---|---|---|
| **Web Framework** | **Next.js 15.x (App Router + Turbopack)** | Server Components, Server Actions, Dynamic Streaming UI, Zero-API-boilerplate. |
| **Ngôn Ngữ** | **TypeScript 5.x Strict Mode** | 100% Type safety, Database Types auto-inferred từ PostgreSQL schema. |
| **Giao Diện & UX** | **Tailwind CSS v4 + Radix UI + Lucide** | Mobile-first, Dark/Light theme, Sonner Toast, Touch-friendly cho điện thoại trang trại. |
| **Cơ Sở Dữ Liệu** | **PostgreSQL 17 (Supabase Managed)** | Row Level Security (RLS), Sổ cái kho Append-Only, 77+ Security Definer RPCs, 101 Migrations. |
| **Xác Thực (Auth)** | **GoTrue + @supabase/ssr** | Đăng nhập Username/Mật khẩu (không cần email), Khóa định danh bất biến (Immutable Identity). |
| **Offline & Sync** | **PowerSync + Serwist PWA + SQLite WASM** | Kiến trúc Offline-First, IndexedDB/SQLite cục bộ, tự động đồng bộ 2 chiều ngay khi có mạng. |
| **In Ấn & Vector PDF** | **@react-pdf/renderer + QRCode** | Nhúng font tiếng Việt UTF-8 (Roboto), sinh phiếu A4/A5 và tem QR vector độ nét cao gắn URL tra cứu. |
| **Trợ Lý AI RAG** | **Vercel AI SDK + Omniroute + OpenAI** | Chatbot AI hỗ trợ tra cứu kỹ thuật, SOP vận hành trại, quản trị tài liệu tri thức nội bộ. |
| **Báo Cáo & BI Analytics** | **Reports Hub + Metabase Views + ExcelJS** | Báo cáo Quản trị, Sổ cái XNT, Thẻ kho, Chi phí Dãy trại, Tiêu hao Xe, Views cho Metabase/PowerBI. |
| **Hệ Thống Thông Báo** | **Nodemailer SMTP + PostgreSQL Queue** | Gửi email thông báo phiếu duyệt, tiến trình đặt hàng, cảnh báo tồn kho thấp, mượn đồ quá hạn. |
| **Kiểm Thử (Testing)** | **Vitest 5.x + React Testing Library** | **626 unit/integration tests / 117 test suites**, kiểm soát toàn diện logic nghiệp vụ. |

---

## 🌟 16 Phân Hệ Nghiệp Vụ Cốt Lõi (Core Subsystems)

1. **Danh Mục Vật Tư Đa Cấp (Catalog & Multi-UOM SKU):** Phân định rõ Product (danh mục chung) vs SKU (đơn vị giữ tồn duy nhất). Hỗ trợ 4 kiểu quản lý: Đơn quy cách, Quy đổi bao bì đa cấp (Thùng/Hộp/ml), Biến thể kỹ thuật 3 trục (Hãng/Kích cỡ/Loại), và Bộ lắp ráp (BOM Virtual Kit / Assembled Kit).
2. **Dashboard May Đo Theo Vai Trò (Role-Tailored Dashboard):** Tự động tùy biến giao diện theo 7 vai trò: Chủ trại/Superuser (KPI tổng quan, giá trị kho, chi phí khu), Kế toán (công nợ, hóa đơn, định giá xuất), Quản kho (chờ cấp phát, tồn thấp, kiểm kê), Kỹ thuật (đồ nghề mượn, thiết bị đang sửa), Tài xế (bơm dầu, định mức tiêu hao), Người yêu cầu (phiếu xin, đồ đã nhận).
3. **Tiến Trình Yêu Cầu Vật Tư 5 Bước & Upload Hóa Đơn (Requisitions Milestones & Invoices):** Theo dõi tiến trình 5 cột mốc: *Gửi yêu cầu ➔ Kỹ thuật duyệt ➔ Đang đặt hàng NCC ➔ Kho xuất cấp ➔ Hoàn tất*. Cho phép chụp ảnh hóa đơn/chứng từ trực tiếp từ điện thoại và tự động đồng bộ hóa đơn với Phiếu nhập kho.
4. **Nhập Kho & Auto-Fulfill FIFO (Receipts & Inbound):** Nhập hàng từ NCC, lưu số lô/HSD, tải ảnh hóa đơn VAT có slider lightbox phóng to. Tự động cấp phát (Auto-fulfill FIFO) cho các phiếu yêu cầu đã duyệt ngay khi nhập hàng.
5. **Xuất Kho & Định Phí Dãy Trại (Issues & Sub-Zone Costing):** Xuất vật tư nội bộ gắn trực tiếp theo Cây không gian 2 cấp (Khu vực `zones` -> Dãy trại `sub_zones`) hoặc xuất bán thương mại cho khách hàng.
6. **Báo Hỏng Hiện Trường (Defect Notes):** Công nhân/Kỹ thuật ghi nhận thiết bị hỏng tại trại, bắt buộc đính kèm >= 1 ảnh hiện trường và mô tả lỗi để đối soát chống gian lận.
7. **Đổi 1-1 Cấp Tốc 30 Giây (Quick 1-1 Exchange Notes):** Đổi motor quạt/máy bơm cháy lấy thiết bị mới trong 30 giây để cứu trại gà. Tự động trừ 1 hàng mới tại Kho Tổng và nạp 1 hàng hỏng vào Kho Hỏng trong 1 transaction duy nhất.
8. **Sửa Chữa Cơ Điện (Repair Orders):** Gom thiết bị hỏng từ Kho Hỏng gửi xưởng quấn motor bên ngoài. Nghiệm thu hoàn thành tự động đưa về lại Kho Tổng; phế phẩm chuyển sang thanh lý.
9. **Thanh Lý Phế Liệu (Liquidations):** Phân loại rác cơ điện, bán ve chai, Chủ trại duyệt thu tiền về quỹ và tự động xóa sổ khỏi kho.
10. **Tủ Dụng Cụ Dùng Chung (Tool Borrowing):** Quản lý mượn/trả máy hàn, máy cắt, thang nhôm, đồng hồ đo điện. Cảnh báo quá hạn mượn và gửi email đôn đốc thu hồi.
11. **Trạm Bồn Xăng Dầu & Xe Cơ Giới (Fuel & Fleet Multi-Zone):** Quét tem QR trên cabin xe cơ giới trong 5 giây, ghi nhận ODO/giờ máy, tính toán tự động chỉ số tiêu hao (L/100km, L/h). Hỗ trợ cấp dầu cho phương tiện hoặc cấp dầu cho toàn khu/nhiều dãy trại. Quản lý giấy tờ đăng kiểm, bảo hiểm, cà vẹt của xe.
12. **Chuyển Kho Nội Bộ (Inter-Warehouse Transfers):** Điều chuyển vật tư giữa Kho Tổng, Kho Cơ Điện, Kho Hỏng, Trạm Dầu với lịch sử dịch chuyển minh bạch.
13. **Kiểm Kê Kho Độc Lập (Stocktake & Variance Balancing):** Tạo phiên kiểm kê, quét QR đếm thực tế, đính kèm ảnh bằng chứng, tính chênh lệch Thừa/Thiếu và Chủ trại duyệt cân bằng tồn kho.
14. **Trung Tâm Báo Cáo & Phân Tích BI (Reports Hub & Metabase BI):** Báo cáo tổng hợp Ban giám đốc, Sổ cái kho (XNT), Thẻ kho chi tiết (Stock Card), Phân tích chi phí từng dãy trại (Zone Cost Drilldown), Báo cáo tiêu hao đội xe, Tích hợp trực tiếp các View BI cho Metabase/PowerBI và xuất Excel chuẩn kế toán.
15. **In Ấn Chứng Từ Chuẩn & Tem QR (Vector PDF & QR Engine):** In phiếu A4/A5 với mã QR định danh ở góc trên liên kết thẳng đến chi tiết điện tử. In tem decal QR dán kệ hàng và dán nắp bình dầu xe.
16. **Trợ Lý AI Tri Thức & Quản Trị Chứng Từ Cấp Cao (Omniroute AI & Master Document Control):** Trợ lý AI tích hợp drawer/nút nổi kéo thả, tra cứu quy trình vận hành và SOP trại gà. Bổ sung bảng điều khiển Quản trị viên can thiệp sâu, kiểm tra quan hệ phụ thuộc (`admin_inspect_document_dependencies`) và xóa cứng/hoàn tác an toàn cho Superuser/Owner.

---

## 👥 7 Vai Trò Người Dùng Chuẩn Hóa (RBAC Matrix)

1. **Quản trị hệ thống (`superuser`):** Toàn quyền kỹ thuật, quản trị phân quyền, nạp dữ liệu, kiểm tra quan hệ chứng từ và can thiệp xóa cứng dữ liệu thừa (`admin_force_delete_document`, `admin_purge_user_data`).
2. **Chủ trang trại (`owner`):** Toàn quyền kinh doanh, xem Dashboard tài chính, duyệt phiếu sửa chữa/thanh lý, duyệt cân bằng kiểm kê, quản trị nhân sự và kiểm soát chứng từ cấp cao.
3. **Kế toán (`accountant`):** Quản lý giá mua/bán, duyệt phiếu nhập kho, theo dõi công nợ NCC/Khách hàng, kiểm soát chi phí dãy trại, truy cập Views Metabase BI và xuất báo cáo tài chính.
4. **Quản lý kho (`warehouse`):** Thực hiện nhập-xuất-chuyển-kiểm kê, xuất cấp phát vật tư theo tiến trình, quản lý mượn trả dụng cụ, quản lý trạm bồn dầu và cấp phát theo khu vực.
5. **Kỹ thuật trưởng (`technician`):** Duyệt cấp 1 phiếu yêu cầu vật tư, thực hiện đổi 1-1 khẩn cấp, quản lý sửa chữa thiết bị cơ điện, bảo dưỡng máy móc.
6. **Người yêu cầu (`requester`):** Công nhân/Trưởng trại lập phiếu xin cấp vật tư, theo dõi tiến trình đặt hàng, upload hóa đơn mua gấp, báo hỏng thiết bị, xác nhận đã nhận hàng và hoàn trả vật tư thừa.
7. **Tài xế (`driver`):** Xem danh sách xe phụ trách, quét mã QR đổ dầu diesel tại trạm bồn, xem hồ sơ giấy tờ xe (đăng kiểm/bảo hiểm) và tra cứu lịch sử tiêu hao nhiên liệu.

---

## 📁 Cấu Trúc Mã Nguồn (Repository Layout)

```
├── docs/                             # Hệ thống tài liệu hoàn chỉnh theo chuẩn Diátaxis
│   ├── README.md                     # Bản đồ điều hướng tài liệu trung tâm
│   ├── architecture/                 # Tài liệu kiến trúc (system, rbac, schema, state-machines)
│   ├── user-guide/                   # 16 bài hướng dẫn chi tiết từng nghiệp vụ (01 -> 16)
│   ├── reference/                    # Từ điển database tables, RPCs, App routes, CLI scripts
│   ├── operations/                   # Runbook triển khai, sự cố, sao lưu, email scheduler
│   └── superpowers/                  # Specs & Plans kỹ thuật chuyên sâu
├── public/                           # Assets tĩnh: Logo thương hiệu, Fonts tiếng Việt UTF-8
├── scripts/                          # Tập lệnh CLI: deploy.sh, dev-up.sh, seed, verify-fuel-flow, benchmark
├── src/
│   ├── app/                          # Next.js App Router (Authenticated routes, Auth, API Routes)
│   ├── components/                   # UI Components dùng chung (Layout, UI primitives, AI Drawer)
│   ├── features/                     # Module nghiệp vụ độc lập (catalog, fuel, reports, pdf, requisitions...)
│   ├── lib/                          # Tiện ích dùng chung (supabase, powersync, email, notifications, ai, stock)
│   ├── stores/                       # Zustand stores (cart-store, offline-queue-store, ui-store)
│   └── types/                        # Database TypeScript types sinh tự động từ PostgreSQL
└── supabase/
    ├── migrations/                   # 101 SQL migrations (0001_baseline -> 0101_fuel_dispense_zone_allocation)
    └── seed.sql                      # Dữ liệu khởi tạo mẫu
```

---

## 📚 Bản Đồ Tài Liệu Chi Tiết (Diátaxis Documentation)

Toàn bộ tài liệu chi tiết của dự án được tổ chức khoa học tại thư mục `docs/`:
* 🧭 **Bản đồ tài liệu trung tâm:** [docs/README.md](./docs/README.md)
* 🏗️ **Kiến trúc & Giải thích:** [Kiến trúc Tổng quan](./docs/architecture/system-overview.md) · [Phân quyền 7 Vai trò](./docs/architecture/rbac-and-roles.md) · [Database Schema](./docs/architecture/database-schema.md) · [State Machines](./docs/architecture/state-machines.md)
* 📖 **Sổ tay Hướng dẫn Người dùng:** [Danh mục 16 bài hướng dẫn](./docs/README.md#-sổ-tay-hướng-dẫn-nghiệp-vụ)
* 📚 **Tra cứu Kỹ thuật:** [Từ điển Database Tables](./docs/reference/database-tables.md) · [Danh mục 77+ RPCs](./docs/reference/rpc-and-functions.md) · [Routes & APIs](./docs/reference/app-routes-and-navigation.md) · [CLI Scripts](./docs/reference/cli-scripts.md)
* ⚙️ **Vận hành & Triển khai:** [Deployment Runbook](./docs/operations/deployment-runbook.md) · [Email Scheduler](./docs/operations/email-notification-scheduler.md) · [PowerSync Sync Architecture](./docs/powersync-architecture-and-deployment.md) · [Troubleshooting](./docs/operations/troubleshooting.md) · [Backup & Recovery](./docs/operations/backup-and-recovery.md) · [Domain & Email Setup](./docs/DOMAIN_AND_EMAIL_SETUP.md)
