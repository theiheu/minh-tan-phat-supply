import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevDocTools } from "./dev-doc-tools";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/features/admin-tools/actions", () => ({
  adminDeleteDocAction: vi.fn().mockResolvedValue({ ok: true }),
  adminReopenDocAction: vi.fn().mockResolvedValue({ ok: true }),
  adminInspectDocAction: vi.fn().mockResolvedValue({
    document: { id: "123", code: "TEST-01" },
    dependencies: [],
    movements_count: 0,
    can_direct_delete: true,
  }),
}));

describe("DevDocTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isDev is false", () => {
    const { container } = render(
      <DevDocTools
        kind="requisition"
        id="req-123"
        code="YCVT-001"
        docName="phiếu yêu cầu"
        canReopen={true}
        isDev={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders delete, reopen, and can thiep buttons when isDev is true and canReopen is true", () => {
    render(
      <DevDocTools
        kind="issue"
        id="issue-123"
        code="PX-001"
        docName="phiếu xuất"
        canReopen={true}
        isDev={true}
      />
    );

    expect(screen.getByRole("button", { name: /Mở lại sửa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xoá/i })).toBeInTheDocument();
  });

  it("renders only delete and can thiep buttons when canReopen is false", () => {
    render(
      <DevDocTools
        kind="defect"
        id="defect-123"
        code="BH-001"
        docName="phiếu hỏng"
        canReopen={false}
        isDev={true}
      />
    );

    expect(screen.queryByRole("button", { name: /Mở lại/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Xoá/i })).toBeInTheDocument();
  });
});
