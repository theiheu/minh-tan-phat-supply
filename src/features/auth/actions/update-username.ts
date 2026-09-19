"use server";

import { requireSuperuser } from "@/lib/auth";

export async function updateUsername(_input: { userId: string; username: string }) {
  await requireSuperuser();
  throw new Error("Tên đăng nhập không thể thay đổi sau khi đã tạo để bảo đảm tính toàn vẹn dữ liệu");
}
