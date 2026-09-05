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
