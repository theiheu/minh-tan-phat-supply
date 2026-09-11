import { describe, it, expect } from "vitest";
import { createUserSchema, emailSchema, updateProfileSchema } from "./schema";

describe("features/auth/schema", () => {
  describe("emailSchema", () => {
    it("chấp nhận email hợp lệ và chuẩn hoá về chữ thường", () => {
      expect(emailSchema.parse("user@example.com")).toBe("user@example.com");
      expect(emailSchema.parse("  STAFF@COMPANY.VN  ")).toBe("staff@company.vn");
    });

    it("chuyển chuỗi rỗng, null hoặc undefined thành null", () => {
      expect(emailSchema.parse("")).toBe(null);
      expect(emailSchema.parse("   ")).toBe(null);
      expect(emailSchema.parse(null)).toBe(null);
      expect(emailSchema.parse(undefined)).toBe(null);
    });

    it("báo lỗi khi email không đúng định dạng", () => {
      expect(() => emailSchema.parse("not-an-email")).toThrow();
      expect(() => emailSchema.parse("invalid@")).toThrow();
      expect(() => emailSchema.parse("@domain.com")).toThrow();
    });
  });

  describe("createUserSchema", () => {
    it("chấp nhận dữ liệu hợp lệ có email", () => {
      const parsed = createUserSchema.parse({
        name: "Nguyễn Văn A",
        username: "nguyen.van.a",
        email: "nguyenvana@gmail.com",
        role: "requester",
        zoneId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        password: "password123",
      });

      expect(parsed.email).toBe("nguyenvana@gmail.com");
      expect(parsed.username).toBe("nguyen.van.a");
    });

    it("chấp nhận dữ liệu hợp lệ khi không nhập email", () => {
      const parsed = createUserSchema.parse({
        name: "Nguyễn Văn B",
        username: "nguyen.van.b",
        email: "",
        role: "manager",
        zoneId: null,
        password: "password123",
      });

      expect(parsed.email).toBe(null);
    });
  });

  describe("updateProfileSchema", () => {
    it("chấp nhận cập nhật email người dùng", () => {
      const parsed = updateProfileSchema.parse({
        userId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        name: "Trần Văn C",
        email: "tranvanc@minhtanphat.vn",
        role: "manager",
        zoneId: null,
        isActive: true,
      });

      expect(parsed.email).toBe("tranvanc@minhtanphat.vn");
    });
  });
});
