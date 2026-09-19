"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperuser } from "@/lib/types";
import { internalEmailForUsername } from "@/lib/username";
import { createUserSchema } from "../schema";

export async function createUser(input: {
  name: string;
  username: string;
  email?: string | null;
  role: string;
  zoneId: string | null;
  subZoneId?: string | null;
  password: string;
}) {
  const caller = await requireSuperuser();
  const parsed = createUserSchema.parse(input);
  if (!isSuperuser(caller.role)) {
    throw new Error("Chỉ tài khoản superuser được tạo tài khoản");
  }
  if (parsed.role === "superuser" && !isSuperuser(caller.role)) {
    throw new Error("Chỉ tài khoản superuser được tạo tài khoản superuser");
  }

  const admin = createAdminClient();

  // Pre-check thân thiện (index unique vẫn là hàng rào cuối)
  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", parsed.username)
    .maybeSingle();
  if (dup) throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");

  const email = internalEmailForUsername(parsed.username);
  let createdUserId: string | null = null;

  const { data: createdUser, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      name: parsed.name,
      email: parsed.email ?? null,
      role: parsed.role,
      zone_id: parsed.zoneId,
      sub_zone_id: parsed.subZoneId ?? null,
      username: parsed.username,
    },
  });

  if (error) {
    const errorMsg = (error.message || "").toLowerCase();

    // Trường hợp GoTrue báo trùng email (do Supabase Auth dùng email nội bộ username@mtp.local)
    if (
      errorMsg.includes("already been registered") ||
      errorMsg.includes("already registered") ||
      errorMsg.includes("user already exists")
    ) {
      // Tự động kiểm tra xem có tài khoản auth mồ côi trong auth.users (không có profile trong profiles) không
      const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const orphanedAuthUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );

      if (orphanedAuthUser) {
        const { data: existingProf } = await admin
          .from("profiles")
          .select("id")
          .eq("id", orphanedAuthUser.id)
          .maybeSingle();

        if (!existingProf) {
          // Xóa tài khoản auth mồ côi và tạo lại
          await admin.auth.admin.deleteUser(orphanedAuthUser.id);
          const retry = await admin.auth.admin.createUser({
            email,
            password: parsed.password,
            email_confirm: true,
            user_metadata: {
              name: parsed.name,
              email: parsed.email ?? null,
              role: parsed.role,
              zone_id: parsed.zoneId,
              sub_zone_id: parsed.subZoneId ?? null,
              username: parsed.username,
            },
          });

          if (!retry.error && retry.data?.user?.id) {
            createdUserId = retry.data.user.id;
          } else {
            throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");
          }
        } else {
          throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");
        }
      } else {
        throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");
      }
    } else {
      // Race condition: unique index lower(username) chặn ở trigger handle_new_user.
      const { data: exists } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", parsed.username)
        .maybeSingle();
      if (exists) throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");
      throw new Error(error.message);
    }
  } else if (createdUser?.user?.id) {
    createdUserId = createdUser.user.id;
  }

  // Đảm bảo dữ liệu profile tồn tại và email (tùy chọn) được lưu chính xác
  if (createdUserId) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", createdUserId)
      .maybeSingle();

    if (!prof) {
      await admin.from("profiles").insert({
        id: createdUserId,
        name: parsed.name,
        username: parsed.username,
        email: parsed.email ?? null,
        role: parsed.role,
        zone_id: parsed.zoneId,
        sub_zone_id: parsed.subZoneId ?? null,
      });
    } else if (parsed.email !== undefined) {
      await admin
        .from("profiles")
        .update({ email: parsed.email ?? null })
        .eq("id", createdUserId);
    }
  }

  revalidatePath("/admin/users");
}
