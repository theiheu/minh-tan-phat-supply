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
