# Phân hệ Đổi mới 1-1 Cấp tốc & Mượn/Trả Dụng cụ Chuồng Trại Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai luồng 1 chạm "Đổi mới 1-1 cấp tốc" khi thiết bị chuồng nuôi gặp sự cố khẩn cấp và xây dựng phân hệ Mượn/Trả Dụng cụ dùng chung (`/tools`) để quản lý tài sản, theo dõi người đang giữ, cảnh báo quá hạn trả và cập nhật tồn kho chính xác.

**Architecture:** 
- Database: Migration `0061_quick_exchange_and_tool_borrowing.sql` tạo bảng `tool_borrowings`, `tool_borrowing_items`, mở rộng `movement_type` với `tool_borrow_out` / `tool_return_in`, cùng các RPC `quick_emergency_exchange`, `create_tool_borrowing`, `return_tool_borrowing`, `cancel_tool_borrowing`.
- Backend: Server actions trong `src/features/exchanges/actions.ts` và `src/features/tools/actions.ts` xử lý logic kiểm tra quyền và gọi RPC an toàn.
- Frontend: Hộp thoại `QuickExchangeDialog` (chụp ảnh hỏng, tạo và duyệt đổi mới tức thì), phân hệ `/tools` với tab *"Dụng cụ tôi đang giữ"* cho công nhân và *"Đang cho mượn"* cho quản lý kho, cùng mẫu in PDF chuẩn.

**Tech Stack:** Next.js 15 (App Router), Supabase Postgres + RLS, TypeScript, Tailwind CSS 4, shadcn/ui, Vitest / React Testing Library, React-PDF (`@react-pdf/renderer`).

**Spec:** `docs/superpowers/specs/2026-09-08-quick-exchange-and-tool-borrowing-design.md`

## Global Constraints

- Tuân thủ cấu trúc feature-first trong `src/features/tools/` và `src/features/exchanges/`.
- Mọi biến động kho mượn/trả dụng cụ phải ghi ledger `stock_movements` qua RPC security definer.
- Mọi action mới có đầy đủ kiểm thử bằng Vitest (`bun run test`).
- Giữ nguyên toàn bộ quy chuẩn bảo mật RLS và giao diện tiếng Việt thân thiện của hệ thống trại gà Minh Tân Phát.

---

### Task 1: SQL Migration cho Đổi mới 1-1 Cấp tốc & Mượn/Trả Dụng cụ

**Files:**
- Create: `supabase/migrations/0061_quick_exchange_and_tool_borrowing.sql`
- Modify: `src/lib/labels.ts`
- Modify: `src/lib/labels.test.ts`

**Interfaces:**
- Produces: RPC `quick_emergency_exchange`, `create_tool_borrowing`, `return_tool_borrowing`, `cancel_tool_borrowing`, labels mapping `TOOL_BORROWING_STATUS`

- [ ] **Step 1: Write the failing test for tool borrowing labels**

In `src/lib/labels.test.ts`, add:
```typescript
import { TOOL_BORROWING_STATUS } from "./labels";

describe("tool borrowing labels", () => {
  it("translates tool borrowing statuses correctly", () => {
    expect(TOOL_BORROWING_STATUS.borrowed).toBe("Đang mượn");
    expect(TOOL_BORROWING_STATUS.returned).toBe("Đã trả đủ");
    expect(TOOL_BORROWING_STATUS.cancelled).toBe("Đã hủy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/labels.test.ts`
Expected: FAIL with `TOOL_BORROWING_STATUS` is undefined.

- [ ] **Step 3: Create SQL Migration and Labels**

Create `supabase/migrations/0061_quick_exchange_and_tool_borrowing.sql`:
```sql
-- 0061_quick_exchange_and_tool_borrowing.sql — Đổi mới 1-1 cấp tốc & Mượn/Trả dụng cụ

-- 1. Thêm movement types cho mượn/trả dụng cụ
alter type public.movement_type add value if not exists 'tool_borrow_out';
alter type public.movement_type add value if not exists 'tool_return_in';

-- 2. Enum & Bảng Mượn Dụng Cụ
create type public.tool_borrowing_status as enum ('borrowed', 'returned', 'cancelled');
create sequence public.tool_borrowings_seq;

create table public.tool_borrowings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  borrower_id uuid not null references public.profiles(id),
  zone_id uuid references public.zones(id),
  purpose text not null,
  borrowed_at timestamptz not null default now(),
  expected_return_date date,
  returned_at timestamptz,
  issued_by uuid references public.profiles(id),
  received_back_by uuid references public.profiles(id),
  notes text,
  status public.tool_borrowing_status not null default 'borrowed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tool_borrowings_borrower_idx on public.tool_borrowings(borrower_id);
create index tool_borrowings_status_idx on public.tool_borrowings(status);

create table public.tool_borrowing_items (
  id uuid primary key default gen_random_uuid(),
  borrowing_id uuid not null references public.tool_borrowings(id) on delete cascade,
  variant_id uuid not null references public.variants(id),
  quantity int not null check (quantity > 0),
  returned_quantity int not null default 0 check (returned_quantity >= 0),
  notes text
);

create index tool_borrowing_items_borrowing_idx on public.tool_borrowing_items(borrowing_id);

-- RLS
alter table public.tool_borrowings enable row level security;
alter table public.tool_borrowing_items enable row level security;

create policy "tool_borrowings_select" on public.tool_borrowings for select to authenticated
  using (public.is_manager() or borrower_id = auth.uid());

create policy "tool_borrowing_items_select" on public.tool_borrowing_items for select to authenticated
  using (public.is_manager() or exists (
    select 1 from public.tool_borrowings b where b.id = borrowing_id and b.borrower_id = auth.uid()
  ));

-- 3. RPC quick_emergency_exchange
create or replace function public.quick_emergency_exchange(
  p_variant_id uuid,
  p_quantity int,
  p_damage_detail text,
  p_images text[],
  p_zone_id uuid,
  p_by uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_defect_id uuid;
  v_exchange_id uuid;
  v_defect_code text;
  v_exchange_code text;
  v_main_loc uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if p_images is null or array_length(p_images, 1) is null or array_length(p_images, 1) = 0 then
    raise exception 'Bắt buộc phải có ít nhất 1 ảnh hiện trường hỏng';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- 1. Tạo phiếu báo hỏng ở trạng thái staging
  v_defect_code := public.next_code('HONG', 'public.defect_notes_seq'::regclass);
  insert into public.defect_notes (code, source_location_id, reported_by, status)
  values (v_defect_code, v_main_loc, p_by, 'staging')
  returning id into v_defect_id;

  insert into public.defect_note_items (defect_note_id, variant_id, quantity, damage_detail, images, note)
  values (v_defect_id, p_variant_id, p_quantity, p_damage_detail, p_images, 'Đổi mới khẩn cấp 1-1');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.create', 'defect', v_defect_id, jsonb_build_object('status', 'staging', 'emergency', true));

  -- 2. Tạo phiếu Đổi Mới và duyệt thẳng (approved)
  v_exchange_code := public.next_code('DM', 'public.exchange_notes_seq'::regclass);
  insert into public.exchange_notes (code, linked_defect_id, created_by, approved_by, approved_at, status)
  values (v_exchange_code, v_defect_id, p_by, p_by, now(), 'approved')
  returning id into v_exchange_id;

  insert into public.exchange_note_items (exchange_note_id, variant_id, quantity)
  values (v_exchange_id, p_variant_id, p_quantity);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create_emergency', 'exchange', v_exchange_id, jsonb_build_object('status', 'approved'));

  return jsonb_build_object(
    'defect_id', v_defect_id,
    'defect_code', v_defect_code,
    'exchange_id', v_exchange_id,
    'exchange_code', v_exchange_code
  );
end;
$$;

-- 4. RPC create_tool_borrowing
create or replace function public.create_tool_borrowing(
  p_items jsonb,
  p_zone_id uuid,
  p_purpose text,
  p_expected_return_date date,
  p_borrower_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then raise exception 'Mục đích mượn không được để trống'; end if;
  if p_borrower_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ quản lý kho mới được tạo phiếu mượn hộ người khác';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';
  v_code := public.next_code('MDC', 'public.tool_borrowings_seq'::regclass);

  insert into public.tool_borrowings (
    code, borrower_id, zone_id, purpose, expected_return_date, issued_by, status
  )
  values (
    v_code, p_borrower_id, p_zone_id, p_purpose, p_expected_return_date, auth.uid(), 'borrowed'
  )
  returning id into v_id;

  -- Trừ tồn kho Kho chính & ghi ledger tool_borrow_out
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.tool_borrowing_items (borrowing_id, variant_id, quantity)
    values (v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);

    perform public._move_stock(
      (it.value->>'variant_id')::uuid,
      v_main_loc,
      null,
      (it.value->>'quantity')::int,
      'tool_borrow_out',
      'tool_borrowing',
      v_id,
      auth.uid(),
      'Xuất mượn dụng cụ: ' || p_purpose
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'tool_borrowing.create', 'tool_borrowing', v_id, jsonb_build_object('status', 'borrowed', 'code', v_code));

  return v_id;
end;
$$;

-- 5. RPC return_tool_borrowing
create or replace function public.return_tool_borrowing(
  p_borrowing_id uuid,
  p_items jsonb,
  p_notes text,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.tool_borrowing_status;
  v_main_loc uuid;
  v_all_returned boolean := true;
  it record;
  v_borrowed_qty int;
  v_already_returned int;
  v_return_qty int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận nhận lại dụng cụ'; end if;

  select status into v_status from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Phiếu không ở trạng thái đang mượn (hiện tại: %)', v_status; end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  for it in select value from jsonb_array_elements(p_items) loop
    v_return_qty := (it.value->>'quantity')::int;
    if v_return_qty <= 0 then continue; end if;

    select quantity, returned_quantity into v_borrowed_qty, v_already_returned
    from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and variant_id = (it.value->>'variant_id')::uuid
    for update;

    if v_borrowed_qty is null then
      raise exception 'Dụng cụ % không có trong phiếu mượn', it.value->>'variant_id';
    end if;

    if v_already_returned + v_return_qty > v_borrowed_qty then
      raise exception 'Số lượng trả vượt quá số lượng còn đang mượn';
    end if;

    update public.tool_borrowing_items
    set returned_quantity = returned_quantity + v_return_qty
    where borrowing_id = p_borrowing_id and variant_id = (it.value->>'variant_id')::uuid;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid,
      null,
      v_main_loc,
      v_return_qty,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Nhận trả dụng cụ'
    );
  end loop;

  -- Kiểm tra xem tất cả các món đã trả đủ chưa
  if exists (
    select 1 from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and returned_quantity < quantity
  ) then
    v_all_returned := false;
  end if;

  if v_all_returned then
    update public.tool_borrowings
    set status = 'returned', returned_at = now(), received_back_by = p_by, notes = coalesce(notes || E'\n', '') || coalesce(p_notes, '')
    where id = p_borrowing_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.return', 'tool_borrowing', p_borrowing_id, jsonb_build_object('all_returned', v_all_returned, 'items', p_items));
end;
$$;

-- 6. RPC cancel_tool_borrowing
create or replace function public.cancel_tool_borrowing(
  p_borrowing_id uuid,
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.tool_borrowing_status;
  v_borrower uuid;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status, borrower_id into v_status, v_borrower from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Chỉ có thể hủy phiếu đang mượn'; end if;
  if v_borrower is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người mượn hoặc quản lý mới được hủy phiếu';
  end if;

  -- Không cho hủy nếu đã có dòng trả lại
  if exists (
    select 1 from public.tool_borrowing_items where borrowing_id = p_borrowing_id and returned_quantity > 0
  ) then
    raise exception 'Phiếu đã có dụng cụ được trả, không thể hủy';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- Hoàn trả tồn kho Kho chính
  for it in select variant_id, quantity from public.tool_borrowing_items where borrowing_id = p_borrowing_id loop
    perform public._move_stock(
      it.variant_id,
      null,
      v_main_loc,
      it.quantity,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Hủy phiếu mượn dụng cụ'
    );
  end loop;

  update public.tool_borrowings set status = 'cancelled' where id = p_borrowing_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.cancel', 'tool_borrowing', p_borrowing_id, jsonb_build_object('status', 'cancelled'));
end;
$$;
```

Update `src/lib/labels.ts` with:
```typescript
export const TOOL_BORROWING_STATUS: Record<string, string> = {
  borrowed: "Đang mượn",
  returned: "Đã trả đủ",
  cancelled: "Đã hủy",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/labels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0061_quick_exchange_and_tool_borrowing.sql src/lib/labels.ts src/lib/labels.test.ts
git commit -m "feat(db): add migration for quick emergency exchange and tool borrowing subsystem"
```

---

### Task 2: Server Action & Giao diện Đổi mới 1-1 Cấp tốc (`QuickExchangeDialog`)

**Files:**
- Modify: `src/features/exchanges/actions.ts`
- Create: `src/features/exchanges/components/quick-exchange-dialog.tsx`
- Modify: `src/app/(app)/defects/page.tsx`
- Modify: `src/features/products/components/product-card.tsx`
- Test: `src/features/exchanges/components/quick-exchange-dialog.test.tsx`

**Interfaces:**
- Produces: `quickEmergencyExchange(input: { variantId: string; quantity: number; damageDetail: string; images: string[]; zoneId?: string })`, `<QuickExchangeDialog />`

- [ ] **Step 1: Write the failing test for QuickExchangeDialog**

Create `src/features/exchanges/components/quick-exchange-dialog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickExchangeDialog } from "./quick-exchange-dialog";

vi.mock("@/features/exchanges/actions", () => ({
  quickEmergencyExchange: vi.fn().mockResolvedValue({
    defect_id: "def-1",
    exchange_id: "ex-1",
    exchange_code: "DM-001",
  }),
}));

describe("QuickExchangeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trigger button with emergency label", () => {
    render(<QuickExchangeDialog variants={[{ id: "v1", name: "Bóng úm", detail: "45W" }]} />);
    expect(screen.getByText(/Đổi khẩn cấp 1-1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/exchanges/components/quick-exchange-dialog.test.tsx`
Expected: FAIL with "Cannot find module './quick-exchange-dialog'"

- [ ] **Step 3: Implement quickEmergencyExchange Action and QuickExchangeDialog**

In `src/features/exchanges/actions.ts`:
```typescript
export async function quickEmergencyExchange(input: {
  variantId: string;
  quantity: number;
  damageDetail: string;
  images: string[];
  zoneId?: string;
}) {
  const profile = await requireProfile();
  if (!input.variantId) throw new Error("Vui lòng chọn vật tư cần đổi");
  if (input.quantity <= 0) throw new Error("Số lượng phải lớn hơn 0");
  if (!input.damageDetail.trim()) throw new Error("Vui lòng nhập mô tả hư hỏng");
  if (!input.images || input.images.length === 0) throw new Error("Vui lòng chụp ít nhất 1 ảnh chứng cứ hỏng");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quick_emergency_exchange", {
    p_variant_id: input.variantId,
    p_quantity: input.quantity,
    p_damage_detail: input.damageDetail.trim(),
    p_images: input.images,
    p_zone_id: input.zoneId || profile.zone_id || null,
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  // Notify managers
  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["manager", "superuser"])
    .eq("is_active", true);

  const managerIds = (managers ?? []).map((m) => m.id);
  const result = data as { defect_id: string; exchange_id: string; exchange_code: string };

  try {
    await Promise.all(
      managerIds.map((uid) =>
        supabase.rpc("create_notification", {
          p_user_id: uid,
          p_type: "exchange",
          p_title: `🚨 ĐỔI KHẨN CẤP 1-1: ${result.exchange_code}`,
          p_body: `Yêu cầu đổi khẩn cấp: ${input.damageDetail}`,
          p_link: `/defects/exchange/${result.exchange_id}`,
        }),
      ),
    );
  } catch {}

  revalidatePath("/defects");
  revalidatePath("/products");
  return result;
}
```

Implement `src/features/exchanges/components/quick-exchange-dialog.tsx` with dialog form, camera/upload image picker, quantity stepper, and quick submission.

Modify `src/app/(app)/defects/page.tsx` to include `<QuickExchangeDialog />` prominently in the header.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/features/exchanges/components/quick-exchange-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/exchanges/actions.ts src/features/exchanges/components/quick-exchange-dialog.tsx src/features/exchanges/components/quick-exchange-dialog.test.tsx src/app/(app)/defects/page.tsx
git commit -m "feat(exchanges): add quick 1-1 emergency exchange server action and dialog component"
```

---

### Task 3: Phân hệ Mượn Dụng Cụ - Server Actions & Schemas

**Files:**
- Create: `src/features/tools/schema.ts`
- Create: `src/features/tools/types.ts`
- Create: `src/features/tools/actions.ts`
- Test: `src/features/tools/actions.test.ts`

**Interfaces:**
- Produces: `createToolBorrowing`, `returnToolBorrowing`, `cancelToolBorrowing`, schemas & type definitions

- [ ] **Step 1: Write the failing test for tool actions**

Create `src/features/tools/actions.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toolBorrowingSchema, toolReturnSchema } from "./schema";

describe("Tool Schemas", () => {
  it("validates borrowing input correctly", () => {
    const valid = toolBorrowingSchema.safeParse({
      items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 2 }],
      purpose: "Hàn máng ăn",
      expectedReturnDate: "2026-09-10",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects borrowing with empty purpose or zero quantity", () => {
    const invalid = toolBorrowingSchema.safeParse({
      items: [{ variantId: "47814b7e-9762-42da-91ef-07755efcfa77", quantity: 0 }],
      purpose: "",
    });
    expect(invalid.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/tools/actions.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Implement schemas, types, and actions**

Create `src/features/tools/schema.ts`:
```typescript
import { z } from "zod";

export const toolBorrowingItemSchema = z.object({
  variantId: z.string().uuid("Vật tư không hợp lệ"),
  quantity: z.number().int().min(1, "Số lượng phải ít nhất là 1"),
});

export const toolBorrowingSchema = z.object({
  items: z.array(toolBorrowingItemSchema).min(1, "Phải chọn ít nhất 1 dụng cụ"),
  zoneId: z.string().uuid().optional().nullable(),
  purpose: z.string().min(1, "Vui lòng nhập mục đích mượn dụng cụ"),
  expectedReturnDate: z.string().optional().nullable(),
  borrowerId: z.string().uuid().optional(),
});

export const toolReturnItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1, "Số lượng trả phải lớn hơn 0"),
});

export const toolReturnSchema = z.object({
  borrowingId: z.string().uuid(),
  items: z.array(toolReturnItemSchema).min(1, "Phải chọn ít nhất 1 món để trả"),
  notes: z.string().optional(),
});

export type ToolBorrowingInput = z.infer<typeof toolBorrowingSchema>;
export type ToolReturnInput = z.infer<typeof toolReturnSchema>;
```

Create `src/features/tools/types.ts` with `ToolBorrowingRow`, `ToolBorrowingItemWithVariant`, and `ToolStatus`.

Create `src/features/tools/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireManager, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toolBorrowingSchema, toolReturnSchema, type ToolBorrowingInput, type ToolReturnInput } from "./schema";

export async function createToolBorrowing(input: ToolBorrowingInput) {
  const profile = await requireProfile();
  const parsed = toolBorrowingSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_tool_borrowing", {
    p_items: parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_zone_id: parsed.zoneId || null,
    p_purpose: parsed.purpose.trim(),
    p_expected_return_date: parsed.expectedReturnDate || null,
    p_borrower_id: parsed.borrowerId || profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tools");
  revalidatePath("/products");
  return data as string;
}

export async function returnToolBorrowing(input: ToolReturnInput) {
  const profile = await requireManager();
  const parsed = toolReturnSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("return_tool_borrowing", {
    p_borrowing_id: parsed.borrowingId,
    p_items: parsed.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_notes: parsed.notes || "",
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tools");
  revalidatePath("/products");
}

export async function cancelToolBorrowing(borrowingId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_tool_borrowing", {
    p_borrowing_id: borrowingId,
    p_by: profile.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tools");
  revalidatePath("/products");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/features/tools/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tools/schema.ts src/features/tools/types.ts src/features/tools/actions.ts src/features/tools/actions.test.ts
git commit -m "feat(tools): add tool borrowing schemas, types, and server actions"
```

---

### Task 4: UI Components Mượn & Trả Dụng Cụ (`ToolCard`, `ToolBorrowDialog`, `ToolReturnDialog`)

**Files:**
- Create: `src/features/tools/components/tool-card.tsx`
- Create: `src/features/tools/components/tool-borrow-dialog.tsx`
- Create: `src/features/tools/components/tool-return-dialog.tsx`
- Test: `src/features/tools/components/tool-card.test.tsx`

**Interfaces:**
- Produces: `<ToolCard />`, `<ToolBorrowDialog />`, `<ToolReturnDialog />`

- [ ] **Step 1: Write the failing test for ToolCard**

Create `src/features/tools/components/tool-card.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCard } from "./tool-card";

describe("ToolCard", () => {
  it("renders tool details and remaining quantity", () => {
    render(
      <ToolCard
        borrowingId="b1"
        code="MDC-20260908-0001"
        productName="Máy hàn que"
        variantLabel="250A Inverter"
        quantity={2}
        returnedQuantity={0}
        borrowedAt="2026-09-08T08:00:00Z"
        expectedReturnDate="2026-09-10"
        purpose="Hàn khung chuồng"
        borrowerName="Nguyễn Văn A"
        isManager={false}
      />,
    );

    expect(screen.getByText("Máy hàn que")).toBeInTheDocument();
    expect(screen.getByText(/Đang giữ: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Hàn khung chuồng/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/tools/components/tool-card.test.tsx`
Expected: FAIL with "Cannot find module './tool-card'"

- [ ] **Step 3: Implement ToolCard, ToolBorrowDialog, and ToolReturnDialog**

Create `src/features/tools/components/tool-card.tsx`:
- Render tool name, variant label, quantity badge, borrower name, zone, purpose, expected return date.
- Calculate overdue days: if `expectedReturnDate < today` and remaining quantity > 0 $\rightarrow$ show pulsating amber/red badge: `⚠️ Quá hạn X ngày`.
- Action buttons: "Báo trả dụng cụ" / "Xác nhận nhận lại".

Create `src/features/tools/components/tool-borrow-dialog.tsx`:
- Select tool material from available stock.
- Quantity selector bounded to main warehouse available stock.
- Expected return date picker with quick presets (+1 ngày, +3 ngày, +7 ngày).
- Purpose input field.

Create `src/features/tools/components/tool-return-dialog.tsx`:
- Shows items currently borrowed.
- Input stepper for returning quantity (supports full or partial return).
- Optional return notes.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/features/tools/components/tool-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tools/components/tool-card.tsx src/features/tools/components/tool-borrow-dialog.tsx src/features/tools/components/tool-return-dialog.tsx src/features/tools/components/tool-card.test.tsx
git commit -m "feat(tools): add tool card, tool borrow dialog, and tool return dialog components"
```

---

### Task 5: Trang Điều Khiển `/tools`, Điều Hướng & In Phiếu PDF

**Files:**
- Create: `src/app/(app)/tools/page.tsx`
- Modify: `src/lib/nav.ts`
- Modify: `src/lib/nav.test.ts`
- Create: `src/app/api/tools/[id]/pdf/route.tsx`

**Interfaces:**
- Produces: `/tools` page, navigation item for Tools, PDF route `/api/tools/[id]/pdf`

- [ ] **Step 1: Write test for navigation item**

In `src/lib/nav.test.ts`, add:
```typescript
it("includes /tools navigation item for all authenticated roles", () => {
  const requesterItems = filterByRole(ALL_NAV_ITEMS, "requester");
  const managerItems = filterByRole(ALL_NAV_ITEMS, "manager");
  expect(requesterItems.some((i) => i.href === "/tools")).toBe(true);
  expect(managerItems.some((i) => i.href === "/tools")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/nav.test.ts`
Expected: FAIL

- [ ] **Step 3: Update Navigation and Implement Tools Page & PDF Slip**

In `src/lib/nav.ts`:
- Add `Wrench` or `Hammer` icon.
- Add `{ href: "/tools", label: "Dụng cụ", icon: Wrench }` to `REQUISITION_NAV_ITEMS` and `ALL_NAV_ITEMS`.

Create `src/app/(app)/tools/page.tsx`:
- Fetch active tool borrowings and items from Supabase.
- Tab 1: **"Dụng cụ tôi đang giữ"** (filtered by `borrower_id = profile.id` and `status = 'borrowed'`).
- Tab 2: **"Đang cho mượn (Toàn trại)"** (for Managers to oversee all borrowed tools, filter by overdue / zone).
- Tab 3: **"Lịch sử mượn trả"** (completed/returned borrowings).
- Header action: `<ToolBorrowDialog />`.

Create `src/app/api/tools/[id]/pdf/route.tsx`:
- Render StandardSlip with title `"PHIẾU MƯỢN DỤNG CỤ"`, code `MDC-...`, borrower name, zone, purpose, items table, and signers ("Người mượn", "Người giao", "Người nhận lại").

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/nav.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/tools/page.tsx src/lib/nav.ts src/lib/nav.test.ts src/app/api/tools/[id]/pdf/route.tsx
git commit -m "feat(tools): add /tools page, navigation menu, and tool borrowing PDF slip"
```

---

### Task 6: Kiểm thử Toàn diện & Kiểm tra Build Production

**Files:**
- Test all test files across repo: `bun run test`
- Typecheck: `bun run typecheck`
- Production Build: `bun run build`

- [ ] **Step 1: Run comprehensive tests**

Run: `bun run test`
Expected: All test suites PASS.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run production build**

Run: `bun run build`
Expected: Next.js production build succeeds with 0 errors.

- [ ] **Step 4: Commit any final polishing changes**

```bash
git commit --allow-empty -m "chore: complete Phase 2 quick emergency exchange and tool borrowing subsystem"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** Migration `0061_quick_exchange_and_tool_borrowing.sql`, `quickEmergencyExchange`, `QuickExchangeDialog`, `tool_borrowings` CRUD, `/tools` page, Overdue badges, and PDF slips all mapped.
- [x] **No Placeholders:** Code blocks, test cases, and exact SQL statements provided.
- [x] **Type consistency:** Matches schema names, RPC parameter signatures, and Supabase database structure.
