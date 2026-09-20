import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDocTools } from "./admin-doc-tools";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../actions", () => ({
  adminDeleteDocAction: vi.fn().mockResolvedValue({ ok: true }),
  adminReopenDocAction: vi.fn().mockResolvedValue({ ok: true }),
  adminInspectDocAction: vi.fn().mockResolvedValue({
    document: { id: "123", code: "TEST-01" },
    dependencies: [],
    movements_count: 0,
    can_direct_delete: true,
  }),
}));

describe("AdminDocTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isAdmin and isDev are false", () => {
    const { container } = render(
      <AdminDocTools
        kind="requisition"
        id="req-123"
        code="YCVT-001"
        docName="phiếu yêu cầu"
        canReopen={true}
        isAdmin={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders delete, reopen, and can thiep buttons when isAdmin is true and canReopen is true", () => {
    render(
      <AdminDocTools
        kind="issue"
        id="issue-123"
        code="PX-001"
        docName="phiếu xuất"
        canReopen={true}
        isAdmin={true}
      />
    );

    expect(screen.getByRole("button", { name: /Mở lại sửa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Can thiệp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xoá/i })).toBeInTheDocument();
  });

  it("renders only delete and can thiep buttons when canReopen is false", () => {
    render(
      <AdminDocTools
        kind="defect"
        id="defect-123"
        code="BH-001"
        docName="phiếu hỏng"
        canReopen={false}
        isAdmin={true}
      />
    );

    expect(screen.queryByRole("button", { name: /Mở lại/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Can thiệp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xoá/i })).toBeInTheDocument();
  });
});
