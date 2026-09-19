import { describe, expect, it } from "vitest";
import {
  canDeleteDoc,
  canDeleteUsers,
  isOwner,
  isPrivileged,
  isSuperuser,
} from "./types";

describe("Role and Permission Helpers", () => {
  describe("canDeleteDoc", () => {
    it("returns true for superuser and owner", () => {
      expect(canDeleteDoc("superuser")).toBe(true);
      expect(canDeleteDoc("owner")).toBe(true);
    });

    it("returns false for non-admin roles", () => {
      expect(canDeleteDoc("warehouse")).toBe(false);
      expect(canDeleteDoc("accountant")).toBe(false);
      expect(canDeleteDoc("technician")).toBe(false);
      expect(canDeleteDoc("requester")).toBe(false);
      expect(canDeleteDoc("driver")).toBe(false);
      expect(canDeleteDoc(null)).toBe(false);
      expect(canDeleteDoc(undefined)).toBe(false);
    });
  });

  describe("canDeleteUsers", () => {
    it("returns true for superuser, owner, and accountant", () => {
      expect(canDeleteUsers("superuser")).toBe(true);
      expect(canDeleteUsers("owner")).toBe(true);
      expect(canDeleteUsers("accountant")).toBe(true);
    });

    it("returns false for other roles", () => {
      expect(canDeleteUsers("warehouse")).toBe(false);
      expect(canDeleteUsers("requester")).toBe(false);
    });
  });

  describe("isPrivileged", () => {
    it("returns true for warehouse, accountant, owner, superuser", () => {
      expect(isPrivileged("superuser")).toBe(true);
      expect(isPrivileged("owner")).toBe(true);
      expect(isPrivileged("accountant")).toBe(true);
      expect(isPrivileged("warehouse")).toBe(true);
    });

    it("returns false for non-privileged staff", () => {
      expect(isPrivileged("technician")).toBe(false);
      expect(isPrivileged("requester")).toBe(false);
      expect(isPrivileged("driver")).toBe(false);
    });
  });

  describe("isOwner and isSuperuser", () => {
    it("isOwner checks owner and superuser", () => {
      expect(isOwner("owner")).toBe(true);
      expect(isOwner("superuser")).toBe(true);
      expect(isOwner("warehouse")).toBe(false);
    });

    it("isSuperuser checks strictly superuser", () => {
      expect(isSuperuser("superuser")).toBe(true);
      expect(isSuperuser("owner")).toBe(false);
    });
  });
});
