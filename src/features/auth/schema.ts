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
  role: z.enum(["requester", "manager", "superuser"]),
  zoneId: z.string().uuid().nullable(),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1, "Tên không được trống"),
  role: z.enum(["requester", "manager", "superuser"]),
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
