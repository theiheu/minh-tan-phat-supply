# Phân hệ Báo cáo & Thống kê Toàn diện (Chung & Riêng) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trung tâm Báo cáo & Thống kê toàn diện (Unified Report Hub) tại `/reports` phục vụ Trại gà đẻ trứng Lê Văn Dương, bao gồm Báo cáo Chung (Xuất-Nhập-Tồn ledger, Giá trị tồn kho, Hư hỏng/Sửa chữa/Thanh lý, Nhiên liệu tổng hợp) và Báo cáo Riêng (Chi phí theo từng Khu chuồng, Tiêu hao nhiên liệu từng Xe/Máy móc, Đối tác Nhà cung cấp/Khách hàng, Sổ Thẻ kho chi tiết), kèm tính năng Xuất Excel (`.xlsx`) chuẩn hóa và In PDF A4 nhận diện thương hiệu.

**Architecture:** Tạo module `src/features/reports` với các data aggregator queries server-side, bộ tính toán cân đối ledger XNT/định mức xe/phân bổ chuồng, giao diện tabbed hub Client Component mượt mà với bộ lọc thời gian & kho dùng chung, thẻ KPI số liệu & thanh tỷ lệ CSS/Tailwind, cùng các API route xuất file Excel (`xlsx`) và In PDF (`@react-pdf/renderer`).

**Tech Stack:** Next.js 15 (App Router, Server Components + Server Actions), Supabase (PostgreSQL), TypeScript (Strict), Tailwind CSS v4, shadcn/ui, TanStack Query v5, SheetJS (`xlsx`), `@react-pdf/renderer`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-reports-and-analytics-design.md`

## Global Constraints
- Tất cả định dạng tiền tệ sử dụng `formatVnd` (`1.000.000 ₫`) từ `@/lib/format`.
- Tất cả định dạng ngày giờ sử dụng `formatDate` (`DD/MM/YYYY`) hoặc `formatDateTime` (`DD/MM/YYYY HH:mm`).
- Tiêu đề in ấn & xuất file luôn mang thương hiệu chuẩn:
  ```
  TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG
  Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương
  Hotline: 0988 365 238 - 0963 077 879
  ```
- Phân quyền: Phân hệ `/reports` dành riêng cho vai trò `manager` (Quản lý kho / Kế toán / Chủ trại).

---

### Task 1: Type Definitions & Calculation Helpers for Reports

**Files:**
- Create: `src/features/reports/types.ts`
- Create: `src/features/reports/lib/calculations.ts`
- Test: `src/features/reports/lib/calculations.test.ts`

**Interfaces:**
- Consumes: `@/types/database.types`
- Produces:
  - Types: `ReportDateRange`, `StockLedgerRow`, `GeneralReportData`, `ZoneCostRow`, `ZoneCostReportData`, `VehicleUsageRow`, `VehicleReportData`, `SupplierReportRow`, `CustomerReportRow`, `PartnersReportData`, `StockCardEntry`, `StockCardData`
  - Functions: `calculateStockLedger(movements, currentBalances, fromDate, toDate)`, `calculateVehicleConsumption(logs, vehicles)`, `calculateZoneCosts(issues, defectNotes)`

- [ ] **Step 1: Write the failing tests for calculation helpers**

```typescript
// src/features/reports/lib/calculations.test.ts
import { describe, it, expect } from "vitest";
import { calculateStockLedger, calculateVehicleConsumption, calculateZoneCosts } from "./calculations";

describe("Report calculations", () => {
  it("calculates opening stock, period movements, and closing stock correctly", () => {
    const currentBalances = new Map<string, number>([["var-1", 100]]);
    const movements = [
      {
        variant_id: "var-1",
        movement_type: "receipt_in" as const,
        quantity: 50,
        created_at: "2026-09-10T10:00:00Z",
      },
      {
        variant_id: "var-1",
        movement_type: "issue_out" as const,
        quantity: 20,
        created_at: "2026-09-15T10:00:00Z",
      },
    ];

    const result = calculateStockLedger(
      movements,
      currentBalances,
      "2026-09-01T00:00:00Z",
      "2026-09-30T23:59:59Z"
    );

    const row = result.get("var-1");
    expect(row).toBeDefined();
    expect(row?.inQty).toBe(50);
    expect(row?.outQty).toBe(20);
    expect(row?.netChange).toBe(30);
  });

  it("calculates vehicle consumption rate and warns on over-norm", () => {
    const vehicles = [
      { id: "v1", code: "XE-01", name: "Xe ben chở phân", odo_unit: "km" as const, fuel_norm: 15 },
    ];
    const logs = [
      {
        vehicle_id: "v1",
        quantity: 35,
        usage_diff: 200,
        created_at: "2026-09-05T08:00:00Z",
      },
    ];

    const result = calculateVehicleConsumption(logs, vehicles);
    expect(result[0].totalLiters).toBe(35);
    expect(result[0].totalUsageDiff).toBe(200);
    // (35 / 200) * 100 = 17.5 L/100km
    expect(result[0].avgRate).toBe(17.5);
    expect(result[0].isOverNorm).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/reports/lib/calculations.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `types.ts` and `calculations.ts`**

```typescript
// src/features/reports/types.ts
export type DatePreset = "today" | "7days" | "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

export interface ReportDateRange {
  from: string; // ISO or YYYY-MM-DD
  to: string;   // ISO or YYYY-MM-DD
  preset: DatePreset;
}

export interface StockLedgerRow {
  variantId: string;
  productName: string;
  variantLabel: string;
  unit: string;
  categoryName: string;
  openingQty: number;
  inQty: number;
  outQty: number;
  closingQty: number;
  unitPrice: number;
  closingValue: number;
}

export interface GeneralReportData {
  totalInventoryValue: number;
  totalImportValue: number;
  totalIssuedCost: number;
  totalSalesRevenue: number;
  stockLedger: StockLedgerRow[];
  categoryBreakdown: { categoryName: string; cost: number; percentage: number }[];
  defectsSummary: {
    totalDefects: number;
    repairedCount: number;
    repairCost: number;
    liquidationRevenue: number;
  };
  fuelSummary: {
    totalImportedLiters: number;
    totalDispensedLiters: number;
    currentTankStock: number;
    estimatedCost: number;
  };
}

export interface ZoneCostRow {
  zoneId: string;
  zoneName: string;
  totalCost: number;
  percentage: number;
  issueCount: number;
  defectCount: number;
  items: {
    productName: string;
    variantLabel: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
}

export interface ZoneCostReportData {
  grandTotalCost: number;
  zones: ZoneCostRow[];
}

export interface VehicleUsageRow {
  vehicleId: string;
  code: string;
  name: string;
  plate: string | null;
  odoUnit: "km" | "hours";
  fuelNorm: number | null;
  totalLiters: number;
  dispenseCount: number;
  totalUsageDiff: number;
  avgRate: number | null;
  normDiff: number | null;
  isOverNorm: boolean;
}

export interface VehicleReportData {
  totalLitersAllVehicles: number;
  vehicles: VehicleUsageRow[];
}

export interface SupplierReportRow {
  supplierId: string;
  supplierName: string;
  phone: string | null;
  receiptCount: number;
  totalQuantity: number;
  totalAmount: number;
}

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  phone: string | null;
  issueCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface PartnersReportData {
  suppliers: SupplierReportRow[];
  customers: CustomerReportRow[];
}

export interface StockCardEntry {
  id: string;
  createdAt: string;
  refType: string | null;
  refCode: string | null;
  movementType: string;
  movementLabel: string;
  notes: string | null;
  actorName: string;
  inQty: number;
  outQty: number;
  runningBalance: number;
}

export interface StockCardData {
  variantId: string;
  productName: string;
  variantLabel: string;
  unit: string;
  locationName: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  closingStock: number;
  entries: StockCardEntry[];
}
```

Implement `src/features/reports/lib/calculations.ts` with pure aggregation logic.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/features/reports/lib/calculations.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/types.ts src/features/reports/lib/calculations.ts src/features/reports/lib/calculations.test.ts
git commit -m "feat(reports): add report types and core calculation helpers with tests"
```

---

### Task 2: Server Data Queries for Reports

**Files:**
- Create: `src/features/reports/queries.ts`

**Interfaces:**
- Consumes: `@/lib/supabase/server`, `src/features/reports/types.ts`
- Produces:
  - `fetchGeneralReportData(params: { locationId?: string; from: string; to: string }): Promise<GeneralReportData>`
  - `fetchZoneCostReportData(params: { from: string; to: string }): Promise<ZoneCostReportData>`
  - `fetchVehicleReportData(params: { from: string; to: string }): Promise<VehicleReportData>`
  - `fetchPartnersReportData(params: { from: string; to: string }): Promise<PartnersReportData>`
  - `fetchStockCardData(params: { variantId: string; locationId?: string; from: string; to: string }): Promise<StockCardData>`

- [ ] **Step 1: Write `queries.ts` with typed Supabase RPC and queries**

Implement all server queries with optimal `Promise.all` batches, joining products, variants, categories, zones, vehicles, suppliers, customers, and ledger balances.

- [ ] **Step 2: Typecheck queries**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/queries.ts
git commit -m "feat(reports): add server queries for general and specific reports"
```

---

### Task 3: Date Filter Bar & Location Selector Component

**Files:**
- Create: `src/features/reports/components/report-date-filters.tsx`

**Interfaces:**
- Consumes: `ReportDateRange`, `DatePreset`
- Produces: `<ReportDateFilters value={filters} onChange={setFilters} locations={locations} />`

- [ ] **Step 1: Implement `ReportDateFilters`**
  - Preset quick buttons: `Hôm nay`, `7 ngày qua`, `Tháng này` (Default), `Tháng trước`, `Quý này`, `Năm nay`.
  - Date picker input: `Từ ngày` & `Đến ngày` with automatic preset sync.
  - Dropdown chọn `Kho` (Tất cả kho / Kho chính / Kho dầu / Kho hỏng).

- [ ] **Step 2: Verify component rendering and interactivity**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/components/report-date-filters.tsx
git commit -m "feat(reports): create unified date preset and location filter component"
```

---

### Task 4: Tab 1 — Báo Cáo Chung (General Overview & XNT Ledger)

**Files:**
- Create: `src/features/reports/components/general-report-tab.tsx`

**Interfaces:**
- Consumes: `GeneralReportData`, `StockLedgerRow`
- Produces: `<GeneralReportTab data={generalData} onExportExcel={...} />`

- [ ] **Step 1: Implement `GeneralReportTab`**
  - 4 KPI Cards: Tổng giá trị kho, Tổng nhập trong kỳ, Tổng chi phí xuất dùng, Doanh thu xuất bán/thanh lý.
  - Category breakdown with Tailwind visual progress bars.
  - Collapsible cards for Defect & Repair summary, and Fuel summary.
  - Full XNT Ledger Table: Mã VT, Tên VT, Biến thể, ĐVT, Tồn đầu, Nhập, Xuất, Tồn cuối, Đơn giá, Thành tiền tồn cuối.
  - Search filter within table & Total summary footer row.

- [ ] **Step 2: Typecheck & verify**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/components/general-report-tab.tsx
git commit -m "feat(reports): implement general overview and XNT ledger tab"
```

---

### Task 5: Tab 2 — Báo Cáo Riêng theo Chuồng / Khu Vực (Zone Cost Analysis)

**Files:**
- Create: `src/features/reports/components/zone-cost-report-tab.tsx`
- Create: `src/features/reports/components/zone-cost-detail-dialog.tsx`

**Interfaces:**
- Consumes: `ZoneCostReportData`, `ZoneCostRow`
- Produces: `<ZoneCostReportTab data={zoneCostData} />`

- [ ] **Step 1: Implement `ZoneCostReportTab`**
  - Zone cost summary cards: Chuồng tiêu hao lớn nhất, Tổng chi phí vật tư toàn khu, Số chuồng có phát sinh.
  - Interactive table showing: Tên khu vực, Chi phí vật tư (VNĐ), Thanh tiến độ % so với toàn trại, Số phiếu cấp phát, Số lần đổi 1-1.
  - Click on any zone opens `ZoneCostDetailDialog` showing exact items issued to that specific zone with quantities and unit prices.

- [ ] **Step 2: Typecheck & verify**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/components/zone-cost-report-tab.tsx src/features/reports/components/zone-cost-detail-dialog.tsx
git commit -m "feat(reports): implement zone cost analysis tab with drilldown dialog"
```

---

### Task 6: Tab 3 & Tab 4 — Báo Cáo Phương Tiện (Xe/Máy) & Báo Cáo Đối Tác (NCC & Khách Hàng)

**Files:**
- Create: `src/features/reports/components/vehicle-report-tab.tsx`
- Create: `src/features/reports/components/partners-report-tab.tsx`

**Interfaces:**
- Consumes: `VehicleReportData`, `PartnersReportData`
- Produces: `<VehicleReportTab data={vehicleData} />`, `<PartnersReportTab data={partnersData} />`

- [ ] **Step 1: Implement `VehicleReportTab`**
  - Vehicle cards: Tổng lít dầu tiêu thụ, Số phương tiện hoạt động, Số xe vượt định mức.
  - Vehicle table with consumption rate calculation ($L/100km$ or $L/h$), comparison with `fuel_norm`, and color-coded status badges (Over norm = Red badge with exclamation; Normal = Green badge).

- [ ] **Step 2: Implement `PartnersReportTab`**
  - Two sub-sections / tabs: **Nhà cung cấp (Suppliers)** & **Khách hàng (Customers)**.
  - Supplier table: Tên NCC, Số điện thoại, Số đơn nhập, Tổng giá trị thanh toán.
  - Customer table: Tên thương lái/khách mua, Số điện thoại, Số đơn xuất bán, Tổng doanh thu thu về (phân gà, vỉ trứng, phế liệu).

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/components/vehicle-report-tab.tsx src/features/reports/components/partners-report-tab.tsx
git commit -m "feat(reports): implement vehicle fuel report and partners analytics tabs"
```

---

### Task 7: Tab 5 — Sổ Thẻ Kho Chi Tiết (Stock Card)

**Files:**
- Create: `src/features/reports/components/stock-card-tab.tsx`

**Interfaces:**
- Consumes: `StockCardData`, `StockCardEntry`, `variants`, `locations`
- Produces: `<StockCardTab variants={variants} locations={locations} />`

- [ ] **Step 1: Implement `StockCardTab`**
  - Searchable Combobox to pick a Product Variant (with fast autocomplete and QR scan support).
  - Warehouse selector (Kho chính, Kho hỏng...).
  - Stock summary ribbon: Tồn đầu kỳ, Tổng nhập trong kỳ, Tổng xuất trong kỳ, Tồn cuối kỳ.
  - Detailed movement ledger table: Ngày giờ, Số chứng từ (Clickable link to view receipt/issue/defect slip), Loại nghiệp vụ, Diễn giải, SL Nhập (+), SL Xuất (-), Tồn lũy kế, Người thực hiện.

- [ ] **Step 2: Typecheck & verify**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/components/stock-card-tab.tsx
git commit -m "feat(reports): implement stock card detail ledger tab"
```

---

### Task 8: Excel Export Engine & Standard PDF Print Routes

**Files:**
- Create: `src/features/reports/lib/excel-export.ts`
- Create: `src/app/api/reports/export/route.ts`
- Create: `src/app/api/reports/pdf/route.tsx`

**Interfaces:**
- Consumes: SheetJS (`xlsx`), `@react-pdf/renderer`, `src/features/pdf/brand.ts`
- Produces:
  - `exportToExcel(reportType, data, dateRange)`
  - Endpoint `GET /api/reports/export?type=...&from=...&to=...` returning `.xlsx`
  - Endpoint `GET /api/reports/pdf?type=...&from=...&to=...` returning formatted PDF

- [ ] **Step 1: Implement Excel Export Helper `excel-export.ts` & API Route**
  - Format columns, currency, Farm Lê Văn Dương title header, and date period banner.
  - Support exporting all 5 tabs: `stock_ledger`, `zone_cost`, `vehicles`, `partners`, `stock_card`.

- [ ] **Step 2: Implement PDF Route for Print**
  - Standard A4 layout with Farm Brand Header, summary KPI cards, data table, and 3 signature blocks (Người lập báo cáo - Kế toán trại - Quản lý / Chủ trại).

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/lib/excel-export.ts src/app/api/reports/export/route.ts src/app/api/reports/pdf/route.tsx
git commit -m "feat(reports): implement comprehensive excel export and PDF print routes"
```

---

### Task 9: Hub Integration & Main Reports Page Update

**Files:**
- Create: `src/features/reports/components/reports-hub.tsx`
- Modify: `src/app/(app)/reports/page.tsx`

**Interfaces:**
- Consumes: All 5 report tab components, `ReportDateFilters`, export handlers
- Produces: Complete responsive `/reports` page for Farm Management

- [ ] **Step 1: Create `ReportsHub` client component**
  - Manage active tab (`general` | `zones` | `vehicles` | `partners` | `stock_card`).
  - Manage date range state (Defaults to current month).
  - Integrated header with Excel Export & Print PDF buttons.
  - Render active tab seamlessly with TanStack Query caching for snappy tab switching.

- [ ] **Step 2: Update `src/app/(app)/reports/page.tsx`**
  - Fetch master data (zones, vehicles, locations, categories, variants) on server.
  - Render `ReportsHub` with pre-populated server props.

- [ ] **Step 3: Run full typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: All typechecks and tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/components/reports-hub.tsx src/app/(app)/reports/page.tsx
git commit -m "feat(reports): integrate unified reports hub into /reports page"
```

---

### Task 10: End-to-End Verification & Documentation Update

**Files:**
- Modify: `BUILD_GUIDE.md`
- Modify: `SO_TAY_VAN_HANH_TRAI.md`

- [ ] **Step 1: Update documentation**
  - Update `BUILD_GUIDE.md` section on `/reports` with new tabs, schemas, and endpoints.
  - Update `SO_TAY_VAN_HANH_TRAI.md` Tình huống 10 with step-by-step instructions for viewing General XNT, Zone costs, Vehicle fuel, and Partner reports.

- [ ] **Step 2: Run verification**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add BUILD_GUIDE.md SO_TAY_VAN_HANH_TRAI.md
git commit -m "docs: update build guide and farm handbook for reports and analytics"
```
