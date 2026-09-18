# Minh Tân Phát Supply — Hệ Thống Quản Lý Kho Trại Gà

Phần mềm ERP nội bộ vận hành thực tế tại **Trại Gà Đẻ Trứng Lê Văn Dương** (Minh Tân, Dầu Tiếng, Bình Dương). Quản lý toàn bộ vòng đời vật tư từ nhập kho, cấp phát chuồng trại, đổi 1-1 cấp tốc, sửa chữa/thanh lý, kho xăng dầu, đến báo cáo chi phí từng dãy chuồng.

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_(Strict)-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17_%2B_RLS-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-orange?style=flat-square)

---

## Hướng dẫn nhanh (Dev)

```bash
# 1. Cài dependencies
pnpm install

# 2. Cấu hình môi trường
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Chạy dev server (port 3001)
pnpm dev

# 4. Chạy test
pnpm test

# 5. Deploy lên production
pnpm deploy:prod    # = bash scripts/deploy.sh
```

---

## Tech Stack

| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Framework | Next.js 15.x (App Router + Turbopack) | Server Components, Server Actions, RSC |
| Language | TypeScript 5.x Strict | Types auto-inferred từ Supabase DB |
| UI | Tailwind CSS v4 + Radix UI + Lucide | Mobile-first, dark/light theme |
| Database | Supabase (PostgreSQL 17) | RLS + 86 migrations + 73+ RPCs |
| Auth | GoTrue + @supabase/ssr | Username-based login (không cần email) |
| State | Zustand + TanStack Query | Offline queue store + server cache |
| PDF / Print | @react-pdf/renderer + QRCode | Font tiếng Việt, A4/A5 + QR label |
| Offline | Serwist (Service Worker) | PWA cache + IndexedDB |
| Reports | ExcelJS | Xuất Excel chuẩn kế toán |
| AI | ai SDK + OpenAI | AI Copilot RAG nội bộ |
| Testing | Vitest + Testing Library | 349+ tests, 61 test suites |

---

## Cấu trúc thư mục

```
src/
├── app/                     # Next.js App Router
│   ├── (app)/               # Authenticated routes
│   │   ├── products/        # Danh mục vật tư
│   │   ├── requisitions/    # Phiếu yêu cầu vật tư
│   │   ├── receipts/        # Phiếu nhập kho
│   │   ├── issues/          # Phiếu xuất kho / cấp phát
│   │   ├── defects/         # Đổi 1-1 cấp tốc / báo hỏng
│   │   ├── repairs/         # Sửa chữa cơ điện
│   │   ├── liquidations/    # Thanh lý phế liệu
│   │   ├── tools/           # Mượn-trả dụng cụ đồ nghề
│   │   ├── fuel/            # Trạm bồn xăng dầu + xe cộ
│   │   ├── transfers/       # Chuyển kho
│   │   ├── stocktake/       # Kiểm kê định kỳ
│   │   ├── reports/         # Báo cáo + xuất Excel
│   │   ├── assemblies/      # Lắp ráp bộ vật tư
│   │   └── admin/           # Quản trị (Users, Zones, Vehicles, Suppliers…)
│   ├── (auth)/login/        # Đăng nhập
│   └── api/                 # API Routes (PDF, QR, Export, AI)
│
├── features/                # Feature modules (actions + components + schema)
│   ├── catalog/             # SKU catalog domain layer (mới)
│   ├── inventory-posting/   # Posting kernel append-only (mới)
│   ├── products/            # Product + SKU admin
│   ├── requisitions/        # Phiếu yêu cầu
│   ├── receipts/            # Phiếu nhập kho
│   ├── issues/              # Phiếu xuất / cấp phát
│   ├── defects/             # Báo hỏng + đổi 1-1
│   ├── exchanges/           # Exchange notes
│   ├── repairs/             # Sửa chữa
│   ├── liquidations/        # Thanh lý
│   ├── tools/               # Mượn-trả dụng cụ
│   ├── fuel/                # Kho dầu + xe cộ
│   ├── transfers/           # Chuyển kho
│   ├── stocktake/           # Kiểm kê
│   ├── reports/             # Báo cáo
│   ├── assemblies/          # Lắp ráp bộ
│   ├── pdf/                 # PDF / QR rendering
│   ├── ai-admin/            # AI Copilot management
│   ├── notifications/       # Email notifications
│   └── auth/                # Auth helpers
│
├── lib/                     # Shared utilities
│   ├── supabase/            # Supabase client (server + browser + middleware)
│   ├── ai/                  # AI registry, tools, RAG
│   └── *.ts                 # format, labels, stock, fuel, images…
│
├── stores/                  # Zustand stores
│   ├── cart-store.ts        # Giỏ hàng xin cấp phát
│   └── offline-queue-store.ts  # Offline action queue
│
└── types/
    └── database.types.ts    # Auto-generated Supabase types
```

---

## Domain chính

| Domain | Nghiệp vụ |
|---|---|
| **Catalog (Product → SKU)** | Danh mục vật tư, biến thể (SKU), đơn vị tính đa cấp, BOM bộ vật tư |
| **Requisitions** | Phiếu yêu cầu vật tư duyệt 2 cấp (Kỹ thuật → Kho), trả lại thừa |
| **Receipts** | Nhập kho từ NCC, upload hóa đơn VAT, auto-fulfill phiếu đã duyệt |
| **Issues** | Xuất kho nội bộ (theo Sub-zone chuồng) + xuất bán thương mại |
| **Defects / Exchanges** | Đổi 1-1 cấp tốc (30 giây), gom hàng hỏng, quản lý kho hỏng |
| **Repairs / Liquidations** | Gửi xưởng sửa, nghiệm thu, thanh lý phế liệu thu hồi vốn |
| **Tools** | Mượn-trả dụng cụ dùng chung, cảnh báo quá hạn |
| **Fuel** | Trạm bồn dầu: quét QR xe, cấp phát, tính L/100km hoặc L/h |
| **Transfers** | Điều chuyển vật tư giữa các kho nội bộ |
| **Stocktake** | Kiểm kê định kỳ: quét QR thực tế, cân bằng thừa/thiếu |
| **Reports** | Thẻ kho, XNT, chi phí từng dãy chuồng, xuất Excel kế toán |
| **AI Copilot** | Chat RAG nội bộ dựa trên dữ liệu kho thực tế |

---

## Phân quyền (7 vai trò)

| Role | Đối tượng | Quyền hạn |
|---|---|---|
| `superuser` | IT / Quản trị viên | Toàn quyền kỹ thuật, audit, bảo mật |
| `owner` | Chủ trại / Giám đốc | Xem báo cáo tài chính, duyệt thanh lý lớn |
| `accountant` | Kế toán | Quản lý giá, hóa đơn, báo cáo chi phí |
| `warehouse` | Quản kho / Thủ kho | Toàn quyền xuất-nhập-chuyển kho, kiểm kê |
| `technician` | Kỹ thuật / Cơ điện | Duyệt phiếu cấp 1, sửa chữa, mượn-trả |
| `requester` | Công nhân chuồng | Xin cấp vật tư, báo hỏng, xác nhận nhận |
| `driver` | Tài xế | Quét QR đổ dầu, cập nhật ODO/giờ máy |

> **Immutable Identity:** Họ tên + username bị khóa cố định sau khi tạo tài khoản (DB Trigger).  
> **Hybrid Archive:** Tài khoản có lịch sử chứng từ → lưu trữ (không xóa); tài khoản trống → xóa vĩnh viễn.

---

## Scripts quan trọng

```bash
pnpm dev                  # Dev server port 3001 (Turbopack)
pnpm build                # Production build
pnpm test                 # Chạy tất cả Vitest tests
pnpm typecheck            # TypeScript strict check
pnpm seed:fake            # Seed dữ liệu fake để test
pnpm seed:complete        # Seed dữ liệu đầy đủ
pnpm deploy:prod          # Deploy lên production
pnpm sync:knowledge       # Đồng bộ knowledge base cho AI Copilot
bash scripts/dev-up.sh    # Khởi động Supabase local
bash scripts/dev-down.sh  # Dừng Supabase local
```

---

## Tài liệu đầy đủ

Toàn bộ tài liệu kỹ thuật và vận hành trong thư mục **[`docs/`](./docs/README.md)**:

- **[Kiến trúc & Giải thích](./docs/architecture/)** — System overview, RBAC, Database schema, State machines
- **[Sổ tay nghiệp vụ](./docs/user-guide/)** — 14 hướng dẫn tác vụ chi tiết (tiếng Việt)
- **[Vận hành](./docs/operations/)** — Deployment runbook, Backup & Recovery, Troubleshooting
- **[Tham chiếu kỹ thuật](./docs/reference/)** — Database tables, RPCs, App routes, CLI scripts
- **[Sổ tay thực chiến trại](./SO_TAY_VAN_HANH_TRAI.md)** — 10 tình huống xử lý hàng ngày

---

## Trạng thái hiện tại

Hệ thống đang vận hành production. Đang tiến hành **nâng cấp kiến trúc catalog** từ mô hình Product/Variant cũ sang mô hình **Product → SKU → UOM → Stock Ledger** chuẩn hóa (migrations 0072–0086). Xem chi tiết tại [`docs/superpowers/`](./docs/superpowers/).
