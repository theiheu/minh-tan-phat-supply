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
