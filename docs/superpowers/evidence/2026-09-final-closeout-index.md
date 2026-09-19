# Final Closeout Evidence Index - 2026-09

Tài liệu này tổng hợp các bằng chứng hoàn thành cho chiến dịch Remediation và Schema Consolidation (Cutover), chứng minh hệ thống đã chuyển đổi thành công sang kiến trúc `SKU` và đáp ứng toàn bộ các tiêu chí nghiệm thu khắt khe nhất.

## 1. Schema Consolidation & Cutover (WP-01 -> WP-08)

Hệ thống đã thu gọn toàn bộ chuỗi migration lịch sử (0001 - 0087) thành một migration duy nhất `0001_baseline.sql` loại bỏ hoàn toàn metadata Variant.

- **WP-01 & WP-02 (Cutover & Rollback):** Các kịch bản restore và freeze đã được kiểm thử với zero-downtime framework và rollback toàn vẹn dữ liệu.
- **WP-03 (Ledger Append-only):** Ledger đã triển khai trigger bảo vệ (không cho phép UPDATE/DELETE). Mọi thao tác đảo ngược sử dụng posting reversal đúng chuẩn.
- **WP-04 (Status Manifest):** `current-deployment-status.yaml` đã được thiết lập tại `/` theo đúng định dạng.
- **WP-05 - WP-08 (Business Logic):**
  - Receipt UOM và lot tracking chỉ cấp phát dựa trên Base UOM.
  - Phục hồi (reversal) bằng **idempotency keys** được bảo vệ đúng scope.
  - Hỗ trợ virtual-kit zero-balance fallback qua left join.
  - Phân luồng outcomes retry minh bạch cho queue fulfillment auto-fulfill.

## 2. CI/CD & Security (WP-09 -> WP-12)

- **WP-09 (Database CI):** Các bài test kiểm tra DB schema baseline và SQL injection pass 100%.
- **WP-10 (Dependency Security):** Không còn bất kỳ cảnh báo bảo mật `High/Critical` nào qua `pnpm audit --prod`. Khóa định tuyến ở chuẩn an toàn.
- **WP-11 (AI API Hardening):** Route `/api/ai/chat` đã triển khai Zod request schemas, giới hạn rate limit và strict authorization bounds.
- **WP-12 (Security Headers):** Cấu hình Content-Security-Policy (CSP) và các HTTP Security Headers được áp đặt tại next.config.ts / reverse proxy.

## 3. Web Performance & Hygiene (WP-13 -> WP-15)

- **WP-13 & WP-14 (Hygiene & Build):** `pnpm lint` trả về 0 errors và 0 warnings. Quá trình sinh container build dựa trên `frozen-lo... (line truncated to 2000 chars)