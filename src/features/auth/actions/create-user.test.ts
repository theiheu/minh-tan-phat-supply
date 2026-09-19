import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUser } from "./create-user";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockRequireSuperuser = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireSuperuser: () => mockRequireSuperuser(),
}));

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockListUsers = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        listUsers: mockListUsers,
      },
    },
    from: mockAdminFrom,
  }),
}));

describe("createUser Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chặn người dùng không phải superuser tạo tài khoản superuser", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "caller-1", role: "warehouse" });

    await expect(
      createUser({
        name: "Super Admin Test",
        username: "superadmintest",
        email: null,
        role: "superuser",
        zoneId: null,
        password: "password12345",
      }),
    ).rejects.toThrow("Chỉ tài khoản superuser");
  });

  it("báo lỗi thân thiện bằng tiếng Việt khi tên đăng nhập đã tồn tại trong profiles", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "caller-1", role: "superuser" });

    mockAdminFrom.mockReturnValue({
      select: () => ({
        ilike: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: "existing-user" } }),
        }),
      }),
    });

    await expect(
      createUser({
        name: "Nguyễn Văn A",
        username: "nguyen.van.a",
        email: null,
        role: "requester",
        zoneId: null,
        password: "password12345",
      }),
    ).rejects.toThrow("Tên đăng nhập đã tồn tại trong hệ thống");
  });

  it("tạo tài khoản thành công khi KHÔNG nhập email (email = null hoặc rỗng)", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "caller-1", role: "superuser" });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "new-user-123" } }),
            }),
          }),
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      return {};
    });

    mockCreateUser.mockResolvedValue({
      data: { user: { id: "new-user-123" } },
      error: null,
    });

    await createUser({
      name: "Nguyễn Văn B",
      username: "nguyen.van.b",
      email: null,
      role: "warehouse",
      zoneId: null,
      password: "password12345",
    });

    // Supabase Auth được gọi với email nội bộ @mtp.local
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: "nguyen.van.b@mtp.local",
      password: "password12345",
      email_confirm: true,
      user_metadata: {
        name: "Nguyễn Văn B",
        email: null,
        role: "warehouse",
        zone_id: null,
        sub_zone_id: null,
        username: "nguyen.van.b",
      },
    });
  });

  it("chuyển đổi thông báo lỗi tiếng Anh của GoTrue (A user with this email address has already been registered) sang tiếng Việt", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "caller-1", role: "superuser" });

    mockAdminFrom.mockReturnValue({
      select: () => ({
        ilike: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: "user-exists-in-profiles" } }),
        }),
      }),
    });

    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });

    mockListUsers.mockResolvedValue({
      data: {
        users: [{ id: "user-exists-in-profiles", email: "nguyen.van.c@mtp.local" }],
      },
    });

    await expect(
      createUser({
        name: "Nguyễn Văn C",
        username: "nguyen.van.c",
        email: "",
        role: "technician",
        zoneId: null,
        password: "password12345",
      }),
    ).rejects.toThrow("Tên đăng nhập đã tồn tại trong hệ thống");
  });

  it("tự động dọn dẹp tài khoản auth mồ côi (không có profile) và tạo lại tài khoản thành công", async () => {
    mockRequireSuperuser.mockResolvedValue({ id: "caller-1", role: "superuser" });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    // Ban đầu createUser báo email đã tồn tại trong auth.users
    mockCreateUser
      .mockResolvedValueOnce({
        data: null,
        error: { message: "A user with this email address has already been registered" },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "recreated-user-456" } },
        error: null,
      });

    mockListUsers.mockResolvedValue({
      data: {
        users: [{ id: "orphaned-auth-id", email: "orphaned.user@mtp.local" }],
      },
    });

    mockDeleteUser.mockResolvedValue({ error: null });

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
            eq: () => ({
              // orphanedAuthUser không có profile trong profiles
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
          insert: mockInsert,
        };
      }
      return {};
    });

    await createUser({
      name: "Orphan User",
      username: "orphaned.user",
      email: null,
      role: "technician",
      zoneId: null,
      password: "password12345",
    });

    expect(mockDeleteUser).toHaveBeenCalledWith("orphaned-auth-id");
    expect(mockCreateUser).toHaveBeenCalledTimes(2);
    expect(mockInsert).toHaveBeenCalled();
  });
});
