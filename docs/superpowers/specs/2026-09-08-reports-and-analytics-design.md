# Đặc tả Kỹ thuật: Phân hệ Báo cáo & Thống kê Toàn diện (Chung & Riêng)

**Ngày:** 2026-09-08 · **Trạng thái:** Bản thiết kế hoàn chỉnh (Chờ duyệt kế hoạch) · **Phạm vi:** `minh-tan-phat-supply`

---

## 1. Bối cảnh & Mục tiêu

Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân Phát Supply) vận hành với quy mô công nghiệp:
- Hàng trăm danh mục vật tư cơ điện, thuốc thú y, bao bì vỉ trứng, phụ kiện chuồng trại.
- Hàng chục khu chuồng đẻ, chuồng hậu bị, nhà ấp, trạm cơ điện.
- Dàn xe cơ giới (xe ben chở phân, xe xúc lật, xe bồn) và máy phát điện dự phòng 250kVA tiêu thụ lượng lớn dầu Diesel.
- Giao dịch liên tục với nhiều Nhà cung cấp (mua vật tư) và Khách hàng/Thương lái (bán phân, bán vỉ, bán tài sản cũ/ve chai).

### Mục tiêu phân hệ Báo cáo:
Xây dựng một trung tâm Báo cáo & Thống kê (Unified Report Hub) tại `/reports` phục vụ Chủ trại, Quản lý kho và Kế toán:
1. **Báo cáo Chung (Toàn trại):** Xuất - Nhập - Tồn (XNT) đa chiều, biến động giá trị tài sản kho, tổng hợp sự cố thiết bị (hỏng / sửa / thanh lý), và tổng quan nhiên liệu dầu.
2. **Báo cáo Riêng (Theo từng đối tượng nghiệp vụ):**
   - **Khu vực / Chuồng trại (Zone Cost):** Chi phí vật tư từng chuồng để tính giá thành trứng & phát hiện chuồng hao phí bất thường.
   - **Phương tiện / Máy móc (Vehicle Fuel & Machinery):** Tiêu hao nhiên liệu từng xe/máy, so sánh định mức Lít/100km hoặc Lít/giờ, cảnh báo vượt định mức.
   - **Nhà cung cấp (Suppliers):** Thống kê tiền nhập hàng, tần suất giao hàng theo từng nhà cung cấp.
   - **Khách hàng / Thương lái (Customers):** Thống kê doanh thu xuất bán theo từng đối tác.
   - **Sổ Thẻ Kho Chi Tiết (Stock Card):** Tra cứu dòng lịch sử biến động từng mã vật tư theo thời gian và mã chứng từ.
3. **Trực quan hóa & Xuất báo cáo:**
   - Thẻ KPI số liệu + Thanh tiến độ tỷ lệ (Tailwind CSS) tải siêu nhanh, nhẹ và mượt trên thiết bị di động thực địa.
   - Xuất file Excel (`.xlsx`) chuẩn hóa qua SheetJS.
   - In ấn Báo cáo PDF chuẩn khổ A4 mang nhận diện thương hiệu Trại Gà Lê Văn Dương.

---

## 2. Kiến trúc & Thiết kế Giao diện (UI/UX Architecture)

Giao diện `/reports` được tổ chức dạng **Unified Tabbed Hub** với thanh điều hướng và bộ lọc dùng chung:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🌾 TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG — TRUNG TÂM BÁO CÁO & THỐNG KÊ             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📅 BỘ LỌC DÙNG CHUNG:                                                       │
│ [ Hôm nay | 7 ngày qua | Tháng này | Tháng trước | Quý này | Tùy chọn ngày] │
│ Kho áp dụng: [ Tất cả kho ▼ ]       Từ: [2026-09-01]  Đến: [2026-09-30]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ [📊 Báo cáo Chung] [🏠 Theo Chuồng] [🚜 Phương tiện] [🤝 Đối tác] [📑 Thẻ kho]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Tab 1: Báo cáo Chung (Toàn trại - Overview & Ledger XNT)
1. **Thẻ KPI Tổng quan:**
   - **Tổng giá trị kho hiện tại (VNĐ)**: Giá trị tồn theo đơn giá niêm yết.
   - **Tổng tiền nhập kho trong kỳ**: Tổng giá trị hàng từ Nhà cung cấp.
   - **Tổng chi phí vật tư đã xuất dùng**: Cấp cho chuồng + đổi hỏng.
   - **Doanh thu xuất bán & thanh lý**: Tiền thu từ bán phân, vỉ, phế liệu.
2. **Bảng Báo cáo Xuất - Nhập - Tồn (XNT) Tổng Hợp:**
   - Các cột:
     - `Mã VT` & `Tên vật tư`
     - `Biến thể & ĐVT`
     - `Tồn đầu kỳ`
     - `Nhập trong kỳ` (Nhập NCC + Hoàn nhập sửa chữa + Kiểm kê tăng)
     - `Xuất trong kỳ` (Cấp nội bộ + Xuất bán + Đổi hỏng + Xuất sửa chữa + Thanh lý + Kiểm kê giảm)
     - `Tồn cuối kỳ` (Tồn đầu + Nhập - Xuất)
     - `Đơn giá`
     - `Giá trị tồn cuối (VNĐ)`
   - Hàng Tổng cộng toàn kho ở chân bảng.
3. **Phân bổ Chi phí Vật tư theo Nhóm Danh Mục:**
   - Thanh tỷ lệ % chi phí theo từng nhóm: *Cơ điện quạt gió, Thuốc sát trùng, Phụ kiện chuồng, Bao bì vỉ trứng...*
4. **Tổng hợp Sự cố & Thiết bị (Hư hỏng - Sửa chữa - Thanh lý):**
   - Tổng số lượt hỏng đổi 1-1, số thiết bị phục hồi sau sửa chữa, tổng chi phí thuê thợ quấn/sửa, doanh thu thanh lý phế liệu ve chai.
5. **Tổng hợp Kho Dầu:**
   - Tổng lít dầu nhập bồn, tổng lít dầu đã cấp phát, tồn bồn thực tế, tổng chi phí dầu.

---

### 2.2. Tab 2: Báo cáo Riêng theo Chuồng / Khu vực (Zone Cost Analysis)
1. **Bảng Chi phí từng Khu Chuồng:**
   - Liệt kê: Chuồng Đẻ 1..N, Chuồng Hậu Bị 1..N, Nhà Ấp, Nhà Cơ Điện, Trạm Bơm, Văn Phòng...
   - Cột: `Tên khu vực` - `Tổng chi phí vật tư (VNĐ)` - `Tỷ trọng (%)` - `Số lượt cấp phát` - `Số lần báo hỏng đổi 1-1`.
   - Thanh tỷ lệ % trực quan so sánh giữa các chuồng để Quản lý nhận biết ngay chuồng nào tiêu hao đột biến.
2. **Xem chi tiết Vật tư theo từng Chuồng (Drilldown / Modal / Bảng chi tiết):**
   - Khi bấm vào 1 chuồng cụ thể (VD: Chuồng Đẻ 3): Hiển thị chi tiết từng mặt hàng đã cấp cho chuồng đó trong kỳ (Tên hàng, số lượng, đơn giá, thành tiền, ngày cấp, người nhận).

---

### 2.3. Tab 3: Báo cáo Riêng Phương tiện & Máy móc (Vehicles & Machinery)
1. **Bảng Thống kê Tiêu hao Nhiên liệu theo Xe & Máy:**
   - Danh sách: Xe ben dọn phân, Xe xúc lật, Xe bồn cám, Máy phát điện Cummins 250kVA, Xe ba gác...
   - Cột: `Mã xe` - `Tên xe / Model` - `Biển số` - `ĐVT (km / hours)` - `Tổng lít dầu đã cấp` - `Tổng quãng đường/giờ chạy` - `Mức tiêu hao thực tế (L/100km hoặc L/h)` - `Định mức quy định` - `Chênh lệch` - `Trạng thái (Bình thường / Vượt định mức)`.
   - Highlight cảnh báo: Màu đỏ nếu vượt định mức, màu xanh nếu đạt định mức.
2. **Lịch sử các lần đổ dầu của phương tiện:**
   - Ngày giờ, số lít, chỉ số Odo/giờ chạy trước & sau, tài xế/người vận hành, người cấp dầu.

---

### 2.4. Tab 4: Báo cáo Riêng Đối tác (Nhà Cung Cấp & Khách Hàng)
1. **Phân hệ Nhà Cung Cấp (Suppliers):**
   - Thống kê theo từng NCC: `Tên nhà cung cấp` - `Số phiếu nhập` - `Tổng số lượng hàng nhập` - `Tổng giá trị tiền hàng (VNĐ)` - `Các mặt hàng chủ lực`.
2. **Phân hệ Khách Hàng / Thương Lái (Customers):**
   - Thống kê xuất bán theo thương lái: `Tên khách hàng` - `Số phiếu xuất bán` - `Tổng doanh thu bán ra (VNĐ)` - `Mặt hàng mua` (Phân gà, vỉ trứng, phế liệu).

---

### 2.5. Tab 5: Sổ Thẻ Kho Chi Tiết (Stock Card)
1. **Bộ chọn Vật tư & Kho:**
   - Chọn 1 vật tư / biến thể cụ thể (Hỗ trợ tìm kiếm theo tên hoặc mã QR).
   - Chọn Kho (Kho chính, Kho dầu, Kho hỏng...).
2. **Bảng Sổ Chi Tiết Biến Động Vật Tư:**
   - Cột: `Ngày giờ` - `Mã chứng từ` (Click mở chi tiết phiếu) - `Loại nghiệp vụ` (Nhập NCC, Xuất Chuồng, Đổi 1-1, Gửi sửa chữa, Hoàn sửa chữa, Thanh lý, Cân bằng kiểm kê) - `Diễn giải / Ghi chú` - `Số lượng Nhập` - `Số lượng Xuất` - `Tồn lũy kế sau phát sinh` - `Người thực hiện`.

---

## 3. Thiết kế Data Fetching & Business Logic

### 3.1. Thuật toán Tính toán Xuất - Nhập - Tồn (XNT Engine)
Để đảm bảo số liệu chính xác 100% khớp với Ledger kế toán:
- **Tồn cuối kỳ hiện tại:** Lấy từ `stock_balances` (hoặc `variant_stock`).
- **Biến động trong kỳ lọc `[from_date, to_date]`:**
  - Nhập trong kỳ ($Qty_{in}$) = $\sum$ `stock_movements.quantity` với `movement_type` $\in$ (`receipt_in`, `repair_return_in`, `adjustment_in`).
  - Xuất trong kỳ ($Qty_{out}$) = $\sum$ `stock_movements.quantity` với `movement_type` $\in$ (`issue_out`, `defect_out`, `repair_out`, `liquidation_out`, `adjustment_out`, `tool_borrow_out`).
- **Tồn đầu kỳ ($Qty_{opening}$):**
  - Tồn đầu kỳ = Tồn cuối kỳ - Tổng biến động từ ngày $from\_date$ đến hiện tại.
  - Hoặc: Tồn tại thời điểm $from\_date$ = Tồn đầu kỳ khởi tạo + $\sum$ biến động trước $from\_date$.
- **Giá trị tồn:**
  - $Value = Qty \times Price$ (lấy theo `variants.price` niêm yết hoặc đơn giá bình quân).

### 3.2. Thuật toán Tính Chi phí Khu vực (Zone Cost)
- Truy vấn bảng `issues` join `issue_items` và `defect_notes` join `defect_items` theo `zone_id` và thời gian lọc `created_at`.
- Chi phí vật tư = $\sum (\text{Số lượng cấp} \times \text{Đơn giá vật tư})$.

### 3.3. Thuật toán Tiêu hao Nhiên liệu (Fuel Consumption)
- Lấy từ `fuel_logs` group by `vehicle_id`.
- Tiêu hao xe chạy km: $\text{Rate} = (\text{Tổng lít} / \Delta\text{km}) \times 100$.
- Tiêu hao máy phát chạy giờ: $\text{Rate} = \text{Tổng lít} / \Delta\text{giờ}$.

---

## 4. Thiết kế Xuất File & In Ấn (Export & PDF)

### 4.1. Xuất File Excel (`.xlsx`) đa năng
- Tạo API route `/api/reports/export` hỗ trợ xuất file Excel định dạng chuẩn:
  - Header: Tên trang trại, tên loại báo cáo, kỳ báo cáo (Từ ngày ... Đến ngày ...).
  - Bảng dữ liệu có tiêu đề cột rõ ràng, định dạng số ngăn cách hàng nghìn (`1,000,000`).
  - Hàng tổng cộng tự động cộng dồn.
  - Tham số `type`: `stock_ledger` (XNT), `zone_cost` (Theo chuồng), `vehicles` (Nhiên liệu xe), `partners` (Đối tác), `stock_card` (Thẻ kho).

### 4.2. In Ấn Báo Cáo PDF Chuẩn Khổ A4
- Tạo API route `/api/reports/pdf` render trực tiếp PDF khổ A4 bằng `@react-pdf/renderer` hoặc popup in chuyên dụng:
  - Header chuẩn:
    ```
    TRẠI GÀ ĐẺ TRỨNG LÊ VĂN DƯƠNG
    Ấp Tân Tiến, xã Minh Tân, huyện Dầu Tiếng, tỉnh Bình Dương
    Hotline: 0988 365 238 - 0963 077 879
    ```
  - Chữ ký 3 bên: Người lập báo cáo - Kế toán trại - Quản lý / Chủ trại duyệt.

---

## 5. Kế hoạch Từng bước Triển khai

1. **Giai đoạn 1 (Server Queries & Data Aggregators):**
   - Viết các hàm query dữ liệu báo cáo tối ưu trong `src/features/reports/queries.ts` (XNT toàn trại, Chi phí theo chuồng, Nhiên liệu theo xe, Đối tác NCC/Khách, Sổ thẻ kho).
2. **Giai đoạn 2 (UI Components & Tabs):**
   - Xây dựng thanh lọc ngày chuẩn `src/features/reports/components/report-date-filters.tsx`.
   - Xây dựng Tab Báo cáo Chung `src/features/reports/components/general-report-tab.tsx`.
   - Xây dựng Tab Báo cáo Chi phí Chuồng `src/features/reports/components/zone-cost-report-tab.tsx`.
   - Xây dựng Tab Báo cáo Phương tiện `src/features/reports/components/vehicle-report-tab.tsx`.
   - Xây dựng Tab Báo cáo Đối tác `src/features/reports/components/partners-report-tab.tsx`.
   - Xây dựng Tab Sổ Thẻ Kho `src/features/reports/components/stock-card-tab.tsx`.
3. **Giai đoạn 3 (Export & Print):**
   - Nâng cấp API xuất Excel `/api/reports/export` hỗ trợ đầy đủ 5 tab.
   - Nâng cấp chức năng In PDF báo cáo.
4. **Giai đoạn 4 (Tích hợp & Kiểm thử):**
   - Ghép toàn bộ vào trang chính `/reports`.
   - Viết unit test / integration test cho các thuật toán tính toán báo cáo.
   - Kiểm tra giao diện trên cả Desktop và Điện thoại.

---
*(Tài liệu đặc tả kiến trúc được chuẩn bị cho quá trình lập Kế hoạch thực thi chi tiết)*
