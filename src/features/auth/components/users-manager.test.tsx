import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("hiển thị cột Email, nút Tạo tài khoản và mở modal form khi bấm nút", () => {
    render(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        subZones={[{ id: "sz1", zone_id: "z1", name: "Trại A1" }]}
        currentRole="manager"
      />,
    );

    // Tiêu đề cột Email trong bảng
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();

    // Giá trị email hiển thị trong danh sách người dùng
    expect(screen.getByDisplayValue("vana@gmail.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("quanly@minhtanphat.vn")).toBeInTheDocument();

    // Nút Tạo tài khoản ở góc trên bên phải
    const createBtn = screen.getByRole("button", { name: /Tạo tài khoản/i });
    expect(createBtn).toBeInTheDocument();

    // Bấm nút mở modal form tạo tài khoản
    fireEvent.click(createBtn);

    // Kiểm tra các trường trong modal
    expect(screen.getByText("Tạo tài khoản mới")).toBeInTheDocument();
    expect(screen.getByLabelText(/Họ và tên/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên đăng nhập/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu khởi tạo/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Email (nhận thông báo)")).toBeInTheDocument();
  });

  it("căn lề trên (align-top) cho các ô trong bảng để khi hiển thị ô trại không làm lệch hàng", () => {
    const { container } = render(
      <UsersManager
        profiles={[
          {
            ...mockProfiles[0],
            zone_id: "z1",
            sub_zone_id: "sz1",
          },
        ]}
        zones={[{ id: "z1", name: "Khu A" }]}
        subZones={[{ id: "sz1", zone_id: "z1", name: "Trại A1" }]}
        currentRole="manager"
      />,
    );

    const cells = container.querySelectorAll("tbody td");
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => {
      expect(cell.className).toContain("align-top");
    });
  });
});
