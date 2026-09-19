import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DriverAccountSelect } from "./driver-account-select";

describe("DriverAccountSelect Component", () => {
  const mockDrivers = [
    { id: "drv-1", name: "Nguyễn Văn Lái 1", username: "lai1", email: "lai1@mtp.vn" },
    { id: "drv-2", name: "Trần Văn Lái 2", username: "lai2", email: "lai2@mtp.vn" },
  ];

  it("renders driver selection label and options", () => {
    const onChange = vi.fn();
    render(
      <DriverAccountSelect
        drivers={mockDrivers}
        driverId="drv-1"
        driverName="Nguyễn Văn Lái 1"
        onDriverChange={onChange}
      />
    );

    expect(screen.getByText(/Tài xế \/ Người lái/i)).toBeInTheDocument();
    (console.warn as any).mockClear?.();
  });
});
