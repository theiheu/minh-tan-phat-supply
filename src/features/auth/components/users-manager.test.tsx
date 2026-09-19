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
vi.mock("@/features/auth/actions/delete-user", () => ({
  deleteUser: vi.fn(),
  archiveUser: vi.fn(),
  reactivateUser: vi.fn(),
  checkUserDeleteEligibility: vi.fn().mockResolvedValue({ canHardDelete: true, historyReason: null }),
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
      name: "Trần Quản Kho",
      username: "tran.quankho",
      email: "quankho@minhtanphat.vn",
      role: "warehouse",
      zone_id: null,
      sub_zone_id: null,
      is_active: true,
      is_protected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "user-3",
      name: "Lê Đã Nghỉ",
      username: "le.danghi",
      email: "danghi@gmail.com",
      role: "driver",
      zone_id: null,
      sub_zone_id: null,
      is_active: false,
      is_protected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("hiển thị cố định Họ tên và Tên đăng nhập (không cho sửa), hiển thị cột Email và mở form tạo tài khoản", () => {
    render(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="warehouse"
      />,
    );

    // Tiêu đề cột trong bảng
    expect(screen.getByRole("columnheader", { name: "Họ và tên" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tên đăng nhập" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();

    // Họ tên & Tên đăng nhập hiển thị cố định dạng text/badge (không phải input, không có @)
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("nguyen.van.a")).toBeInTheDocument();

    // Email vẫn cho phép nhập để nhận thông báo
    expect(screen.getByDisplayValue("vana@gmail.com")).toBeInTheDocument();

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
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  });

  it("hỗ trợ chuyển đổi giữa tab Đang làm việc và Đã nghỉ việc / Lưu trữ", () => {
    render(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="owner"
        currentUserId="user-super"
      />,
    );

    // Mặc định tab Đang làm việc hiển thị 2 người active
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Trần Quản Kho")).toBeInTheDocument();
    expect(screen.queryByText("Lê Đã Nghỉ")).not.toBeInTheDocument();

    // Bấm chuyển sang tab Đã nghỉ việc / Lưu trữ
    const archivedTabBtn = screen.getByText(/Đã nghỉ việc/i);
    fireEvent.click(archivedTabBtn);

    // Hiển thị người đã nghỉ và nút kích hoạt lại
    expect(screen.getByText("Lê Đã Nghỉ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kích hoạt lại/i })).toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument();
  });

  it("chỉ hiển thị nút khóa/xóa cho kế toán, chủ trại hoặc superuser (ẩn đối với quản kho)", () => {
    // 1. Quản kho (warehouse): không thấy nút xóa/khóa
    const { rerender } = render(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="warehouse"
        currentUserId="user-2"
      />,
    );
    expect(screen.queryByTitle("Khóa tài khoản / Đánh dấu nghỉ việc")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Xóa vĩnh viễn (nếu chưa có phiếu)")).not.toBeInTheDocument();

    // 2. Kế toán (accountant): thấy nút khóa và xóa trên user active
    rerender(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="accountant"
        currentUserId="user-acc"
      />,
    );
    expect(screen.getAllByTitle("Khóa tài khoản / Đánh dấu nghỉ việc")).toHaveLength(2);
    expect(screen.getAllByTitle("Xóa vĩnh viễn (nếu chưa có phiếu)")).toHaveLength(2);

    // 3. Chủ trại (owner): thấy nút khóa và xóa trên user active
    rerender(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="owner"
        currentUserId="user-owner"
      />,
    );
    expect(screen.getAllByTitle("Khóa tài khoản / Đánh dấu nghỉ việc")).toHaveLength(2);

    // 4. Quản trị hệ thống (superuser): thấy nút khóa và xóa trên user active
    rerender(
      <UsersManager
        profiles={mockProfiles}
        zones={[{ id: "z1", name: "Khu A" }]}
        currentRole="superuser"
        currentUserId="user-super"
      />,
    );
    expect(screen.getAllByTitle("Khóa tài khoản / Đánh dấu nghỉ việc")).toHaveLength(2);
  });
});
