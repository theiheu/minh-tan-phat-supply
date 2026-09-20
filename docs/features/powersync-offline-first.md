# Tính Năng Mới: Công Nghệ Đồng Bộ Dữ Liệu Ngoại Tuyến PowerSync (Local-First Sync Engine)

> **Phần mềm:** Minh Tân Phát Supply — Hệ Thống Quản Lý Kho & Vận Hành Trại Gà  
> **Phiên bản áp dụng:** v2.5+  
> **Công nghệ nền tảng:** PowerSync Engine + SQLite (WASM/OPFS) + Supabase PostgreSQL 17  

---

## 1. Bối Cảnh Thực Tế & Động Lực Phát Triển

Trang trại gà đẻ trứng **Lê Văn Dương** (Minh Tân, Dầu Tiếng, Bình Dương) có quy mô hàng chục hecta với hệ thống chuồng kín cách nhiệt, khu cách ly kiểm dịch, trạm biến áp, kho vật tư tổng và bãi xe cơ giới.

### Thách thức vận hành trước đây:
- **Khu vực mất sóng:** Bên trong các dãy chuồng lạnh, khu cách ly hoặc góc kho sâu, sóng 4G/Wifi thường xuyên chập chờn hoặc mất hẳn kết nối.
- **Gián đoạn công việc:** Kỹ thuật viên và công nhân không thể mở danh mục để tra cứu mã phụ tùng thay thế, không tạo được phiếu lĩnh vật tư khẩn cấp, và tài xế/người vận hành không thể ghi nhận số lít dầu cấp phát cho xe tại bãi máy.
- **Rủi ro sai lệch dữ liệu:** Cơ chế lưu nháp thủ công trước đây chỉ hỗ trợ một phần nhỏ phiếu yêu cầu, không thể tìm kiếm vật tư offline và dễ xảy ra lỗi lệch dữ liệu nếu danh mục ở máy chủ đã thay đổi.

👉 **Giải pháp đột phá:** Tích hợp **PowerSync Engine**, đưa toàn bộ cơ sở dữ liệu danh mục cần thiết về lưu trữ trực tiếp trong **SQLite siêu nhẹ (WASM/OPFS)** trên chính trình duyệt điện thoại của nhân viên.

---

## 2. Điểm Khác Biệt Của Kiến Trúc Local-First

Khác với các ứng dụng Web truyền thống phải gửi yêu cầu qua mạng mỗi khi bấm nút:

1. **Mô hình Cũ (Online-Only / REST):**
   - Người dùng gửi yêu cầu qua mạng 3G/4G tới máy chủ Supabase.
   - Khi mất sóng, trang bị treo hoặc báo lỗi 'Không có kết nối mạng'.

2. **Mô hình Mới PowerSync (Local-First):**
   - Người dùng đọc/ghi trực tiếp trên cơ sở dữ liệu SQLite cục bộ trong máy (Độ trễ 0ms).
   - Hoạt động 100% bình thường khi mất sóng hoàn toàn.
   - Ngay khi có mạng trở lại, PowerSync tự động đồng bộ ngầm hai chiều với máy chủ Supabase.

---

## 3. Các Phân Hệ Thực Địa Được Kích Hoạt Ngoại Tuyến

### 3.1. Tra Cứu Kho & Danh Mục Vật Tư Tức Thì (Offline Catalog)
- **Tốc độ phản hồi 0ms:** Toàn bộ danh mục hàng nghìn SKU, nhóm hàng, quy cách đóng gói và đơn vị tính quy chuẩn đã được nạp sẵn vào bộ nhớ thiết bị.
- **Tìm kiếm thông minh (Instant Search):** Lọc theo tên vật tư, mã SKU, phân loại nhóm hàng diễn ra tức thì mà không cần chờ tải mạng.

### 3.2. Lập Phiếu Yêu Cầu Cấp Phát Vật Tư (Offline Requisitions)
- Nhân viên trong chuồng trại có thể lập phiếu yêu cầu cấp phát vật tư (bóng đèn, cám, thuốc thú y, vòi uống nước...) ngay tại hiện trường.
- Phiếu được ghi nhận an toàn vào SQLite trên máy và tự động đồng bộ lên máy chủ Supabase ngay khi bước ra khỏi chuồng có sóng trở lại.

### 3.3. Quét QR & Ghi Nhận Nhiên Liệu Xe Cơ Giới (Offline Fuel Dispensing)
- Bãi xe và trạm nhiên liệu nội bộ không cần wifi cố định.
- Quét mã QR gắn trên xe tải, máy cày, xe nâng để nhận diện phương tiện và nhập chỉ số công tơ mét, số lít dầu DO cấp phát.
- Hệ thống tự kiểm tra tính hợp lý của số ODO dựa trên dữ liệu xe đã đồng bộ sẵn trong máy.

### 3.4. Quản Lý Mượn / Trả Công Cụ Dụng Cụ (Offline Tool Tracking)
- Ghi nhận kỹ thuật viên mượn máy hàn, đồng hồ đo điện, máy khoan pin, cờ lê... tại các trạm bảo trì.
- Kiểm tra danh sách thiết bị chưa hoàn trả ngay cả khi không có kết nối internet.

---

## 4. Trải Nghiệm Người Dùng (User Guide)

### 4.1. Huy Hiệu Trạng Thái Đồng Bộ Thông Minh (PowerSync Status Badge)
Ở góc thanh điều hướng, người dùng luôn quan sát được trạng thái dữ liệu:

| Biểu tượng & Huy hiệu | Ý nghĩa trạng thái | Hành động của người dùng |
|---|---|---|
| 🟢 **Đã đồng bộ** | Dữ liệu trên điện thoại hoàn toàn trùng khớp với máy chủ trung tâm. | Sử dụng bình thường. |
| 🔵 **Đang nạp...** | Đang tải các danh mục vật tư/xe mới nhất từ máy chủ về máy. | Quá trình diễn ra tự động trong vài giây. |
| 🟠 **Đang gửi...** | Đang đẩy các phiếu yêu cầu, lượt đổ dầu tạo lúc offline lên hệ thống. | Giữ ứng dụng mở trong giây lát khi vừa có mạng lại. |
| ⚪ **Ngoại tuyến (SQLite)** | Thiết bị đang mất sóng internet, ứng dụng tự chuyển sang chạy trên SQLite local. | Yên tâm thao tác, dữ liệu được bảo vệ an toàn trên máy. |

---

## 5. Đảm Bảo An Toàn Dữ Liệu & Sổ Cái Bất Biến (Append-Only Ledger)

Một trong những ưu tiên hàng đầu của Minh Tân Phát Supply là **tính chính xác tuyệt đối của sổ cái kế toán kho**:

1. **Không cho phép Client ghi đè trực tiếp:** Dữ liệu ngoại tuyến khi đẩy lên máy chủ bắt buộc phải đi qua **73+ PostgreSQL Stored Procedures (RPCs)** nghiêm ngặt (`create_requisition`, `create_fuel_dispense`, `create_tool_borrowing`).
2. **Khóa chống gian lận & Xung đột:** Mọi thay đổi tồn kho thực tế chỉ được ghi nhận sau khi máy chủ xác thực quyền hạn người dùng (JWT Token) và phân bổ số liệu theo thời gian thực.
3. **Phân quyền đồng bộ (Sync Rules):** Nhân viên trại chỉ tải về dữ liệu thuộc phạm vi trách nhiệm của mình, giúp tiết kiệm bộ nhớ điện thoại và bảo mật dữ liệu nội bộ.

---

## 6. Câu Hỏi Thường Gặp (FAQ)

**Q1: Điện thoại của tôi có bị tốn dung lượng bộ nhớ khi lưu dữ liệu offline không?**  
*Trả lời:* Toàn bộ cơ sở dữ liệu SQLite của trại chỉ chiếm khoảng **2MB - 5MB** (tương đương dung lượng của 1 bức ảnh chụp), hoàn toàn nhẹ nhàng trên mọi dòng điện thoại Android và iPhone.

**Q2: Nếu tôi tạo phiếu khi mất mạng, sau đó đóng trình duyệt thì có bị mất phiếu không?**  
*Trả lời:* **Không.** Dữ liệu đã được lưu trữ bền vững trong bộ nhớ SQLite (OPFS/IndexedDB) của trình duyệt. Khi bạn mở lại ứng dụng và có kết nối mạng, phiếu sẽ tự động được gửi đi.

**Q3: Tôi có cần thao tác gì đặc biệt để kích hoạt tính năng này không?**  
*Trả lời:* Tính năng hoạt động hoàn toàn tự động và trong suốt. Bạn chỉ cần đăng nhập tài khoản làm việc như bình thường.