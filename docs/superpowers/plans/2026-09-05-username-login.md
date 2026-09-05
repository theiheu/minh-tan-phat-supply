# Đăng nhập bằng username — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển toàn bộ người dùng sang đăng nhập bằng username + mật khẩu do manager đặt; email ẩn khỏi UI (Supabase Auth vẫn dùng email nội bộ phía sau).

**Architecture:** Username lưu ở cột mới `public.profiles.username` (unique case-insensitive) — `profiles` vốn được tạo tự động bởi trigger `handle_new_user` từ `auth.users` metadata nên không đụng cấu trúc `auth.users`. Tài khoản mới: manager gõ username + mật khẩu → action server (service key) `createUser` với email tự sinh `username@mtp.local` (`email_confirm: true`, không gửi email). Tài khoản cũ giữ nguyên email thật, chỉ backfill username. Đăng nhập: form server action → RPC `get_login_email(username)` (security definer, chỉ service_role) → `signInWithPassword` với email nội bộ. Mọi quyền vẫn theo `auth.uid()` → RLS không đổi.

**Tech Stack:** Next.js 15 App Router · Supabase (Auth + Postgres RPC) · TypeScript strict · Zod · shadcn/ui · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-09-05-username-login-design.md`

## Global Constraints

- Chạy mọi lệnh từ **repo root** `/home/thehi/minh-tan-phat-supply`.
- Supabase local phải đang chạy khi dùng `db reset`/`gen types`/psql: nếu chưa, chạy `bunx supabase start` (CLI 2.116.0; binary cache: `~/.bun/install/cache/@supabase/cli-linux-x64@*/bin/supabase`).
- psql vào DB local: `docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "<sql>"`.
- Username: chữ thường `a-z`, `0-9`, `.`, `_`, `-`; 3–30 ký tự; **không dấu**; bắt đầu bằng chữ cái; chuẩn hoá `trim().toLowerCase()`; regex: `^[a-z][a-z0-9._-]{2,29}$`. Mật khẩu ≥ 8 ký tự.
- Email nội bộ tài khoản mới = `username@mtp.local`. Không gửi/xác minh email.
- Chỉ manager được tạo tài khoản/đổi mật khẩu/đổi username (mọi action server gọi `requireManager()`). Trang đăng nhập: mọi lỗi đều báo **"Sai tên đăng nhập hoặc mật khẩu"**.
- KHÔNG đổi: email nhà cung cấp (`suppliers`), RLS, cấu trúc bảng `auth.users` (chỉ thêm metadata `username`).
- Conventional Commits (feat/fix/docs/chore). Sau mỗi task chạy `bun run typecheck` (trừ khi task nói rõ cách khác) rồi commit riêng.
- Không commit các file sửa dở KHÔNG liên quan hiện có trong working tree (7 file ở `src/app/(app)/products|reports`, `src/features/products/*`, `src/features/requisitions/components/requisition-form.tsx`, `src/stores/cart-store.ts`) — chỉ `git add` đúng file của task.

---

### Task 1: Migration 0029 — cột `profiles.username` + backfill + RPC `get_login_email`

**Files:**
- Create: `supabase/migrations/0029_username_login.sql`

**Interfaces:**
- Produces: cột `public.profiles.username text NOT NULL`, unique index `lower(username)`; trigger `handle_new_user` nhận `user_metadata.username` (fallback local-part email); RPC `public.get_login_email(text) -> text` (service_role only); RPC `public.admin_update_username(uuid, text)` (manager-only); `list_requester_accounts()` giờ trả `(id uuid, name text, username text, zone_id uuid)`.

- [ ] **Step 1: Tạo file migration**

```sql
-- 0029_username_login.sql — đăng nhập bằng tên đăng nhập (username)
-- Username nằm ở public.profiles; email nội bộ username@mtp.local cho tài khoản mới.

alter table public.profiles add column username text;

-- Backfill username từ local-part email (chuẩn hoá, xử lý trùng lặp)
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in
    select p.id, p.created_at, lower(u.email::text) as email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
    order by p.created_at, p.id
  loop
    base := lower(regexp_replace(split_part(coalesce(r.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'));
    if base = '' then
      base := 'user' || left(replace(r.id::text, '-', ''), 8);
    end if;
    if not (base ~ '^[a-z]') then
      base := 'u' || base;
    end if;
    base := left(base, 30);
    cand := base;
    n := 2;
    while exists (select 1 from public.profiles where lower(username) = lower(cand)) loop
      cand := left(base, greatest(1, 30 - length(n::text) - 1)) || '-' || n;
      n := n + 1;
    end loop;
    update public.profiles set username = cand where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column username set not null;

create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- Trigger: copy username từ user_metadata (fallback: local-part email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := nullif(trim(lower(new.raw_user_meta_data->>'username')), '');
  if v_username is null then
    v_username := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  insert into public.profiles (id, name, role, zone_id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid,
    v_username
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- RPC tra email nội bộ khi đăng nhập — chỉ service_role gọi được (không lộ email qua API anon)
create or replace function public.get_login_email(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
    and p.is_active
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
revoke all on function public.get_login_email(text) from anon, authenticated;
grant execute on function public.get_login_email(text) to service_role;

-- Đổi username (manager-only qua RLS guard; index unique chặn trùng)
create or replace function public.admin_update_username(p_user_id uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_username is null or length(trim(p_username)) = 0 or p_username !~ '^[a-z][a-z0-9._-]{2,29}$' then
    raise exception 'Tên đăng nhập không hợp lệ';
  end if;
  update public.profiles set username = lower(trim(p_username)) where id = p_user_id;
end;
$$;

-- list_requester_accounts: trả username thay email
create or replace function public.list_requester_accounts()
returns table (id uuid, name text, username text, zone_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, p.username, p.zone_id
    from public.profiles p
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;
```

- [ ] **Step 2: Reset DB để áp migration từ đầu (môi trường dev)**

Run: `bunx supabase db reset`
Expected: áp tuần tự 0028 → 0029, seed xong, "Finished supabase db reset on branch main."

- [ ] **Step 3: Kiểm chứng bằng psql**

Run:
```bash
docker exec supabase_db_minh-tan-phat-supply psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select column_name from information_schema.columns where table_name='profiles' and column_name='username';" \
 -c "select indexname from pg_indexes where tablename='profiles' and indexname='profiles_username_lower_idx';" \
 -c "select p.username, u.email from public.profiles p join auth.users u on u.id=p.id order by u.email;" \
 -c "select public.get_login_email('manager');"
```
Expected: username column + index tồn tại; bảng username/email; `get_login_email('manager')` trả đúng email tài khoản manager (seed tạo `manager@mtp.local` → username `manager` sau backfill).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0029_username_login.sql
git commit -m "feat(db): username login — cột profiles.username, backfill, RPC get_login_email"
```

---

### Task 2: Regenerate database types + cập nhật chỗ dùng `list_requester_accounts`

**Files:**
- Modify: `src/types/database.types.ts` (regenerated)
- Modify: `src/features/requisitions/components/requisition-form.tsx` (type `accounts`, hint email → username, 2 comment)
- Modify: `src/app/(app)/requisitions/new/page.tsx` (comment)

**Interfaces:**
- Consumes: RPC mới từ Task 1.
- Produces: `Profile.username: string | null`; `list_requester_accounts` trả `{id,name,username,zone_id}[]`. Giữ main typecheck xanh sau khi type thay đổi.

- [ ] **Step 1: Regenerate database types**

Run: `bunx supabase gen types typescript --local > src/types/database.types.ts`
Expected: file được ghi đè; `profiles` Row có `username: string | null`; `list_requester_accounts` trong Functions trả cột `username`.

- [ ] **Step 2: Sửa `requisition-form.tsx` (3 chỗ)**

Thay type prop `accounts`:
```tsx
  accounts?: { id: string; name: string | null; username: string; zone_id: string | null }[];
```
Thay comment `// MẶC ĐỊNH: ... (kèm email).` → `// MẶC ĐỊNH: phiếu là của tài khoản đang đăng nhập. Chỉ khi "làm cho người khác" mới chọn tài khoản khác từ danh sách (hiện tên đăng nhập).`
Thay map hint:
```tsx
    .map((a) => ({ value: a.id, label: a.name as string, hint: a.username }));
```
Thay `searchPlaceholder="Gõ tên hoặc email để tìm…"` → `searchPlaceholder="Gõ tên hoặc tên đăng nhập để tìm…"`

- [ ] **Step 3: Sửa comment `src/app/(app)/requisitions/new/page.tsx`**

Thay:
```ts
  // Danh sách tài khoản người yêu cầu (kèm email) — RPC chỉ cho manager.
```
bằng:
```ts
  // Danh sách tài khoản người yêu cầu (kèm tên đăng nhập) — RPC chỉ cho manager.
```

- [ ] **Step 4: Verify & commit**

Run: `bun run typecheck`
Expected: không lỗi TS.
```bash
git add src/types/database.types.ts src/features/requisitions/components/requisition-form.tsx "src/app/(app)/requisitions/new/page.tsx"
git commit -m "chore(types): regen database types username; requisition picker hiện tên đăng nhập"
```

---

### Task 3: Util username (TDD) + schema auth mới

**Files:**
- Create: `src/lib/username.ts`
- Test: `src/lib/username.test.ts`
- Modify: `src/features/auth/schema.ts` (thay toàn bộ invite schema)

**Interfaces:**
- Produces: `USERNAME_RE`, `normalizeUsername(raw): string`, `isValidUsername(raw): boolean`, `internalEmailForUsername(username): string` (`username@mtp.local`); schema: `createUserSchema`, `updateUsernameSchema`, `resetPasswordSchema`, `updateProfileSchema` (giữ nguyên), type exports.

- [ ] **Step 1: Viết test fail trước**

`src/lib/username.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername, internalEmailForUsername } from "./username";

describe("username", () => {
  it("normalize: trim + lowercase", () => {
    expect(normalizeUsername("  Nguyen.Van.A ")).toBe("nguyen.van.a");
  });

  it("chấp nhận username hợp lệ", () => {
    expect(isValidUsername("manager")).toBe(true);
    expect(isValidUsername("nguyen.van_a-2")).toBe(true);
    expect(isValidUsername("a1")).toBe(false); // < 3 ký tự
    expect(isValidUsername("nguyễn")).toBe(false); // có dấu
    expect(isValidUsername("1abc")).toBe(false); // phải bắt đầu bằng chữ
    expect(isValidUsername("has space")).toBe(false);
    expect(isValidUsername("UPPER")).toBe(false); // phải chữ thường
    expect(isValidUsername("x".repeat(31))).toBe(false); // quá dài
  });

  it("sinh email nội bộ", () => {
    expect(internalEmailForUsername("requester")).toBe("requester@mtp.local");
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `bun run test src/lib/username.test.ts`
Expected: FAIL, module `./username` không tồn tại.

- [ ] **Step 3: Viết `src/lib/username.ts`**

```ts
// Quy tắc tên đăng nhập: chữ thường a-z, số, . _ - ; 3-30 ký tự; không dấu;
// bắt đầu bằng chữ cái. Lưu luôn dạng lowercase (chuẩn hoá khi tạo/sửa).
export const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

export const EMAIL_DOMAIN = "mtp.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

// Email nội bộ cho Supabase Auth (ẩn khỏi UI). Tài khoản cũ giữ email thật.
export function internalEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `bun run test src/lib/username.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Viết lại `src/features/auth/schema.ts` (thay toàn bộ nội dung)**

```ts
import { z } from "zod";
import { USERNAME_RE } from "@/lib/username";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Tên đăng nhập tối thiểu 3 ký tự")
  .max(30, "Tên đăng nhập tối đa 30 ký tự")
  .regex(
    USERNAME_RE,
    "Tên đăng nhập chỉ gồm chữ thường không dấu (a-z), số, . _ - và bắt đầu bằng chữ cái",
  );

export const passwordSchema = z.string().min(8, "Mật khẩu tối thiểu 8 ký tự");

export const createUserSchema = z.object({
  name: z.string().min(1, "Tên không được trống"),
  username: usernameSchema,
  role: z.enum(["requester", "manager"]),
  zoneId: z.string().uuid().nullable(),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1, "Tên không được trống"),
  role: z.enum(["requester", "manager"]),
  zoneId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export const updateUsernameSchema = z.object({
  userId: z.string().uuid(),
  username: usernameSchema,
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUsernameInput = z.infer<typeof updateUsernameSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// TODO(Task 5): xoá cùng invite-user.ts — chỉ giữ tạm để invite-user.ts còn compile
export const inviteUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được trống"),
  role: z.enum(["requester", "manager"]),
  zoneId: z.string().uuid().nullable(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
```

- [ ] **Step 6: Verify & commit**

Run: `bun run typecheck`
Expected: xanh (invite-user.ts vẫn import `inviteUserSchema` được giữ tạm; users-manager chưa đổi — sẽ đổi ở Task 5).
```bash
git add src/lib/username.ts src/lib/username.test.ts src/features/auth/schema.ts
git commit -m "feat(auth): util username + schema tạo tài khoản/đổi mật khẩu"
```

---

### Task 4: Server actions auth (login, create-user, reset-password, update-username)

**Files:**
- Create: `src/features/auth/actions/login.ts`
- Create: `src/features/auth/actions/create-user.ts`
- Create: `src/features/auth/actions/reset-password.ts`
- Create: `src/features/auth/actions/update-username.ts`
- Delete: `src/features/auth/actions/invite-user.ts`
- Modify: `src/lib/env.ts` (bỏ helper `getSiteUrl` + comment cũ)

**Interfaces:**
- Consumes: `createUserSchema`/`updateUsernameSchema`/`resetPasswordSchema` (Task 3), `internalEmailForUsername` (Task 3), RPC `get_login_email` (Task 1).
- Produces:
  - `loginAction(prev: {error: string|null}, formData: FormData) -> Promise<{error: string|null}>` (redirect nội bộ khi thành công)
  - `createUser(input: CreateUserInput): Promise<void>` — throw Error("Tên đăng nhập đã tồn tại") khi trùng
  - `resetPassword(input: ResetPasswordInput): Promise<void>`
  - `updateUsername(input: UpdateUsernameInput): Promise<void>`

- [ ] **Step 1: Viết `src/features/auth/actions/login.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "Sai tên đăng nhập hoặc mật khẩu" };
  }

  const admin = createAdminClient();
  const { data: email } = await admin.rpc("get_login_email", { p_username: username });
  if (!email) {
    return { error: "Sai tên đăng nhập hoặc mật khẩu" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Sai tên đăng nhập hoặc mật khẩu" };
  }

  redirect(safeNext(formData.get("next")));
}
```

- [ ] **Step 2: Viết `src/features/auth/actions/create-user.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalEmailForUsername } from "@/lib/username";
import { createUserSchema } from "../schema";

export async function createUser(input: {
  name: string;
  username: string;
  role: string;
  zoneId: string | null;
  password: string;
}) {
  await requireManager();
  const parsed = createUserSchema.parse(input);

  const admin = createAdminClient();

  // Pre-check thân thiện (index unique vẫn là hàng rào cuối)
  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", parsed.username)
    .maybeSingle();
  if (dup) throw new Error("Tên đăng nhập đã tồn tại");

  const email = internalEmailForUsername(parsed.username);
  const { error } = await admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      name: parsed.name,
      role: parsed.role,
      zone_id: parsed.zoneId,
      username: parsed.username,
    },
  });

  if (error) {
    // Race: unique index lower(username) chặn ở trigger handle_new_user
    if (/duplicate key|already exists|23505/i.test(error.message)) {
      throw new Error("Tên đăng nhập đã tồn tại");
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}
```

- [ ] **Step 3: Viết `src/features/auth/actions/reset-password.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetPasswordSchema } from "../schema";

export async function resetPassword(input: { userId: string; password: string }) {
  await requireManager();
  const parsed = resetPasswordSchema.parse(input);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(parsed.userId, {
    password: parsed.password,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
```

- [ ] **Step 4: Viết `src/features/auth/actions/update-username.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateUsernameSchema } from "../schema";

export async function updateUsername(input: { userId: string; username: string }) {
  await requireManager();
  const parsed = updateUsernameSchema.parse(input);

  // Chỉ manager; đổi username KHÔNG đổi email auth.users (đăng nhập luôn tra
  // username → email qua get_login_email nên vẫn hoạt động).
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_username", {
    p_user_id: parsed.userId,
    p_username: parsed.username,
  });
  if (error) {
    if (/duplicate key|23505/i.test(error.message)) throw new Error("Tên đăng nhập đã tồn tại");
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}
```

- [ ] **Step 5: Không xoá gì thêm ở task này**

`invite-user.ts` và `getSiteUrl()` (chỉ mình nó dùng) sẽ bị xoá ở **Task 5** cùng lúc swap UI — giữ nguyên để typecheck luôn xanh sau mỗi commit. Không sửa `src/lib/env.ts` ở task này.

- [ ] **Step 6: Verify & commit**

Run: `bun run typecheck`
Expected: xanh (nếu theo phương án "dời xoá getSiteUrl sang Task 5" thì không cần sửa invite-user.ts).
```bash
git add src/features/auth/actions/login.ts src/features/auth/actions/create-user.ts src/features/auth/actions/reset-password.ts src/features/auth/actions/update-username.ts
git commit -m "feat(auth): server actions login/create-user/reset-password/update-username"
```

---

### Task 5: UI Quản trị → Người dùng (tạo tài khoản + cột username + đổi mật khẩu)

**Files:**
- Modify: `src/features/auth/components/users-manager.tsx` (thay toàn bộ)
- Modify: `src/app/(app)/admin/users/page.tsx`

**Interfaces:**
- Consumes: `createUser`, `resetPassword`, `updateUsername`, `updateProfile` (actions Task 4 + cũ), `Profile` (đã có `username`).
- Produces: giao diện hoàn chỉnh màn Quản trị → Người dùng.

- [ ] **Step 1: Thay toàn bộ `users-manager.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createUser } from "@/features/auth/actions/create-user";
import { resetPassword } from "@/features/auth/actions/reset-password";
import { updateUsername } from "@/features/auth/actions/update-username";
import { updateProfile } from "@/features/auth/actions/update-profile";
import type { Profile } from "@/lib/types";

type ZoneOption = { id: string; name: string };

const ROLE_OPTIONS = [
  { value: "requester", label: "Người yêu cầu" },
  { value: "manager", label: "Quản lý kho" },
];

function CreateAccountForm({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("requester");
  const [zoneId, setZoneId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createUser({ name, username, role, zoneId, password });
        toast.success(`Đã tạo tài khoản ${username.trim().toLowerCase()}`);
        setName("");
        setUsername("");
        setPassword("");
        setRole("requester");
        setZoneId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo tài khoản thất bại");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tạo tài khoản mới</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="cu-name">Tên</Label>
            <Input id="cu-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Tên đăng nhập</Label>
            <Input
              id="cu-username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z][a-z0-9._-]{2,29}"
              title="Chữ thường không dấu, số, . _ - ; bắt đầu bằng chữ cái"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="nguyen.van.a"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Mật khẩu</Label>
            <Input
              id="cu-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Khu vực</Label>
            <Select value={zoneId ?? "none"} onValueChange={(v) => setZoneId(v === "none" ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Không —</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Đang tạo…" : "Tạo tài khoản"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ profile, zones }: { profile: Profile; zones: ZoneOption[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [role, setRole] = useState(profile.role);
  const [zoneId, setZoneId] = useState<string | null>(profile.zone_id);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [resettingPw, setResettingPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function save() {
    startTransition(async () => {
      try {
        const un = username.trim().toLowerCase();
        if (un !== profile.username) {
          await updateUsername({ userId: profile.id, username: un });
        }
        await updateProfile({ userId: profile.id, name, role, zoneId, isActive });
        toast.success("Đã cập nhật người dùng");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cập nhật thất bại");
      }
    });
  }

  function savePassword() {
    startTransition(async () => {
      try {
        await resetPassword({ userId: profile.id, password: newPassword });
        toast.success("Đã đặt lại mật khẩu");
        setNewPassword("");
        setResettingPw(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Đặt lại mật khẩu thất bại");
      }
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="min-w-[160px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </TableCell>
        <TableCell className="min-w-[140px]">
          <Input
            value={username}
            minLength={3}
            maxLength={30}
            pattern="[a-z][a-z0-9._-]{2,29}"
            onChange={(e) => setUsername(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={zoneId ?? "none"} onValueChange={(v) => setZoneId(v === "none" ? null : v)}>
            <SelectTrigger className="w-full min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Không —</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 accent-primary"
            />
            {isActive ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Hoạt động</Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-500">Đã khóa</Badge>
            )}
          </label>
        </TableCell>
        <TableCell className="min-w-[170px]">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={save} disabled={pending}>
                {pending ? "…" : "Lưu"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResettingPw((v) => !v);
                  setNewPassword("");
                }}
              >
                Đổi mật khẩu
              </Button>
            </div>
            {resettingPw && (
              <div className="flex gap-1.5">
                <Input
                  type="password"
                  minLength={8}
                  placeholder="Mật khẩu mới (≥8)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 w-40"
                />
                <Button size="sm" onClick={savePassword} disabled={pending || newPassword.length < 8}>
                  Lưu
                </Button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

export function UsersManager({ profiles, zones }: { profiles: Profile[]; zones: ZoneOption[] }) {
  return (
    <div className="space-y-4">
      <CreateAccountForm zones={zones} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách người dùng</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Khu vực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} zones={zones} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Thay toàn bộ `src/app/(app)/admin/users/page.tsx`**

```tsx
import { UsersManager } from "@/features/auth/components/users-manager";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireManager();

  const supabase = await createClient();
  const [{ data: profiles }, { data: zones }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("zones").select("id, name").order("name"),
  ]);

  return <UsersManager profiles={profiles ?? []} zones={zones ?? []} />;
}
```

- [ ] **Step 3: Xoá invite-user.ts + dọn schema/env (xoá luôn `inviteUserSchema` và `getSiteUrl` — không còn nơi dùng)**

```bash
git rm src/features/auth/actions/invite-user.ts
```
Trong `src/features/auth/schema.ts`: xoá block "TODO(Task 5)" gồm `inviteUserSchema` + type `InviteUserInput`.
Trong `src/lib/env.ts`: xoá block
```ts
// URL gốc của app (dùng cho link redirect trong email mời, v.v.).
// Local mặc định http://localhost:3000; production set qua NEXT_PUBLIC_SITE_URL.
export function getSiteUrl(): string {
  return getPublicEnv().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
```
(Không xoá `NEXT_PUBLIC_SITE_URL` khỏi schema/env — Dockerfile và `.env.example` vẫn dùng nó.)

- [ ] **Step 4: Verify & commit**

Run: `bun run typecheck && bun run lint`
Expected: xanh.
```bash
git add src/features/auth/components/users-manager.tsx "src/app/(app)/admin/users/page.tsx" src/features/auth/schema.ts src/lib/env.ts
git commit -m "feat(admin): tạo tài khoản username + mật khẩu, đổi mật khẩu; bỏ invite email"
```

---

### Task 6: Trang đăng nhập bằng username

**Files:**
- Modify: `src/app/(auth)/login/login-form.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `loginAction`/`LoginState` từ `src/features/auth/actions/login.ts` (Task 4).

- [ ] **Step 1: Thay toàn bộ `login-form.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/features/auth/actions/login";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Đăng nhập</CardTitle>
        <CardDescription>Hệ thống quản lý kho Trại gà Minh Tân Phát</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div className="space-y-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              name="username"
              required
              autoComplete="username"
              placeholder="nguyen.van.a"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify & commit**

Run: `bun run typecheck && bun run lint`
Expected: xanh.
```bash
git add "src/app/(auth)/login/login-form.tsx"
git commit -m "feat(login): đăng nhập bằng tên đăng nhập + mật khẩu"
```

---

### Task 7: Bootstrap + verify script + docs + chạy kiểm thử toàn cục

**Files:**
- Modify: `scripts/bootstrap.ts`
- Create: `scripts/verify-username-login.ts`
- Modify: `README.md`
- Modify: `DEPLOYMENT.md` (mục §7 liên quan mời user/SMTP)
- Modify: `BUILD_GUIDE.md` (chỉ các đoạn mô tả quy trình mời user bằng email — nếu có)

**Interfaces:**
- Consumes: `internalEmailForUsername`, `get_login_email`, trigger username.

- [ ] **Step 1: Thay toàn bộ `scripts/bootstrap.ts`**

```ts
// scripts/bootstrap.ts — tạo tài khoản mẫu cho local dev (chỉ chạy local).
// Chạy: bun run scripts/bootstrap.ts
// Tài khoản đăng nhập bằng TÊN ĐĂNG NHẬP: manager / requester (mật khẩu password123).
import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/username";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser(
  username: string,
  password: string,
  name: string,
  role: "requester" | "manager",
  zoneId: string | null,
) {
  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (dup) {
    console.log("đã tồn tại:", username);
    return;
  }
  const email = internalEmailForUsername(username);
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, zone_id: zoneId, username },
  });
  if (error) console.error("lỗi:", username, error.message);
  else console.log("đã tạo:", username, `(${email})`);
}

const { data: zones } = await admin.from("zones").select("id").limit(1);
const zoneId = zones?.[0]?.id ?? null;

await ensureUser("manager", "password123", "Quản lý kho", "manager", null);
await ensureUser("requester", "password123", "Người yêu cầu", "requester", zoneId);
console.log("Xong. Đăng nhập: manager / password123 hoặc requester / password123");
```

- [ ] **Step 2: Tạo `scripts/verify-username-login.ts`**

```ts
// scripts/verify-username-login.ts — kiểm chứng đăng nhập bằng username.
// Chạy: bun run scripts/bootstrap.ts && bun run scripts/verify-username-login.ts
import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/username";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

async function verify(username: string, password: string) {
  const { data: email, error: rpcErr } = await admin.rpc("get_login_email", { p_username: username });
  assert(!rpcErr, `get_login_email('${username}') không lỗi`);
  assert(email === internalEmailForUsername(username), `email nội bộ của '${username}' = ${email}`);

  const { data: session, error: signErr } = await anon.auth.signInWithPassword({ email: email!, password });
  assert(!signErr && !!session.session, `đăng nhập '${username}' + mật khẩu đúng thành công`);

  const { data: missing } = await admin.rpc("get_login_email", { p_username: "khong-ton-tai" });
  assert(missing === null, "username không tồn tại trả null");
}

await verify("manager", "password123");
await verify("requester", "password123");
console.log("Xong — đăng nhập bằng username hoạt động.");
```

- [ ] **Step 3: Cập nhật `README.md`**

Thay dòng tài khoản test trong mục "Khởi động":
```md
Tài khoản test (local): `bun run scripts/bootstrap.ts` tạo `manager` và `requester` (mật khẩu `password123`) — **đăng nhập bằng tên đăng nhập**, không cần email. Mời thêm người dùng tại màn hình Quản trị → Người dùng.
```
bằng:
```md
Tài khoản test (local): `bun run scripts/bootstrap.ts` tạo tài khoản `manager` và `requester` (mật khẩu `password123`) — đăng nhập bằng **tên đăng nhập** (không cần email). Quản lý tạo tài khoản + mật khẩu cho người dùng tại màn hình Quản trị → Người dùng.
```

- [ ] **Step 4: Cập nhật `DEPLOYMENT.md` §7**

Thay đoạn mô tả "tạo user thật bằng màn hình Quản trị → Người dùng → Mời (gửi email qua SMTP đã cấu hình ở bước 4)" bằng mô tả tạo tài khoản trực tiếp: username + mật khẩu do manager đặt, không cần SMTP/email mời. (Đọc quanh §7 rồi sửa câu văn tương ứng, giữ nguyên phần bootstrap.)

- [ ] **Step 5: Rà `BUILD_GUIDE.md`**

Run: `grep -n "mời\|invite\|email mời\|gửi email" BUILD_GUIDE.md | head -30`
Nếu có đoạn mô tả quy trình mời người dùng bằng email → sửa ngắn gọn thành "quản lý tạo tài khoản: username + mật khẩu". Nếu chỉ nhắc email ở ngữ cảnh khác (báo cáo/nhà cung cấp) → không đụng.

- [ ] **Step 6: Chạy kiểm chứng toàn cục**

```bash
bun run scripts/bootstrap.ts          # tạo manager/requester mới theo username
bun run scripts/verify-username-login.ts
bun run test
bun run lint
bun run typecheck
```
Expected: verify in ra `ok: ...` và "Xong"; `test`/`lint`/`typecheck` xanh.

- [ ] **Step 7: Commit**

```bash
git add scripts/bootstrap.ts scripts/verify-username-login.ts README.md DEPLOYMENT.md BUILD_GUIDE.md
git commit -m "feat(scripts): bootstrap/verify theo username; docs cập nhật đăng nhập không email"
```

---

### Task 8: QA thủ công trên app đang chạy

**Files:** không đổi file — chỉ kiểm chứng.

- [ ] **Step 1: Đảm bảo app + supabase đang chạy** (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login` = 200; `curl -s http://127.0.0.1:54321/auth/v1/health` OK). Nếu chưa: `bun run dev:up` (script có sẵn) hoặc `bunx supabase start` + `bun run dev`.
- [ ] **Step 2: Trình duyệt mở `http://localhost:3000/login`** — form phải là "Tên đăng nhập" + "Mật khẩu" (không còn ô email).
- [ ] **Step 3: Đăng nhập `requester` / `password123`** → vào trang được phép; đăng xuất.
- [ ] **Step 4: Đăng nhập `manager` / `password123`** → vào **Quản trị → Người dùng**: form "Tạo tài khoản mới" (không có email); tạo thử user username `test.qa` + mật khẩu ≥8 → xuất hiện trong danh sách với cột "Tên đăng nhập"; thử tạo trùng `test.qa` → báo "Tên đăng nhập đã tồn tại"; thử "Đổi mật khẩu" cho user đó → đăng xuất → đăng nhập `test.qa` bằng mật khẩu mới thành công.
- [ ] **Step 5: Đăng nhập sai username/mật khẩu** → thông báo "Sai tên đăng nhập hoặc mật khẩu".
- [ ] **Step 6: Dọn user QA** — vào Quản trị → Người dùng khoá (is_active=false) `test.qa` (hoặc reset DB nếu không cần giữ) để không sót dữ liệu thử.
