# BUILD GUIDE v2 — Hệ thống Quản lý Kho Trại Gà (`minh-tan-phat-supply`)

> **Mục đích:** Tài liệu **duy nhất** để xây dựng dự án từ đầu đến cuối. Một agent chỉ cần bám theo file này là code được, **không cần mở repo cũ `K-MTP-PRo`**.
>
> **Cách dùng:** Đọc tuần tự. Khi code bám theo: mục 3 (khởi tạo) → mục 5 (SQL) → mục 6 (state machine) → mục 8 (RPC) → mục 14 (màn hình) → mục 15 (nghiệp vụ) → mục 21 (lộ trình).
> Thuật ngữ tiếng Việt giữ nghĩa; định danh code/DB dùng tiếng Anh (xem Glossary mục 7).

---

## MỤC LỤC
1. Tổng quan & vòng đời vật tư
2. Tech stack & phiên bản
3. Khởi tạo dự án
4. Cấu trúc thư mục
5. Data model (SQL đầy đủ, đúng thứ tự)
6. State machine (trạng thái từng loại phiếu)
7. Glossary (VN → EN) + label map
8. RPC & Server Actions (danh sách đầy đủ + chống race)
9. Data layer (client, hooks, pagination)
10. State management (Zustand)
11. Auth & phân quyền (RLS)
12. Design system & UI
13. Routing map
14. Đặc tả từng màn hình
15. Quy tắc nghiệp vụ & luồng xử lý
16. Validation (zod)
17. Seed data (đầy đủ, chạy được)
18. Báo cáo & xuất liệu
19. Testing
20. Local dev & Deployment
21. Lộ trình (phases + acceptance criteria)
22. Coding conventions
23. Tech-debt cần tránh
24. Checklist triển khai

---

## 1. Tổng quan & vòng đời vật tư

**Domain:** Quản lý vật tư trại gà — danh mục sản phẩm, tồn kho đa kho, phiếu yêu cầu (nhiều trạng thái), phiếu nhập kho, vật tư hỏng → sửa chữa → thanh lý, kiểm kê, báo cáo.

**Vai trò:**
- `requester` (Người yêu cầu): xem kho, tạo phiếu yêu cầu, báo hỏng, xác nhận nhận hàng.
- `manager` (Quản lý kho): quản trị, duyệt/cấp phát, nhập kho, sửa chữa, thanh lý, kiểm kê, báo cáo, quản lý người dùng.

**Vòng đời vật tư:**
```
NHẬP KHO → TỒN KHO CHÍNH → CẤP PHÁT (issued) → SỬ DỤNG → (requester) ĐÃ NHẬN
                                        ↓ (hỏng)
                          KHO TẬP KẾT HỎNG → SỬA CHỮA → NHẬP LẠI KHO
                                        └───────────→ THANH LÝ (bán/tiêu hủy)
```

---

## 2. Tech stack & phiên bản

| Hạng mục | Công nghệ | Phiên bản |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Ngôn ngữ | TypeScript (strict) | 5.x |
| DB/Auth | Supabase (Postgres + Auth + Storage) | supabase-js 2.x |
| Data fetching | TanStack Query | 5.x |
| Client state | Zustand | 5.x |
| Form + validate | react-hook-form + zod | RHF 7.x, zod 3.x |
| UI | Tailwind CSS + shadcn/ui | Tailwind 3.x/4 |
| PDF | @react-pdf/renderer | 3.x |
| Excel | xlsx | 0.18.x |
| Toast | sonner | — |
| Package manager | Bun | 1.x |
| Test | Vitest + RTL; Playwright (E2E) | 2.x |

---

## 3. Khởi tạo dự án

```bash
# 1. Next.js app
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun

# 2. Dependencies
bun add @supabase/supabase-js @tanstack/react-query zustand react-hook-form zod @hookform/resolvers @react-pdf/renderer xlsx sonner
bun add -d vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom prettier

# 3. shadcn/ui
bunx shadcn@latest init
bunx shadcn@latest add button card table dialog form select tabs badge sheet dropdown-menu input textarea sonner skeleton command popover

# 4. Supabase CLI
bunx supabase init
bunx supabase start        # local dev (Docker)

# 5. .env.example
cat > .env.example <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only
EOF
```

**Env validation (zod) khi boot:**
```ts
// lib/env.ts
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
});
export const env = envSchema.parse(process.env); // fail sớm nếu thiếu
```

---

## 4. Cấu trúc thư mục

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/                        # protected
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── products/page.tsx
│   │   ├── requisitions/{page.tsx,new/page.tsx,[id]/page.tsx}
│   │   ├── receipts/{page.tsx,new/page.tsx}
│   │   ├── defects/{page.tsx,new/page.tsx}
│   │   ├── repairs/page.tsx
│   │   ├── liquidations/page.tsx
│   │   ├── stocktake/page.tsx        # kiểm kê
│   │   ├── reports/page.tsx
│   │   └── admin/{products,categories,zones,locations,suppliers,users}/page.tsx
│   ├── layout.tsx
│   └── api/...                       # export, webhook
├── features/{auth,products,requisitions,receipts,defects,repairs,liquidations,stocktake,reports,admin}/
│   ├── components/  actions/  api/  schema/  types.ts
├── components/{ui,layout}/
├── lib/{supabase/{client,server,admin}.ts, auth.ts, env.ts, utils.ts}
├── server/db/                        # RPC wrappers, ledger helpers
├── stores/{cart-store.ts, ui-store.ts}
└── types/database.types.ts           # supabase gen types
supabase/{migrations/, seed.sql}
middleware.ts
```

---

## 5. Data model (SQL đầy đủ, đúng thứ tự)

> UUID everywhere (`gen_random_uuid()`), enum tiếng Anh + label map tiếng Việt, migration **chỉ additive**.
> Thứ tự quan trọng vì FK: core → auth → suppliers → catalog → inventory → **defects** → requisitions → repairs → liquidations → receipts → audit → stocktake.

### 5.1 `0001_core.sql`
```sql
create extension if not exists "uuid-ossp";

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz            -- soft delete
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 5.2 `0002_auth.sql`
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('requester','manager')),
  zone_id uuid references public.zones(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role, zone_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager' and is_active);
$$;
```

### 5.3 `0003_suppliers.sql` — nhà cung cấp
```sql
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

### 5.4 `0004_catalog.sql`
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  images text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  options text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(12,2),
  images text[] not null default '{}',
  unit text,
  min_stock integer not null default 0,
  is_trackable_lot boolean not null default false,   -- có theo lô/hạn không (thuốc, vắc-xin)
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

### 5.5 `0005_inventory.sql`
```sql
create type public.location_type as enum ('main','defect','repair','other');

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
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
  'receipt_in','requisition_out','return_in','defect_out','repair_out',
  'repair_return_in','liquidation_out','adjustment_in','adjustment_out','transfer'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id),
  from_location_id uuid references public.stock_locations(id),
  to_location_id uuid references public.stock_locations(id),
  movement_type public.movement_type not null,
  quantity integer not null,
  ref_type text,
  ref_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
```

### 5.6 `0006_defects.sql` (TRƯỚC requisitions)
```sql
create type public.defect_status as enum ('staging','in_repair','returned','liquidated','cancelled');
create type public.severity_level as enum ('light','medium','severe');
create type public.damage_type as enum ('cracked','chipped','broken','worn','electrical','chemical','other');
create type public.defect_resolution as enum ('repaired','liquidated');

create table public.defect_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
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
  damage_detail text,
  damage_type public.damage_type,
  severity public.severity_level,
  images text[] not null default '{}',
  unit_cost numeric(12,2),
  resolution public.defect_resolution,
  created_at timestamptz not null default now()
);
```

### 5.7 `0007_requisitions.sql` — nhiều trạng thái
```sql
create type public.requisition_type as enum ('new_supply','replacement');
create type public.requisition_status as enum (
  'draft','pending','approved','issued','received','rejected','cancelled'
);

create table public.requisitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  requester_id uuid not null references public.profiles(id),
  zone_id uuid references public.zones(id) on delete set null,
  purpose text not null,
  requisition_type public.requisition_type not null default 'new_supply',
  linked_defect_id uuid references public.defect_notes(id),
  status public.requisition_status not null default 'draft',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  fulfilled_by uuid references public.profiles(id),
  fulfilled_at timestamptz,
  fulfillment_notes text,
  received_by uuid references public.profiles(id),
  received_at timestamptz,
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

### 5.8 `0008_repairs.sql`
```sql
create type public.repair_status as enum ('in_repair','returned','cancelled');
create type public.repair_outcome as enum ('returned_to_stock','liquidation');

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
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
  outcome public.repair_outcome,
  created_at timestamptz not null default now()
);
```

### 5.9 `0009_liquidations.sql`
```sql
create type public.liquidation_status as enum ('pending','approved','completed','rejected','cancelled');
create type public.liquidation_method as enum ('sale','dispose');

create table public.liquidation_notes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
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
  source_item_id uuid,
  quantity integer not null default 1 check (quantity > 0),
  method public.liquidation_method not null default 'dispose',
  unit_value numeric(12,2),
  proceeds numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
```

### 5.10 `0010_receipts.sql` — có lô/hạn, trạng thái
```sql
create type public.receipt_status as enum ('draft','posted','cancelled');

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status public.receipt_status not null default 'draft',
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
  unit_cost numeric(12,2),
  batch_no text,                   -- lô (nếu variant is_trackable_lot)
  expiry_date date,                -- hạn sử dụng
  created_at timestamptz not null default now()
);
```

### 5.11 `0011_audit.sql`
```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,           -- 'product.update', 'requisition.approve', ...
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
```

### 5.12 `0012_stocktake.sql` — kiểm kê
```sql
create type public.stocktake_status as enum ('draft','posted','cancelled');

create table public.stocktake_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- 'KK-0001'
  location_id uuid not null references public.stock_locations(id),
  status public.stocktake_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table public.stocktake_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.stocktake_sessions(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  system_qty integer not null default 0,   -- tồn hệ thống tại thời điểm kiểm
  actual_qty integer not null default 0,   -- số thực tế
  created_at timestamptz not null default now()
);
-- diff = actual_qty - system_qty
```

### 5.13 `0013_sequences.sql` — sinh mã phiếu
```sql
create sequence public.requisitions_seq;
create sequence public.receipts_seq;
create sequence public.defect_notes_seq;
create sequence public.repair_orders_seq;
create sequence public.liquidation_notes_seq;
create sequence public.stocktake_seq;

create or replace function public.next_code(prefix text, seq regclass)
returns text language plpgsql as $$
begin
  return prefix || '-' || lpad(nextval(seq)::text, 4, '0');
end;
$$;
```

### 5.14 `0014_triggers.sql`
```sql
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
-- gắn trigger cho mọi bảng có updated_at: categories, zones, profiles, products,
-- variants, stock_locations, suppliers, defect_notes, repair_orders,
-- liquidation_notes, requisitions, receipts
```

### 5.15 `0015_indexes.sql`
```sql
create index idx_products_category on public.products(category_id);
create index idx_variants_product on public.variants(product_id);
create index idx_balances_variant on public.stock_balances(variant_id);
create index idx_balances_location on public.stock_balances(location_id);
create index idx_movements_variant on public.stock_movements(variant_id);
create index idx_movements_type on public.stock_movements(movement_type);
create index idx_requisitions_status on public.requisitions(status);
-- 1 defect chỉ được tạo 1 phiếu đổi mới (chống tạo trùng)
create unique index idx_requisitions_unique_replacement
  on public.requisitions (linked_defect_id)
  where requisition_type = 'replacement' and linked_defect_id is not null;
create index idx_requisition_items_req on public.requisition_items(requisition_id);
create index idx_receipt_items_receipt on public.receipt_items(receipt_id);
create index idx_defect_items_note on public.defect_note_items(defect_note_id);
create index idx_repair_items_order on public.repair_order_items(repair_order_id);
create index idx_liquidation_items_note on public.liquidation_items(liquidation_note_id);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
```

### 5.16 `0016_rls.sql` — xem mục 11

---

## 6. State machine (trạng thái từng loại phiếu)

> Quy tắc chung: mỗi bước chuyển trạng thái ghi `audit_logs` (ai, khi nào, before/after). Trạng thái `*_status` lưu enum tiếng Anh, UI hiển thị nhãn tiếng Việt (mục 7.2).

### 6.1 Phiếu yêu cầu (`requisition_status`) — QUAN TRỌNG NHẤT

| Status | Nhãn VN | Ý nghĩa | Ai thực hiện |
|---|---|---|---|
| `draft` | Nháp | Đang soạn, chưa gửi | requester |
| `pending` | Đang chờ | Đã gửi, chờ manager xử lý | requester (gửi) |
| `approved` | Đã duyệt | Manager duyệt, chờ cấp phát | manager |
| `issued` | Đã cấp phát | Đã trừ stock, hàng đã xuất | manager |
| `received` | Đã nhận | Requester xác nhận đã nhận hàng | requester |
| `rejected` | Từ chối | Manager từ chối (kèm lý do) | manager |
| `cancelled` | Đã hủy | Requester hủy (trước khi cấp phát) | requester |

**Chuyển trạng thái hợp lệ:**
```
draft ──submit──▶ pending ──approve──▶ approved ──issue──▶ issued ──receive──▶ received
   │                  │                    │
   └─cancel           ├─reject             └─reject
   │                  └─cancel
   ▼
cancelled ─────────────▶ (kết thúc)
rejected ──────────────▶ (kết thúc)
```
| Từ | Đến | Điều kiện |
|---|---|---|
| draft | pending | có ≥1 item, điền zone + purpose |
| draft | cancelled | requester tự hủy |
| pending | approved | manager duyệt |
| pending | rejected | manager từ chối, **bắt buộc** `rejection_reason` |
| pending | cancelled | requester rút |
| approved | issued | manager cấp phát: **trừ stock + ghi ledger** |
| approved | rejected | manager từ chối |
| issued | received | requester xác nhận đã nhận |
| issued | (không thể hủy/reject) | — |

**Không được phép:** `issued → pending`, `received → issued`, `rejected → approved` (trừ khi manager mở lại thủ công — không khuyến nghị).

### 6.2 Phiếu nhập kho (`receipt_status`)
```
draft ──post──▶ posted   (cộng stock + auto cấp phát các requisition pending/approved)
   └─cancel─▶ cancelled
```
| Status | Nhãn | Ý nghĩa |
|---|---|---|
| `draft` | Nháp | Đang nhập, chưa ghi nhận stock |
| `posted` | Đã ghi nhận | Đã cộng stock + auto cấp phát |
| `cancelled` | Đã hủy | Hủy trước khi post |

### 6.3 Phiếu hỏng (`defect_status`)
```
staging ──send_repair──▶ in_repair ──return──▶ returned
   │                        │──liquidate──▶ liquidated
   ├──liquidate──▶ liquidated
   └──cancel─────▶ cancelled
```
| Status | Nhãn | Ý nghĩa |
|---|---|---|
| `staging` | Đang tập kết | Đã chuyển về Kho hỏng |
| `in_repair` | Đang sửa | Đã đưa đi sửa |
| `returned` | Đã nhập lại | Sửa xong, về Kho chính |
| `liquidated` | Đã thanh lý | Đã xử lý thanh lý |
| `cancelled` | Đã hủy | Hủy phiếu |

> `defect_note_items.resolution` (`repaired`/`liquidated`) phản ánh **từng cái** trong phiếu.

### 6.4 Phiếu sửa (`repair_status`)
```
in_repair ──return──▶ returned   (từng item: outcome = returned_to_stock | liquidation)
   └─cancel─▶ cancelled
```

### 6.5 Phiếu thanh lý (`liquidation_status`)
```
pending ──approve──▶ approved ──complete──▶ completed
   │                     └─cancel
   ├─reject──▶ rejected
   └─cancel──▶ cancelled
```
| Status | Nhãn | Ý nghĩa |
|---|---|---|
| `pending` | Chờ duyệt | |
| `approved` | Đã duyệt | chờ hoàn tất |
| `completed` | Hoàn tất | **đã trừ stock + ghi proceeds** |
| `rejected` | Từ chối | |
| `cancelled` | Đã hủy | |

---

## 7. Glossary (VN → EN) + label map

### 7.1 Glossary thuật ngữ
| Tiếng Việt | EN (code/DB) |
|---|---|
| Vật tư / sản phẩm | product / item |
| Biến thể | variant |
| Danh mục | category |
| Khu vực | zone |
| Kho / vị trí kho | stock location |
| Tồn kho | stock / stock balance |
| Sổ biến động kho | stock movement (ledger) |
| Phiếu yêu cầu | requisition |
| Cấp phát / xuất kho | fulfill / issue |
| Đã nhận | received |
| Phiếu nhập kho | receipt (GRN) |
| Nhà cung cấp | supplier |
| Vật tư hỏng | defect |
| Sửa chữa | repair |
| Thanh lý | liquidation |
| Kiểm kê | stocktake |
| Đổi mới (thay thế) | replacement |
| Cấp mới | new supply |

### 7.2 Label map (UI)
```ts
export const REQUISITION_STATUS: Record<string,string> = {
  draft:"Nháp", pending:"Đang chờ", approved:"Đã duyệt", issued:"Đã cấp phát",
  received:"Đã nhận", rejected:"Từ chối", cancelled:"Đã hủy"
};
export const RECEIPT_STATUS = { draft:"Nháp", posted:"Đã ghi nhận", cancelled:"Đã hủy" };
export const DEFECT_STATUS = { staging:"Đang tập kết", in_repair:"Đang sửa", returned:"Đã nhập lại", liquidated:"Đã thanh lý", cancelled:"Đã hủy" };
export const REPAIR_STATUS = { in_repair:"Đang sửa", returned:"Đã về", cancelled:"Đã hủy" };
export const LIQUIDATION_STATUS = { pending:"Chờ duyệt", approved:"Đã duyệt", completed:"Hoàn tất", rejected:"Từ chối", cancelled:"Đã hủy" };
export const LIQUIDATION_METHOD = { sale:"Bán", dispose:"Tiêu hủy" };
export const REQUISITION_TYPE = { new_supply:"Cấp mới", replacement:"Đổi mới" };
export const STOCKTAKE_STATUS = { draft:"Nháp", posted:"Đã chốt", cancelled:"Đã hủy" };
export const SEVERITY_LEVEL = { light:"Nhẹ", medium:"Vừa", severe:"Nặng" };
export const DAMAGE_TYPE = { cracked:"Nứt", chipped:"Mẻ", broken:"Gãy", worn:"Mòn", electrical:"Hỏng điện", chemical:"Hỏng hóa chất", other:"Khác" };
export const DEFECT_RESOLUTION = { repaired:"Đã sửa", liquidated:"Đã thanh lý" };
export const REPAIR_OUTCOME = { returned_to_stock:"Nhập lại kho", liquidation:"Thanh lý" };
export const MOVEMENT_TYPE = {
  receipt_in:"Nhập kho", requisition_out:"Cấp phát", return_in:"Nhập trả lại",
  defect_out:"Chuyển kho hỏng", repair_out:"Đưa đi sửa", repair_return_in:"Nhập lại kho (sửa xong)",
  liquidation_out:"Thanh lý", adjustment_in:"Điều chỉnh +", adjustment_out:"Điều chỉnh -", transfer:"Chuyển kho"
};
```

---

## 8. RPC & Server Actions

> **Nguyên tắc:** mọi thay đổi stock + chuyển trạng thái chạy qua **RPC `security definer`**, bên trong dùng `SELECT ... FOR UPDATE` để chống race. Server Action chỉ gọi RPC + `revalidatePath`.

### 8.1 Pattern chống race (bắt buộc)
> **3 quy tắc cứng cho MỌI RPC đổi trạng thái + đổi stock:**
> 1. **Khóa dòng chứng từ trước** bằng `select ... for update` rồi mới check trạng thái (chống duyệt/cấp phát trùng khi double-click / 2 tab).
> 2. **Khóa stock theo thứ tự cố định** `order by variant_id` khi lặp nhiều dòng (chống deadlock).
> 3. Kiểm tra `quantity` **sau khi khóa** rồi mới trừ.

```sql
-- 1) khóa dòng chứng từ trước khi check trạng thái
select status into v_status from public.requisitions where id = p_id for update;

-- 2) khóa stock theo thứ tự cố định
select quantity into v_qty
from public.stock_balances
where variant_id = v_variant and location_id = v_loc
for update;
```

### 8.2 Danh sách RPC cần viết

| # | RPC | Input | Output | Việc làm |
|---|---|---|---|---|
| 1 | `create_requisition` | items jsonb, zone_id, purpose, type, linked_defect_id, requester_id | requisition_id | tạo `draft` + items |
| 2 | `submit_requisition` | id | — | draft→pending |
| 3 | `approve_requisition` | id, by | — | pending→approved |
| 4 | `fulfill_requisition` | id, by, notes | — | approved→issued, trừ stock + ledger |
| 5 | `receive_requisition` | id, by | — | issued→received |
| 6 | `reject_requisition` | id, by, reason | — | pending/approved→rejected |
| 7 | `cancel_requisition` | id, by | — | draft/pending→cancelled |
| 8 | `create_receipt` | items jsonb, supplier_id, by | receipt_id | tạo `draft` |
| 9 | `post_receipt` | id, by | linked_req_ids[] | draft→posted, cộng stock + auto fulfill |
| 10 | `cancel_receipt` | id, by | — | draft→cancelled |
| 11 | `record_defect` | items jsonb, source_loc, by | defect_id | tạo defect + chuyển kho hỏng |
| 12 | `send_to_repair` | defect_item_ids[], vendor, dates, by | repair_id | staging→in_repair |
| 13 | `complete_repair` | repair_id, outcomes jsonb, by | — | in_repair→returned, xử lý từng item |
| 14 | `create_liquidation` | items jsonb, reason, by | liquidation_id | tạo pending |
| 15 | `approve_liquidation` | id, by | — | pending→approved |
| 16 | `complete_liquidation` | id, items_outcome jsonb, by | — | approved→completed, trừ stock |
| 17 | `reject_liquidation` | id, by, reason | — | pending→rejected |
| 18 | `post_stocktake` | session_id, by | — | draft→posted, tạo adjustment |
| 19 | `transfer_stock` | items jsonb, from_loc, to_loc, by | — | chuyển kho giữa locations |
| 20 | `return_requisition_items` | requisition_id, items jsonb, by | — | nhập trả lại: cộng stock + ledger `return_in` |
| 21 | `adjust_stock` | variant_id, location_id, delta, reason, by | — | điều chỉnh tồn thủ công (delta ±, bắt buộc reason) |

### 8.3 Ví dụ RPC `fulfill_requisition` (đầy đủ pattern)
```sql
create or replace function public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_qty int;
  v_main uuid;
  v_status public.requisition_status;
begin
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  -- 0. KHÓA dòng chứng từ TRƯỚC khi check trạng thái (chống cấp phát trùng)
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'approved' then
    raise exception 'Phiếu không ở trạng thái đã duyệt (hiện tại: %)', v_status;
  end if;

  -- 1. kiểm tra đủ tồn (khóa theo thứ tự variant_id cố định để tránh deadlock)
  for it in select * from public.requisition_items where requisition_id = p_id
             order by variant_id loop
    select quantity into v_qty from public.stock_balances
    where variant_id = it.variant_id and location_id = v_main for update;
    if v_qty is null or v_qty < it.quantity then
      raise exception 'Không đủ tồn kho cho variant %', it.variant_id;
    end if;
  end loop;

  -- 2. trừ stock + ghi ledger (cùng thứ tự variant_id)
  for it in select * from public.requisition_items where requisition_id = p_id
             order by variant_id loop
    update public.stock_balances set quantity = quantity - it.quantity, updated_at = now()
    where variant_id = it.variant_id and location_id = v_main;

    insert into public.stock_movements(variant_id, from_location_id, movement_type, quantity, ref_type, ref_id, created_by)
    values (it.variant_id, v_main, 'requisition_out', it.quantity, 'requisition', p_id, p_by);
  end loop;

  -- 3. chuyển trạng thái
  update public.requisitions
  set status = 'issued', fulfilled_by = p_by, fulfilled_at = now(), fulfillment_notes = p_notes
  where id = p_id;

  -- 4. audit
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after)
  values (p_by, 'requisition.fulfill', 'requisition', p_id, jsonb_build_object('status','issued'));
end;
$$;
```
> Ghi chú composite: nếu variant có `variant_components`, `fulfill_requisition` phải trừ từng component thay vì trừ chính variant (lặp qua `variant_components`). Viết tương tự trong các RPC đụng stock.

### 8.4 Server Action pattern
```ts
"use server";
export async function fulfillRequisition(id: string) {
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  await supabaseServer.rpc("fulfill_requisition", { p_id: id, p_by: user.id, p_notes: "" });
  revalidatePath("/requisitions");
  revalidatePath(`/requisitions/${id}`);
}
```

---

## 9. Data layer

### 9.1 Supabase clients
```ts
// lib/supabase/client.ts — browser
export const supabase = createBrowserClient(url, anon);
// lib/supabase/server.ts — server (cookies)
// lib/supabase/admin.ts — service role (server-only, dùng cho seed/quản lý tài khoản)
```

### 9.2 TanStack Query + server-side pagination
```ts
export function useRequisitions(page: number, pageSize = 20, status?: string) {
  return useQuery({
    queryKey: ["requisitions", page, status],
    queryFn: async () => {
      let q = supabase.from("requisitions")
        .select("*, requester:profiles(name), zone:zones(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, count, error } = await q;
      if (error) throw error;
      return { data, count };
    },
    placeholderData: keepPreviousData,
  });
}
```

### 9.3 Quy ước
- Đọc: TanStack Query + client supabase (RLS đảm bảo quyền).
- Ghi: Server Action → RPC → `revalidatePath`.
- **Mọi list dùng server-side pagination** (`range` + `count`) — không load toàn bộ.
- Soft delete: query luôn `.is("deleted_at", null)`.

---

## 10. State management (Zustand)

```ts
// stores/cart-store.ts
interface CartItem { variantId: string; quantity: number; }
interface CartState {
  items: CartItem[];
  addItem(v: string, qty: number): void;
  updateQty(v: string, qty: number): void;
  removeItem(v: string): void;
  clear(): void;
}
// stores/ui-store.ts: isCartOpen, sidebarCollapsed, mobileDrawerOpen
```
Chỉ giữ state **phiên/UI** ở Zustand; dữ liệu nghiệp vụ ở TanStack Query.

---

## 11. Auth & phân quyền (RLS)

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | authenticated | auth.uid()=id | auth.uid()=id **chỉ cột `name`** (role/zone qua RPC) | — |
| categories/zones/products/variants/variant_components/suppliers/stock_locations | authenticated | manager | manager | manager (soft delete) |
| stock_balances | authenticated | manager | manager | — |
| stock_movements | manager (requester nếu cần) | — | — | — |
| requisitions/items | requester của mình, manager tất cả | requester | requester (draft/pending), manager (cấp phát) | requester (draft) |
| receipts/items | manager | manager | manager | manager |
| defect_notes/items | requester của mình, manager tất cả | requester + manager | manager | manager |
| repair_orders/items, liquidation_notes/items, stocktake_*, audit_logs | manager | manager | manager | manager |

```sql
alter table public.requisitions enable row level security;
create policy "requester_read_own" on public.requisitions
  for select using (auth.uid() = requester_id or public.is_manager());
create policy "requester_insert_own" on public.requisitions
  for insert with check (auth.uid() = requester_id);
-- ... áp dụng tương tự cho các bảng khác theo bảng trên
```

**CHỐNG LEO QUYỀN (bắt buộc):** requester KHÔNG được tự đổi `role`/`zone_id`. Chặn bằng trigger:
```sql
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer as $$
begin
  if new.role is distinct from old.role or new.zone_id is distinct from old.zone_id then
    raise exception 'Không được tự đổi role/zone';
  end if;
  return new;
end;
$$;
create trigger trg_profiles_no_escalation
  before update on public.profiles for each row
  when (auth.uid() = old.id and not public.is_manager())
  execute function public.prevent_role_escalation();
```
> Đổi role/zone chỉ qua RPC `security definer` (manager gọi).

---

## 12. Design system & UI (kế thừa chuẩn repo cũ)

### 12.1 Màu sắc
| Vai trò | Class | Hex |
|---|---|---|
| Primary | `sky-600` (hover `sky-700`, gradient `from-sky-600 to-sky-700`) | `#0284c7` |
| Success (tồn kho còn, issued) | `emerald-600` (bg `emerald-100`) | `#16a34a` |
| Warning (nút "Thêm", pending) | `amber-500` / `amber-600` | `#f59e0b` / `#d97706` |
| Danger (hết hàng, rejected) | `red-600` (bg `red-100`) | `#dc2626` |
| Neutral | gray-50 (nền), gray-200 (border), gray-600 (text phụ), gray-900 (text chính) | — |

**Status màu (badge):** draft=gray, pending=amber, approved=sky, issued=emerald, received=teal, rejected=red, cancelled=gray.

### 12.2 Typography
- Font hệ thống: `system-ui, -apple-system, "Segoe UI", Roboto` (không cần import).
- Size: text-xs(0.75rem) → text-4xl(2.25rem). Heading: h1=2.25rem bold → h6=1rem semibold.
- Weight: light / normal / medium / semibold / bold. Bảng số dùng `tabular-nums`.

### 12.3 Spacing, bo góc, shadow
- Padding/gap theo lưới 8px: p-1(0.5rem) → p-8(3rem); margin tương tự.
- Bo góc: rounded-md(0.5rem) / lg(0.75) / xl(1rem) / 2xl(1.5rem) / full.
- Shadow: `shadow-sm` → `shadow-2xl`.

### 12.4 Hover & animation
- `hover:scale-110` (icon), `hover:-translate-y-1` (card), `hover:shadow-lg`, `hover:bg-gray-100`.
- `transition-colors` / `transition-all` (150–300ms); `animate-fadeIn / slideInUp / pulse / spin`.

### 12.5 Layout
- Desktop: Sidebar + Topbar + nội dung.
- Mobile: Topbar + Bottom nav (5) + Drawer.
- Loading=skeleton, Empty=minh họa+text+nút, Error=toast+retry.

### 12.6 Best practice (bắt buộc)
- KHÔNG inline style; KHÔNG arbitrary color `bg-[#0284c7]` — dùng class design system.
- Mobile-first; luôn có hover/focus state; `aria-label` cho nút chỉ có icon.
- Badge trạng thái hiển thị theo `*_STATUS` label map + màu mục 12.1.
- Components: shadcn/ui + sonner toast.

---

## 13. Routing map

| Route | Màn hình | Role |
|---|---|---|
| `/login` | Đăng nhập | public |
| `/dashboard` | Dashboard | cả 2 |
| `/products` | Kho vật tư | cả 2 |
| `/requisitions` | Danh sách phiếu yêu cầu | cả 2 |
| `/requisitions/new` | Tạo phiếu | requester |
| `/requisitions/[id]` | Chi tiết phiếu | cả 2 |
| `/receipts`, `/receipts/new` | Phiếu nhập | manager |
| `/defects`, `/defects/new` | Vật tư hỏng | cả 2 |
| `/repairs` | Sửa chữa | manager |
| `/liquidations` | Thanh lý | manager |
| `/stocktake` | Kiểm kê | manager |
| `/transfers` | Chuyển kho | manager |
| `/reports` | Báo cáo | manager |
| `/admin/{products,categories,zones,locations,suppliers,users}` | Quản trị | manager |

---

## 14. Đặc tả từng màn hình

### 14.1 Đăng nhập
- Card: email + mật khẩu + "Đăng nhập" (Supabase Auth). Link quên mật khẩu. Redirect theo role.

### 14.2 Dashboard
- KPI: Tồn kho thấp, Phiếu đang chờ, Phiếu đã cấp chưa nhận, Nhập gần đây, Tổng sản phẩm.
- Cảnh báo: tồn ≤ min_stock, **vật tư sắp hết hạn** (nếu is_trackable_lot).
- Manager: bộ lọc kỳ (hôm nay/tuần/tháng) cho nhập/xuất.

### 14.3 Kho vật tư
- Search + CategoryNav + lưới ProductCard (ảnh, tên, danh mục, giá, badge tồn).
- Click → Dialog chọn biến thể → số lượng → thêm giỏ.
- Composite hiện tồn = min theo linh kiện.

### 14.4 Giỏ hàng (Drawer)
- List item (ảnh, biến thể, ±, giá, xóa) + tổng + "Tạo phiếu yêu cầu".

### 14.5 Tạo phiếu yêu cầu
- Form: khu vực, mục đích, loại (Cấp mới/Đổi mới). Đổi mới → chọn phiếu hỏng liên quan.
- Lưu nháp (draft) hoặc Gửi (submit→pending).

### 14.6 Danh sách / chi tiết phiếu yêu cầu
- Bảng: mã, người yêu cầu, khu vực, ngày, **badge trạng thái** (7 trạng thái).
- Filter theo status + phân trang.
- Chi tiết: items, mục đích, timeline (ai duyệt/cấp/nhận + thời gian).
- Hành động theo role: requester (gửi/hủy/xác nhận nhận, **trả lại vật tư không dùng hết**), manager (duyệt/từ chối/cấp phát).

### 14.7 Phiếu nhập kho
- Danh sách: mã, nhà cung cấp, ngày, **badge** (Nháp/Đã ghi nhận/Hủy).
- Tạo: chọn supplier, thêm item (biến thể, số lượng, đơn giá, lô/hạn nếu is_trackable_lot) → Lưu nháp.
- "Ghi nhận" (post) → cộng stock + auto cấp phát (FIFO) → hiện danh sách phiếu đã cấp.

### 14.8 Vật tư hỏng
- Danh sách: mã, ngày, người báo, badge trạng thái.
- Ghi nhận: location nguồn → thêm dòng (biến thể, số lượng, chi tiết hỏng, kiểu, mức độ, ảnh upload).
- Chi tiết: nút "Đưa đi sửa", "Thanh lý", "Tạo yêu cầu đổi mới".

### 14.9 Sửa chữa
- Danh sách: mã, đơn vị sửa, ngày gửi, dự kiến về, chi phí, badge.
- Tạo phiếu: chọn item từ Kho hỏng → đơn vị, ngày gửi, dự kiến.
- Nhập kết quả: từng item chọn outcome (nhập lại kho/thanh lý) + chi phí.

### 14.10 Thanh lý
- Danh sách: mã, lý do, badge, tổng giá trị, tiền thu.
- Tạo: chọn item hỏng → số lượng, phương thức, giá trị.
- Duyệt → hoàn tất (nhập tiền thu) → trừ stock.

### 14.11 Kiểm kê (`/stocktake`)
- Chọn location → hiện list variant + tồn hệ thống → nhập số thực tế → hiện lệch (±).
- "Chốt kiểm kê" → tạo `adjustment_in/out` cho từng lệch + ledger + audit.

### 14.12 Quản trị
- **Sản phẩm:** bảng + form (tên, mô tả, ảnh upload, danh mục, options, variants: attributes/price/unit/min_stock/is_trackable_lot/components).
- **Danh mục:** icon + kéo thả + CRUD.
- **Khu vực:** CRUD.
- **Kho/vị trí:** CRUD.
- **Nhà cung cấp:** CRUD.
- **Người dùng:** danh sách profile, tạo tài khoản (username + mật khẩu do quản lý đặt, role + zone), đổi role/username/mật khẩu, vô hiệu hóa.

### 14.13 Báo cáo — mục 18

### 14.14 Chuyển kho & Điều chỉnh tồn (manager)
- **Chuyển kho (`/transfers`):** chọn `from_location` → `to_location` → thêm item (biến thể + số lượng) → lý do → "Chuyển" (RPC `transfer_stock`). Ghi ledger `transfer`.
- **Điều chỉnh tồn thủ công:** chọn biến thể + location → nhập delta (±) → **bắt buộc lý do** → "Lưu" (RPC `adjust_stock`). Ghi `adjustment_in`/`adjustment_out`.

---

## 15. Quy tắc nghiệp vụ & luồng xử lý

### 15.1 Tính tồn kho
```
stock(variant) = có components ? min(floor(stock(child)/qty)) : sum(stock_balances)
```

### 15.2 Cấp phát (fulfill)
- Chỉ khi `approved`. Kiểm tra tồn (FOR UPDATE) → trừ stock (composite: trừ component) → ledger → `issued`.
- Requester `receive` → `received` (đóng phiếu).

### 15.3 Nhập kho + auto cấp phát
- `post_receipt`: cộng stock (lưu unit_cost + lô/hạn) → lấy các requisition `pending`/`approved` theo `created_at, id` tăng dần (FIFO, tie-break bằng id) → lần lượt `fulfill` → ghi id vào `linked_requisition_ids`.

### 15.4 Hỏng → sửa → nhập lại / thanh lý
1. `record_defect`: Kho chính −qty → Kho hỏng +qty (ledger `defect_out`).
2. `send_to_repair`: Kho hỏng −qty → Kho đang sửa +qty (`repair_out`).
3. `complete_repair`: từng item outcome → `returned_to_stock` (Kho đang sửa → Kho chính, `repair_return_in`) hoặc `liquidation`.

### 15.5 Thanh lý
- Tạo (pending) → duyệt (approved) → hoàn tất (completed): trừ stock location tương ứng (`liquidation_out`), ghi `proceeds`.

### 15.6 Đổi mới
- Phiếu yêu cầu `replacement` + `linked_defect_id` → manager cấp phát cái mới → `issued` → `received`.
- **1 defect chỉ được tạo 1 phiếu đổi mới** (partial unique index ở mục 5.15 chặn trùng `linked_defect_id`).

### 15.7 Kiểm kê
- `post_stocktake`: mỗi lệch `actual - system` tạo `adjustment_in`/`adjustment_out` + ledger.

### 15.8 Nhập trả lại kho (return-to-stock)
- Khi requester nhận vật tư nhưng **dùng không hết**, trả lại Kho chính qua RPC `return_requisition_items`.
- Điều kiện: requisition ở `issued`/`received`; số trả ≤ (đã cấp − đã trả trước đó).
- Xử lý: cộng `stock_balances` Kho chính + ledger `return_in` (ref requisition). **KHÔNG qua receipts** (không phải nhập từ NCC).
- Ghi audit `requisition.return`.

### 15.9 Điều chỉnh tồn thủ công (ngoài kỳ kiểm kê)
- RPC `adjust_stock(variant_id, location_id, delta, reason, by)`: delta dương → `adjustment_in`, âm → `adjustment_out`.
- **Bắt buộc `reason`** (không rỗng); ghi ledger + audit. Khác kiểm kê: không cần session.

### 15.10 Quy đổi đơn vị (chưa hỗ trợ)
- MVP giả định **nhập-xuất cùng đơn vị** (bao→bao, cái→cái). Không quy đổi kg↔bao.
- Nếu thực tế cần (cám mua bao 25kg, cấp theo kg): thêm bảng `unit_conversions` (variant_id, from_unit, to_unit, factor) + UoM sau. **KHÔNG làm trong MVP**.

---

## 16. Validation (zod)

```ts
export const variantSchema = z.object({
  attributes: z.record(z.string()),
  price: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  minStock: z.number().int().min(0).default(0),
  isTrackableLot: z.boolean().default(false),
  components: z.array(z.object({ childVariantId: z.string().uuid(), quantity: z.number().int().positive() })).optional(),
});
export const productSchema = z.object({
  name: z.string().min(1), description: z.string().optional(),
  images: z.array(z.string()).default([]), categoryId: z.string().uuid().nullable(),
  options: z.array(z.string()).default([]), variants: z.array(variantSchema).min(1),
});

export const requisitionSchema = z.object({
  zoneId: z.string().uuid(), purpose: z.string().min(1),
  requisitionType: z.enum(["new_supply","replacement"]).default("new_supply"),
  linkedDefectId: z.string().uuid().optional(),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
}).superRefine((v, ctx) => {
  if (v.requisitionType === "replacement" && !v.linkedDefectId)
    ctx.addIssue({ code: "custom", message: "Đổi mới phải chọn phiếu hỏng liên quan" });
});

export const defectItemSchema = z.object({
  variantId: z.string().uuid(), quantity: z.number().int().positive(),
  damageDetail: z.string().min(1),
  damageType: z.enum(["cracked","chipped","broken","worn","electrical","chemical","other"]).optional(),
  severity: z.enum(["light","medium","severe"]).optional(),
  images: z.array(z.string()).default([]),
});

export const receiptItemSchema = z.object({
  variantId: z.string().uuid(), quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(), batchNo: z.string().optional(),
  expiryDate: z.string().date().optional(),
});
```

---

## 17. Seed data (đầy đủ, chạy được)

### 17.1 Categories (8 — kế thừa repo cũ) + icon mapping
| Danh mục | display_order | Icon (SVG) | Nguồn |
|---|---|---|---|
| Thức ăn chăn nuôi | 1 | `feed` | repo cũ `assets/icons/feed.svg` |
| Thuốc & Vắc-xin | 2 | `medicine` | repo cũ `assets/icons/medicine.svg` |
| Dụng cụ chăn nuôi | 3 | `tool` | vẽ thêm |
| Hệ thống chuồng trại | 4 | `coop` | repo cũ `assets/icons/coop.svg` |
| Vệ sinh & Sát trùng | 5 | `clean` | repo cũ `assets/icons/clean.svg` |
| Bảo hộ lao động | 6 | `ppe` | vẽ thêm |
| Phụ tùng & Sửa chữa | 7 | `repair` | vẽ thêm |
| Khác | 8 | `other` | repo cũ `assets/icons/other.svg` |

> **Icon:** kế thừa 5 file SVG từ repo cũ (`feed`, `medicine`, `coop`, `clean`, `other`) + vẽ thêm 3 (`tool`, `ppe`, `repair`). Lưu vào `public/icons/*.svg`; map trong code `categoryIcons: Record<string, string>`. Cột `categories.icon` lưu **key icon** (VD `'feed'`).

```sql
insert into public.categories (name, icon, display_order) values
('Thức ăn chăn nuôi','feed',1),('Thuốc & Vắc-xin','medicine',2),
('Dụng cụ chăn nuôi','tool',3),('Hệ thống chuồng trại','coop',4),
('Vệ sinh & Sát trùng','clean',5),('Bảo hộ lao động','ppe',6),
('Phụ tùng & Sửa chữa','repair',7),('Khác','other',8)
on conflict (name) do nothing;

-- zones, locations, suppliers

insert into public.zones (name) values ('Khu 1'),('Khu 2'),('Khu 3'),('Khu 4')
on conflict (name) do nothing;

insert into public.stock_locations (code, name, type) values
('KHO_CHINH','Kho chính','main'),('KHO_HONG','Kho hỏng tập kết','defect'),('KHO_DANG_SUA','Đang sửa chữa','repair')
on conflict (code) do nothing;

insert into public.suppliers (name, contact_name, phone) values
('Công ty TNHH Thức ăn Chăn nuôi Minh Phát','Ô. Hùng','0900000001'),
('Công ty Thuốc Thú y An Bình','Bà. Lan','0900000002')
on conflict (name) do nothing;

-- Dữ liệu động (products/variants/stock_balances): chạy 1 lần sau `db reset`;
-- nếu cần idempotent, thêm unique key hoặc guard `where not exists`.
```

### 17.2 Sản phẩm + variants + stock_balances
> Pattern: insert product (subquery category), insert variants (subquery product theo tên), insert stock_balances vào KHO_CHINH.

```sql
-- 1. Cám gà con
insert into public.products (name, category_id, options) values
('Cám gà con', (select id from categories where name='Thức ăn chăn nuôi'), '{"Trọng lượng"}');
insert into public.variants (product_id, attributes, price, unit, min_stock) values
((select id from products where name='Cám gà con'), '{"Trọng lượng":"Bao 10kg"}', 180000, 'Bao', 20),
((select id from products where name='Cám gà con'), '{"Trọng lượng":"Bao 25kg"}', 420000, 'Bao', 10);

-- 2. Vắc-xin Newcastle (theo lô/hạn)
insert into public.products (name, category_id, options) values
('Vắc-xin Newcastle', (select id from categories where name='Thuốc & Vắc-xin'), '{"Liều"}');
insert into public.variants (product_id, attributes, price, unit, min_stock, is_trackable_lot) values
((select id from products where name='Vắc-xin Newcastle'), '{"Liều":"Lọ 100 liều"}', 15000, 'Lọ', 30, true),
((select id from products where name='Vắc-xin Newcastle'), '{"Liều":"Lọ 500 liều"}', 60000, 'Lọ', 10, true);

-- ... (agent tự thêm 10 sản phẩm còn lại theo bảng 17.3, cùng pattern)
```

### 17.3 Bảng sản phẩm đầy đủ (12)
| Tên | Danh mục | Options | Variants (unit/giá) | Theo lô? |
|---|---|---|---|---|
| Cám gà con | Thức ăn chăn nuôi | Trọng lượng | Bao 10kg/180k, Bao 25kg/420k | — |
| Vắc-xin Newcastle | Thuốc & Vắc-xin | Liều | Lọ 100 liều/15k, Lọ 500 liều/60k | ✅ |
| Máng ăn dài cho gà | Dụng cụ chăn nuôi | Chiều dài | 50cm/25k, 75cm/32k, 100cm/40k | — |
| Quạt thông gió công nghiệp | Hệ thống chuồng trại | — | Cái/1.250k | — |
| Thuốc sát trùng Vimekon | Vệ sinh & Sát trùng | Dung tích | Chai 1L/220k | ✅ |
| Ủng bảo hộ cao su | Bảo hộ lao động | Kích cỡ | 39–42, 85k/đôi | — |
| Bóng đèn úm hồng ngoại | Phụ tùng & Sửa chữa | Công suất | 100W/45k, 150W/55k, 250W/70k | — |
| Men tiêu hóa gia cầm | Thuốc & Vắc-xin | — | Gói/95k | ✅ |
| Tấm lót chuồng trấu | Hệ thống chuồng trại | — | Bao/30k | — |
| Xẻng xúc cám | Dụng cụ chăn nuôi | Loại | Nhựa/20k, Inox/65k | — |
| Bộ máng uống núm tự động | Dụng cụ chăn nuôi | Loại | **Composite**: Bộ(7.5k)=1 Núm(5k)+1 Cốc(2.5k) | — |
| Vôi bột khử trùng | Vệ sinh & Sát trùng | — | Bao/50k | — |

### 17.4 Stock balances seed (cộng tồn Kho chính)
```sql
insert into public.stock_balances (variant_id, location_id, quantity)
select v.id, (select id from stock_locations where code='KHO_CHINH'), 100
from variants v;
```
> Composite: KHÔNG seed stock cho variant composite (tồn = min theo linh kiện); chỉ seed cho linh kiện.

---

## 18. Báo cáo & xuất liệu

| Báo cáo | Nguồn | Dạng |
|---|---|---|
| Tồn kho | stock_balances join variants/products/locations | bảng + bar |
| Nhập - Xuất - Tồn | stock_movements theo kỳ | line/bar |
| Cấp phát theo khu vực | requisitions issued/received join zones | pie/bar |
| Hỏng - Sửa - Thanh lý | defect/repair/liquidation | bảng + bar |
| Sắp hết hạn | receipt_items.expiry_date ≤ 30 ngày | bảng |
| Lịch sử biến động kho | stock_movements | bảng (filter) |
| Audit log | audit_logs | bảng |

**Xuất phiếu PDF:** nút "In/Xuất PDF" trên mỗi phiếu → `@react-pdf/renderer` (server).
**Xuất báo cáo:** PDF + Excel/CSV (`xlsx`).

### 18.1 Phiếu xuất mẫu (Print Templates — CHUẨN)
> Đây là **chuẩn in ấn** toàn hệ thống. Mọi phiếu in ra giấy (A4) phải theo cấu trúc này. In bằng `@react-pdf/renderer` (server), khổ A4, lề 20mm, font hệ thống.

**Cấu trúc chung (mọi phiếu):**
```
┌──────────────────────────────────────────────┐
│ [LOGO]  TRẠI GÀ MINH TÂN PHÁT                │
│         <TIÊU ĐỀ PHIẾU>     Mã: <CODE>        │
│         Ngày: <DD/MM/YYYY>                    │
├──────────────────────────────────────────────┤
│ Thông tin chung (theo từng loại phiếu)        │
├──────────────────────────────────────────────┤
│ Bảng chi tiết items (cột theo từng loại phiếu)│
├──────────────────────────────────────────────┤
│ Tổng / Ghi chú                                │
│ Người lập     Người duyệt     Người nhận      │
└──────────────────────────────────────────────┘
```

**1. Phiếu yêu cầu vật tư (REQ)**
- Thông tin: Người yêu cầu, Khu vực, Mục đích, Loại (cấp mới/đổi mới), Trạng thái.
- Bảng: STT | Tên vật tư | Biến thể | Đơn vị | Số lượng | Ghi chú.
- Ký: Người yêu cầu | Người duyệt | Người cấp phát | Người nhận.

**2. Phiếu nhập kho (GRN)**
- Thông tin: Nhà cung cấp, Người lập, Ghi chú.
- Bảng: STT | Tên vật tư | Biến thể | Đơn vị | Số lượng | Đơn giá | Thành tiền | Lô | Hạn sử dụng.
- Ký: Người lập | Thủ kho | Người duyệt.

**3. Phiếu ghi nhận vật tư hỏng (HONG)**
- Thông tin: Người báo, Kho nguồn.
- Bảng: STT | Tên vật tư | Biến thể | Số lượng | Chi tiết hỏng | Kiểu hỏng | Mức độ.
- Ký: Người báo | Người xác nhận.

**4. Phiếu sửa chữa (SC)**
- Thông tin: Đơn vị sửa, Ngày gửi, Ngày dự kiến về, Tổng chi phí.
- Bảng: STT | Tên vật tư | Biến thể | Số lượng | Chi tiết sửa | Chi phí | Kết quả (nhập lại/thanh lý).
- Ký: Người gửi | Đơn vị sửa | Người nhận lại.

**5. Phiếu thanh lý (TL)**
- Thông tin: Lý do, Người lập, Người duyệt.
- Bảng: STT | Tên vật tư | Biến thể | Số lượng | Phương thức (bán/tiêu hủy) | Giá trị | Tiền thu.
- Ký: Người lập | Người duyệt | Người nhận (nếu bán).

**Quy ước in:**
- Số tiền định dạng `1.234.567 đ`; số lượng số nguyên; ngày `dd/mm/yyyy`.
- Bảng lặp lại header khi qua trang; **Tổng tiền = Σ(số lượng × đơn giá)**.

### Storage (upload ảnh)
- Buckets: `product-images`, `defect-images` (public read, authenticated write).
- Flow: upload → lấy public URL → lưu vào `images text[]`.
- Chấp nhận png/jpg/webp, max 5MB.
- **Resize 2 tầng:** (1) client resize bằng `browser-image-compression`/canvas trước khi upload (≤ 1200px, jpeg ~0.7) để tiết kiệm data; (2) server/edge resize nếu cần.

### Offline & mạng yếu (đặc thù trại gà)
- **Ảnh:** luôn nén/resize ở client trước upload (xem trên) — 3G/4G nông thôn yếu.
- **Form tạo phiếu / báo hỏng:** giữ nguyên dữ liệu form khi submit lỗi mạng (KHÔNG reset); hiện toast "Mất kết nối, thử lại" + nút Retry. Dùng `useTransition` + `isPending` để chống double-submit.
- (Tuỳ chọn, không bắt buộc MVP) optimistic UI + retry queue; PWA offline sau này.

---

## 19. Testing

- **Unit:** composite stock, `next_code`, các pure function.
- **Component:** ProductCard badge, form validation.
- **Integration (bắt buộc):**
  1. Composite stock: thiếu 1 linh kiện → 0.
  2. `fulfill_requisition` thiếu stock → raise, không trừ.
  3. `post_receipt` → stock tăng + ledger + auto fulfill.
  4. `record_defect` → Kho chính giảm, Kho hỏng tăng, ledger đúng.
  5. **Race thực:** gọi 2 `fulfill` song song (`Promise.all`) trên cùng 1 phiếu → chỉ 1 thành công, stock chỉ trừ 1 lần.
  6. **Deadlock:** 2 RPC cùng lúc với tập variant đảo thứ tự [X,Y] vs [Y,X] → không deadlock (nhờ `order by variant_id`).
  7. State machine: chuyển trạng thái sai → lỗi (VD `pending→issued` không qua `approved` bị chặn).
  8. **FIFO tie-break:** 2 phiếu cùng `created_at` → cấp phát theo `id` tăng dần.
- **RLS (test âm, bắt buộc):**
  - requester KHÔNG đọc được requisition của người khác.
  - requester KHÔNG tự UPDATE `role` thành manager (trigger chặn).
  - requester KHÔNG đọc/ghi receipts (manager-only).
- **E2E (Playwright):** login → tạo phiếu → duyệt → cấp → nhận.

---

## 20. Local dev & Deployment

```bash
# Local dev
bunx supabase start                 # DB local (Docker)
bunx supabase db reset              # reset + chạy migrations + seed
bunx supabase migration new <name>  # tạo migration mới
bunx supabase gen types typescript --local > src/types/database.types.ts
bun run dev

# Deploy migration lên Supabase remote
bunx supabase link --project-ref <ref>
bunx supabase db push
```

**Deployment:**
- Host Next.js trên Vercel; biến môi trường: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- CI (GitHub Actions): `lint` + `typecheck` + `test`; migration chạy thủ công hoặc job `supabase db push`.

---

## 21. Lộ trình (phases + acceptance criteria)

| Phase | Nội dung | Chấp nhận khi |
|---|---|---|
| 0 | Nền tảng + CI + layout shell | app chạy, CI xanh, route rỗng điều hướng được |
| 1 | Auth + profiles + tạo tài khoản username + role menu | login thật bằng username + mật khẩu, menu đúng role |
| 2 | Catalog + suppliers + stock_locations/balances | CRUD đủ, composite stock đúng |
| 3 | Phiếu yêu cầu (full 7 trạng thái) | draft→pending→approved→issued→received chạy đúng |
| 4 | Phiếu nhập + RPC + ledger | post cộng stock + auto fulfill + ledger đầy đủ |
| 5 | Hỏng → sửa → nhập lại | vòng hỏng→sửa→về đúng, stock khớp |
| 6 | Thanh lý + Đổi mới | thanh lý trừ kho, đổi mới nối defect→requisition |
| 7 | Kiểm kê | chốt kiểm kê tạo adjustment đúng |
| 8 | Báo cáo + xuất phiếu/báo cáo | số liệu khớp ledger, in/xuất đủ loại |
| 9 | Mở rộng: giao nhận + kiểm định + chatbot AI + thông báo | — |

---

## 22. Coding conventions & rules (kế thừa repo cũ)

**Kiến trúc:**
- Feature = `src/features/<name>/{components,actions,api,schema,types}`; không import internals feature khác.
- File: component PascalCase, hook `useXxx.ts`, action `create.ts`.
- Page mặc định Server Component; component tương tác `"use client"`.
- Query key: `["products"]`, `["requisitions", id]`.

**Design (bắt buộc theo mục 12):**
- Không inline style; không arbitrary color `bg-[#...]` → dùng class design system.
- Spacing nhất quán (lưới 8px); luôn responsive mobile-first; luôn hover/focus.
- Thêm `aria-label` cho nút icon; giữ semantic HTML.

**Logic & data:**
- Không hardcode tiếng Việt trong logic → dùng label map (mục 7.2).
- Service role chỉ dùng server; không lộ ra client.
- Mọi đổi stock qua RPC (không cập nhật trực tiếp từ client) để ledger đồng bộ.

**Git:**
- Commit Conventional Commits; branch `main`/`dev`/`feat/*`.
- Không commit `.env` thật; chỉ `.env.example`.

---

## 23. Tech-debt cần tránh (bài học repo cũ)

1. Không gom vào 1 App.tsx → App Router + feature-first.
2. Không trộn localStorage + Supabase → chỉ Supabase.
3. Không `parseInt()` trên UUID.
4. Không file rỗng/stub.
5. Không component quá 300–400 dòng.
6. Không auth giả (mật khẩu cứng) → Supabase Auth + RLS.
7. Không status tiếng Việt trong DB → enum EN + label map.
8. Không nhúng Gemini key vào client.
9. Không cập nhật stock ngoài RPC (đảm bảo ledger đồng bộ).
10. Không xóa cứng → dùng soft delete cho danh mục/SP/NCC.

---

## 24. Checklist triển khai (xong 1 phase)

- [ ] Migration chạy sạch, RLS bật.
- [ ] Types gen lại sau mỗi thay đổi schema.
- [ ] Test + lint + typecheck qua.
- [ ] Mọi đổi stock có ledger tương ứng (đối chiếu được).
- [ ] State machine chặn chuyển trạng thái sai.
- [ ] Mobile + desktop responsive.
- [ ] Không còn dữ liệu/code legacy.
- [ ] `.env.example` đầy đủ, không có secret thật.
