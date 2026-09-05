// scripts/ensure-superuser.ts — tạo/đồng bộ tài khoản superuser hệ thống (is_protected).
//
// Chạy local:  SUPERUSER_PASSWORD='...' bun run scripts/ensure-superuser.ts
// Khi deploy production: chạy cùng biến môi trường SUPERUSER_PASSWORD (không commit mật khẩu).
//
// Tài khoản này có role 'superuser' (toàn quyền ngang manager, qua is_manager()) và
// is_protected = true → trigger 0033 chặn mọi đường xóa/khóa/hạ quyền/đổi username.
// Idempotent: nếu username đã tồn tại thì chỉ đảm bảo role + is_protected đúng.
import { createClient } from "@supabase/supabase-js";
import { internalEmailForUsername } from "../src/lib/username";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const USERNAME = "thieudev";
const NAME = "Dev (Quản trị hệ thống)";

const password = process.env.SUPERUSER_PASSWORD;
if (!password || password.length < 8) {
  console.error("Cần đặt SUPERUSER_PASSWORD (tối thiểu 8 ký tự). Không commit mật khẩu vào git.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await admin
  .from("profiles")
  .select("id, role, is_active, is_protected")
  .ilike("username", USERNAME)
  .maybeSingle();

if (existing) {
  // Đã tồn tại: đảm bảo role superuser + is_protected (service role, auth.uid() is null → trigger cho phép).
  const { error } = await admin
    .from("profiles")
    .update({ role: "superuser", is_protected: true, is_active: true })
    .eq("id", existing.id);
  if (error) {
    console.error("Cập nhật superuser thất bại:", error.message);
    process.exit(1);
  }
  console.log("Đã đồng bộ tài khoản superuser:", USERNAME, "(id", existing.id + ")");
} else {
  const email = internalEmailForUsername(USERNAME);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: NAME, role: "superuser", username: USERNAME },
  });
  if (error) {
    console.error("Tạo superuser thất bại:", error.message);
    process.exit(1);
  }
  if (data?.user?.id) {
    const { error: upErr } = await admin
      .from("profiles")
      .update({ role: "superuser", is_protected: true })
      .eq("id", data.user.id);
    if (upErr) {
      console.error("Đánh dấu is_protected thất bại:", upErr.message);
      process.exit(1);
    }
  }
  console.log("Đã tạo tài khoản superuser:", USERNAME, `(${email})`);
}

console.log("Xong. Đăng nhập: thieudev / <SUPERUSER_PASSWORD>");
