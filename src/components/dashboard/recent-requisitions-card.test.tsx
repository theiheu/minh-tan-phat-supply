import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  RecentRequisitionItem,
  RecentRequisitionsCard,
} from "./recent-requisitions-card";

describe("RecentRequisitionsCard", () => {
  it("does not render requisitions with status 'issued' in the table", () => {
    const items: RecentRequisitionItem[] = [
      {
        id: "req-1",
        code: "REQ-0001",
        purpose: "Xin cám gà đẻ",
        status: "pending",
        created_at: "2026-09-18T10:00:00Z",
        requester: { name: "Nguyễn Văn A" },
        zone: { name: "Khu 1" },
        sub_zone: { name: "Trại 1" },
      },
      {
        id: "req-2",
        code: "REQ-0002",
        purpose: "Xin thuốc bổ sung",
        status: "approved",
        created_at: "2026-09-18T11:00:00Z",
        requester: { name: "Trần Văn B" },
        zone: { name: "Khu 2" },
        sub_zone: null,
      },
      {
        id: "req-3",
        code: "REQ-0003",
        purpose: "Xin vật tư đã cấp",
        status: "issued",
        created_at: "2026-09-18T12:00:00Z",
        requester: { name: "Lê Văn C" },
        zone: { name: "Khu 3" },
        sub_zone: null,
      },
    ];

    render(<RecentRequisitionsCard items={items} />);

    expect(screen.getByText("Phiếu yêu cầu cần xử lý")).toBeInTheDocument();

    // REQ-0001 (pending) and REQ-0002 (approved) should be visible
    expect(screen.getAllByText("REQ-0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("REQ-0002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xin cám gà đẻ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xin thuốc bổ sung").length).toBeGreaterThan(0);

    // REQ-0003 (issued) should NOT be displayed
    expect(screen.queryByText("REQ-0003")).not.toBeInTheDocument();
    expect(screen.queryByText("Xin vật tư đã cấp")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã cấp phát")).not.toBeInTheDocument();
  });

  it("renders empty state when all items are 'issued'", () => {
    const items: RecentRequisitionItem[] = [
      {
        id: "req-3",
        code: "REQ-0003",
        purpose: "Xin vật tư đã cấp",
        status: "issued",
        created_at: "2026-09-18T12:00:00Z",
        requester: { name: "Lê Văn C" },
        zone: { name: "Khu 3" },
        sub_zone: null,
      },
    ];

    render(<RecentRequisitionsCard items={items} />);

    expect(
      screen.getByText("Không có phiếu yêu cầu nào đang chờ xử lý.")
    ).toBeInTheDocument();
    expect(screen.queryByText("REQ-0003")).not.toBeInTheDocument();
  });

  it("renders empty state when items list is empty", () => {
    render(<RecentRequisitionsCard items={[]} />);

    expect(
      screen.getByText("Không có phiếu yêu cầu nào đang chờ xử lý.")
    ).toBeInTheDocument();
  });
});
