# Kế hoạch triển khai: Làm lại Trung tâm Báo cáo

**Goal:** Triển khai `/reports` thành ba khu vực rõ ràng: Tổng quan quản trị native mặc định, Báo cáo nghiệp vụ và Phân tích chuyên sâu Metabase; bổ sung tín hiệu quản trị từ dữ liệu hiện có mà không đổi schema hay công thức kế toán.

**Architecture:** `ReportsHub` chỉ điều phối section, URL và bộ lọc. Hợp đồng dữ liệu Tổng quan được tổng hợp server-side trong owner `src/features/reports`; các rule cảnh báo là hàm thuần có test. Năm component báo cáo nghiệp vụ và Metabase hiện có được tái sử dụng sau lớp điều hướng mới.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, Vitest, Testing Library.

**Baseline/Authority Refs:**
- `docs/superpowers/specs/2026-09-08-reports-and-analytics-design.md` (đã duyệt)
- `docs/aegis/BASELINE-GOVERNANCE.md`
- `docs/reference/app-routes-and-navigation.md`
- `docs/user-guide/11-bao-cao-phan-tich.md`
- Source hiện hành trong `src/features/reports`

**Compatibility Boundary:** Giữ `/reports`, `requireManager()`, công thức/số liệu ledger, API Excel/PDF, năm báo cáo nghiệp vụ và tính độc lập của báo cáo native khi Metabase lỗi. Không reset thay đổi dirty hiện có.

**TDD Route:**
- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Strict signals: thay đổi hành vi điều hướng và tổng hợp dữ liệu, nhưng không có yêu cầu strict TDD
- Light eligibility: không áp dụng vì phạm vi trung bình/cao
- TDD-fit exception: none
- Test posture: post-change regression
- Reason: triển khai tối thiểu theo đặc tả đã duyệt, sau đó chạy test tập trung và quality gates
- Verification: Vitest phạm vi reports, typecheck, lint, build, browser desktop/mobile

## Scope Check

### Plan Basis
- Yêu cầu: phân tích và làm lại tab Báo cáo.
- Quyết định đã duyệt: ưu tiên ra quyết định quản trị; dashboard native sở hữu bề mặt chính; Metabase phân tích sâu; bổ sung KPI/cảnh báo từ dữ liệu hiện có.
- Không còn câu hỏi sản phẩm chặn triển khai.

### BaselineUsageDraft
- Required baseline refs: spec báo cáo, baseline governance, source hiện hành.
- Acknowledged before plan refs: đã đọc.
- Cited in plan refs: liệt kê ở header.
- Missing refs: Hindsight không khả dụng do thiếu API token; không phải blocker source-local.
- Decision: continue.

### Requirement Ready Check
- Requirement source refs: đặc tả đã duyệt và lựa chọn trực tiếp của người dùng.
- Goals and scope refs: sections 1–3 của spec.
- User/scenario refs: Chủ trại, Kế toán, Quản lý kho.
- Requirement item refs: sections 5–12 của spec.
- Acceptance refs: section 2.2 và 12 của spec.
- Open blocker questions: không.
- Decision: ready.

### Change Necessity
- User-visible need: thông tin hiện tại phân tán trong bảy tab ngang cấp và chưa tạo tín hiệu quản trị.
- No-change/non-code option: tài liệu hoặc cấu hình không thể thay IA, URL state, loading/error và cảnh báo.
- Why code change is necessary: cần thay component orchestration và hợp đồng dữ liệu Tổng quan.
- Minimum change boundary: `src/app/(app)/reports/page.tsx`, `src/features/reports/**`, tài liệu hướng dẫn.
- Decision: code-change.

### Existence Check
- Proposed new surface: dashboard overview contract và section navigation.
- Existing owner/reuse candidate: `src/features/reports`, `GeneralReportTab`, các report tab hiện có.
- Why existing surface is insufficient: `GeneralReportData` thiếu cảnh báo/điểm nóng; `ReportsHub` trộn bảy report tab ngang cấp.
- Creation proof: hành vi quản trị đã duyệt cần một contract tổng hợp và section navigation, nhưng không cần module/domain mới.
- Entropy/retirement impact: thay thế hoàn toàn navigation cũ; không giữ hai owner song song.
- Decision: reuse-existing.

### Architecture Integrity Lens
- Invariant: queries/actions/types trong feature reports sở hữu nghiệp vụ; UI không tự phát minh rule.
- Canonical owner/contract: `src/features/reports`.
- Responsibility overlap: loại bỏ rule/data loading khỏi component trình bày khi có thể.
- Higher-level simplification: một overview action/query; report detail tiếp tục lazy load.
- Retirement/falsifier: xóa mapping bảy tab cấp một; nếu contract overview buộc schema mới thì dừng và quay lại design.
- Verdict: aligned.

### Plan Pressure Test
- Owner/contract/retirement: owner rõ, navigation cũ được retire.
- Architecture integrity: không tạo module song song.
- Verification scope: unit, component, quality gates, browser.
- Task executability: chia theo contract, UI, integration, Metabase/docs.
- Pressure result: proceed.

### Plan-Time Complexity Check
- Artifact class: feature hub/client orchestrator.
- Target files: `reports-hub.tsx` hiện 482 dòng; `queries.ts` khoảng 1000 dòng.
- Current pressure: hub quá lớn; query file lớn nhưng là owner đang có.
- Projected pressure: over-budget nếu tiếp tục nhồi vào hub.
- Planned governance: tạo component/hook owner-local nhỏ; thêm query function có giới hạn thay vì module dữ liệu mới.
- Better file boundary: `report-navigation.ts`, `management-overview.ts`, `use-report-data.ts` hoặc tương đương trong feature.
- Recommendation: extract helper + add owner files.

## File Map

### Create
- `src/features/reports/lib/management-insights.ts` — rule thuần tạo cảnh báo và điểm nóng.
- `src/features/reports/lib/management-insights.test.ts` — regression rule/severity/order.
- `src/features/reports/components/report-section-nav.tsx` — điều hướng ba khu vực và lựa chọn report nghiệp vụ responsive.
- `src/features/reports/components/management-overview.tsx` — KPI, cảnh báo, rankings, CTA.
- `src/features/reports/components/use-report-data.ts` — lazy cache và sequence guard owner-local nếu extraction phù hợp.

### Modify
- `src/features/reports/types.ts` — section/report keys và overview contract.
- `src/features/reports/queries.ts` — aggregator overview tái sử dụng query hiện có.
- `src/features/reports/actions.ts` — manager-gated overview action; bảo toàn Metabase action dirty.
- `src/app/(app)/reports/page.tsx` — parse query params, SSR initial overview, default fallback.
- `src/features/reports/components/reports-hub.tsx` — điều phối IA mới, URL, filters, export.
- `src/features/reports/components/general-report-tab.tsx` — retire hoặc chuyển thành nội dung overview wrapper; không giữ duplicate owner.
- `src/features/reports/components/metabase-bi-tab.tsx` — UX configured/error, bỏ chi tiết hạ tầng.
- Các test report liên quan — cập nhật assertions và regression.
- `docs/user-guide/11-bao-cao-phan-tich.md` — hướng dẫn theo ba khu vực, loại bỏ credential nhạy cảm khỏi user guide.

## Tasks

### Task 1: Chốt contract điều hướng và insight quản trị

**Files:** modify `types.ts`; create `management-insights.ts`, test.

**Why:** Một contract rõ giúp UI không ghép rule rải rác và cho phép test độc lập.

**Change Necessity:** Kiểu dữ liệu cũ chỉ mô tả từng báo cáo, không mô tả section/cảnh báo. Đây là biên tối thiểu.

**Impact/Compatibility:** Chỉ bổ sung type/hàm; không đổi công thức ledger.

**Steps:**
1. Khai báo `ReportSection`, `OperationalReportKey`, `ManagementAlert`, `ManagementOverviewData`.
2. Viết hàm thuần tạo alert từ general/zone/vehicle data; chỉ phát tín hiệu có bằng chứng, giới hạn và sort severity ổn định.
3. Viết regression tests cho vượt định mức, điểm nóng trại, no-data và deterministic ordering.
4. Chạy `pnpm test -- src/features/reports/lib/management-insights.test.ts`.

### Task 2: Thêm aggregator Tổng quan server-side

**Files:** modify `queries.ts`, `actions.ts`, query tests.

**Why:** First paint và rule nghiệp vụ phải có owner server-side, không fan-out tùy ý từ client.

**Change Necessity:** Tổng quan cần general + zone + vehicle trong một hợp đồng; no-change không đáp ứng cảnh báo/điểm nóng.

**Impact/Compatibility:** Tái sử dụng các fetch hiện hành; không thay output cũ.

**Steps:**
1. Thêm `fetchManagementOverviewData` gọi các aggregator hiện có theo cùng date range/location hợp lệ.
2. Biến đổi thành contract overview bằng helper Task 1.
3. Thêm `getManagementOverviewAction` với `requireManager()`.
4. Bảo toàn nguyên văn hợp đồng Metabase action hiện đang dirty, chỉ sửa typing `any` nếu cần.
5. Thêm test cho forwarding params, partial/no-data policy và auth boundary theo pattern hiện hành.
6. Chạy `pnpm test -- src/features/reports/queries.test.ts src/features/reports/lib/management-insights.test.ts`.

### Task 3: Xây section navigation và URL state

**Files:** create `report-section-nav.tsx`; modify page/hub và hub tests.

**Why:** Ba mục đích sử dụng cần phân cấp thay cho bảy tab ngang.

**Change Necessity:** Cấu trúc DOM/interaction hiện tại không thể biểu diễn IA đã duyệt.

**Impact/Compatibility:** `/reports` vẫn mở được; query không hợp lệ fallback overview; report deep link mới là additive.

**Steps:**
1. Tạo config duy nhất cho 3 section và 5 operational reports.
2. Render tab semantics cấp một; desktop report rail/card và mobile select.
3. Parse `section`/`report` ở page hoặc client bằng API Next phù hợp; normalize giá trị invalid.
4. Khi đổi section/report, cập nhật URL bằng router replace/push mà giữ date/location params nếu đang dùng.
5. Thêm test default overview, deep link operations, BI, invalid params, keyboard/ARIA cơ bản.
6. Chạy `pnpm test -- src/features/reports/components/reports-hub.test.tsx`.

### Task 4: Xây Tổng quan quản trị và data orchestration an toàn

**Files:** create `management-overview.tsx`, có thể create `use-report-data.ts`; modify hub/general tests.

**Why:** Đây là bề mặt quyết định chính và phải chống stale response.

**Change Necessity:** General tab hiện chỉ có KPI/card tĩnh, thiếu alert queue, ranking và CTA.

**Impact/Compatibility:** Component báo cáo chi tiết được giữ; data cache chỉ thay orchestration client.

**Steps:**
1. Render 4 KPI có kỳ/đơn vị, alert center, top zones, top vehicles, category distribution và CTA.
2. Thêm skeleton/empty/error/partial state cục bộ.
3. Điều hướng CTA sang report tương ứng hoặc BI và giữ filter.
4. Extract lazy cache key theo `report/from/to/location/variant`.
5. Thêm sequence/request-key guard để response cũ không ghi đè trạng thái mới; clear stale-visible data khi request lỗi.
6. Thêm tests cho alerts, CTA, empty/error/partial và race response.
7. Chạy toàn bộ component tests reports.

### Task 5: Tái cấu trúc Báo cáo nghiệp vụ và export actions

**Files:** modify hub, date filters nếu cần, report tab tests.

**Why:** Sổ chi tiết cần dễ tìm và hành động export phải gắn đúng báo cáo.

**Change Necessity:** Export/filter hiện gắn trực tiếp vào bảy-tab hub và không phù hợp section architecture.

**Impact/Compatibility:** Giữ nguyên endpoint/type mappings và điều kiện chọn SKU của Thẻ kho.

**Steps:**
1. Đặt tên/mô tả báo cáo, filters và Excel/PDF trong header nội dung operations.
2. Chỉ hiện location filter cho báo cáo sử dụng nó.
3. Giữ date/location khi đổi báo cáo.
4. Xác minh URL type: `stock_ledger`, `zone_cost`, `vehicles`, `partners`, `stock_card`.
5. Giữ disabled tooltip/label cho stock card chưa chọn SKU.
6. Chạy component tests XNT/zone/vehicle/partners/stock-card/date-filters.

### Task 6: Hoàn thiện Metabase như khu phân tích chuyên sâu

**Files:** modify `metabase-bi-tab.tsx`, test; giữ `actions.ts`, `src/lib/metabase.ts` dirty work.

**Why:** BI phải chuyên sâu nhưng không làm hỏng native reports hoặc lộ chi tiết hạ tầng.

**Change Necessity:** UI hiện hiển thị port/database và chưa phân biệt rõ configured/load error.

**Impact/Compatibility:** Giữ signing/config và dashboard list; không thay schema/view.

**Steps:**
1. Bỏ thông tin port/PostgreSQL khỏi UI nghiệp vụ.
2. Thêm configured/unconfigured/loading/error states, retry và direct link hợp lệ.
3. Lazy mount chỉ khi section BI active.
4. Giữ fullscreen và dashboard selector, cải thiện mobile wrapping.
5. Chạy `pnpm test -- src/features/reports/components/metabase-bi-tab.test.tsx`.

### Task 7: SSR integration, tài liệu và regression

**Files:** page, guide, test files.

**Why:** First paint phải có overview và hướng dẫn phải khớp UI mới.

**Change Necessity:** Page hiện chỉ preload general data; guide hiện mô tả Metabase tab ngang và chứa credential tĩnh.

**Impact/Compatibility:** Manager gate và route giữ nguyên. Credential nhạy cảm bị loại khỏi tài liệu người dùng, không ảnh hưởng runtime.

**Steps:**
1. Preload `ManagementOverviewData` cho default section; tránh gọi Metabase khi không mở BI.
2. Cập nhật guide theo ba khu vực và cách truy cập báo cáo nghiệp vụ.
3. Xóa mật khẩu/credential DB khỏi user guide; trỏ admin đến env/runbook phù hợp.
4. Chạy test reports, typecheck, lint và build.
5. Browser smoke desktop 1440×900 và mobile Pixel 7: overview, operations switch, filters, CTA, BI state.
6. Kiểm tra console/network không có lỗi mới liên quan reports.

## Risks and Rollback

- Nếu aggregator song song quá chậm, đo trước; tối ưu query trong owner hiện có, không thêm cache/persistence mới chưa được duyệt.
- Nếu cảnh báo thiếu bằng chứng, ẩn loại cảnh báo thay vì mở rộng schema.
- Nếu query-param state gây regression, fallback luôn là overview và giữ route cũ.
- Nếu Metabase chưa cấu hình, native sections vẫn đạt acceptance.
- Rollback theo lát: navigation/overview có thể revert trong feature reports mà không rollback schema hay export API.

## Retirement

- Xóa navigation bảy tab cấp một và `ReportTab` cũ sau khi tests mới pass.
- Không giữ fallback UI cũ.
- `GeneralReportTab` hoặc được tái sử dụng làm component con có tên đúng vai trò, hoặc retire hoàn toàn; không để hai dashboard overview cạnh tranh.
- Không tạo schema/persistence/compat carrier mới.

## Execution Readiness View

- Intent Lock: ưu tiên quyết định quản trị; native overview mặc định.
- Scope Fence: chỉ reports UI/data aggregation/docs; không schema, permission, ledger formula.
- Baseline Lock: approved spec + existing reports owners.
- Approved Behavior: 3 sections, 5 operational reports, deep links, safe Metabase.
- Owner/Contract Constraints: nghiệp vụ ở reports queries/lib; UI chỉ render/interaction.
- Compatibility Boundary: route/auth/export/formulas/current dirty work preserved.
- Retirement Boundary: one new navigation, old seven-tab navigation removed.
- Task Batches: contract/data; navigation/overview; operations/BI; docs/verification.
- Test Obligations: focused Vitest then typecheck/lint/build/browser.
- Review Gates: after contract, after UI integration, before completion.
- Drift/Rewind Rules: schema/new permission/new BI engine => stop and return to design.
- Evidence Required Before Completion: passing commands and desktop/mobile browser evidence.
- Advisory Boundary: method-pack execution guidance only; not completion authority.

## Execution Route

- Decision: inline
- Evidence: core tasks overlap heavily in `reports-hub.tsx`, `types.ts`, `actions.ts` and tests; current workspace already contains user-owned dirty Metabase work.
- Fallback: use read-only subagent review after major slice.
- User confirmation required: no.
