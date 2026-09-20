import { describe, expect, it } from "vitest";
import {
  adminDeleteDocSchema,
  adminOverrideMetaSchema,
  adminReopenDocSchema,
} from "./schema";

const VALID_UUID_1 = "47814b7e-9762-42da-91ef-07755efcfa77";
const VALID_UUID_2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const VALID_UUID_3 = "c8f2b3e4-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

describe("admin-tools schema validation", () => {
  describe("adminDeleteDocSchema", () => {
    it("accepts valid input", () => {
      const valid = {
        kind: "receipt",
        id: VALID_UUID_1,
        cascade: true,
        reason: "Xoá phiếu nhập thử nghiệm",
      };
      const parsed = adminDeleteDocSchema.parse(valid);
      expect(parsed.kind).toBe("receipt");
      expect(parsed.cascade).toBe(true);
      expect(parsed.reason).toBe("Xoá phiếu nhập thử nghiệm");
    });

    it("rejects invalid kind", () => {
      const invalid = {
        kind: "unknown_kind",
        id: VALID_UUID_1,
        reason: "Test",
      };
      expect(() => adminDeleteDocSchema.parse(invalid)).toThrow();
    });

    it("rejects invalid uuid", () => {
      const invalid = {
        kind: "issue",
        id: "not-a-uuid",
        reason: "Test",
      };
      expect(() => adminDeleteDocSchema.parse(invalid)).toThrow();
    });

    it("rejects empty reason", () => {
      const invalid = {
        kind: "requisition",
        id: VALID_UUID_1,
        reason: "",
      };
      expect(() => adminDeleteDocSchema.parse(invalid)).toThrow();
    });
  });

  describe("adminReopenDocSchema", () => {
    it("accepts valid reopen input", () => {
      const valid = {
        kind: "repair",
        id: VALID_UUID_2,
        reason: "Mở lại để điều chỉnh chi phí sửa chữa",
      };
      const parsed = adminReopenDocSchema.parse(valid);
      expect(parsed.kind).toBe("repair");
      expect(parsed.reason).toBe("Mở lại để điều chỉnh chi phí sửa chữa");
    });
  });

  describe("adminOverrideMetaSchema", () => {
    it("accepts valid meta override input", () => {
      const valid = {
        kind: "fuel_receipt",
        id: VALID_UUID_3,
        createdAt: "2026-09-08T10:00:00.000Z",
        notes: "Ghi chú điều chỉnh",
        reason: "Cập nhật ngày theo hóa đơn giấy",
      };
      const parsed = adminOverrideMetaSchema.parse(valid);
      expect(parsed.kind).toBe("fuel_receipt");
      expect(parsed.createdAt).toBe("2026-09-08T10:00:00.000Z");
      expect(parsed.notes).toBe("Ghi chú điều chỉnh");
    });
  });
});
