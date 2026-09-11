import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsersManager } from "./users-manager";
import type { Profile } from "@/lib/types";

vi.mock("@/features/auth/actions/create-user", () => ({
  createUser: vi.fn(),
}));
vi.mock("@/features/auth/actions/update-profile", () => ({
  updateProfile: vi.fn(),
}));
vi.mock("@/features/auth/actions/update-username", () => ({
  updateUsername: vi.fn(),
}));
vi.mock("@/features/auth/actions/reset-password", () => ({
  resetPassword: vi.fn(),
}));

describe("UsersManager", () => {
  const mockProfiles: Profile[] = [
    {
      id: "user-1",
      name: "Nguyễn Văn A",
      username: "nguyen.van.a",
      email: "vana@gmail.com",
      role: "requester",
      zone_id: null,
      sub_zone_id: null,
      is_active: true,
      is_protected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "user-2",
      name: "Trần Quản Lý",
      username: "tran.quanly",
      email: "quanly@minhtanphat.vn",
      role: "manager",
      zone_id: null,
      sub_zone_id: null,
      is_active: true,
      is_protected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("hiển thị cột Email và giá trị email của người dùng", () => {
    render(
      <UsersManager
        profiles={mockProfiles}
        zones={[]}
        subZones={[]}
        currentRole="manager"
      />,
    );

    // Tiêu đề cột Email
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();

    // Input email trong form tạo tài khoản
    expect(screen.getByLabelText("Email (nhận thông báo)")).toBeInTheDocument();

    // Input email trong danh sách dòng người dùng
    expect(screen.getByDisplayValue("vana@gmail.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("quanly@minhtanphat.vn")).toBeInTheDocument();
  });
});
