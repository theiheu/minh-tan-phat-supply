# Hệ thống Quản lý Kho Trại Gà Minh Tân Phát

Hệ thống quản lý vật tư trại gà: catalog sản phẩm, tồn kho đa kho, phiếu yêu cầu (nhiều trạng thái), nhập kho, vật tư hỏng → sửa chữa → thanh lý, kiểm kê, báo cáo.

> **Nguồn đặc tả duy nhất: [`BUILD_GUIDE.md`](./BUILD_GUIDE.md)** — đọc tuần tự mục 3 (khởi tạo) → 5 (SQL) → 6 (state machine) → 8 (RPC) → 14 (màn hình) → 15 (nghiệp vụ) → 21 (lộ trình).

## Tech stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres + Auth + RLS) · TanStack Query · Zustand · react-hook-form + zod · Vitest/RTL (test) · Bun

## Khởi động

```bash
bun install
bun run dev        # http://localhost:3000
bun run lint       # eslint
bun run build      # production build
```

Môi trường: copy `.env.example` → `.env.local` và điền URL/key Supabase.

Tài khoản test (local): `bun run scripts/bootstrap.ts` tạo `manager@mtp.local` và `requester@mtp.local` (mật khẩu `password123`). Mời thêm người dùng tại màn hình Quản trị → Người dùng.

## Cấu trúc (theo mục 4 BUILD_GUIDE.md)

- `src/app/` — App Router: `(auth)`, `(app)`, pages theo routing map mục 13
- `src/features/<name>/` — feature-first: `components/ actions/ api/ schema/ types.ts`
- `src/lib/` — supabase clients, env, utils
- `supabase/` — config.toml; migrations + seed theo mục 5, 17
