// scripts/assign-user-emails.ts — gán email doanh nghiệp hàng loạt cho các tài khoản người dùng
//
// Cách chạy:
//   pnpm tsx scripts/assign-user-emails.ts <domain> [--overwrite]
//   Hoặc:
//   pnpm tsx scripts/assign-user-emails.ts minhtanphat.vn
//
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const args = process.argv.slice(2);
const domainArg = args.find((a) => !a.startsWith("--"));
const overwrite = args.includes("--overwrite");

async function main() {
  if (!domainArg) {
    console.log(`
  Hướng dẫn sử dụng:
    pnpm tsx scripts/assign-user-emails.ts <domain> [--overwrite]

  Ví dụ:
    pnpm tsx scripts/assign-user-emails.ts minhtanphat.vn
    pnpm tsx scripts/assign-user-emails.ts congty.com --overwrite
    `);
    process.exit(1);
  }

  const domain = domainArg.trim().toLowerCase().replace(/^@/, "");

  const admin = createClient(URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Bắt đầu gán email theo tên miền: @${domain} (overwrite: ${overwrite})...`);

  let query = admin.from("profiles").select("id, name, username, email, is_active").eq("is_active", true);
  if (!overwrite) {
    query = query.is("email", null);
  }

  const { data: users, error } = await query;
  if (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("Không có tài khoản nào cần cập nhật email.");
    process.exit(0);
  }

  let count = 0;
  for (const u of users) {
    if (!u.username) continue;
    const newEmail = `${u.username.toLowerCase()}@${domain}`;
    const { error: upErr } = await admin
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", u.id);

    if (upErr) {
      console.error(`- Lỗi khi cập nhật ${u.username}:`, upErr.message);
    } else {
      console.log(`✓ Đã gán email cho [${u.name}] (${u.username}) -> ${newEmail}`);
      count++;
    }
  }

  console.log(`\nHoàn thành! Đã cập nhật thành công ${count}/${users.length} tài khoản.`);
}

main();
