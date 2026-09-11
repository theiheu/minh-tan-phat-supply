# Kế hoạch Lộ trình Phát triển Toàn diện Trại Gà Minh Tân Phát (Master Roadmap)

> **Mục tiêu tài liệu:** Bản kế hoạch (Plan) chuẩn hóa theo lộ trình từng giai đoạn (Phases) để mở rộng hệ thống từ Quản lý Vật tư/Kho/Dầu sang Hệ sinh thái Quản trị Trại gà đẻ trứng Toàn diện (Smart Poultry ERP).  
> **Trạng thái:** Durable Roadmap Plan (Lưu giữ để xem xét và triển khai từng giai đoạn trong tương lai).

---

## TỔNG QUAN LỘ TRÌNH 4 GIAI ĐOẠN

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN HIỆN TẠI (ĐÃ HOÀN THÀNH & ỔN ĐỊNH)                           │
│ - Quản lý Kho vật tư, Linh kiện cơ điện, Đồ hỏng, Đổi mới, Sửa chữa    │
│ - Quản lý Trạm cấp dầu, ODO xe/máy phát, Báo cáo XNT, Offline PWA & QR  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: QUẢN LÝ ĐÀN GÀ & THU HOẠCH TRỨNG THƯƠNG PHẨM              │
│ - Quản lý lứa gà theo dãy chuồng, theo dõi gà chết/loại thải hằng ngày │
│ - Nhật ký thu nhặt trứng theo ca, phân loại trứng, tính % Tỷ lệ đẻ    │
│ - Xuất bán trứng cho thương lái & Quản lý bảng giá trứng theo ngày     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: THỨC ĂN, CHỈ SỐ FCR & LỊCH THÚ Y VẮC-XIN TỰ ĐỘNG          │
│ - Quản lý cấp cám, định mức g/con/ngày, chỉ số FCR, cảnh báo ăn giảm   │
│ - Lịch vắc-xin tự động theo tuần tuổi, cảnh báo cách ly thuốc (kháng sinh)│
│ - Tự động liên kết xuất kho thức ăn & thuốc từ Kho vật tư              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: TÀI CHÍNH NÔNG TRẠI, GIÁ THÀNH 1 QUẢ TRỨNG & LÃI/LỖ P&L    │
│ - Báo cáo Giá thành sản xuất 1 quả trứng (Cost per Egg) theo ngày     │
│ - Báo cáo P&L Doanh thu - Chi phí toàn trại & từng lứa gà              │
│ - Chấm công ca nhặt trứng & Công thức tính thưởng năng suất chuồng     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## CHI TIẾT CÁC TASK PHÁT TRIỂN THEO TỪNG GIAI ĐOẠN

### GIAI ĐOẠN 1: QUẢN LÝ ĐÀN GÀ & THU HOẠCH TRỨNG THƯƠNG PHẨM

#### Task 1.1: Database Migration — Bảng Đàn gà & Thu hoạch Trứng
- [ ] **Database Schema:**
  - Tạo bảng `flocks` (lứa gà, ngày nhập, giống, số lượng ban đầu, số lượng hiện tại, trạng thái).
  - Tạo bảng `flock_mortality_logs` (nhật ký gà chết, gà loại, nguyên nhân chết).
  - Tạo bảng `egg_collections` (nhặt trứng theo ca sáng/chiều, phân loại trứng loại 1, loại 2, jumbo, dập, méo, bẩn, % đẻ).
  - Tạo bảng `egg_price_rates` & `egg_sales` & `egg_sale_items` (xuất bán trứng cho thương lái).
- [ ] **RLS Policies & Indexes:**
  - Đánh index `idx_flocks_zone_sub_zone`, `idx_egg_collections_flock_date`, `idx_mortality_flock_date`.
  - Phân quyền: `requester` được ghi nhận thu trứng và gà chết của chuồng mình; `manager` quản lý giá và xuất bán.

#### Task 1.2: Backend Actions & Logic Tính toán Tự động
- [ ] **Server Actions:**
  - `recordEggCollection(data)`: Ghi nhận số trứng thu được, tự động tính `laying_rate_percent`.
  - `recordMortality(data)`: Ghi nhận gà chết/loại, tự động cập nhật giảm `current_quantity` của đàn gà.
  - `createEggSale(data)`: Tạo phiếu xuất bán trứng, tính tổng tiền theo bảng giá ngày xuất.
  - `setDailyEggPrice(data)`: Thiết lập bảng giá trứng theo ngày.

#### Task 1.3: Giao diện Người dùng (UI/UX)
- [ ] **Màn hình Nhặt trứng trên Mobile (`/production/eggs`):**
  - Giao diện nút bấm số lớn, tối ưu hóa cho công nhân thao tác tại chuồng.
  - Quét mã QR đầu dãy chuồng để tự động chọn đúng Flock/Sub-zone.
- [ ] **Màn hình Quản lý Đàn gà (`/production/flocks`):**
  - Danh sách các dãy chuồng, số lượng gà hiện tại, số tuần tuổi, % đẻ ngày hôm nay.
- [ ] **Màn hình Xuất bán Trứng (`/production/sales`):**
  - Tạo đơn bán trứng, chọn đại lý/thương lái, in phiếu xuất bán trứng A4/A5 chuẩn.

---

### GIAI ĐOẠN 2: DINH DƯỠNG THỨC ĂN, FCR & LỊCH VẮC-XIN THÚ Y

#### Task 2.1: Quản lý Tiêu thụ Cám & Chỉ số FCR
- [ ] **Database & Logic:**
  - Tạo bảng `flock_feed_consumptions`.
  - Logic tính: $	ext{Định mức ăn} = rac{	ext{Tổng kg cám} 	imes 1000}{	ext{Tổng số gà sống}}$ (g/con/ngày).
  - Logic tính FCR: $	ext{FCR} = rac{	ext{Tổng kg cám tiêu thụ}}{	ext{Tổng kg trứng sản xuất}}$.
  - Cảnh báo tự động: Khi chuồng ăn giảm $> 5%$ so với trung bình 3 ngày trước.
- [ ] **Tích hợp Kho:** Khi bấm xác nhận cấp cám $ightarrow$ Tự động trừ tồn kho Cám trong Kho chính.

#### Task 2.2: Lịch Vắc-xin & An toàn Sinh học
- [ ] **Database & Logic:**
  - Tạo bảng `vaccine_schedules` (lịch vắc-xin chuẩn theo tuần tuổi).
  - Tạo bảng `flock_treatments` (nhật ký điều trị kháng sinh, ngưng thuốc).
  - Tự động sinh lịch nhắc vắc-xin khi tạo một lứa gà mới (`flock`).
  - Gửi thông báo Notification và Email cho Trưởng trại trước 3 ngày đến lịch vắc-xin.
- [ ] **Cảnh báo Thời gian Cách ly:** Khóa hoặc cảnh báo đỏ khi xuất bán gà thịt nếu chuồng chưa hết hạn ngưng thuốc.

---

### GIAI ĐOẠN 3: TÀI CHÍNH NÔNG TRẠI, GIÁ THÀNH 1 QUẢ TRỨNG & P&L TỔNG THỂ

#### Task 3.1: Báo cáo Giá thành Sản xuất 1 Quả Trứng (Cost per Egg)
- [ ] **Logic Tổng hợp Giá thành:**
  - Chi phí thức ăn (tính từ xuất cám thực tế).
  - Khấu hao gà giống hậu bị (phân bổ theo tuần đẻ từ tuần 18 đến tuần 75).
  - Chi phí vắc-xin & thuốc thú y.
  - Chi phí điện, dầu máy phát, dầu xe dọn phân (kế thừa từ module `fuel`).
  - Chi phí vật tư hỏng hóc, sửa chữa (kế thừa từ module `defects` & `repairs`).
  - Chi phí nhân công phân bổ.
- [ ] **Dashboard Tài chính:**
  - Biểu đồ biến động giá thành sản xuất so với giá bán thị trường theo từng ngày.
  - Báo cáo Lãi/Lỗ ròng (Net Profit) của toàn trại và từng dãy chuồng.

#### Task 3.2: Quản lý Nhân sự & Thưởng Năng suất Chuồng
- [ ] **Chấm công & Ca trực chuồng:**
  - Quản lý phân công công nhân phụ trách từng dãy chuồng.
- [ ] **Công thức Thưởng Năng suất:**
  - Thưởng vượt % đẻ chuẩn giống.
  - Thưởng giữ tỷ lệ chết thấp ($< 0.05%/	ext{ngày}$).
  - Thưởng tỷ lệ trứng dập vỡ thấp ($< 0.5%$).

---

## NGUYÊN TẮC BẢO TOÀN HIỆU NĂNG KHI PHÁT TRIỂN TIẾP THEO

1. **Giữ vững kiến trúc hiện tại:**
   - Mọi danh mục tham chiếu (Flocks, Breeds, Egg Grades, Feed Types) đều đưa vào bộ nhớ đệm `src/lib/cached-metadata.ts`.
   - Mọi bảng danh sách (Nhặt trứng, Tiêu thụ cám, Bán trứng) luôn phân trang `PAGE_SIZE = 20`.
   - Thư viện xuất biểu đồ nâng cao hoặc PDF chỉ nạp động khi cần (`dynamic import`).
2. **Không phá vỡ dữ liệu cũ:**
   - Các bảng `zones`, `sub_zones`, `variants`, `stock_balances`, `audit_logs`, `fuel_dispenses` giữ nguyên làm nền tảng vững chắc kết nối xuyên suốt các giai đoạn.
