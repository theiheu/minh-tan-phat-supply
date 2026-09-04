# DESIGN PLAN — Rebuild "Quản lý Vật tư Trại Gà" (Next.js 15 + Supabase)

> Tài liệu thiết kế & lộ trình rebuild dự án từ repo `K-MTP-PRo`.
> Trạng thái: **Đã khóa toàn bộ quyết định thiết kế** (xem mục 9).

---

## 1. Mục tiêu & nguyên tắc

- Viết lại toàn bộ từ đầu trên nền **Next.js 15 + TypeScript + Supabase**, không copy-paste kiến trúc cũ.
- Tái sử dụng **domain knowledge** (schema ý tưởng, danh mục, luồng nghiệp vụ).
- Trả nợ kỹ thuật của bản cũ:
  - Bỏ `localStorage` làm nguồn dữ liệu → **Supabase là nguồn duy nhất**.
  - Bỏ `App.tsx` 1258 dòng → App Router + phân tầng rõ.
  - **Sửa bug `parseInt(p.id)` trên UUID** → dùng UUID (`string`) xuyên suốt.
  - Auth thật bằng **Supabase Auth + RLS**.
  - Xóa toàn bộ file stub/rỗng.
- Phủ **vòng đời vật tư đầy đủ**: nhập → tồn → cấp phát → hỏng → tập kết → sửa → nhập lại → thanh lý, kèm **đổi mới**, **báo cáo thống kê**, **xuất phiếu/báo cáo**.

---

## 2. Tech stack

| Hạng mục | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server/Client Components |
| Ngôn ngữ | TypeScript (strict) | |
| Backend/DB/Auth | Supabase (Postgres + Auth + RLS) | `supabase gen types typescript` |
| Data fetching | TanStack Query v5 | Cache, invalidation, optimistic update |
| Client UI state | Zustand | Giỏ hàng, UI cục bộ |
| Form + validate | react-hook-form + zod | Schema dùng chung FE + BE |
| UI | Tailwind CSS + shadcn/ui | |
| Package manager | Bun | |
| Lint/format | ESLint (default Next) + Prettier | |
| Test | Vitest + React Testing Library; Playwright (E2E sau) | |
| PDF/Export | `@react-pdf/renderer` (PDF) + `xlsx`/CSV | Xuất phiếu & báo cáo |

---

## 3. Kiến trúc thư mục đề xuất

```
farm-supply/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/                      # protected layout (sidebar/topbar)
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── products/page.tsx
│   │   ├── requisitions/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── receipts/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   ├── defects/                # vật tư hỏng
│   │   ├── repairs/                # sửa chữa
│   │   ├── liquidations/           # thanh lý
│   │   ├── reports/                # báo cáo
│   │   └── admin/
│   │       ├── products/page.tsx
│   │       ├── categories/page.tsx
│   │       ├── zones/page.tsx
│   │       └── locations/page.tsx  # quản lý kho (multi-kho)
│   ├── layout.tsx
│   └── api/…                       # route handlers khi cần (webhook, export)
├── components/
│   ├── ui/                         # shadcn/ui
│   ├── layout/                     # Sidebar, Topbar, MobileNav
│   └── features/                   # products, requisitions, receipts,
│                                   # defects, repairs, liquidations, reports
├── lib/
│   ├── supabase/                   # client (browser/server), admin
│   ├── auth/
│   └── utils/
├── server/actions/                 # Server Actions (mutations)
├── types/                          # generated DB types
├── supabase/
│   ├── migrations/                 # 00x_*.sql
│   └── seed.sql
├── middleware.ts                   # protect route theo session
└── .env.example
```

---

## 4. Vòng đời vật tư

```
                    NHẬP KHO (phiếu nhập)
                          │  + stock (Kho chính)
                          ▼
                  ┌─────────────────┐
                  │  TỒN KHO CHÍNH   │◄──────── NHẬP LẠI KHO (sửa xong)
                  └────────┬────────┘
                           │ cấp phát / xuất
                           ▼
                  SỬ DỤNG TẠI KHU VỰC (trại)
                           │
              ┌────────────┼─────────────────┐
              ▼            ▼                  ▼
       HỎNG (ghi nhận)  ĐỔI MỚI           (hết hạn)
              │      (yêu cầu cấp mới/thay)
              ▼
      KHO TẬP KẾT HỎNG (staging)
              │
      ┌───────┴────────┐
      ▼                ▼
 SỬA CHỮA         THANH LÝ
 (phiếu sửa)      (phiếu thanh lý)
      │                │
      ▼                ▼
 NHẬP LẠI KHO     TIÊU HỦY / BÁN (ghi tiền thu)
 (nếu sửa được)   (nếu không sửa được / không đáng sửa)
```

> Mọi biến động kho đều ghi vào `stock_movements` (sổ cái) → làm gốc cho báo cáo & đối soát.

---

## 5. Data model (schema khóa)

### 5.1 Nguyên tắc chung
- **UUID everywhere** (không dùng int id).
- Enum tiếng Anh lưu DB + map sang nhãn tiếng Việt ở UI.
- **Tồn kho theo vị trí** (`stock_balances`), không còn cột `variants.stock`.
- **Giá trị tồn kho** = giá cố định `variants.price`; lưu `unit_cost` ở dòng phiếu nhập để báo cáo chi phí thực tế.

### 5.2 Bảng core (giữ ý tưởng cũ, sửa theo UUID + cải tiến)

| Bảng | Thay đổi so với bản cũ |
|---|---|
| `profiles` | 1-1 `auth.users`, chứa `name`, `role` (`requester`/`manager`), `zone_id` — thay bảng `users` tự tạo |
| `categories` | `id uuid`, `name unique`, `icon`, `display_order` |
| `zones` | `id uuid`, `name unique`, `description` |
| `products` | `id uuid`, `name`, `description`, `images text[]`, `category_id`, `options text[]` |
| `variants` | `id uuid`, `product_id`, `attributes jsonb`, `price numeric`, `images text[]`, `unit`, **`min_stock int default 0`** (ngưỡng cảnh báo) |
| `variant_components` | `parent_variant_id`, `child_variant_id`, `quantity` (composite product) |
| `requisitions` | thêm `requisition_type` (`new_supply`/`replacement`), `linked_defect_id`; dùng `requester_id` (FK profiles) thay `requester_name` text |
| `requisition_items` | `requisition_id`, `variant_id`, `quantity` |
| `receipts` | `id uuid`, `supplier`, `notes`, `created_by`, `linked_requisition_ids uuid[]` |
| `receipt_items` | `receipt_id`, `variant_id`, `quantity`, **`unit_cost numeric`** |

### 5.3 Vị trí kho & tồn theo vị trí

```sql
CREATE TYPE location_type AS ENUM ('main', 'defect', 'repair', 'other');

CREATE TABLE stock_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,   -- 'KHO_CHINH','KHO_HONG','KHO_DANG_SUA'
  name        text NOT NULL,          -- 'Kho chính','Kho hỏng tập kết','Đang sửa chữa'
  type        location_type NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE stock_balances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (variant_id, location_id)
);
```

### 5.4 Sổ biến động kho (ledger)

```sql
CREATE TYPE movement_type AS ENUM (
  'receipt_in','requisition_out','defect_out','repair_out',
  'repair_return_in','liquidation_out','adjustment_in','adjustment_out','transfer'
);

CREATE TABLE stock_movements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id        uuid NOT NULL REFERENCES variants(id),
  from_location_id  uuid REFERENCES stock_locations(id),
  to_location_id    uuid REFERENCES stock_locations(id),
  movement_type     movement_type NOT NULL,
  quantity          integer NOT NULL,
  ref_type          text,      -- 'receipt'|'requisition'|'defect'|'repair'|'liquidation'
  ref_id            uuid,      -- id phiếu liên quan
  notes             text,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now()
);
```

### 5.5 Phiếu ghi nhận hỏng (chi tiết từng cái)

```sql
CREATE TYPE defect_status AS ENUM ('staging','in_repair','returned','liquidated');

CREATE TABLE defect_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,        -- 'HONG-0001'
  source_location_id  uuid REFERENCES stock_locations(id),
  reported_by         uuid REFERENCES profiles(id),
  status              defect_status NOT NULL DEFAULT 'staging',
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE defect_note_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_note_id  uuid NOT NULL REFERENCES defect_notes(id) ON DELETE CASCADE,
  variant_id      uuid NOT NULL REFERENCES variants(id),
  quantity        integer NOT NULL DEFAULT 1,
  damage_detail   text,        -- MÔ TẢ HỎNG CỦA CÁI NÀY (khác nhau từng dòng)
  damage_type     text,        -- 'nứt','mẻ','gãy','hỏng động cơ',...
  severity        text,        -- 'nhẹ'|'vừa'|'nặng'
  images          text[],
  unit_cost       numeric(12,2),
  resolution      text,        -- 'repaired'|'liquidated' (điền khi xử lý xong)
  created_at      timestamptz DEFAULT now()
);
```

> **Mỗi cái hỏng có chi tiết riêng**: cùng 1 biến thể nhưng khác hỏng → nhiều dòng `quantity = 1`, mỗi dòng 1 `damage_detail`. Cùng kiểu hỏng nhiều cái → 1 dòng `quantity = n`.

### 5.6 Phiếu sửa chữa

```sql
CREATE TYPE repair_status AS ENUM ('in_repair','returned','cancelled');

CREATE TABLE repair_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,          -- 'SC-0001'
  vendor             text NOT NULL,
  sent_at            date,
  expected_return_at date,
  returned_at        timestamptz,
  status             repair_status NOT NULL DEFAULT 'in_repair',
  total_cost         numeric(12,2),
  notes              text,
  created_by         uuid REFERENCES profiles(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE repair_order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id  uuid NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  defect_item_id   uuid REFERENCES defect_note_items(id),
  variant_id       uuid NOT NULL REFERENCES variants(id),
  quantity         integer NOT NULL DEFAULT 1,
  repair_detail    text,
  cost             numeric(12,2),
  outcome          text,       -- 'returned_to_stock' | 'liquidation'
  created_at       timestamptz DEFAULT now()
);
```

> Cho phép **chia kết quả từng cái** trong cùng 1 phiếu sửa: cái sửa được → nhập lại kho, cái không → thanh lý.

### 5.7 Phiếu thanh lý

```sql
CREATE TYPE liquidation_status AS ENUM ('pending','approved','completed','rejected');
CREATE TYPE liquidation_method AS ENUM ('sale','dispose');

CREATE TABLE liquidation_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,            -- 'TL-0001'
  reason       text,
  status       liquidation_status NOT NULL DEFAULT 'pending',
  approved_by  uuid REFERENCES profiles(id),
  approved_at  timestamptz,
  completed_at timestamptz,
  notes        text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE liquidation_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_note_id  uuid NOT NULL REFERENCES liquidation_notes(id) ON DELETE CASCADE,
  variant_id           uuid NOT NULL REFERENCES variants(id),
  source_item_id       uuid,    -- từ defect_note_items hoặc repair_order_items
  quantity             integer NOT NULL DEFAULT 1,
  method               liquidation_method NOT NULL DEFAULT 'dispose',
  unit_value           numeric(12,2),
  proceeds             numeric(12,2) DEFAULT 0,
  notes                text,
  created_at           timestamptz DEFAULT now()
);
```

### 5.8 Đổi mới (thay thế)

```sql
CREATE TYPE requisition_type AS ENUM ('new_supply','replacement');
-- requisitions thêm:
--   requisition_type requisition_type NOT NULL DEFAULT 'new_supply',
--   linked_defect_id uuid REFERENCES defect_notes(id)
```

### 5.9 View báo cáo (xây ở Phase 7)

```sql
CREATE VIEW v_stock_onhand AS
SELECT v.id AS variant_id, v.product_id, p.name AS product_name,
       sl.id AS location_id, sl.name AS location_name,
       COALESCE(sb.quantity,0) AS qty, v.unit, v.price,
       COALESCE(sb.quantity,0) * COALESCE(v.price,0) AS stock_value
FROM variants v
JOIN products p ON p.id = v.product_id
CROSS JOIN stock_locations sl
LEFT JOIN stock_balances sb ON sb.variant_id = v.id AND sb.location_id = sl.id;
```

Các view còn lại: `v_stock_below_threshold`, `v_movement_summary`, `v_defect_repair_summary`.

### 5.10 RLS (bật từ đầu)

- `profiles`/`products`/`categories`/`zones`/`stock_locations`: authenticated đọc; manager ghi.
- `requisitions`: requester đọc/ghi của mình; manager đọc tất cả.
- `receipts`/`defect_notes`/`repair_orders`/`liquidation_notes`/`stock_movements`: manager toàn quyền; requester đọc theo phạm vi.

---

## 6. Hình thức UI (design language)

| Yếu tố | Lựa chọn |
|---|---|
| Bộ màu | Primary **Emerald** `#059669`; nền **Zinc/Slate**; `pending`=Amber, `fulfilled/verified`=Emerald, `rejected`=Rose |
| Font | Inter, chữ số dùng tabular-nums cho bảng stock |
| Bo góc / bóng | Radius 8–12px, shadow nhẹ, border mảnh |
| Thư viện | shadcn/ui (Button, Card, Table, Dialog, Form, Select, Tabs, Badge, Sheet/Drawer, Sonner) |

### Bố cục
- **Desktop (≥1024px):** Sidebar trái (menu) + Topbar (tiêu đề + tìm kiếm + avatar) + nội dung.
- **Mobile (<1024px):** Topbar + Bottom nav (5 mục) + Drawer menu phụ.

### Điều hướng theo vai trò
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
| Giao nhận & Kiểm định *(sau MVP)* | — | ✅ |
| Chatbot AI *(sau MVP)* | ✅ | ✅ |

### Trạng thái UI chuẩn
- Loading: skeleton. Empty: minh họa + text + nút hành động. Error: toast + retry.
- Bảng trên mobile chuyển thành card xếp dọc.

---

## 7. Luồng nghiệp vụ chi tiết

### 7.1 Hỏng → Tập kết → Sửa → Nhập lại kho
1. **Ghi nhận hỏng**: tạo `defect_notes` + `defect_note_items` (mỗi dòng 1 chi tiết hỏng).
   - Stock: **Kho chính −qty**, **Kho hỏng +qty** → `stock_movements` loại `defect_out`.
2. **Đưa đi sửa**: tạo `repair_orders`, chọn item từ Kho hỏng → `in_repair`.
   - Stock: **Kho hỏng −qty**, **Đang sửa +qty** → `repair_out`.
3. **Sửa xong**: cập nhật từng `repair_order_items.outcome`:
   - `returned_to_stock`: **Đang sửa −qty → Kho chính +qty** → `repair_return_in`; `resolution = 'repaired'`.
   - `liquidation`: chuyển sang luồng thanh lý.

### 7.2 Thanh lý
1. Tạo `liquidation_notes` (Chờ duyệt) + `liquidation_items` (từ tập kết / sửa không được).
2. Manager duyệt (`approved`) → bán/tiêu hủy.
3. Hoàn tất: trừ stock location tương ứng → `liquidation_out`; ghi `proceeds`; `resolution = 'liquidated'`.

### 7.3 Đổi mới (thay thế)
1. Từ 1 `defect_notes` tạo `requisitions` loại `replacement` + `linked_defect_id`.
2. Manager duyệt → cấp phát cái mới từ Kho chính → `requisition_out` → `fulfilled`.
3. Cái hỏng đi tiếp theo 7.1/7.2 (song song, không chặn).

---

## 8. Lộ trình (phases)

| Phase | Nội dung | Checkpoint |
|---|---|---|
| 0 | Nền tảng: init Next.js + Tailwind/shadcn + Supabase + gen types + ESLint/Prettier + Vitest + CI; dựng layout shell | shell chạy, CI xanh |
| 1 | Auth & phân quyền: Supabase Auth + `profiles` + middleware + role menu | login thật, menu đúng role |
| 2 | Catalog: CRUD categories/zones/products/variants/composite + **`stock_locations` + `stock_balances`** | CRUD + stock composite đúng |
| 3 | Phiếu yêu cầu: giỏ hàng + tạo phiếu (`requisition_type`) + duyệt/cấp phát | tạo/duyệt/cấp phát đúng |
| 4 | Phiếu nhập kho + **`stock_movements`** | nhập tăng stock, ledger đầy đủ |
| 5 | **Hỏng → Kho tập kết → Sửa chữa → Nhập lại kho** | vòng hỏng→sửa→về đúng, stock khớp |
| 6 | **Thanh lý + Đổi mới (thay thế)** | thanh lý trừ kho, đổi mới nối defect→requisition |
| 7 | **Báo cáo thống kê** (tồn kho, NXT, cấp phát theo khu vực, hỏng-sửa-thanh lý, lịch sử biến động) | số liệu khớp ledger |
| 8 | **Xuất phiếu PDF + Xuất báo cáo (PDF/Excel/CSV)** | in/xuất đủ loại phiếu & báo cáo |
| 9 | Mở rộng: Giao nhận + Kiểm định + Chatbot AI (Gemini qua server) + notifications | |

---

## 9. Quyết định đã chốt

1. Giữ domain cũ, viết lại sạch.
2. Stack: Next.js 15 + TS + Supabase.
3. Lộ trình: MVP core trước, mở rộng sau.
4. Auth thật (Supabase Auth + RLS).
5. Hỏng **theo số lượng**, mỗi cái có **chi tiết hỏng riêng** (dòng `defect_note_items`).
6. "Đổi mới" = báo hỏng → cấp thay cái mới từ kho (`requisition_type = replacement`).
7. **Kho tập kết là kho riêng** (multi-kho qua `stock_locations`).
8. **"Đang sửa" là location riêng** `KHO_DANG_SUA` (type `repair`).
9. **Giá trị tồn kho** = giá cố định `variants.price`; lưu `unit_cost` ở dòng phiếu nhập cho báo cáo chi phí thực tế.

---

## 10. Migration & rủi ro

### Migration dữ liệu cũ
- Script `supabase/migrate_legacy.ts` (hoặc SQL) đọc DB Supabase cũ → map sang schema mới:
  - đổi id int → uuid; status tiếng Việt → enum mới; `requester_name` → `profiles`; seed stock vào `stock_balances` (location `KHO_CHINH`).
- Dữ liệu localStorage cũ (nếu còn): xuất JSON → import qua script.
- Chạy thử trên staging trước, đối chiếu số bản ghi từng bảng.

### Rủi ro & lưu ý
- **Composite stock** dễ sai → viết hàm thuần + unit test ngay Phase 2.
- **RLS** phải test từng role (requester vs manager).
- **UUID migration** có FK ràng buộc → migrate đúng thứ tự (products trước variants, …).
- **Ledger nhất quán**: mọi thay đổi stock phải đi kèm 1 dòng `stock_movements` (dùng DB transaction/RPC).
- Cân nhắc tên repo mới tách biệt (ví dụ `farm-supply`) để không đè lên `K-MTP-PRo`.
