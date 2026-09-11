import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ZoneSubZoneSelect } from "./zone-sub-zone-select";

const zones = [
  { id: "z-1", name: "Khu 1" },
  { id: "z-2", name: "Khu 2" },
];

const subZones = [
  { id: "sz-1", zone_id: "z-1", name: "Trại 1" },
  { id: "sz-2", zone_id: "z-1", name: "Trại 2" },
  { id: "sz-3", zone_id: "z-2", name: "Trại 3" },
];

describe("ZoneSubZoneSelect component", () => {
  it("renders zone and sub-zone select dropdowns", () => {
    render(
      <ZoneSubZoneSelect
        zones={zones}
        subZones={subZones}
        zoneId="z-1"
        subZoneId="sz-1"
        onZoneChange={vi.fn()}
        onSubZoneChange={vi.fn()}
      />
    );

    expect(screen.getByText("Khu vực")).toBeInTheDocument();
    expect(screen.getByText("Trại / Phân xưởng")).toBeInTheDocument();
  });

  it("shows disabled subzone trigger when no zone is selected", () => {
    render(
      <ZoneSubZoneSelect
        zones={zones}
        subZones={subZones}
        zoneId=""
        onZoneChange={vi.fn()}
        onSubZoneChange={vi.fn()}
      />
    );

    const triggers = screen.getAllByRole("combobox");
    expect(triggers[1]).toBeDisabled();
  });
});
