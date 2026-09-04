# BUILD GUIDE — Hệ thống Quản lý Kho Trại Gà (`minh-tan-phat-supply`)

> **Mục đích:** Đây là tài liệu **duy nhất** để xây dựng dự án từ đầu đến cuối.
> Một agent/developer chỉ cần đọc và bám theo file này là code được — **không cần mở repo cũ `K-MTP-PRo`**.
>
> **Cách dùng:** Đọc tuần tự từ mục 1→21. Khi code, bám theo:
> - Mục 3 (khởi tạo) → mục 5 (SQL) → mục 12 (màn hình) → mục 13 (nghiệp vụ) → mục 18 (lộ trình).
> - Mọi thuật ngữ tiếng Việt giữ nguyên nghĩa; định danh code/DB dùng tiếng Anh.

---

## MỤC LỤC
1. Tổng quan dự án
2. Tech stack & phiên bản
3. Khởi tạo dự án (từng bước)
4. Cấu trúc thư mục
5. Data model (SQL đầy đủ)
6. Auth & phân quyền (RLS)
7. Types & enums
8. Data layer (client, Server Actions, hooks)
9. State management (Zustand)
10. Design system & UI
11. Routing map
12. Đặc tả từng màn hình
13. Quy tắc nghiệp vụ & luồng xử lý
14. Validation (zod schemas)
15. Seed data
16. Báo cáo & xuất liệu
17. Testing
18. Lộ trình (phases + acceptance criteria)
19. Coding conventions
20. Tech-debt cần tránh
21. Checklist triển khai

---

## 1. Tổng quan dự án

**Domain:** Quản lý vật tư trại gà — theo dõi danh mục sản phẩm, tồn kho theo vị trí, phiếu yêu cầu, phiếu nhập kho, vật tư hỏng → sửa chữa → thanh lý, báo cáo thống kê.

**Vai trò:**
- `requester` (Người yêu cầu): xem kho, báo vật tư hỏng, tạo phiếu yêu cầu.
- `manager` (Quản lý kho): toàn quyền quản trị, nhập kho, cấp phát, sửa chữa, thanh lý, báo cáo.

**Vòng đời vật tư (tổng thể):**
```
NHẬP KHO → TỒN KHO CHÍNH → CẤP PHÁT/XUẤT → SỬ DỤNG
                                        ↓ (hỏng)
                          KHO TẬP KẾT HỎNG → SỬA CHỮA → NHẬP LẠI KHO
                                        └───────────→ THANH LÝ (bán/tiêu hủy)
```

---

## 2. Tech stack & phiên bản

| Hạng mục | Công nghệ | Phiên bản (tối thiểu) |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Ngôn ngữ | TypeScript (strict) | 5.x |
| DB/Auth | Supabase (Postgres + Auth) | supabase-js 2.x |
| Data fetching | TanStack Query | 5.x |
| Client state | Zustand | 5.x |
| Form + validate | react-hook-form + zod | RHF 7.x, zod 3.x |
| UI | Tailwind CSS + shadcn/ui | Tailwind 3.x (hoặc 4) |
| PDF | @react-pdf/renderer | 3.x |
| Excel | xlsx (SheetJS) | 0.18.x |
| Toast | sonner (kèm shadcn) | — |
| Package manager | Bun | 1.x (dùng được cả npm) |
| Test | Vitest + React Testing Library | 2.x |
| Lint/format | ESLint (default Next) + Prettier | — |

---

## 3. Khởi tạo dự án (từng bước)

```bash
# 1. Tạo Next.js app (App Router + TS + Tailwind + ESLint + src dir)
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun

# 2. Cài dependencies
bun add @supabase/supabase-js @tanstack/react-query zustand react-hook-form zod @hookform/resolvers @react-pdf/renderer xlsx sonner
bun add -d vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom prettier

# 3. Khởi tạo shadcn/ui (theo hướng dẫn, chọn neutral base color)
bunx shadcn@latest init
bunx shadcn@latest add button card table dialog form select tabs badge sheet dropdown-menu input textarea sonner skeleton command popover

# 4. Supabase CLI (local dev) — tùy chọn dùng remote project
bunx supabase init
# nếu chạy local: bunx supabase start

# 5. Tạo .env.example
cat > .env.example <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# Server-only (dùng cho seed/admin, KHÔNG lộ ra client):
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EOF
```

**Nguyên tắc env:**
- `NEXT_PUBLIC_*` chỉ chứa URL + anon key (an toàn với RLS).
- Service role key chỉ dùng ở **server** (Server Actions / script seed).

---

## 4. Cấu trúc thư mục

```
minh-tan-phat-supply/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx               # sidebar + topbar + bottom nav (protected)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── products/page.tsx
│   │   │   ├── requisitions/
│   │   │   │   ├── page.tsx             # danh sách
│   │   │   │   ├── new/page.tsx         # tạo phiếu
│   │   │   │   └── [id]/page.tsx        # chi tiết
│   │   │   ├── receipts/page.tsx
│   │   │   ├── receipts/new/page.tsx
│   │   │   ├── defects/page.tsx
│   │   │   ├── defects/new/page.tsx
│   │   │   ├── repairs/page.tsx
│   │   │   ├── liquidations/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── admin/{products,categories,zones,locations}/page.tsx
│   │   ├── layout.tsx                   # root layout (providers)
│   │   └── api/...                      # route handlers (export, webhook) nếu cần
│   ├── features/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── requisitions/
│   │   ├── receipts/
│   │   ├── defects/
│   │   ├── repairs/
│   │   ├── liquidations/
│   │   └── reports/
│   │       ├── components/   # UI riêng feature
│   │       ├── actions/      # Server Actions / mutations
│   │       ├── api/          # TanStack Query hooks + supabase query
│   │       ├── schema/       # zod schemas
│   │       └── types.ts      # type cục bộ
│   ├── components/
│   │   ├── ui/               # shadcn (shared)
│   │   └── layout/           # Sidebar, Topbar, BottomNav, MobileNav
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts     # browser client
│   │   │   ├── server.ts     # server client (cookies)
│   │   │   └── admin.ts      # service-role client (server-only)
│   │   ├── auth.ts           # session helpers, isManager()
│   │   └── utils.ts          # cn(), format, label maps
│   ├── server/
│   │   └── db/               # helper ghi stock_movements, transactions
│   ├── stores/               # Zustand: cart-store.ts, ui-store.ts
│   └── types/                # supabase generated (database.types.ts)
├── supabase/
│   ├── migrations/           # 0001_*.sql ... (theo mục 5)
│   └── seed.sql
├── middleware.ts             # protect route
├── .env.example
└── ...
```

---

## 5. Data model (SQL đầy đủ)

> **Nguyên tắc:** UUID everywhere (`gen_random_uuid()`), enum tiếng Anh lưu DB + map tiếng Việt ở UI, migration **chỉ additive**.
> Tách thành các file migration theo thứ tự dưới đây (thứ tự quan trọng vì FK).

### 5.1 `0001_core.sql` — extension, categories, zones
```sql
create extension if not exists "uuid-ossp";

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,                       -- Base64 data URL (hoặc tên icon)
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 5.2 `0002_auth.sql` — profiles + trigger
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('requester','manager')),
  zone_id uuid references public.zones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tự tạo profile khi có user mới
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'requester');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 5.3 `0003_catalog.sql` — products, variants, variant_components
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  images text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  options text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(12,2),
  images text[] not null default '{}',
  unit text,
  min_stock integer not null default 0,   -- ngưỡng cảnh báo tồn thấp
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.variant_components (
  id uuid primary key default gen_random_uuid(),
  parent_variant_id uuid not null references public.variants(id) on delete cascade,
  child_variant_id uuid not null references public.variants(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (parent_variant_id, child_variant_id)
);
```

### 5.4 `0004_inventory.sql` — kho, tồn theo vị trí, sổ biến động
```sql
create type public.location_type as enum ('main','defect','repair','other');

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'KHO_CHINH','KHO_HONG','KHO_DANG_SUA'
  name text not null,
  type public.location_type not null default 'main',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  location_id uuid not null references public.stock_locations(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (variant_id, location_id)
);

create type public.movement_type as enum (
  'receipt_in','requisition_out','defect_out','repair_out',
  'repair_return_in','liquidation_out','adjustment_in','adjustment_out','transfer'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id),
  from_location_id uuid references public.stock_locations(id),
  to_location_id uuid references public.stock_locations(id),
  movement_type public.movement_type not null,
  quantity integer not null,
  ref_type text,                   -- 'receipt'|'requisition'|'defect'|'repair'|'liquidation'
  ref_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
```

### 5.5 `0005_requisitions.sql`
```sql
create type public.requisition_type as enum ('new_supply','replacement');
create type public.requisition_status as enum ('pending','fulfilled');

create table public.requisitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'REQ-0001'
  requester_id uuid not null references public.profiles(id),
  zone_id uuid references public.zones(id) on delete set null,
  purpose text not null,
  requisition_type public.requisition_type not null default 'new_supply',
  linked_defect_id uuid references public.defect_notes(id),  -- tạo ở 0006
  status public.requisition_status not null default 'pending',
  fulfilled_by uuid references public.profiles(id),
  fulfilled_at timestamptz,
  fulfillment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
```
> Ghi chú: `linked_defect_id` tham chiếu bảng `defect_notes` (0006). Nếu muốn migration chạy độc lập, tạo 0006 **trước** 0005, hoặc thêm FK bằng `alter table` riêng sau. **Khuyến nghị:** tạo 0006 (defect) trước 0005.

### 5.6 `0006_defects.sql` — vật tư hỏng (tạo TRƯỚC 0005)
```sql
create type public.defect_status as enum ('staging','in_repair','returned','liquidated');

create table public.defect_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'HONG-0001'
  source_location_id uuid references public.stock_locations(id),
  reported_by uuid references public.profiles(id),
  status public.defect_status not null default 'staging',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.defect_note_items (
  id uuid primary key default gen_random_uuid(),
  defect_note_id uuid not null references public.defect_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null default 1 check (quantity > 0),
  damage_detail text,              -- chi tiết hỏng (khác nhau từng dòng)
  damage_type text,                -- 'nứt','mẻ','gãy',...
  severity text,                   -- 'nhẹ'|'vừa'|'nặng'
  images text[] not null default '{}',
  unit_cost numeric(12,2),
  resolution text,                 -- 'repaired'|'liquidated'
  created_at timestamptz not null default now()
);
```

### 5.7 `0007_repairs.sql` — sửa chữa
```sql
create type public.repair_status as enum ('in_repair','returned','cancelled');

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'SC-0001'
  vendor text not null,
  sent_at date,
  expected_return_at date,
  returned_at timestamptz,
  status public.repair_status not null default 'in_repair',
  total_cost numeric(12,2),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_order_items (
  id uuid primary key default gen_random_uuid(),
  repair_order_id uuid not null references public.repair_orders(id) on delete cascade,
  defect_item_id uuid references public.defect_note_items(id),
  variant_id uuid not null references public.variants(id),
  quantity integer not null default 1 check (quantity > 0),
  repair_detail text,
  cost numeric(12,2),
  outcome text,                    -- 'returned_to_stock'|'liquidation'
  created_at timestamptz not null default now()
);
```

### 5.8 `0008_liquidations.sql` — thanh lý
```sql
create type public.liquidation_status as enum ('pending','approved','completed','rejected');
create type public.liquidation_method as enum ('sale','dispose');

create table public.liquidation_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'TL-0001'
  reason text,
  status public.liquidation_status not null default 'pending',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.liquidation_items (
  id uuid primary key default gen_random_uuid(),
  liquidation_note_id uuid not null references public.liquidation_notes(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  source_item_id uuid,             -- từ defect_note_items hoặc repair_order_items
  quantity integer not null default 1 check (quantity > 0),
  method public.liquidation_method not null default 'dispose',
  unit_value numeric(12,2),
  proceeds numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
```

### 5.9 `0009_receipts.sql` — phiếu nhập kho
```sql
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'GRN-0001'
  supplier text not null,
  notes text,
  created_by uuid references public.profiles(id),
  linked_requisition_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2),         -- giá nhập thực tế (cho báo cáo chi phí)
  created_at timestamptz not null default now()
);
```

### 5.10 `0010_triggers.sql` — cập nhật `updated_at`
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_categories before update on public.categories for each row execute function public.set_updated_at();
create trigger trg_zones before update on public.zones for each row execute function public.set_updated_at();
create trigger trg_profiles before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_products before update on public.products for each row execute function public.set_updated_at();
create trigger trg_variants before update on public.variants for each row execute function public.set_updated_at();
create trigger trg_stock_locations before update on public.stock_locations for each row execute function public.set_updated_at();
create trigger trg_defect_notes before update on public.defect_notes for each row execute function public.set_updated_at();
create trigger trg_repair_orders before update on public.repair_orders for each row execute function public.set_updated_at();
create trigger trg_liquidation_notes before update on public.liquidation_notes for each row execute function public.set_updated_at();
create trigger trg_requisitions before update on public.requisitions for each row execute function public.set_updated_at();
create trigger trg_receipts before update on public.receipts for each row execute function public.set_updated_at();
```

### 5.11 `0011_indexes.sql`
```sql
create index idx_products_category on public.products(category_id);
create index idx_variants_product on public.variants(product_id);
create index idx_balances_variant on public.stock_balances(variant_id);
create index idx_balances_location on public.stock_balances(location_id);
create index idx_movements_variant on public.stock_movements(variant_id);
create index idx_movements_type on public.stock_movements(movement_type);
create index idx_requisitions_status on public.requisitions(status);
create index idx_requisition_items_req on public.requisition_items(requisition_id);
create index idx_receipt_items_receipt on public.receipt_items(receipt_id);
create index idx_defect_items_note on public.defect_note_items(defect_note_id);
create index idx_repair_items_order on public.repair_order_items(repair_order_id);
create index idx_liquidation_items_note on public.liquidation_items(liquidation_note_id);
```

### 5.12 `0012_rls.sql` — phân quyền (xem mục 6)

---

## 6. Auth & phân quyền (RLS)

### 6.1 Helper
```sql
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function public.is_requester()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'requester');
$$;
```

### 6.2 Bật RLS + policies (tóm tắt)

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | authenticated | `auth.uid() = id` | `auth.uid() = id` (tự sửa) | — |
| categories/zones/products/variants/stock_locations | authenticated | manager | manager | manager |
| variant_components | authenticated | manager | manager | manager |
| stock_balances | authenticated | manager | manager | manager |
| stock_movements | manager (requester đọc nếu cần) | manager | — | — |
| requisitions/items | requester đọc của mình, manager đọc tất cả | requester tạo của mình | requester sửa của mình, manager cấp phát | requester xóa của mình |
| receipts/items | manager | manager | manager | manager |
| defect_notes/items | requester đọc của mình, manager tất cả | requester + manager | manager xử lý | manager |
| repair_orders/items | manager | manager | manager | manager |
| liquidation_notes/items | manager | manager | manager | manager |

Ví dụ policy mẫu:
```sql
alter table public.requisitions enable row level security;

create policy "requester_read_own" on public.requisitions
  for select using (auth.uid() = requester_id or public.is_manager());

create policy "requester_insert_own" on public.requisitions
  for insert with check (auth.uid() = requester_id);
```
> **Lưu ý:** các thao tác cấp phát/nhập kho đụng nhiều bảng + ledger → nên viết thành **Postgres function (RPC) `security definer`** hoặc **Server Action với service role**, để giữ transaction nhất quán (xem mục 13.7).

---

## 7. Types & enums

### 7.1 Label map (UI hiển thị tiếng Việt)
```ts
export const REQUISITION_STATUS: Record<string, string> = {
  pending: "Đang chờ xử lý",
  fulfilled: "Đã hoàn thành",
};
export const DEFECT_STATUS: Record<string, string> = {
  staging: "Đang tập kết",
  in_repair: "Đang sửa",
  returned: "Đã nhập lại",
  liquidated: "Đã thanh lý",
};
export const REPAIR_STATUS = { in_repair: "Đang sửa", returned: "Đã về", cancelled: "Đã hủy" };
export const LIQUIDATION_STATUS = { pending: "Chờ duyệt", approved: "Đã duyệt", completed: "Hoàn tất", rejected: "Từ chối" };
export const LIQUIDATION_METHOD = { sale: "Bán", dispose: "Tiêu hủy" };
export const REQUISITION_TYPE = { new_supply: "Cấp mới", replacement: "Đổi mới" };
export const MOVEMENT_TYPE: Record<string, string> = {
  receipt_in: "Nhập kho", requisition_out: "Cấp phát", defect_out: "Chuyển kho hỏng",
  repair_out: "Đưa đi sửa", repair_return_in: "Nhập lại kho", liquidation_out: "Thanh lý",
  adjustment_in: "Điều chỉnh +", adjustment_out: "Điều chỉnh -", transfer: "Chuyển kho",
};
```

### 7.2 Mã phiếu (code) — sinh theo format `<PREFIX>-<STT>`
```ts
// Dùng DB sequence hoặc đếm + 1. Định dạng:
// REQ-0001 (yêu cầu), GRN-0001 (nhập), HONG-0001 (hỏng), SC-0001 (sửa), TL-0001 (thanh lý)
export function nextCode(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
```

---

## 8. Data layer

### 8.1 Supabase clients
```ts
// lib/supabase/client.ts — browser
import { createBrowserClient } from "@supabase/ssr"; // hoặc @supabase/supabase-js
export const supabase = createBrowserClient(url, anon);

// lib/supabase/server.ts — server (đọc cookie)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// lib/supabase/admin.ts — server-only, dùng service role (chỉ cho seed/script)
import { createClient } from "@supabase/supabase-js";
export const supabaseAdmin = createClient(url, serviceRole, { auth: { persistSession: false } });
```

### 8.2 Pattern TanStack Query (ví dụ feature `products`)
```ts
// features/products/api/queries.ts
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(name, icon), variants(*)");
      if (error) throw error;
      return data;
    },
  });
}
```

### 8.3 Pattern Server Action (ví dụ tạo phiếu yêu cầu)
```ts
// features/requisitions/actions/create.ts
"use server";
export async function createRequisition(input: CreateRequisitionInput) {
  const parsed = requisitionSchema.parse(input);   // zod
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  // insert requisitions + requisition_items (transaction qua RPC)
  await supabaseServer.rpc("create_requisition", { ... });
  revalidatePath("/requisitions");
}
```

### 8.4 Nguyên tắc
- Đọc dữ liệu: TanStack Query + client supabase (RLS đảm bảo quyền).
- Ghi dữ liệu (mutation): **Server Action** → gọi RPC/transaction → `revalidatePath`.
- Mọi thay đổi stock phải qua **RPC transaction** (mục 13.7) để ghi ledger đồng bộ.

---

## 9. State management (Zustand)

```ts
// stores/cart-store.ts
interface CartItem { variantId: string; quantity: number; }
interface CartState {
  items: CartItem[];
  addItem(variantId: string, qty: number): void;
  updateQty(variantId: string, qty: number): void;
  removeItem(variantId: string): void;
  clear(): void;
}
// stores/ui-store.ts: isCartOpen, mobile drawer, sidebar collapsed...
```

**Nguyên tắc:** chỉ dữ liệu **phiên/UI** nằm trong Zustand (giỏ hàng, drawer). Dữ liệu nghiệp vụ (products, phiếu...) nằm trong **TanStack Query** (cache server).

---

## 10. Design system & UI

| Yếu tố | Giá trị |
|---|---|
| Primary | Emerald `#059669` |
| Nền | Zinc/Slate xám nhạt |
| Trạng thái | pending=Amber, fulfilled/verified=Emerald, rejected=Rose |
| Font | Inter; bảng số dùng `tabular-nums` |
| Bo góc | 8–12px, shadow nhẹ, border mảnh |
| Components | shadcn/ui (Button, Card, Table, Dialog, Form, Select, Tabs, Badge, Sheet, DropdownMenu, Sonner) |

### Layout
- **Desktop (≥1024px):** Sidebar trái + Topbar (tiêu đề + tìm kiếm + avatar) + nội dung.
- **Mobile (<1024px):** Topbar + Bottom nav (5 mục) + Drawer menu phụ.
- Trạng thái: Loading=skeleton, Empty=minh họa + text + nút hành động, Error=toast + retry.

### Điều hướng theo role
| Menu | Requester | Manager |
|---|---|---|
| Dashboard | ✅ | ✅ |
| Kho vật tư | ✅ | ✅ |
| Phiếu yêu cầu | ✅ (của mình) | ✅ (tất cả) |
| Phiếu nhập kho | — | ✅ |
| Vật tư hỏng | ✅ (báo hỏng) | ✅ (xử lý) |
| Sửa chữa / Thanh lý | — | ✅ |
| Báo cáo | — | ✅ |
| Quản trị (SP/DM/KV/Kho) | — | ✅ |

---

## 11. Routing map

| Route | Màn hình | Role |
|---|---|---|
| `/login` | Đăng nhập | public |
| `/dashboard` | Dashboard | cả 2 |
| `/products` | Kho vật tư (catalog) | cả 2 |
| `/requisitions` | Danh sách phiếu yêu cầu | cả 2 |
| `/requisitions/new` | Tạo phiếu yêu cầu | requester |
| `/requisitions/[id]` | Chi tiết phiếu | cả 2 |
| `/receipts` | Danh sách phiếu nhập | manager |
| `/receipts/new` | Tạo phiếu nhập | manager |
| `/defects` | Danh sách vật tư hỏng | cả 2 |
| `/defects/new` | Ghi nhận hỏng | cả 2 |
| `/repairs` | Danh sách sửa chữa | manager |
| `/liquidations` | Danh sách thanh lý | manager |
| `/reports` | Báo cáo | manager |
| `/admin/products` | Quản trị sản phẩm | manager |
| `/admin/categories` | Quản trị danh mục | manager |
| `/admin/zones` | Quản trị khu vực | manager |
| `/admin/locations` | Quản trị kho/vị trí | manager |

---

## 12. Đặc tả từng màn hình

### 12.1 Đăng nhập (`/login`)
- Card giữa màn hình: email + mật khẩu + nút "Đăng nhập" (Supabase Auth).
- Link "Quên mật khẩu". Sau login → redirect theo role → `/dashboard`.

### 12.2 Dashboard (`/dashboard`)
- 4 thẻ KPI: **Tồn kho thấp**, **Phiếu đang chờ**, **Nhập gần đây**, **Tổng sản phẩm**.
- Bảng "Phiếu yêu cầu gần nhất" + "Cảnh báo tồn kho" (stock ≤ `min_stock`).
- Requester chỉ thấy số liệu liên quan mình; manager thấy toàn trại.
- Manager thêm bộ lọc kỳ (Hôm nay/Tuần/Tháng) cho KPI nhập/xuất.

### 12.3 Kho vật tư (`/products`)
- SearchBar (tìm theo tên/mô tả) + CategoryNav (chips ngang, cuộn trên mobile).
- Lưới ProductCard: ảnh, tên, danh mục, giá, **badge tồn** ("Còn 50"/"Hết hàng").
- Click card → **Dialog chọn biến thể** (attributes → số lượng) → "Thêm vào giỏ".
- Composite hiện tồn = min theo linh kiện (mục 13.1).

### 12.4 Giỏ hàng (Drawer)
- List item (ảnh, biến thể, số lượng ±, giá, xóa) + tổng + nút "Tạo phiếu yêu cầu".

### 12.5 Tạo phiếu yêu cầu (`/requisitions/new`)
- Form: người yêu cầu (từ profile), khu vực (Select), mục đích (textarea), loại phiếu (Cấp mới/Đổi mới).
- Nếu "Đổi mới" → bắt buộc chọn 1 phiếu hỏng liên quan.
- Bảng item (chỉnh số lượng/xóa) → "Gửi phiếu" → toast → về danh sách.

### 12.6 Danh sách / chi tiết phiếu yêu cầu
- Bảng: mã, người yêu cầu, khu vực, ngày, **badge trạng thái**.
- Filter + tìm kiếm + phân trang.
- Chi tiết: item + mục đích + người cấp phát + thời gian.
- Manager: nút **"Cấp phát"** (kiểm tra tồn → trừ stock → `fulfilled`).

### 12.7 Phiếu nhập kho (`/receipts`, `/receipts/new`)
- Danh sách: mã (GRN), nhà cung cấp, ngày, người tạo, số phiếu yêu cầu được cấp phát.
- Tạo mới: nhập supplier + thêm item (sản phẩm → biến thể → số lượng → đơn giá) → "Lưu phiếu".
- Khi lưu: **cộng stock + auto cấp phát** các phiếu pending (FIFO) → thông báo kết quả.

### 12.8 Vật tư hỏng (`/defects`, `/defects/new`)
- Danh sách: mã (HONG), ngày, người báo, **badge trạng thái**, tổng số lượng.
- Ghi nhận hỏng: chọn location nguồn → thêm dòng item: biến thể, số lượng, **chi tiết hỏng**, kiểu hỏng, mức độ, ảnh.
- Chi tiết: nút **"Đưa đi sửa"**, **"Thanh lý"**, **"Tạo yêu cầu đổi mới"**.
- Lưu phiếu hỏng: **Kho chính −qty → Kho hỏng +qty** (ledger `defect_out`).

### 12.9 Sửa chữa (`/repairs`)
- Danh sách: mã (SC), đơn vị sửa, ngày gửi, dự kiến về, chi phí, **badge** (Đang sửa/Đã về/Hủy).
- Tạo phiếu sửa: chọn item từ Kho hỏng → nhập đơn vị sửa, ngày gửi, ngày dự kiến về.
- Nhập kết quả: từng dòng chọn `outcome` (nhập lại kho / thanh lý) + chi phí sửa.

### 12.10 Thanh lý (`/liquidations`)
- Danh sách: mã (TL), lý do, **badge** (Chờ duyệt/Đã duyệt/Hoàn tất/Từ chối), tổng giá trị, tiền thu.
- Tạo phiếu: chọn item hỏng → số lượng, phương thức (bán/tiêu hủy), giá trị ước tính.
- Duyệt → hoàn tất (nhập tiền thu thực tế) → trừ stock location tương ứng.

### 12.11 Quản trị (`/admin/*`)
- **Sản phẩm:** bảng + thêm/sửa/xóa; form: tên, mô tả, ảnh, danh mục, options, danh sách biến thể (attributes, price, unit, min_stock, components nếu composite).
- **Danh mục:** thẻ icon + kéo thả đổi thứ tự + thêm/sửa/xóa.
- **Khu vực:** danh sách tên + mô tả + CRUD.
- **Kho/vị trí:** quản lý `stock_locations` (code, name, type).

### 12.12 Báo cáo (`/reports`) — xem mục 16

---

## 13. Quy tắc nghiệp vụ & luồng xử lý

### 13.1 Tính tồn kho (composite)
```
stock(variant) = nếu có components: min(floor(stock(child) / qty)) trên mọi child
                 ngược lại: stock_balances.sum(quantity) trên mọi location
```

### 13.2 Cấp phát phiếu yêu cầu
1. Kiểm tra tồn từng item. Thiếu → báo lỗi liệt kê, **không cấp phát**.
2. Đủ → trừ stock (composite: trừ từng component `qty × item.qty`).
3. Ghi ledger `requisition_out` (from Kho chính).
4. Cập nhật phiếu `status=fulfilled`, `fulfilled_by`, `fulfilled_at`, `fulfillment_notes`.

### 13.3 Tạo phiếu nhập kho + auto cấp phát
1. Cộng stock từng item (`receipt_in`), lưu `unit_cost`.
2. Lấy phiếu `pending` sắp xếp `created_at` tăng dần (FIFO).
3. Lần lượt cấp phát (13.2) → thành công ghi id vào `linked_requisition_ids`.

### 13.4 Vật tư hỏng → sửa → nhập lại
1. **Ghi hỏng:** Kho chính −qty → Kho hỏng +qty (`defect_out`); status `staging`.
2. **Đưa đi sửa:** Kho hỏng −qty → Kho đang sửa +qty (`repair_out`); status `in_repair`.
3. **Sửa xong:** từng item `outcome`:
   - `returned_to_stock`: Kho đang sửa −qty → Kho chính +qty (`repair_return_in`); `resolution='repaired'`.
   - `liquidation`: chuyển sang luồng thanh lý.

### 13.5 Thanh lý
1. Tạo phiếu (Chờ duyệt) + items.
2. Duyệt (`approved`) → bán/tiêu hủy.
3. Hoàn tất: trừ stock location tương ứng (`liquidation_out`), ghi `proceeds`, `resolution='liquidated'`.

### 13.6 Đổi mới (thay thế)
1. Từ 1 phiếu hỏng tạo `requisition` loại `replacement` + `linked_defect_id`.
2. Manager cấp phát cái mới từ Kho chính → `fulfilled`.
3. Cái hỏng xử lý song song theo 13.4/13.5.

### 13.7 Transaction & ledger (QUAN TRỌNG)
Mọi thao tác đổi stock phải **nguyên tử**. Dùng RPC `security definer`:
```sql
create or replace function public.receipt_in(
  p_items jsonb, p_supplier text, p_created_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_receipt_id uuid; it jsonb;
begin
  insert into receipts(code, supplier, created_by)
  values ('GRN-'||lpad(nextval('receipts_seq')::text,4,'0'), p_supplier, p_created_by)
  returning id into v_receipt_id;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into receipt_items(receipt_id, variant_id, quantity, unit_cost)
    values (v_receipt_id, (it->>'variant_id')::uuid, (it->>'quantity')::int, (it->>'unit_cost')::numeric);

    update stock_balances set quantity = quantity + (it->>'quantity')::int
    where variant_id = (it->>'variant_id')::uuid and location_id = (select id from stock_locations where code='KHO_CHINH');

    insert into stock_movements(variant_id, to_location_id, movement_type, quantity, ref_type, ref_id, created_by)
    values ((it->>'variant_id')::uuid, (select id from stock_locations where code='KHO_CHINH'),
            'receipt_in', (it->>'quantity')::int, 'receipt', v_receipt_id, p_created_by);
  end loop;
  return jsonb_build_object('receipt_id', v_receipt_id);
end;
$$;
```
> Viết RPC tương tự cho: `fulfill_requisition`, `record_defect`, `send_to_repair`, `return_repair`, `complete_liquidation`. (Dùng sequence `*_seq` cho code; tạo `create sequence receipts_seq;`...)

---

## 14. Validation (zod schemas)

```ts
// features/products/schema.ts
export const variantSchema = z.object({
  attributes: z.record(z.string()),
  price: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  minStock: z.number().int().min(0).default(0),
  components: z.array(z.object({ childVariantId: z.string(), quantity: z.number().int().positive() })).optional(),
});
export const productSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  description: z.string().optional(),
  images: z.array(z.string()).default([]),
  categoryId: z.string().uuid().nullable(),
  options: z.array(z.string()).default([]),
  variants: z.array(variantSchema).min(1, "Cần ít nhất 1 biến thể"),
});

// features/requisitions/schema.ts
export const requisitionSchema = z.object({
  zoneId: z.string().uuid(),
  purpose: z.string().min(1, "Mục đích không được trống"),
  requisitionType: z.enum(["new_supply", "replacement"]).default("new_supply"),
  linkedDefectId: z.string().uuid().optional(),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

// features/defects/schema.ts
export const defectItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  damageDetail: z.string().min(1),
  damageType: z.string().optional(),
  severity: z.enum(["nhẹ", "vừa", "nặng"]).optional(),
  images: z.array(z.string()).default([]),
});
```

---

## 15. Seed data

### 15.1 Categories (8)
```sql
insert into public.categories (name, icon, display_order) values
('Thức ăn chăn nuôi', null, 1),
('Thuốc & Vắc-xin', null, 2),
('Dụng cụ chăn nuôi', null, 3),
('Hệ thống chuồng trại', null, 4),
('Vệ sinh & Sát trùng', null, 5),
('Bảo hộ lao động', null, 6),
('Phụ tùng & Sửa chữa', null, 7),
('Khác', null, 8);
```

### 15.2 Zones (4)
```sql
insert into public.zones (name) values ('Khu 1'), ('Khu 2'), ('Khu 3'), ('Khu 4');
```

### 15.3 Stock locations (3)
```sql
insert into public.stock_locations (code, name, type) values
('KHO_CHINH', 'Kho chính', 'main'),
('KHO_HONG', 'Kho hỏng tập kết', 'defect'),
('KHO_DANG_SUA', 'Đang sửa chữa', 'repair');
```

### 15.4 Sản phẩm (12) — tham khảo, ghi tắt
| Tên | Danh mục | Options | Variants (unit/giá) |
|---|---|---|---|
| Cám gà con | Thức ăn chăn nuôi | Trọng lượng | Bao 10kg/180k, Bao 25kg/420k |
| Vắc-xin Newcastle | Thuốc & Vắc-xin | Liều | Lọ 100 liều/15k, Lọ 500 liều/60k |
| Máng ăn dài cho gà | Dụng cụ chăn nuôi | Chiều dài | 50cm/25k, 75cm/32k, 100cm/40k |
| Quạt thông gió công nghiệp | Hệ thống chuồng trại | — | Cái/1.250k |
| Thuốc sát trùng Vimekon | Vệ sinh & Sát trùng | Dung tích | Chai 1L/220k |
| Ủng bảo hộ cao su | Bảo hộ lao động | Kích cỡ | 39–42, 85k/đôi |
| Bóng đèn úm hồng ngoại | Phụ tùng & Sửa chữa | Công suất | 100W/45k, 150W/55k, 250W/70k |
| Men tiêu hóa gia cầm | Thuốc & Vắc-xin | — | Gói/95k |
| Tấm lót chuồng trấu | Hệ thống chuồng trại | — | Bao/30k |
| Xẻng xúc cám | Dụng cụ chăn nuôi | Loại | Nhựa/20k, Inox/65k |
| Bộ máng uống núm tự động | Dụng cụ chăn nuôi | Loại | **Composite**: Bộ=1 Núm(5k)+1 Cốc(2.5k) |
| Vôi bột khử trùng | Vệ sinh & Sát trùng | — | Bao/50k |

> Chi tiết đầy đủ (mô tả, ảnh, stock mẫu) agent có thể nhập thêm; cấu trúc bắt buộc theo schema mục 5.

---

## 16. Báo cáo & xuất liệu

| Báo cáo | Dữ liệu nguồn | Dạng |
|---|---|---|
| Tồn kho | `stock_balances` join variants/products/locations | bảng + bar |
| Nhập - Xuất - Tồn (NXT) | `stock_movements` theo kỳ | line/bar |
| Cấp phát theo khu vực | `requisitions` fulfilled join zones | pie/bar |
| Hỏng - Sửa - Thanh lý | defect/repair/liquidation | bảng + bar |
| Lịch sử biến động kho | `stock_movements` | bảng (filter mạnh) |

**Xuất phiếu (PDF):** nút "In/Xuất PDF" trên mỗi phiếu (yêu cầu, nhập, hỏng, sửa, thanh lý) → `@react-pdf/renderer` (server).
**Xuất báo cáo:** PDF (biểu đồ) + Excel/CSV (`xlsx` / CSV server-side).

---

## 17. Testing

- **Unit (Vitest):** hàm tính tồn composite, `nextCode`, các pure function nghiệp vụ.
- **Component (RTL):** ProductCard badge tồn, form validation.
- **Integration:** RPC/Server Actions (fulfill, receipt_in) — kiểm tra stock & ledger khớp.
- **E2E (Playwright, sau):** luồng đăng nhập → tạo phiếu → cấp phát.

**Bắt buộc test:**
1. Composite stock: thiếu 1 linh kiện → tồn 0.
2. Cấp phát thiếu stock → không trừ, báo lỗi.
3. `receipt_in` → stock tăng + 1 dòng `stock_movements`.
4. `record_defect` → Kho chính giảm, Kho hỏng tăng, ledger đúng.

---

## 18. Lộ trình (phases + acceptance criteria)

| Phase | Nội dung | Chấp nhận khi |
|---|---|---|
| 0 | Nền tảng: init Next.js + shadcn + Supabase + CI + layout shell | app chạy, CI xanh, route rỗng điều hướng được |
| 1 | Auth + profiles + middleware + role menu | login thật, refresh giữ session, menu đúng role |
| 2 | Catalog + `stock_locations` + `stock_balances` | CRUD SP/DM/KV/Kho + stock composite đúng |
| 3 | Phiếu yêu cầu (tạo/duyệt/cấp phát) | requester tạo, manager cấp phát, ledger `requisition_out` |
| 4 | Phiếu nhập + `stock_movements` + RPC | nhập tăng stock, ledger đầy đủ |
| 5 | Hỏng → tập kết → sửa → nhập lại | vòng hỏng→sửa→về đúng, stock khớp |
| 6 | Thanh lý + Đổi mới | thanh lý trừ kho, đổi mới nối defect→requisition |
| 7 | Báo cáo thống kê | số liệu khớp ledger |
| 8 | Xuất phiếu PDF + báo cáo PDF/Excel/CSV | in/xuất đủ loại |
| 9 | Mở rộng: giao nhận + kiểm định + chatbot AI + thông báo | — |

---

## 19. Coding conventions

- **Thư mục:** mỗi feature = folder `src/features/<name>/` gồm `components/`, `actions/`, `api/`, `schema/`.
- **Đặt tên:** file component PascalCase (`ProductCard.tsx`), hook `useXxx.ts`, action `create.ts`.
- **Server vs Client:** page mặc định Server Component; component tương tác thêm `"use client"`.
- **Query key:** `["products"]`, `["requisitions", id]`.
- **Commit:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- **Branch:** `main` (ổn định), `dev`, nhánh `feat/xxx`.
- **Không hardcode** chuỗi tiếng Việt trong logic — dùng label map (mục 7.1).
- **Không gọi service role từ client.** Service role chỉ ở server.

---

## 20. Tech-debt cần tránh (bài học repo cũ)

1. Không gom hết vào 1 file App.tsx → dùng App Router + feature-first.
2. Không trộn localStorage + Supabase → chỉ Supabase.
3. Không `parseInt()` trên UUID → UUID string xuyên suốt.
4. Không để file rỗng/stub.
5. Không component quá 300–400 dòng → tách nhỏ.
6. Không auth giả (mật khẩu cứng) → Supabase Auth + RLS.
7. Không lưu status tiếng Việt trong DB → enum tiếng Anh + label map.
8. Không nhúng Gemini key vào client → gọi qua server.

---

## 21. Checklist triển khai (trước khi coi là xong 1 phase)

- [ ] Migration chạy sạch, không lỗi, RLS bật.
- [ ] Types Supabase được generate lại sau mỗi thay đổi schema.
- [ ] Test qua (vitest) + lint + typecheck.
- [ ] Thao tác stock luôn có ledger tương ứng (đối chiếu được).
- [ ] Mobile + desktop responsive.
- [ ] Không có dữ liệu/code legacy nào sót lại.
- [ ] `.env.example` đầy đủ; không có secret thật trong repo.
