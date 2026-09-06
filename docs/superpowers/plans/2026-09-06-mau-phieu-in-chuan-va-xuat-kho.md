# Mẫu phiếu in chuẩn + Module xuất kho + Bảng tồn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa mọi phiếu in của app về một mẫu in chuẩn (khung giống phiếu xuất kho giấy của trại), thêm module "Phiếu xuất kho" 2 kiểu đích (Khu nội bộ / Khách hàng), in Bảng tồn kho và in Phiếu kiểm kê.

**Architecture:** (1) Component PDF cấu hình duy nhất `SlipDocument` (giữ tên export cũ, đổi props) + hằng số thương hiệu, mọi route PDF cũ đổi sang; (2) DB additive: bảng `customers`, `issues`/`issue_items`, enum `movement_type` thêm `issue_out`, view `location_stock`, RPC definer `create_issue/post_issue/cancel_issue` (mirror `receipts`), typegen; (3) UI mới `/issues` (+`/admin/customers`) theo pattern module `receipts`; (4) các route PDF mới cho xuất kho, bảng tồn, kiểm kê.

**Tech Stack:** Next.js 15 App Router (server actions + RPC Supabase), @react-pdf/renderer 4.9, Supabase Postgres, Tailwind/shadcn, zod 4, Vitest, Bun; migration bằng `bunx supabase@2.116.0 db push`.

**Spec:** `docs/superpowers/specs/2026-09-06-mau-phieu-in-chuan-va-xuat-kho-design.md`

## Global Constraints

- Migration **chỉ additive** (bảng mới, ALTER TYPE thêm giá trị enum, view/sequence mới) — không sửa/đổi/xoá cột dữ liệu cũ (dev 3001 & prod 3000 dùng chung DB local).
- Không bao giờ để client ghi trực tiếp `stock_balances`/`stock_movements` — mọi biến động kho qua RPC `_move_stock` (security definer, `is_manager()`).
- Tiếng Việt UI; enum DB giữ tiếng Anh, hiển thị qua label map (như `src/lib/labels.ts`).
- Mã phiếu qua `public.next_code(prefix, regclass)`; mã xuất kho prefix `PXK`, sequence `public.issues_seq`.
- Đầu mọi phiếu in (chuẩn tuyệt đối): `TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG` / `Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương` / `SĐT: 0988 365 238 – 0963 077 879`, logo `public/brand/logo.jpg` nếu có.
- Phiếu xuất: khách hàng → có cột Đơn giá/Thành tiền + 4 ô chữ ký (Người nhận hàng | Vận chuyển | Người lập phiếu (Đại diện người bán) | Chủ trại); khu nội bộ → **không** cột giá, 3 ô chữ ký (bỏ Vận chuyển).
- Các phiếu khác giữ nguyên vai trò chữ ký hiện có (bảng A4 trong spec); Bảng tồn không chữ ký.
- `Thành tiền bằng chữ` chỉ khi phiếu có tiền.
- Format: tiền `formatVnd` (`1.234.567 đ`), ngày `formatDate` (`dd/mm/yyyy`), dòng ngày in dài `Ngày 06 tháng 09 năm 2026`.

---

### Task 1: Helper đọc số tiền bằng chữ + ngày dài (TDD)

**Files:**
- Create: `src/lib/money-words.ts`
- Create: `src/lib/money-words.test.ts`
- Modify: `src/lib/format.ts` (thêm `formatDateLong`)
- Test: `src/lib/money-words.test.ts`, chạy `bun run test`

**Interfaces:**
- Produces: `formatAmountInWords(amount: number): string` — trả chuỗi tiếng Việt, vd `1234567` → `"một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy đồng"`; `0` → `"không đồng"`.
- Produces: `formatDateLong(iso: string | null | undefined): string` — `2026-09-06T00:00:00+07:00` → `"Ngày 06 tháng 09 năm 2026"`; null → `""`.

- [ ] **Step 1: Viết test trước**

`src/lib/money-words.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatAmountInWords } from "./money-words";

describe("formatAmountInWords", () => {
  it("0", () => expect(formatAmountInWords(0)).toBe("không đồng"));
  it("đơn vị", () => expect(formatAmountInWords(5)).toBe("năm đồng"));
  it("trăm lẻ", () => expect(formatAmountInWords(105)).toBe("một trăm lẻ năm đồng"));
  it("nghìn", () => expect(formatAmountInWords(1234)).toBe("một nghìn hai trăm ba mươi tư đồng"));
  it("triệu", () => expect(formatAmountInWords(1000005)).toBe("một triệu không trăm lẻ năm đồng"));
  it("tỷ", () => expect(formatAmountInWords(2000000000)).toBe("hai tỷ đồng"));
  it("lẻ nghìn", () => expect(formatAmountInWords(1001)).toBe("một nghìn không trăm lẻ một đồng"));
});
```
(Quy ước chữ "lẻ" cho hàng trăm/triệu có 0 ở giữa; không thêm "linh". Nếu anh muốn khác thì sửa test + hàm cùng lúc.)

- [ ] **Step 2: Chạy test, xác nhận FAIL** — `bun run test` → thiếu module.

- [ ] **Step 3: Cài đặt** `src/lib/money-words.ts`:

```ts
// Đọc số tiền bằng chữ (tiếng Việt) — dòng "Thành tiền bằng chữ" trên phiếu in.
const ONES = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const TENS = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
const TEENS = ["mười", "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu", "mười bảy", "mười tám", "mười chín"];

function readThree(n: number, withLinh: boolean): string {
  // 0 ≤ n ≤ 999
  if (n === 0) return withLinh ? "không" : "";
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES[h] + " trăm");
  if (r > 0) {
    if (h > 0 && r < 10) parts.push("lẻ");
    if (r < 10) parts.push(ONES[r]);
    else if (r < 20) parts.push(TEENS[r - 10]);
    else {
      const t = Math.floor(r / 10), o = r % 10;
      parts.push(TENS[t]);
      if (o > 0) {
        if (o === 1) parts.push("mốt");
        else if (o === 5) parts.push("lăm");
        else parts.push(ONES[o]);
      }
    }
  }
  return parts.join(" ");
}

const SCALE = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

export function formatAmountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const n = Math.round(amount);
  if (n === 0) return "không đồng";
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const withLinh = parts.length > 0 && g < 100 && g > 0;
    const word = readThree(g, withLinh);
    parts.push(`${word} ${SCALE[i]}`.trim());
  }
  return `${parts.join(" ")} đồng`;
}
```

- [ ] **Step 4: Chạy test → PASS** (`bun run test`).
- [ ] **Step 5: Thêm `formatDateLong` vào `src/lib/format.ts`**:
```ts
export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `Ngày ${String(d.getDate()).padStart(2, "0")} tháng ${String(d.getMonth() + 1).padStart(2, "0")} năm ${d.getFullYear()}`;
}
```
  (Test trong Task 2 vì phụ thuộc cấu trúc PDF; nếu muốn test riêng thì thêm `format.test.ts`.)
- [ ] **Step 6: Commit** `git add src/lib && git commit -m "feat(pdf): helper tiền bằng chữ và ngày dài"`

---

### Task 2: Engine mẫu in chuẩn `SlipDocument` + thương hiệu/logo

**Files:**
- Rewrite: `src/features/pdf/slip.tsx`
- Create: `src/features/pdf/brand.ts`
- Test: build PDF smoke ở Task 6 (engine không test unit; kiểm bằng render thật + typecheck)

**Interfaces (props mới của `SlipDocument` — thay toàn bộ props cũ):**
```ts
export interface SlipColumn { label: string; flex: number; align?: "left" | "right" | "center" }
export interface SlipField { label: string; value?: string | null }
export interface SlipTotals { left?: string; right?: string }

export function SlipDocument(props: {
  title: string;                 // ví dụ "PHIẾU XUẤT KHO"
  code: string;                  // "PXK-0001"
  createdAt: string;             // ISO → tự vẽ "Ngày 06 tháng 09 năm 2026" dưới title
  fields?: SlipField[];          // cột trái (Bên nhận hàng…)
  rightPanel?: { heading?: string; fields: SlipField[] }; // ô phải (Thông tin xe…)
  columns: SlipColumn[];
  rows: (string | number | null | undefined)[][]; // không kèm STT — STT tự đánh
  signers?: string[];
  totals?: SlipTotals[];         // dòng "TỔNG CỘNG" cuối bảng (có viền trên)
  amountInWords?: string;        // "Thành tiền bằng chữ: …" (có money-words cung cấp)
  notes?: string;                // "Ghi chú" tự do cuối phiếu
}): JSX.Element
```
Số cột bảng = `1 (STT) + columns.length`; hàng tổng hiển thị label phía trái cột đầu và `right` phía phải cột cuối của **dòng riêng có borderTop** (không cần colspan).

- [ ] **Step 1: Tạo `src/features/pdf/brand.ts`**
```ts
// Hằng số thương hiệu + logo (đọc file public/brand/logo.jpg → data URI, cache).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const BRAND = {
  name: "TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG",
  address: "Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương",
  phone: "SĐT: 0988 365 238 – 0963 077 879",
};

let cachedLogo: string | null | undefined;
export function brandLogoDataUri(): string | null {
  if (cachedLogo !== undefined) return cachedLogo;
  const p = path.join(process.cwd(), "public", "brand", "logo.jpg");
  if (!existsSync(p)) { cachedLogo = null; return null; }
  cachedLogo = `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
  return cachedLogo;
}
```

- [ ] **Step 2: Viết lại `src/features/pdf/slip.tsx`** — component A4 có: khung ngoài viền mỏng; header 3 dòng thương hiệu (logo trái nếu có, cỡ ~38×30) + `Số phiếu: <code>` căn phải trên cùng; `title` đậm 16pt giữa; dòng `formatDateLong(createdAt)` giữa; 2 cột fields (trái 55% / phải 45%, ô phải có heading đậm nhỏ + viền) chỉ vẽ khi `fields`/`rightPanel` khác rỗng; bảng viền đủ (header đậm, ô STT + các cột theo `flex`, căn theo `align`, số căn phải); `totals` thành các dòng cuối bảng (viền trên, chữ đậm: `left` bên trái, `right` bên phải); `amountInWords` là dòng sau bảng (viền quanh cụm bảng+totals, in như `Thành tiền bằng chữ: <value>`); `notes` dòng cuối; footer mỗi trang: `Số phiếu: <code>` trái + `Trang {pageNumber}/{totalPages}` phải (dùng `<Text fixed render={({ pageNumber, totalPages }) => ...}>`); font `Roboto` (`ensurePdfFonts` gọi ở route như hiện tại). Khi bảng dài: header cột lặp lại qua `<View fixed>` trong trang. Dùng `StyleSheet` chuẩn của @react-pdf/renderer như file hiện tại.

> Lưu ý triển khai: vì react-pdf không hỗ trợ colspan, hàng totals/dòng amount-in-words nằm bên trong `View` có `borderWidth: 1` bao bọc toàn bảng — dòng totals là `flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1`, amount-in-words là dòng trái không viền ngăn cách. Signature: `View` cao ~70 trống + hàng `signers` `justifyContent: "space-between"`, mỗi nhãn căn giữa độ rộng bằng nhau; thêm chú thích nhỏ `(Ký, ghi rõ họ tên)` nếu cần.

- [ ] **Step 3: typecheck** `bun run typecheck` → sạch (các route cũ đang truyền props cũ sẽ lỗi — **dự kiến**, sửa ở Task 3–5).
- [ ] **Step 4: Commit** `git add src/features/pdf public/brand && git commit -m "feat(pdf): engine mẫu in chuẩn SlipDocument + brand/logo"` (logo `public/brand/logo.jpg` đã tải sẵn trong repo)

---

### Task 3: Đổi route PDF Phiếu nhập kho sang mẫu chuẩn

**Files:**
- Modify: `src/app/api/receipts/[id]/pdf/route.tsx`

**Interfaces:**
- Consumes: props mới của `SlipDocument` (Task 2), `formatVnd`, `formatAmountInWords` (Task 1).

- [ ] **Step 1: Sửa call `<SlipDocument …/>` trong route receipts** thành (giữ nguyên truy vấn `r`, `items`, `total`):
```tsx
<SlipDocument
  title="PHIẾU NHẬP KHO"
  code={r.code}
  createdAt={r.created_at}
  fields={[
    { label: "Nhà cung cấp", value: r.supplier?.name },
    { label: "Người lập", value: r.creator?.name },
    { label: "Ghi chú", value: r.notes },
  ]}
  columns={[
    { label: "Tên vật tư", flex: 1.5 },
    { label: "Biến thể", flex: 1.3 },
    { label: "Đơn vị", flex: 0.7 },
    { label: "Số lượng", flex: 0.8, align: "right" },
    { label: "Đơn giá", flex: 1.0, align: "right" },
    { label: "Thành tiền", flex: 1.0, align: "right" },
    { label: "Lô", flex: 0.8 },
    { label: "Hạn sử dụng", flex: 0.9 },
  ]}
  rows={(items ?? []).map((i) => [
    i.variants?.products?.name ?? "—",
    variantLabel(i.variants?.attributes, i.variants?.unit),
    i.variants?.unit ?? "—",
    i.quantity,
    i.unit_cost != null ? formatVnd(i.unit_cost) : "—",
    formatVnd(i.quantity * (i.unit_cost ?? 0)),
    i.batch_no ?? "",
    i.expiry_date ? formatDate(i.expiry_date) : "",
  ])}
  totals={[{ left: "TỔNG CỘNG", right: formatVnd(total) }]}
  amountInWords={`Thành tiền bằng chữ: ${formatAmountInWords(total)}`}
  signers={["Người lập", "Thủ kho", "Người duyệt"]}
/>
```
- [ ] **Step 2:** Import bổ sung: `import { formatAmountInWords } from "@/lib/money-words";` (xóa dùng cũ `info`, `date`, `totalNote`).
- [ ] **Step 3:** `bun run typecheck` + render thử qua smoke (Task 6 chung) → sạch.
- [ ] **Step 4: Commit** `git add src/app/api/receipts && git commit -m "feat(pdf): phiếu nhập kho theo mẫu chuẩn"`

---

### Task 4: Đổi route PDF Phiếu yêu cầu vật tư + bỏ component cũ

**Files:**
- Modify: `src/app/api/requisitions/[id]/pdf/route.tsx`
- Delete: `src/features/requisitions/components/requisition-pdf.tsx` (không còn import nào — kiểm tra bằng grep trước khi xoá)

- [ ] **Step 1: Thay `<RequisitionPDF>` bằng `<SlipDocument>`** (giữ nguyên truy vấn `req`, `items`, quyền owner-or-manager, `formatDate`):
```tsx
<SlipDocument
  title="PHIẾU YÊU CẦU VẬT TƯ"
  code={req.code}
  createdAt={req.created_at}
  fields={[
    { label: "Người yêu cầu", value: req.requester?.name },
    { label: "Khu vực", value: req.zone?.name },
    { label: "Loại", value: REQUISITION_TYPE[req.requisition_type] ?? req.requisition_type },
    { label: "Trạng thái", value: REQUISITION_STATUS[req.status] ?? req.status },
    { label: "Mục đích", value: req.purpose },
  ]}
  columns={[
    { label: "Tên vật tư", flex: 1.6 },
    { label: "Biến thể", flex: 1.4 },
    { label: "Đơn vị", flex: 0.8 },
    { label: "Số lượng", flex: 0.8, align: "right" },
  ]}
  rows={(items ?? []).map((i) => [
    i.variants?.products?.name ?? "—",
    variantLabel(i.variants?.attributes, i.variants?.unit),
    i.variants?.unit ?? "—",
    i.quantity,
  ])}
  signers={["Người yêu cầu", "Người duyệt", "Người cấp phát", "Người nhận"]}
/>
```
- [ ] **Step 2:** Sửa import: bỏ `RequisitionPDF`, thêm `SlipDocument`, `formatDateLong` không cần (engine tự vẽ); giữ `REQUISITION_*` maps.
- [ ] **Step 3:** Xoá file legacy, `bun run typecheck` sạch (nếu còn import sót thì xoá luôn).
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(pdf): phiếu yêu cầu theo mẫu chuẩn, bỏ component cũ"`

---

### Task 5: Đổi 3 route còn lại (Hỏng / Sửa chữa / Thanh lý)

**Files:**
- Modify: `src/app/api/defects/[id]/pdf/route.tsx`
- Modify: `src/app/api/repairs/[id]/pdf/route.tsx`
- Modify: `src/app/api/liquidations/[id]/pdf/route.tsx`

- [ ] **Step 1: defects** — đổi call thành props mới, `fields` = `[["Người báo", …],["Kho nguồn", …]]` dạng `{label,value}`, columns giữ nguyên, `signers={["Người báo", "Người xác nhận"]}`, xoá `info/date/totalNote`.
- [ ] **Step 2: repairs** — `fields`: Đơn vị sửa, Ngày gửi, Dự kiến về, Tổng chi phí (dùng `formatVnd`); columns giữ nguyên; `signers={["Người gửi", "Đơn vị sửa", "Người nhận lại"]}`.
- [ ] **Step 3: liquidations** — `fields`: Lý do, Người lập, Người duyệt; columns giữ nguyên (đọc tiếp phần sau dòng 48 của file hiện tại để lấy đủ cột/rows/signers và giữ nguyên).
- [ ] **Step 4:** `bun run typecheck` sạch.
- [ ] **Step 5: Commit** `git commit -am "feat(pdf): hỏng/sửa/thanh lý theo mẫu chuẩn"`

---

### Task 6: Smoke PDF + rà soát hình thức (mốc nghiệm thu)

**Files:**
- Modify: `scripts/verify-pdf-font.tsx`

- [ ] **Step 1:** Cập nhật script để render bằng props mới: **bỏ import `RequisitionPDF`** (file đã xoá ở Task 4), thay nội dung mẫu GRN bằng props mới của `SlipDocument` (dùng 2–3 dòng giả), mẫu REQ dùng `SlipDocument` cấu hình phiếu yêu cầu, thêm render `SlipDocument` mẫu kiểu "PHIẾU XUẤT KHO" bán cho khách (có fields, rightPanel xe, giá, totals, amountInWords dùng `formatAmountInWords(1234567)`, 4 signers) → ghi `.tmp/pdf-smoke/pxk-sample.pdf`.
- [ ] **Step 2:** Chạy `bun run scripts/verify-pdf-font.tsx` → tạo đủ 3 file mẫu, không lỗi font.
- [ ] **Step 3:** Mở 3 PDF mẫu (browser) **so với mẫu giấy của anh**; điều chỉnh spacing/cỡ chữ/kích thước logo trong `slip.tsx` đến khi ưng (vòng lặp nhỏ, commit tách nếu sửa).
- [ ] **Step 4: Commit** (kể cả mọi tinh chỉnh) `git commit -am "test(pdf): smoke mẫu chuẩn grn/req/pxk"`

> **Checkpoint cho user:** dừng lại, gửi 3 file mẫu để anh xem trước khi sang DB/UI.

---

### Task 7: Migration DB — customers + issues + enum + view + RLS (additive)

**Files:**
- Create: `supabase/migrations/0035_customers_issues.sql`
- Modify: `src/types/database.types.ts` (typegen, sau khi db push)

- [ ] **Step 1: Viết `0035_customers_issues.sql`** (bám migration `0003_suppliers.sql` và `0010_receipts.sql`; enum có sẵn `public.movement_type` ở `0005_inventory.sql`):

```sql
-- 0035_customers_issues.sql — khách hàng + phiếu xuất kho (additive).

-- 1) Khách hàng (bên nhận hàng khi xuất bán)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_name_active_key on public.customers (name) where deleted_at is null and is_active;

-- 2) movement_type thêm giá trị issue_out
alter type public.movement_type add value if not exists 'issue_out';

-- 3) Phiếu xuất kho
create sequence public.issues_seq;
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  destination_type text not null check (destination_type in ('zone','customer')),
  zone_id uuid references public.zones(id),
  customer_id uuid references public.customers(id),
  vehicle_plate text,
  driver_name text,
  creator_id uuid not null references public.profiles(id),
  notes text,
  status text not null default 'draft' check (status in ('draft','posted','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (destination_type = 'zone' and zone_id is not null and customer_id is null) or
    (destination_type = 'customer' and customer_id is not null and zone_id is null)
  )
);
create table public.issue_items (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2),
  created_at timestamptz not null default now()
);
create index issue_items_issue_idx on public.issue_items (issue_id);
create index issues_status_created_idx on public.issues (status, created_at);

-- 4) View tồn theo từng kho (composite bung linh kiện) — dùng cho bảng tồn in
create or replace view public.location_stock
with (security_invoker = true) as
select
  sb.location_id,
  v.id as variant_id,
  v.product_id,
  case
    when exists (select 1 from public.variant_components vc where vc.parent_variant_id = v.id) then (
      select min(sb2.quantity / greatest(vc.quantity, 1))
      from public.variant_components vc
      join public.stock_balances sb2 on sb2.variant_id = vc.child_variant_id and sb2.location_id = sb.location_id
      where vc.parent_variant_id = v.id
    )
    else sb.quantity
  end as quantity
from public.stock_balances sb
join public.variants v on v.id = sb.variant_id;

-- 5) RLS (theo pattern 0016_rls.sql)
alter table public.customers enable row level security;
alter table public.issues enable row level security;
alter table public.issue_items enable row level security;

create policy "customers_read_all" on public.customers for select to authenticated using (true);
create policy "customers_write_manager" on public.customers for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "issues_read_manager" on public.issues for select to authenticated using (public.is_manager());
create policy "issues_write_manager" on public.issues for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "issue_items_read_manager" on public.issue_items for select to authenticated using (public.is_manager());
create policy "issue_items_write_manager" on public.issue_items for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- 6) Audit trigger updated_at (nếu có trigger chuẩn ở 0014_triggers.sql cho bảng mới thì thêm tương tự)
```

- [ ] **Step 2:** `bunx supabase@2.116.0 db push` (DB local đang chạy). Xác minh `bunx supabase@2.116.0 db push` báo thành công, không lỗi.
- [ ] **Step 3:** `bunx supabase@2.116.0 gen types typescript --local > src/types/database.types.ts` (nếu lệnh local lỗi vì khác port, chép theo cách repo đã gen — xem BUILD_GUIDE §5). Commit typegen riêng nếu diff lớn.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(db): customers, issues, movement issue_out, location_stock + RLS"`

---

### Task 8: RPC issues + script verify (TDD-ish theo repo: verify trước/sau)

**Files:**
- Create: `supabase/migrations/0036_issues_rpc.sql`
- Create: `scripts/verify-issue-flow.ts`
- Modify: `src/lib/types.ts` (Row aliases mới — đọc file hiện có để thêm đúng kiểu)

- [ ] **Step 1: Viết `0036_issues_rpc.sql`** (bám chính xác style `0017_rpc.sql` — `_move_stock`, `next_code`, `is_manager`, audit):

```sql
-- 0036_issues_rpc.sql — nghiệp vụ phiếu xuất kho (mirror receipts).

-- Bung composite thành linh kiện cho danh sách (variant_id, quantity) bất kỳ.
create or replace function public._expand_variant_demand(p_items jsonb)
returns table (variant_id uuid, quantity int)
language sql stable security definer set search_path = public as $$
  select t.variant_id, sum(t.qty)::int as quantity
  from (
    select (it.value->>'variant_id')::uuid as variant_id, (it.value->>'quantity')::int as qty
    from jsonb_array_elements(p_items) it
    where not exists (
      select 1 from public.variant_components vc
      where vc.parent_variant_id = (it.value->>'variant_id')::uuid
    )
    union all
    select vc.child_variant_id, ((it.value->>'quantity')::int) * vc.quantity as qty
    from jsonb_array_elements(p_items) it
    join public.variant_components vc
      on vc.parent_variant_id = (it.value->>'variant_id')::uuid
  ) t group by t.variant_id
$$;

create or replace function public.create_issue(
  p_items jsonb, p_destination_type text,
  p_zone_id uuid, p_customer_id uuid,
  p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được lập phiếu xuất'; end if;
  if p_destination_type not in ('zone','customer') then raise exception 'Kiểu đích không hợp lệ'; end if;
  if p_destination_type = 'zone' and p_zone_id is null then raise exception 'Phải chọn khu nhận'; end if;
  if p_destination_type = 'customer' and p_customer_id is null then raise exception 'Phải chọn khách hàng'; end if;

  insert into public.issues
    (code, destination_type, zone_id, customer_id, vehicle_plate, driver_name, creator_id, notes)
  values (
    public.next_code('PXK', 'public.issues_seq'::regclass),
    p_destination_type, p_zone_id, p_customer_id,
    nullif(p_vehicle_plate,''), nullif(p_driver_name,''), p_by, nullif(p_notes,'')
  )
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.issue_items (issue_id, variant_id, quantity, unit_price)
    values (
      v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int,
      nullif(it.value->>'unit_price','')::numeric
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'issue.create', 'issue', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;

create or replace function public.post_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_main uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận xuất'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select status into v_status from public.issues where id = p_id for update;
  if v_status <> 'draft' then raise exception 'Phiếu xuất không ở trạng thái nháp (hiện tại: %)', v_status; end if;
  if not exists (select 1 from public.issue_items where issue_id = p_id) then
    raise exception 'Phiếu xuất không có vật tư';
  end if;

  -- trừ stock từng dòng (đã bung composite), order by variant_id chống deadlock
  for it in
    select d.variant_id, d.quantity
    from public._expand_variant_demand(
      (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity))
       from public.issue_items i where i.issue_id = p_id)
    ) d order by d.variant_id
  loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'issue_out', 'issue', p_id, p_by);
  end loop;

  update public.issues set status = 'posted', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.post', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted'));
end;
$$;

create or replace function public.cancel_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;
  update public.issues set status = 'cancelled', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.cancel', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;
```
> Lưu ý: `post_issue` dùng `v_status text` khớp cột `issues.status` (text + check). Kiểm tra tên cột `public.audit_logs` (actor_id, action, entity_type, entity_id, before, after) khớp migration `0011_audit.sql`.

- [ ] **Step 2:** `bunx supabase@2.116.0 db push` → sạch.
- [ ] **Step 3: Viết `scripts/verify-issue-flow.ts`** — clone cấu trúc `scripts/verify-receipt-flow.ts` (đọc file này trước để lấy đúng cách login `manager@mtp.local`/`password123`, client supabase `http://127.0.0.1:54321`, demo anon key). Các bước assert:
  1. Tạo (hoặc mượn) khách hàng qua insert trực tiếp (service role hoặc RPC manager) — lấy `customer_id`.
  2. `create_issue` với 1 item `variant_id` có tồn > 0 (truy vấn `variant_stock`), destination `customer`, `unit_price` 15000 → trả `PXK-…`.
  3. `post_issue` → `stock_balances` của variant giảm đúng quantity; `stock_movements` có dòng `movement_type='issue_out'`, `ref_type='issue'`, `ref_id=issue_id`; `issues.status='posted'`.
  4. `post_issue` lần 2 → lỗi (status không draft).
  5. Tạo phiếu khác destination `zone` với item số lượng > tồn → `post_issue` raise "Không đủ tồn" và `stock_balances` không đổi, phiếu còn `draft`.
  6. `cancel_issue` phiếu draft → `cancelled`; `cancel_issue` phiếu posted → lỗi.
  In PASS/FAIL từng bước, `process.exit(1)` nếu fail.
- [ ] **Step 4:** Chạy `bun run scripts/verify-issue-flow.ts` → tất cả PASS.
- [ ] **Step 5:** Cập nhật `src/lib/types.ts` (thêm alias Row cho `customers`, `issues`, `issue_items`; `IssueDestinationType = "zone" | "customer"`; đọc file hiện tại để theo đúng style export).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(db): RPC issues + verify-issue-flow"`

---

### Task 9: Zod schema + server actions issues + CRUD customers admin

**Files:**
- Create: `src/features/issues/schema.ts`
- Create: `src/features/issues/actions.ts`
- Modify: `src/features/admin/actions.ts` (thêm `saveCustomer`, `deleteCustomer`)
- Create: `src/app/(app)/admin/customers/page.tsx` (clone `src/app/(app)/admin/suppliers/page.tsx` — đọc trước)
- Modify: `src/lib/nav.ts`

- [ ] **Step 1: `src/features/issues/schema.ts`**
```ts
import { z } from "zod";

export const issueItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
});

export const issueSchema = z
  .object({
    destinationType: z.enum(["zone", "customer"]),
    zoneId: z.string().uuid().nullable(),
    customerId: z.string().uuid().nullable(),
    vehiclePlate: z.string().trim().max(50).optional(),
    driverName: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
    items: z.array(issueItemSchema).min(1, "Phải có ít nhất 1 vật tư"),
  })
  .superRefine((v, ctx) => {
    if (v.destinationType === "zone" && !v.zoneId)
      ctx.addIssue({ code: "custom", path: ["zoneId"], message: "Phải chọn khu nhận" });
    if (v.destinationType === "customer" && !v.customerId)
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Phải chọn khách hàng" });
  });

export type IssueInput = z.infer<typeof issueSchema>;
```
- [ ] **Step 2: `src/features/issues/actions.ts`** (mirror `src/features/receipts/actions.ts`):
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { issueSchema, type IssueInput } from "./schema";

export async function createIssue(input: IssueInput) {
  const profile = await requireManager(); // trả profile chứa .id — kiểm tra src/lib/auth.ts
  const parsed = issueSchema.parse(input);
  const supabase = await createClient();
  const items = parsed.items.map((i) => ({
    variant_id: i.variantId,
    quantity: i.quantity,
    unit_price: i.unitPrice ?? null,
  }));
  const { data, error } = await supabase.rpc("create_issue", {
    p_items: items,
    p_destination_type: parsed.destinationType,
    p_zone_id: parsed.zoneId,
    p_customer_id: parsed.customerId,
    p_vehicle_plate: parsed.vehiclePlate ?? null,
    p_driver_name: parsed.driverName ?? null,
    p_notes: parsed.notes ?? null,
    p_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
  return data as string;
}

export async function postIssue(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  for (const p of ["/issues", "/dashboard", "/products", "/reports"]) revalidatePath(p);
}

export async function cancelIssue(id: string) {
  const profile = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_issue", { p_id: id, p_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
}
```
(Lưu ý: nếu `requireManager()` không trả profile.id, đọc cách `src/features/receipts/actions.ts` lấy `profile.id` và làm tương tự.)
- [ ] **Step 3: admin actions** — đọc `src/features/admin/actions.ts` hàm `saveSupplier/deleteSupplier` (nhận `data: Record<string,string>`) và bảng fields trong `src/app/(app)/admin/suppliers/page.tsx`, thêm `saveCustomer`/`deleteCustomer` thao tác bảng `customers` với các cột `{name, phone, address, notes}`.
- [ ] **Step 4: `/admin/customers`** — clone trang suppliers: cột `Tên, SĐT, Địa chỉ, Ghi chú, Hoạt động`, dialog sửa, nút xoá (soft delete `deleted_at`), lọc active.
- [ ] **Step 5: nav.ts** — ADMIN_NAV thêm `{ href: "/admin/customers", label: "Khách hàng", icon: Users, roles: ["manager"] }` (icon có sẵn `Users`/`Building2` trong import).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(issues): schema+actions, admin khách hàng, nav"`

---

### Task 10: UI module Phiếu xuất (list / new / detail)

**Files:**
- Create: `src/features/issues/components/issue-form.tsx` (client, mirror `src/features/receipts/components/receipt-form.tsx`)
- Create: `src/app/(app)/issues/page.tsx` (server list)
- Create: `src/app/(app)/issues/new/page.tsx`
- Create: `src/app/(app)/issues/[id]/page.tsx` (server detail)
- Modify: `src/lib/labels.ts` (map `ISSUE_DESTINATION` = `{ zone: "Nội bộ khu", customer: "Bán cho khách" }`, `ISSUE_STATUS` = `{ draft: "Nháp", posted: "Đã xuất", cancelled: "Đã hủy" }`), `src/lib/nav.ts` (MAIN_NAV thêm `Phiếu xuất` href `/issues`, roles manager, icon `PackageMinus` — kiểm tra icon có trong lucide-react đang dùng).

- [ ] **Step 1: List `/issues`** — clone cấu trúc `src/app/(app)/receipts/page.tsx` (đọc trước): server component, query `issues` join `customers(name,phone,address)` / `zones(name)` / `profiles(name)`, hiển thị: Mã phiếu, Loại (label map), Bên nhận (customer.zone name), Ngày (`formatDate`), Tổng SL (sum items), Tổng tiền (nếu destination_type=customer, sum qty*unit_price, `formatVnd`), Trạng thái; nút `In` (Link `/api/issues/${id}/pdf`) như receipts; nút `Tạo phiếu xuất` về `/issues/new`.
- [ ] **Step 2: `/issues/new` + `issue-form.tsx`** — mirror `receipt-form.tsx`; khác biệt:
  - Radio/segmented **Kiểu đích**: `Khu nội bộ` | `Bán cho khách`.
  - Chọn đích bằng Select: khu từ bảng `zones` hoặc khách từ `customers` (server page nạp sẵn như `receipt-form` nhận `suppliers`); kèm link "Thêm khách mới" → `/admin/customers` (như receipt-form link suppliers).
  - Ô "Biển số xe", "Người vận chuyển" chỉ hiện khi Kiểu = Bán cho khách (optional).
  - Dòng vật tư: dùng đúng component chọn sản phẩm/biến thể mà receipt-form đang dùng (đọc file — tái sử dụng nguyên khối); cột nhập **Số lượng**; ô **Đơn giá** chỉ hiện khi Bán (mặc định điền `variants.price` khi chọn biến thể nếu picker trả giá; nếu không, để trống bắt buộc nhập khi bán); nút xoá dòng.
  - Submit gọi `createIssue` (useTransition + toast sonner), thành công → router.push(`/issues/${id}`).
- [ ] **Step 3: `/issues/[id]`** — server component: header (mã, loại, bên nhận + địa chỉ/SĐT nếu khách, xe/tài xế, ghi chú, creator, ngày, trạng thái), bảng dòng vật tư (tên, biến thể, đvt, sl, giá/thành tiền nếu khách, tổng cộng); nút theo trạng thái: draft → `Xác nhận xuất` (gọi `postIssue`, toast + refresh, cảnh báo sẽ trừ tồn) + `Hủy` (`cancelIssue`, confirm dialog), mọi trạng thái → nút `In phiếu` `target="_blank"` `/api/issues/${id}/pdf`. Nút dùng pattern của `receipt-actions.tsx`/`requisition-actions.tsx`.
- [ ] **Step 4:** `bun run typecheck` + `bun run lint` sạch.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(issues): màn hình phiếu xuất kho"`

---

### Task 11: Route PDF phiếu xuất kho + nút in

**Files:**
- Create: `src/app/api/issues/[id]/pdf/route.tsx`

- [ ] **Step 1: Tạo route** (mirror `src/app/api/receipts/[id]/pdf/route.tsx`):
```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { requireManager } from "@/lib/auth";
import { formatVnd } from "@/lib/format";
import { formatAmountInWords } from "@/lib/money-words";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("issues")
    .select("*, customer:customers!issues_customer_id_fkey(name, phone, address), zone:zones!issues_zone_id_fkey(name), creator:profiles!issues_creator_id_fkey(name)")
    .eq("id", id)
    .single();
  if (!doc) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("issue_items")
    .select("quantity, unit_price, variants(attributes, unit, products(name))")
    .eq("issue_id", id);

  const isSale = doc.destination_type === "customer";
  const total = (items ?? []).reduce((n, i) => n + i.quantity * (i.unit_price ?? 0), 0);
  const totalQty = (items ?? []).reduce((n, i) => n + i.quantity, 0);

  const rightFields: { label: string; value?: string | null }[] = [];
  if (doc.vehicle_plate) rightFields.push({ label: "Biển số xe", value: doc.vehicle_plate });
  if (doc.driver_name) rightFields.push({ label: "Người vận chuyển", value: doc.driver_name });

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU XUẤT KHO"
      code={doc.code}
      createdAt={doc.created_at}
      fields={
        doc.destination_type === "customer"
          ? [
              { label: "Bên nhận hàng", value: doc.customer?.name },
              { label: "Địa chỉ", value: doc.customer?.address },
              { label: "Số điện thoại", value: doc.customer?.phone },
            ]
          : [
              { label: "Nhận tại khu", value: doc.zone?.name },
              { label: "Người lập phiếu", value: doc.creator?.name },
            ]
      }
      rightPanel={rightFields.length > 0 ? { heading: "Thông tin xe vận chuyển", fields: rightFields } : undefined}
      columns={
        isSale
          ? [
              { label: "TÊN SẢN PHẨM, HÀNG HÓA", flex: 2.4 },
              { label: "ĐVT", flex: 0.6, align: "center" },
              { label: "SL", flex: 0.6, align: "right" },
              { label: "ĐƠN GIÁ", flex: 1.0, align: "right" },
              { label: "THÀNH TIỀN", flex: 1.1, align: "right" },
              { label: "GHI CHÚ", flex: 0.9 },
            ]
          : [
              { label: "TÊN SẢN PHẨM, HÀNG HÓA", flex: 3.0 },
              { label: "ĐVT", flex: 0.8, align: "center" },
              { label: "SL", flex: 0.8, align: "right" },
              { label: "GHI CHÚ", flex: 1.2 },
            ]
      }
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        i.variants?.unit ?? "—",
        i.quantity,
        ...(isSale ? [formatVnd(i.unit_price ?? 0), formatVnd(i.quantity * (i.unit_price ?? 0))] : []),
        "",
      ])}
      totals={isSale ? [{ left: "TỔNG CỘNG", right: formatVnd(total) }] : [{ left: "TỔNG CỘNG", right: `Tổng số lượng: ${totalQty}` }]}
      amountInWords={isSale ? `Thành tiền bằng chữ: ${formatAmountInWords(total)}` : undefined}
      signers={
        doc.destination_type === "customer"
          ? ["Người nhận hàng", "Vận chuyển", "Người lập phiếu (Đại diện người bán)", "Chủ trại"]
          : ["Người nhận hàng", "Người lập phiếu", "Chủ trại"]
      }
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.code}.pdf"` },
  });
}
```
> Lưu ý triển khai: quan hệ FK tên chính xác (`issues_customer_id_fkey`, `issues_creator_id_fkey`, `issues_zone_id_fkey`) — nếu tên tự sinh khác (xem `database.types.ts` sau typegen), chỉnh select cho khớp. Mỗi dòng bảng của mẫu xuất còn có cột "Biến thể" tuỳ chọn nếu anh muốn in rõ biến thể — giữ tối giản theo spec; có thể thêm cột nếu cần sau nghiệm thu.

- [ ] **Step 2:** Nút in đã có ở Task 10 (list + detail); `bun run typecheck`.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(issues): route PDF phiếu xuất kho"`

---

### Task 12: Bảng tồn kho (in PDF) từ màn Báo cáo

**Files:**
- Create: `src/app/api/reports/stock/pdf/route.tsx`
- Modify: `src/app/(app)/reports/page.tsx` (nút In + chọn kho)

- [ ] **Step 1: Route** — manager; đọc query `location` (uuid, optional):
  - Không có `location`: `location_stock` join locations+products+variant_components… lấy nhóm theo kho, chỉ `quantity > 0`, sắp theo `sl.name`, `p.name`; mỗi nhóm kho là 1 "phần" (in nhiều trang OK).
  - Có `location`: lọc 1 kho.
  - Đổ vào `SlipDocument` 1 lần cho mỗi kho (nhiều `<Page>` trong cùng Document? — `SlipDocument` hiện 1 Document/1 Page: với nhiều kho gọi nhiều lần renderToBuffer là sai; **giải pháp**: bảng tồn dùng một Document với nhiều Page — mở rộng `slip.tsx` thêm export `SlipPages` (nhiều trang cùng header, mỗi kho 1 bảng) HOẶC giữ 1 route chạy `renderToBuffer` cho từng kho rồi merge bằng lib? Đơn giản: cho phép `SlipDocument` nhận `pages?: { ...per page fields... }` — quyết định lúc code, ưu tiên: mở rộng `slip.tsx` xuất thêm `MultiSlipDocument({ title, createdAt, groups: SlipGroup[] })`, mỗi group một `Page` có khung/header và bảng riêng; route dùng nó.)
  - Cột mỗi bảng: `STT | Tên hàng (tên sản phẩm + nhãn biến thể) | ĐVT | Tồn kho`; `signers` không có.
- [ ] **Step 2:** Trang `/reports` thêm cạnh nút CSV: chọn kho (`<Select>` nạp `stock_locations`) + nút `<Link href={`/api/reports/stock/pdf?location=${loc ?? ""}`} target="_blank">In bảng tồn</Link>`.
- [ ] **Step 3:** `bun run typecheck`; render thử.
- [ ] **Step 4: Commit** `git add -A && git commit -m "feat(report): in bảng tồn kho PDF"`

---

### Task 13: In phiếu kiểm kê

**Files:**
- Create: `src/app/api/stocktake/[id]/pdf/route.tsx`
- Modify: `src/features/stocktake/components/stocktake-manager.tsx` (nút In trên session posted hoặc mọi trạng thái)

- [ ] **Step 1:** Đọc `supabase/migrations/0022_create_stocktake.sql` + manager để lấy đúng cột (`stocktake_sessions`, `stocktake_items` — tên cột tồn sổ sách/thực tế/chênh lệch), route: `requireManager`, query session + items join variants/products/locations → `SlipDocument` title `PHIẾU KIỂM KÊ`, fields: Kho, Ngày kiểm; cột `Tên hàng (biến thể) | ĐVT | Tồn sổ sách | Tồn thực tế | Chênh lệch`; signers `["Người kiểm kê", "Thủ kho", "Người duyệt"]`.
- [ ] **Step 2:** Nút In trên manager (mở `/api/stocktake/${id}/pdf` tab mới) cho session có dữ liệu.
- [ ] **Step 3: Commit** `git commit -am "feat(stocktake): in phiếu kiểm kê"`

---

### Task 14: Kiểm tra tổng + build + nghiệm thu cuối

- [ ] **Step 1:** `bun run typecheck`, `bun run lint`, `bun run test`, `bun run scripts/verify-issue-flow.ts`, `bun run scripts/verify-pdf-font.tsx` — tất cả sạch.
- [ ] **Step 2:** `bun run build` thành công.
- [ ] **Step 3:** Thử tay trên web dev (3001) bằng tài khoản manager: lập phiếu xuất (khu + khách), xác nhận xuất → tồn giảm trên /products, hủy phiếu nháp OK, in từng loại phiếu (nhập/yêu cầu/xuất/hỏng/sửa/thanh lý/kiểm kê/bảng tồn) so mẫu giấy.
- [ ] **Step 4:** Commit cuối + cập nhật README/BUILD_GUIDE nếu cần (mục tương ứng), note triển khai prod theo `scripts/deploy.sh` sau khi user duyệt.
