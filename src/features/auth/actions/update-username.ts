"use server";

import { requireManager } from "@/lib/auth";

export async function updateUsername(_input: { userId: string; username: string }) {
  await requireManager();
  throw new Error("Tên đăng nhập không thể thay đổi sau khi đã tạo để bảo đảm tính toàn vẹn dữ liệu");
}
