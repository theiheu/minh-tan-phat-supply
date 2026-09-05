# Đăng nhập bằng tên đăng nhập (username) — bỏ email khỏi UI người dùng

- Ngày: 2026-09-05
- Trạng thái: Đã được duyệt thiết kế bởi người dùng (ngày 2026-09-05)
- Phạm vi: `src/features/auth/*`, `src/app/(auth)/login/*`, màn hình Quản trị → Người dùng, Supabase migration + RPC, `scripts/bootstrap.ts`, tài liệu README

## 1. Bối cảnh & mục tiêu

Hiện tại mọi tài khoản đều là email + mật khẩu (Supabase Auth). Manager mời người dùng bằng email → hệ thống gửi email mời → người dùng bấm link và tự đặt mật khẩu. Email xuất hiện ở: form đăng nhập, form mời, danh sách người dùng, RPC `list_requester_accounts()` (chọn người yêu cầu khi tạo phiếu dùm), và `scripts/bootstrap.ts`.

Người dùng thực tế (công nhân/nhân viên trại) không nhất thiết có email. Yêu cầu:

- Manager **tạo tài khoản đầy đủ** cho người yêu cầu: đặt **tên đăng nhập (username)** + **mật khẩu ban đầu**, tài khoản kích hoạt ngay — không gửi email mời.
- Người dùng (mọi vai trò) **đăng nhập bằng username + mật khẩu**.
- Email không còn xuất hiện ở bất kỳ UI nào của người dùng.
- **Chỉ manager** đặt/đổi lại mật khẩu (người dùng không tự đổi, không có "quên mật khẩu").

## 2. Quyết định thiết kế đã chốt (với người dùng)

1. Định danh đăng nhập = **username** do manager đặt; áp dụng cho **mọi người dùng** (cả quản lý lẫn người yêu cầu).
2. Email ẩn khỏi UI; hệ thống **tự sinh email nội bộ** `username@mtp.local` cho tài khoản mới (Supabase Auth bắt buộc có email).
3. Tài khoản cũ: **giữ nguyên email thật** trong hệ thống, chỉ được gán username → vẫn đăng nhập được bằng username. Không ghi đè/đổi email cũ.
4. Vòng đời mật khẩu: chỉ manager tạo/đổi lại. Không cho phép tự đổi mật khẩu, không có luồng quên mật khẩu.

## 3. Mô hình kỹ thuật

```
Người dùng gõ username + mật khẩu
        │
        ▼
Login action (server, anon) ──► RPC get_login_email(username)
        │                          (security definer, chỉ service_role gọi)
        │ ◄───────────────────────── email nội bộ của username đó
        ▼
supabase.auth.signInWithPassword({ email, password })  (như cũ)
```

- **Nguồn dữ liệu username:** cột mới `public.profiles.username` (unique, không phân biệt hoa thường qua index `lower(username)`). `profiles` là bảng app-side đã có (FK `auth.users.id`), được tạo tự động bởi trigger `handle_new_user` từ metadata — không đụng cấu trúc bảng `auth.users`.
- **Email nội bộ của tài khoản mới:** `username@mtp.local`, đặt ở trường email của `auth.users` lúc tạo qua Admin API, kèm `email_confirm: true` để không phát sinh luồng xác minh. Đảm bảo unique vì username là unique toàn cục.
- **Đăng nhập luôn qua tra cứu** (không dùng trực tiếp `username@mtp.local` như email mặc định) vì tài khoản cũ giữ email thật — một luồng duy nhất cho cả tài khoản cũ lẫn mới.
- RLS không đổi: mọi quyền vẫn theo `auth.uid()` → `profiles.role`.

## 4. Thay đổi chi tiết

### 4.1 Database — migration mới `supabase/migrations/0029_username_login.sql`

1. `alter table public.profiles add column username text;`
2. Backfill username cho các dòng hiện hữu từ local-part của `auth.users.email`:
   - Chuẩn hoá: lowercase; giữ `[a-z0-9._-]`; bỏ ký tự khác.
   - Chuỗi rỗng sau chuẩn hoá → sinh theo id (`user<8 ký tự đầu id>`).
   - Trùng lặp (case-insensitive) → thêm hậu tố `-2`, `-3`, … theo thứ tự `created_at`.
   - Chạy trong transaction, `on conflict` an toàn.
3. Unique index: `create unique index profiles_username_lower_idx on public.profiles (lower(username)) where username is not null;`
4. Recreate trigger function `handle_new_user`: copy thêm `raw_user_meta_data->>'username'` vào cột username.
5. RPC `public.get_login_email(p_username text) returns text` — security definer, `search_path = public`:
   - `select u.email::text from auth.users u join public.profiles p on p.id = u.id where lower(p.username) = lower(p_username) and p.is_active limit 1;`
   - Không tìm thấy → trả null (login action tự quy về lỗi chung).
   - `revoke all ... from anon, authenticated; grant execute to service_role;` (chỉ service key gọi được → không lộ email qua API công khai).
6. Sửa `list_requester_accounts()`: cột trả về `email` → `username` (kiểu `table (id uuid, name text, username text, zone_id uuid)`).

### 4.2 Quản trị → Người dùng (`users-manager.tsx`, page loader, actions, schema)

- **Form mời → Form "Tạo tài khoản"**: các trường Tên · Tên đăng nhập · Vai trò · Khu vực · Mật khẩu (manager nhập). Xoá ô email + toast "gửi lời mời".
- **Action mới `create-user.ts`** (server, `requireManager()`):
  1. Validate bằng schema mới (username + password ≥ 8 ký tự).
  2. Kiểm tra username trùng (query service role `profiles` theo `lower(username)`).
  3. `admin.auth.admin.createUser({ email: `${username}@mtp.local`, password, email_confirm: true, data: { name, role, zone_id, username } })` → trigger tạo profile kèm username.
  4. Race trùng username: nếu insert profile lỗi unique index → xoá auth user vừa tạo (admin API) → báo "Tên đăng nhập đã tồn tại".
- **Action `reset-password.ts`** (server, `requireManager()`): `admin.auth.admin.updateUserById(id, { password })`.
- **Action `update-username.ts`** (server, `requireManager()`): validate + kiểm tra trùng + cập nhật `profiles.username` (không đổi email).
- **Schema (`src/features/auth/schema.ts`)**: thay `inviteUserSchema` bằng `createUserSchema` (username + password); `updateProfileSchema` không đổi; thêm schema username dùng chung.
- **UI danh sách**: cột Email → cột "Tên đăng nhập" (username); nút "Đổi mật khẩu" và cho sửa username trên từng hàng. `page.tsx` không còn cần `admin.auth.admin.listUsers()` để lấy email → bỏ (giảm tải), profile select thêm `username`.
- Type `Profile` (`src/lib/types.ts` + `src/types/database.types.ts` regenerated) thêm `username: string | null`.

### 4.3 Trang đăng nhập (`src/app/(auth)/login/login-form.tsx` + action mới)

- Ô nhập đổi thành "Tên đăng nhập" (`autoComplete="username"`) + "Mật khẩu" (`current-password`).
- Gọi action server `login.ts`: validate → RPC `get_login_email` → `signInWithPassword` bằng server client (anon) → set cookie qua `@supabase/ssr`; thành công redirect `next`.
- Mọi lỗi (sai username/mật khẩu, tài khoản bị khóa) đều trả về thông báo chung: **"Sai tên đăng nhập hoặc mật khẩu"** (không tiết lộ username có tồn tại hay không).
- Xoá `invite-user.ts` (không dùng nữa).

### 4.4 `scripts/bootstrap.ts`

- Tạo 2 tài khoản mẫu bằng username: `manager` (role manager) và `requester` (role requester, gán zone đầu tiên), mật khẩu `password123`, email nội bộ `username@mtp.local`, `email_confirm: true`, metadata kèm `username`.
- Giữ tính idempotent: nếu username đã tồn tại thì bỏ qua.

### 4.5 Chỗ khác bị email người dùng chạm tới

- `src/app/(app)/requisitions/new/page.tsx`: comment + hiển thị hint chọn người yêu cầu → dùng `username` (RPC đã đổi).
- `src/features/requisitions/components/requisition-form.tsx`: type của `accounts` (`email` → `username`), hint hiển thị "Tên đăng nhập".
- `src/lib/env.ts`: cập nhật comment (không còn link mời qua email).
- Không đổi: email của **nhà cung cấp** (suppliers) — ngoài phạm vi.

### 4.6 Docs & types

- `README.md` mục "Khởi động": tài khoản test đăng nhập bằng username `manager` / `requester`.
- Regenerate `src/types/database.types.ts` (`bunx supabase gen types typescript --local`).
- Cập nhật `BUILD_GUIDE.md`/`DEPLOYMENT.md` ở phần nói về mời/email nếu có mô tả quy trình cũ (rà soát khi code).

## 5. Quy tắc username & mật khẩu

- Username: chữ thường `a–z`, số `0–9`, `.`, `_`, `-`; dài 3–30; **không dấu**; bắt đầu bằng chữ cái; unique không phân biệt hoa thường. Chuẩn hoá `trim().toLowerCase()` khi lưu.
- Mật khẩu: ≥ 8 ký tự (do manager nhập khi tạo/đổi lại). Không có luồng người dùng tự đổi.

## 6. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Sai username hoặc mật khẩu | Báo chung "Sai tên đăng nhập hoặc mật khẩu" |
| Username trùng khi tạo/sửa | Báo "Tên đăng nhập đã tồn tại", không tạo tài khoản |
| Username sai định dạng | Validation ngay ở form + schema |
| Tài khoản bị khóa (`is_active = false`) | Không cho đăng nhập (giống hành vi hiện tại: `get_login_email` lọc `is_active`) |
| Không phải manager gọi action tạo/sửa | `requireManager()` chặn |

## 7. Kiểm thử

- `bunx supabase db reset` (local) → migration mới + backfill + seed chạy sạch.
- Script verify thủ công (theo mẫu `scripts/verify-*.ts`): tạo user bằng action/Admin API với username → đăng nhập bằng username + mật khẩu qua auth gateway thành công.
- Đăng nhập bằng username `manager` / `requester` trên trang login.
- `bun run lint` · `bun run typecheck` · `bun run test`.

## 8. Ngoài phạm vi (explicit)

- Email nhà cung cấp (suppliers), email trong báo cáo/PDF, email trong ghi chú kiểm kê — giữ nguyên.
- Không đổi RLS, không đổi cấu trúc `auth.users` (chỉ thêm metadata `username` + cột `profiles.username`).
- Không làm luồng "đổi mật khẩu khi đăng nhập lần đầu" / tự đổi mật khẩu (đã chốt: chỉ manager).
