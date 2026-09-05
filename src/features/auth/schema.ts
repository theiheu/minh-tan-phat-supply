import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được trống"),
  role: z.enum(["requester", "manager"]),
  zoneId: z.string().uuid().nullable(),
});

export const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1, "Tên không được trống"),
  role: z.enum(["requester", "manager"]),
  zoneId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
