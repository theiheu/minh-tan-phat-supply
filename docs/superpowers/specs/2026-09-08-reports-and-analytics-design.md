# Đặc tả thiết kế: Làm lại Trung tâm Báo cáo theo hướng quản trị

**Ngày cập nhật:** 2026-09-20 · **Trạng thái:** Đã duyệt để triển khai · **Phạm vi:** `/reports`

## 1. Quyết định sản phẩm

Trang `/reports` được tái cấu trúc để ưu tiên **ra quyết định quản trị**, thay vì trình bày bảy tab ngang cấp. Kiến trúc được duyệt gồm ba khu vực:

1. **Tổng quan quản trị** — bề mặt mặc định, native trong ứng dụng.
2. **Báo cáo nghiệp vụ** — các sổ chi tiết, đối soát và xuất Excel/PDF.
3. **Phân tích chuyên sâu** — Metabase BI nhúng, dùng cho biểu đồ và drill-down nâng cao.

Dashboard native là nơi trả lời nhanh “điều gì cần chú ý”; Metabase là công cụ phân tích sâu, không cạnh tranh vị trí mặc định với dashboard native.

## 2. Mục tiêu và tiêu chí thành công

### 2.1 Mục tiêu

- Giúp Chủ trại, Kế toán và Quản lý kho nhận ra tín hiệu quan trọng trong một màn hình.
- Phân biệt rõ báo cáo quản trị, báo cáo sổ sách và công cụ BI.
- Bổ sung KPI/cảnh báo được suy ra từ dữ liệu hiện có, không mở rộng schema nghiệp vụ.
- Giữ nguyên khả năng đối soát XNT, thẻ kho và xuất chứng từ.
- Hoạt động rõ ràng trên desktop và thiết bị di động.

### 2.2 Thành công quan sát được

- Khi mở `/reports`, người dùng thấy Tổng quan quản trị trước.
- Trong một màn hình đầu, người dùng xác định được KPI kỳ hiện tại, cảnh báo cần xử lý và khu vực/đối tượng biến động đáng chú ý.
- Người dùng đi từ cảnh báo hoặc khối phân tích đến đúng báo cáo chi tiết bằng một thao tác.
- Báo cáo XNT, Theo trại, Phương tiện, Đối tác và Thẻ kho vẫn dùng được với bộ lọc ngày/kho và chức năng Excel/PDF hiện có.
- Metabase vẫn truy cập được trong khu vực “Phân tích chuyên sâu”, có trạng thái tải/lỗi/không cấu hình rõ ràng.
- Các luồng hiện có qua `/reports` và phân quyền manager không bị phá vỡ.

## 3. Phạm vi

### 3.1 Trong phạm vi

- Làm lại information architecture và giao diện `/reports`.
- Tái sử dụng dữ liệu báo cáo hiện có và bổ sung phép suy diễn cảnh báo ở lớp reports.
- Tổ chức lại điều hướng, bộ lọc, hành động xuất file và trạng thái tải/lỗi/rỗng.
- Giữ Metabase như bề mặt phân tích chuyên sâu.
- Bổ sung test cho điều hướng, truy vấn, cảnh báo và responsive behavior có thể kiểm chứng bằng DOM.
- Cập nhật hướng dẫn người dùng liên quan.

### 3.2 Ngoài phạm vi

- Không tạo bảng nghiệp vụ mới hoặc thay đổi nguồn sự thật tồn kho/kế toán.
- Không xây chart engine mới để thay Metabase.
- Không thay đổi công thức kế toán XNT, giá trị tồn hoặc quyền truy cập hiện hành.
- Không làm lại toàn bộ các API export/PDF nếu hợp đồng hiện tại vẫn đáp ứng.
- Không mở quyền Báo cáo cho vai trò mới.

## 4. Hiện trạng và vấn đề

Hiện tại `ReportsHub` đặt nhiều tab ngang cấp: Metabase, Tổng quan, XNT, Theo Trại, Phương tiện, Đối tác và Sổ Thẻ kho. Cấu trúc này có các vấn đề:

- Trộn ba mục đích khác nhau: ra quyết định, đối soát sổ sách và khám phá BI.
- “Tổng quan” chủ yếu là tập KPI tĩnh, chưa tạo hàng đợi ưu tiên hoặc nêu biến động cần xử lý.
- Metabase được đặt ngang cấp và nổi bật như một lựa chọn chính, làm mờ vai trò dashboard native.
- Tab ngang dài phải cuộn trên mobile và khó truyền đạt quan hệ giữa báo cáo tổng hợp với báo cáo chi tiết.
- Bộ lọc toàn cục xuất hiện cho nhiều bề mặt nhưng không phải bề mặt nào cũng sử dụng cùng ý nghĩa.
- `reports-hub.tsx` đang gánh điều hướng, cache dữ liệu, tải dữ liệu và hành động export trong một component lớn.

## 5. Kiến trúc thông tin đích

### 5.1 Điều hướng cấp một

`ReportsHub` hiển thị ba lựa chọn cấp một:

| Khu vực | Mục đích | Mặc định |
|---|---|---|
| Tổng quan quản trị | KPI, cảnh báo, xu hướng, điểm nóng và lối tắt | Có |
| Báo cáo nghiệp vụ | Sổ chi tiết và kết xuất chứng từ | Không |
| Phân tích chuyên sâu | Metabase BI và drill-down nâng cao | Không |

Điều hướng cấp một dùng segmented control hoặc tab list ngắn, không dùng bảy tab ngang.

### 5.2 Điều hướng báo cáo nghiệp vụ

Trong “Báo cáo nghiệp vụ”, người dùng chọn một trong năm báo cáo:

- Xuất – Nhập – Tồn
- Chi phí theo trại
- Tiêu hao phương tiện
- Đối tác
- Sổ thẻ kho

Trên desktop, các lựa chọn có thể là sidebar/rail nhỏ hoặc danh sách card gọn. Trên mobile, dùng select/sheet hoặc danh sách cuộn dọc; không bắt người dùng cuộn một hàng tab dài.

### 5.3 URL và trạng thái

- `/reports` mở Tổng quan quản trị.
- Trạng thái khu vực/báo cáo được phản ánh bằng query parameter để hỗ trợ deep link và nút Back, ví dụ `?section=operations&report=xnt` hoặc `?section=bi`.
- Link cũ `/reports` vẫn hợp lệ.
- Query parameter không hợp lệ quay về Tổng quan quản trị an toàn.

## 6. Thiết kế Tổng quan quản trị

### 6.1 Thanh ngữ cảnh

Một thanh bộ lọc dùng chung đặt ngay dưới tiêu đề:

- Kỳ báo cáo: Hôm nay, 7 ngày, Tháng này, Tháng trước, Quý này, Tùy chọn.
- Kho: Tất cả kho hoặc một kho cụ thể.
- Nhãn “Cập nhật lúc” khi có dữ liệu.
- Nút làm mới chỉ xuất hiện nếu cần; thay đổi bộ lọc tự tải lại theo hành vi hiện có.

### 6.2 Hàng KPI chính

Ưu tiên bốn KPI có giá trị quản trị:

1. Giá trị tồn kho hiện tại.
2. Giá trị nhập trong kỳ.
3. Chi phí xuất dùng trong kỳ.
4. Chi phí nhiên liệu hoặc doanh thu bán/thanh lý trong kỳ, chọn theo dữ liệu sẵn có và độ tin cậy.

Mỗi KPI phải có nhãn, giá trị, đơn vị và ngữ cảnh kỳ. Chỉ hiển thị so sánh/tăng giảm khi có dữ liệu kỳ đối chiếu đáng tin cậy; không suy đoán phần trăm.

### 6.3 Trung tâm cảnh báo

Hiển thị danh sách tối đa 5–7 tín hiệu cần chú ý, sắp xếp theo mức độ:

- Phương tiện vượt định mức nhiên liệu.
- Khu/trại có tỷ trọng chi phí cao hoặc tăng bất thường theo quy tắc được xác định từ dữ liệu cùng kỳ.
- Sự cố thiết bị đang mở hoặc khối lượng sự cố đáng chú ý.
- Vật tư tồn thấp nếu dữ liệu ngưỡng tồn đã có trong nguồn hiện hành.
- Công cụ mượn quá hạn nếu dữ liệu có sẵn qua view/report hiện hành.

Mỗi cảnh báo gồm: mức độ, tiêu đề ngắn, số liệu làm bằng chứng, phạm vi thời gian và CTA mở báo cáo liên quan. Nếu một loại cảnh báo thiếu dữ liệu đáng tin cậy, loại đó không xuất hiện thay vì hiển thị số 0 gây hiểu nhầm.

### 6.4 Điểm nóng và phân bổ

- Top khu/trại theo chi phí vật tư.
- Top phương tiện tiêu hao hoặc vượt định mức.
- Phân bổ giá trị/chi phí theo nhóm vật tư.

Ưu tiên bảng xếp hạng, progress bar và sparkline đơn giản nếu dữ liệu hỗ trợ; chart phân tích phức tạp thuộc Metabase.

### 6.5 Lối tắt

Các CTA từ Tổng quan phải chuyển thẳng đến báo cáo nghiệp vụ tương ứng và giữ bộ lọc hiện tại:

- Xem XNT
- Xem chi phí theo trại
- Xem phương tiện
- Mở phân tích BI

## 7. Báo cáo nghiệp vụ

### 7.1 Bộ lọc và hành động

- Bộ lọc ngày/kho nằm ở đầu khu vực và chỉ hiển thị trường có nghĩa với báo cáo đang chọn.
- Excel/PDF đặt cạnh tên báo cáo, không nằm lẫn trong điều hướng.
- Với Thẻ kho, Excel/PDF bị vô hiệu hóa đến khi chọn vật tư; có giải thích rõ.
- Thay đổi báo cáo không làm mất kỳ/kho đang chọn.

### 7.2 Hành vi các báo cáo

- **XNT:** giữ công thức Tồn đầu + Nhập − Xuất = Tồn cuối và bảng ledger hiện có.
- **Theo trại:** giữ tổng chi phí, tỷ trọng, số lượt cấp và drill-down vật tư.
- **Phương tiện:** giữ tổng lít, quãng đường/giờ, định mức và trạng thái vượt chuẩn.
- **Đối tác:** giữ tổng hợp nhà cung cấp và khách hàng.
- **Thẻ kho:** giữ chọn SKU/kho, bút toán và số dư lũy kế.

Tất cả báo cáo phải có trạng thái loading, empty và error tại chính vùng nội dung; dữ liệu cũ không được trình bày như dữ liệu mới khi request thất bại.

## 8. Phân tích chuyên sâu Metabase

- Metabase nằm trong khu vực “Phân tích chuyên sâu”, không là tab mặc định.
- Giữ danh sách dashboard chuyên đề, mở Studio và toàn màn hình.
- Không hiển thị chi tiết hạ tầng như port/PostgreSQL cho người dùng nghiệp vụ.
- Nếu chưa cấu hình, hiển thị empty state có hướng dẫn quản trị thay vì iframe lỗi.
- Nếu tải iframe thất bại, cung cấp retry và link mở Metabase trực tiếp khi có URL hợp lệ.
- Bộ lọc native chỉ truyền sang Metabase khi dashboard có contract filter tương ứng; không giả định mọi dashboard nhận cùng bộ lọc.

## 9. Luồng dữ liệu và ownership

### 9.1 Chủ sở hữu chuẩn

- `src/features/reports/queries.ts`: truy vấn và tổng hợp dữ liệu báo cáo.
- `src/features/reports/actions.ts`: cổng server action có kiểm tra quyền.
- `src/features/reports/types.ts`: hợp đồng dữ liệu báo cáo.
- `src/features/reports/components/`: trình bày và tương tác.
- `src/lib/metabase.ts`: cấu hình/ký URL Metabase, không sở hữu KPI native.

### 9.2 Dữ liệu Tổng quan

Tổng quan sử dụng một hợp đồng dữ liệu chuyên biệt được tổng hợp ở server từ các truy vấn hiện hành. Không để component client tự ghép nhiều nguồn thành quy tắc nghiệp vụ. Các rule cảnh báo phải là hàm thuần có test hoặc kết quả từ query tổng hợp có test.

### 9.3 Tải dữ liệu

- Dữ liệu Tổng quan mặc định được tải server-side để first paint có nội dung.
- Báo cáo nghiệp vụ tải lazy theo lựa chọn và có cache theo key `report + from + to + location + variant` trong vòng đời trang.
- Chống race condition: response cũ không được ghi đè lựa chọn/bộ lọc mới.
- Metabase chỉ khởi tạo khi người dùng mở khu vực BI.

## 10. Trạng thái giao diện và accessibility

- **Loading:** skeleton theo cấu trúc nội dung, không thay icon tab bằng spinner như tín hiệu duy nhất.
- **Empty:** nói rõ “không có dữ liệu trong kỳ/bộ lọc này” và đề xuất đổi bộ lọc.
- **Error:** giữ khu vực điều hướng/bộ lọc, hiển thị lỗi cục bộ và nút thử lại.
- **Partial:** nếu một khối Tổng quan lỗi, các khối còn lại vẫn hiển thị; khối lỗi có trạng thái riêng.
- **Accessibility:** dùng `tablist/tab/tabpanel` đúng quan hệ, hỗ trợ bàn phím, focus visible, nhãn icon và độ tương phản.
- **Responsive:** KPI 1 cột trên màn hình hẹp, 2 cột trên tablet, 4 cột trên desktop; bảng có container cuộn ngang và cột nhận diện chính được ưu tiên.

## 11. Compatibility boundary

Phải giữ:

- Route `/reports` và gate `requireManager()`.
- Hợp đồng API export/PDF hiện đang được các báo cáo sử dụng.
- Công thức và nguồn sự thật của XNT, giá trị tồn, chi phí, nhiên liệu.
- Các component báo cáo chi tiết có thể được bọc/tái sử dụng thay vì viết lại toàn bộ.
- Metabase là tùy chọn bổ sung; lỗi Metabase không được làm hỏng báo cáo native.

Được thay đổi:

- Kiểu `ReportTab` và cách biểu diễn navigation state.
- Hợp đồng dữ liệu Tổng quan để bổ sung cảnh báo/điểm nóng.
- Cấu trúc `ReportsHub` nhằm tách navigation, data orchestration và nội dung.

## 12. Kiểm thử và xác minh

### 12.1 Test tự động

- Unit test cho rule cảnh báo và thứ tự ưu tiên.
- Component test cho ba khu vực cấp một, deep link, query parameter sai và CTA drill-down.
- Component test cho loading/empty/error/partial states.
- Regression test cho bộ lọc, lazy load, cache key và chống response race.
- Regression test cho URL Excel/PDF của từng báo cáo.
- Test Metabase cho configured, unconfigured và load error.

### 12.2 Quality gates

- `pnpm test -- src/features/reports`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Browser smoke test desktop và mobile cho `/reports`: điều hướng, bộ lọc, drill-down, export và trạng thái Metabase.

## 13. Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| KPI/cảnh báo sai nghĩa | Chỉ dùng nguồn hiện có, rule có bằng chứng và test; ẩn tín hiệu thiếu dữ liệu |
| Component hub tiếp tục phình to | Tách config điều hướng, data hook/orchestrator và từng section component |
| Request cũ ghi đè dữ liệu mới | Request key hoặc sequence guard; test race condition |
| Metabase không khả dụng | Lazy load, error boundary/empty state cục bộ; native reports độc lập |
| Mobile khó dùng với bảng lớn | Điều hướng dọc/select, bảng cuộn có nhãn rõ, CTA ưu tiên |
| Ghi đè thay đổi đang làm dở | Bảo toàn và tích hợp phần Metabase hiện có; không reset các file dirty ngoài phạm vi |

## 14. Artifact phạm vi

### TaskIntentDraft

- **Outcome:** Trung tâm Báo cáo giúp ra quyết định nhanh nhưng vẫn giữ đầy đủ sổ nghiệp vụ.
- **Success evidence:** Tổng quan mặc định, cảnh báo có CTA, năm báo cáo chi tiết còn hoạt động, Metabase ở cấp chuyên sâu, test và browser smoke pass.
- **Stop condition:** Không mở rộng schema hoặc xây hệ thống BI/chart mới.
- **Non-goals:** Không đổi quyền, công thức kế toán hoặc API export nếu chưa cần.

### BaselineReadSetHint

- `docs/superpowers/specs/2026-09-08-reports-and-analytics-design.md` (tài liệu này, được cập nhật tại chỗ).
- `docs/aegis/BASELINE-GOVERNANCE.md`.
- `docs/reference/app-routes-and-navigation.md`.
- `docs/user-guide/11-bao-cao-phan-tich.md`.
- Các owner hiện hành trong `src/features/reports`.

### BaselineUsageDraft

- **Required refs:** đặc tả báo cáo, baseline governance, source hiện hành.
- **Acknowledged before plan:** đã đọc.
- **Missing refs:** không có blocker; Hindsight không khả dụng do thiếu API token.
- **Decision:** continue.

### ImpactStatementDraft

- **Affected layers:** UI navigation, client data orchestration, report query/action/type, report tests, user guide.
- **Canonical owner:** `src/features/reports`; Metabase config ở `src/lib/metabase.ts`.
- **Preserved invariants:** auth, route, số liệu ledger, export/PDF, native reports độc lập với Metabase.
- **Compatibility:** deep link mới bổ sung; route cũ vẫn hoạt động.
- **Retirement:** thanh bảy tab ngang và mapping navigation cũ được thay thế hoàn toàn, không giữ hai hệ điều hướng song song.
