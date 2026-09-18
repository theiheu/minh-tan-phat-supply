# Superpowers — Kế Hoạch & Thiết Kế Kỹ Thuật Chuyên Sâu

Thư mục này chứa các **tài liệu kỹ thuật chuyên sâu** (design specs, implementation plans, evidence) được tạo ra trong quá trình phát triển các tính năng phức tạp.

---

## Cấu trúc

```
docs/superpowers/
├── specs/       # Thiết kế được duyệt — authority cho implementation
├── plans/       # Kế hoạch thực thi (task breakdown, gating conditions)
└── evidence/    # Bằng chứng kiểm thử, audit SQL, oracle kết quả
```

---

## Feature Archives (đã hoàn thành, merged vào main)

| Feature                         | Spec                                                                   | Plan                                                            |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Username Login                  | [spec](./specs/2026-09-05-username-login-design.md)                    | [plan](./plans/2026-09-05-username-login.md)                    |
| Defect Exchange (Đổi 1-1)       | [spec](./specs/2026-09-05-defect-exchange-design.md)                   | [plan](./plans/2026-09-05-defect-exchange.md)                   |
| Return History                  | [spec](./specs/2026-09-05-return-history-design.md)                    | [plan](./plans/2026-09-05-return-history.md)                    |
| Dev/Prod Separation             | [spec](./specs/2026-09-06-dev-prod-separation-design.md)               | [plan](./plans/2026-09-06-dev-prod-separation.md)               |
| Exchange/Repair Separation      | [spec](./specs/2026-09-06-exchange-repair-separation-design.md)        | [plan](./plans/2026-09-06-exchange-repair-separation.md)        |
| Mẫu Phiếu In Chuẩn & Xuất Kho   | [spec](./specs/2026-09-06-mau-phieu-in-chuan-va-xuat-kho-design.md)    | [plan](./plans/2026-09-06-mau-phieu-in-chuan-va-xuat-kho.md)    |
| Fuel Management                 | [spec](./specs/2026-09-08-fuel-management-design.md)                   | [plan](./plans/2026-09-08-fuel-management.md)                   |
| PWA / QR Offline / Requisitions | [spec](./specs/2026-09-08-pwa-qr-offline-requisition-design.md)        | [plan](./plans/2026-09-08-pwa-qr-offline-requisition.md)        |
| Quick Exchange & Tool Borrowing | [spec](./specs/2026-09-08-quick-exchange-and-tool-borrowing-design.md) | [plan](./plans/2026-09-08-quick-exchange-and-tool-borrowing.md) |
| Reports & Analytics             | [spec](./specs/2026-09-08-reports-and-analytics-design.md)             | [plan](./plans/2026-09-08-reports-and-analytics.md)             |
| Unit Conversion                 | [spec](./specs/2026-09-09-unit-conversion-design.md)                   | [plan](./plans/2026-09-09-unit-conversion.md)                   |
| Sub-zones Management            | [spec](./specs/2026-09-10-sub-zones-management-design.md)              | [plan](./plans/2026-09-10-sub-zones-management.md)              |

---

## In Progress ⚙️

| Feature                                               | Trạng thái                                                                     | Spec                                                                  | Plan                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Full Material Catalog Replacement (Product → SKU)** | ⚠️ Hậu kiểm cutover — cần xác minh live state và đóng safety/correctness gates | [spec](./specs/2026-09-16-unified-product-variant-workflow-design.md) | [plan](./plans/2026-09-16-full-material-catalog-replacement.md) · [remediation agent plan](./plans/2026-09-18-post-cutover-remediation-agent-plan.md) |

---

## Planned 🗓️

| Feature                           | Ghi chú                                           |
| --------------------------------- | ------------------------------------------------- |
| Poultry ERP — Sản lượng & Đàn gà  | Xem [CHANGELOG.md](../../CHANGELOG.md#unreleased) |
| Poultry ERP — Thức ăn & Thú y     | Xem [CHANGELOG.md](../../CHANGELOG.md#unreleased) |
| Poultry ERP — Tài chính Nông trại | Xem [CHANGELOG.md](../../CHANGELOG.md#unreleased) |
