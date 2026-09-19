# 📖 HƯỚNG DẪN 16: GIAO DIỆN DASHBOARD THEO VAI TRÒ (ROLE-TAILORED DASHBOARD)

Tài liệu hướng dẫn cách theo dõi các chỉ số KPI, tác vụ nhanh và lịch sử chứng từ được may đo riêng biệt cho 7 vai trò người dùng trong hệ thống **Minh Tân Phát Supply**.

---

## 1. NGUYÊN TẮC THIẾT KẾ DASHBOARD THEO VAI TRÒ

Hệ thống không dùng chung một giao diện tĩnh cho tất cả mọi người. Khi người dùng đăng nhập, màn hình `/dashboard` sẽ tự động chuyển sang giao diện chuyên biệt phù hợp với quyền hạn và trách nhiệm thực tế:

---

## 2. CHI TIẾT GIAO DIỆN THEO 7 VAI TRÒ

### A. Chủ Trang Trại & Quản Trị Hệ Thống (`owner` / `superuser`) — Executive View
* **Chỉ số KPI:**
  * **Tổng giá trị tài sản kho (VNĐ):** Định giá toàn bộ hàng hóa trong kho theo giá vốn thời gian thực.
  * **Cảnh báo tồn kho an toàn:** Số lượng mặt hàng chạm ngưỡng tối thiểu cần nhập bổ sung.
  * **Tổng chi phí xuất dùng tháng:** Chi phí vật tư đã cấp cho các khu trại trong tháng hiện tại.
  * **Tồn kho bồn dầu Diesel:** Số lít dầu hiện còn trong trạm bồn tổng.
* **Tác vụ nhanh:** Xem báo cáo tài chính, mở phiên kiểm kê, duyệt thanh lý, quản lý tài khoản nhân viên.

### B. Kế Toán Kho & Nội Bộ (`accountant`) — Financial View
* **Chỉ số KPI:**
  * **Tổng tiền nhập kho tháng:** Giá trị các phiếu nhập hàng từ Nhà Cung Cấp.
  * **Hóa đơn chờ đối soát:** Số lượng phiếu nhập chưa upload đủ ảnh hóa đơn đỏ VAT.
  * **Doanh thu xuất bán:** Tiền thu từ bán phân gà, vỉ trứng, phế liệu.
  * **Phân bổ chi phí theo Khu:** Biểu đồ tỷ trọng chi phí tiêu hao của từng Khu A, Khu B...
* **Tác vụ nhanh:** Lập phiếu nhập kho, xuất Excel sổ cái XNT, kiểm tra công nợ NCC/Khách hàng.

### C. Quản Lý Kho Tổng (`warehouse`) — Warehouse Ops View
* **Chỉ số KPI:**
  * **Phiếu yêu cầu chờ xuất cấp:** Danh sách các phiếu xin vật tư đã được duyệt đang đợi giao hàng.
  * **Mặt hàng sắp hết (Low Stock):** Danh sách cảnh báo đỏ các SKU cần nhập gấp.
  * **Lượt mượn dụng cụ quá hạn:** Thợ mượn máy hàn, thang nhôm chưa trả đúng hẹn.
  * **Dầu bồn khả dụng:** Mức dầu Diesel tồn hiện tại.
* **Tác vụ nhanh:** Nhập kho NCC, Xuất cấp theo phiếu yêu cầu, Đổi 1-1 cấp tốc 30s, Cho mượn dụng cụ, Mở phiên kiểm kê.

### D. Kỹ Thuật Trưởng / Quản Lý Khu (`technician`) — Maintenance View
* **Chỉ số KPI:**
  * **Yêu cầu cần duyệt Cấp 1:** Các phiếu xin vật tư của công nhân trại trực thuộc khu.
  * **Thiết bị đang gửi sửa ngoài:** Số motor, máy bơm đang ở xưởng cơ điện ngoài chờ nghiệm thu.
  * **Dụng cụ đội kỹ thuật đang mượn:** Máy móc cầm tay đang phục vụ sửa chữa.
  * **Sự cố báo hỏng chưa xử lý:** Danh sách thiết bị hỏng tại trại cần đổi mới hoặc gửi sửa.
* **Tác vụ nhanh:** Duyệt phiếu yêu cầu, Báo hỏng hiện trường, Lập đơn gửi sửa chữa, Nghiệm thu thiết bị.

### E. Người Yêu Cầu / Công Nhân Trại (`requester`) — My Requests View
* **Chỉ số KPI:**
  * **Phiếu yêu cầu đang xử lý:** Theo dõi tiến độ duyệt và xuất hàng của phiếu xin vật tư.
  * **Vật tư đã nhận trong tháng:** Lịch sử các món đồ đã mang về trại sử dụng.
  * **Vật tư cần hoàn trả:** Các món đồ dùng thừa cần trả lại kho.
* **Tác vụ nhanh:** Bấm tạo phiếu yêu cầu mới (Giỏ hàng mobile), Chụp ảnh báo hỏng thiết bị, Bấm nút "Đã nhận hàng".

### F. Tài Xế Xe Cơ Giới (`driver`) — Fleet View
* **Chỉ số KPI:**
  * **Xe cơ giới phụ trách:** Thông tin xe ben, xe xúc hoặc xe tải được phân công.
  * **Lịch sử đổ dầu gần nhất:** Số lít dầu đã bơm, số ODO và ngày giờ.
  * **Định mức tiêu hao cá nhân:** Mức tiêu thụ thực tế ($L/100km$ hoặc $L/h$).
* **Tác vụ nhanh:** Bấm mở camera quét mã QR trên xe để bơm dầu tại trạm bồn trong 5 giây.

---

## 3. MODAL XEM NHANH CHỨNG TỪ (SLIP DETAIL MODAL)

* Trên mọi danh sách và bảng lịch sử hoạt động tại Dashboard, khi nhấp vào mã chứng từ (VD: `NK-202609-001`, `REQ-202609-002`, `XK-202609-003`), hệ thống sẽ mở **Modal Chi tiết Chứng từ** trực tiếp mà không cần tải lại toàn bộ trang.
* Modal hiển thị đầy đủ: Danh sách mặt hàng, số lượng, đơn giá, ảnh hóa đơn VAT (có thể phóng to bằng slider lightbox) và nút in PDF nhanh.
