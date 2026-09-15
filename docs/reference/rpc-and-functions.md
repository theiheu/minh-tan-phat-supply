# ⚙️ DANH MỤC RPCS, TRIGGERS & POSTGRESQL FUNCTIONS

> Tài liệu tham chiếu chi tiết toàn bộ 73 hàm lưu trữ (Stored Procedures/RPCs), Triggers và Functions trong cơ sở dữ liệu PostgreSQL của hệ thống **Minh Tân Phát Supply**.

---

## 1. GIAO DỊCH TỒN KHO & ĐIỀU CHUYỂN (CORE STOCK RPCS)

### `adjust_stock`
* **Loại:** `SECURITY DEFINER`
* **Mục đích:** Thực hiện tăng hoặc giảm tồn kho của một biến thể tại một vị trí kho cụ thể trong 1 transaction an toàn, tự động kiểm tra chống âm kho và ghi `stock_movements`.
* **Tham số:**
  * `p_location_id` (`uuid`): Vị trí kho
  * `p_variant_id` (`uuid`): Biến thể hàng hóa
  * `p_delta` (`numeric`): Số lượng thay đổi (+ tăng, - giảm)
  * `p_movement_type` (`movement_type`): Loại giao dịch
  * `p_ref_type` (`text`): Tên bảng chứng từ
  * `p_ref_id` (`uuid`): Khóa chính chứng từ
  * `p_by` (`uuid`): Người thực hiện

### `_move_stock`
* **Loại:** `SECURITY DEFINER` (Private helper)
* **Mục đích:** Điều chuyển tồn kho từ Kho nguồn sang Kho đích trong 1 transaction duy nhất (`adjust_stock` trừ kho nguồn và cộng kho đích).

### `transfer_stock`
* **Loại:** `SECURITY DEFINER`
* **Mục đích:** RPC công khai để người dùng thực hiện điều chuyển danh sách vật tư giữa 2 kho vật lý.

---

## 2. NHẬP KHO NHÀ CUNG CẤP (RECEIPTS RPCS)

### `create_receipt`
* **Mục đích:** Tạo phiếu nhập kho ở trạng thái `draft`, lưu thông tin nhà cung cấp, kho nhập, ảnh hóa đơn VAT và danh sách sản phẩm.
* **Tham số:** `p_supplier_id`, `p_location_id`, `p_items` (`jsonb`), `p_invoice_no`, `p_invoice_images`, `p_notes`, `p_by`.

### `post_receipt`
* **Mục đích:** Phê duyệt hoàn tất phiếu nhập kho (`draft` ➜ `posted`).
* **Xử lý tự động:**
  1. Cộng tồn kho cho tất cả sản phẩm trong phiếu.
  2. Cập nhật đơn giá mua vốn (`price_buy`) vào bảng `variants`.
  3. Tìm kiếm các phiếu yêu cầu **ĐÃ ĐƯỢC DUYỆT (`approved`)** theo thứ tự FIFO để tự động cấp phát (`fulfill_requisition`).
  4. Trả về mảng `linked_requisition_ids` các phiếu đã được tự động hoàn tất.

### `revert_receipt` / `cancel_receipt`
* **Mục đích:** Hủy hoặc hoàn tác phiếu nhập kho, tự động trừ lại tồn kho đã cộng và ghi log hoàn tác.

---

## 3. PHIẾU YÊU CẦU & CẤP PHÁT (REQUISITIONS RPCS)

| Function | Quyền hạn | Trạng thái chuyển đổi | Hành động hệ thống |
|---|---|---|---|
| `create_requisition` | `requester`, `technician` | `[*] ➜ draft / pending` | Tạo giỏ hàng xin cấp vật tư, gắn đích đến là Dãy chuồng (`sub_zone`). |
| `submit_requisition` | `requester` | `draft ➜ pending` | Chốt giỏ hàng và gửi lên cấp quản lý phê duyệt. |
| `approve_requisition` | `technician`, `warehouse`, `owner` | `pending ➜ approved` | Chấp thuận cấp phát vật tư theo phiếu. |
| `reject_requisition` | `technician`, `warehouse`, `owner` | `pending ➜ rejected` | Từ chối yêu cầu và lưu lý do từ chối. |
| `fulfill_requisition` | `warehouse` | `approved ➜ issued` | Trừ tồn kho vật lý và ghi sổ cái `stock_movements`. |
| `receive_requisition` | `requester` | `issued ➜ received` | Người nhận bấm xác nhận 2 chiều đã nhận đủ hàng, đóng phiếu. |
| `return_requisition_items` | `requester`, `warehouse` | `received ➜ returned` | Trả lại số lượng vật tư thừa về kho và cộng lại tồn kho. |

---

## 4. XUẤT KHO TRỰC TIẾP (ISSUES RPCS)

### `create_issue`
* **Mục đích:** Tạo phiếu xuất kho nội bộ theo dãy chuồng hoặc xuất bán thương mại cho khách hàng bên ngoài.

### `post_issue`
* **Mục đích:** Xác nhận xuất kho ngay lập tức (`draft` ➜ `posted`), trừ tồn kho và ghi nhận chi phí vào Dãy chuồng đích.

---

## 5. BÁO HỎNG & ĐỔI 1-1 CẤP TỐC (DEFECTS & EXCHANGES RPCS)

### `record_defect`
* **Mục đích:** Ghi nhận thiết bị hỏng tại chuồng (`staging`), lưu ảnh hiện trường và mô tả hư hỏng.

### `create_exchange` & `issue_exchange`
* **Mục đích:** Đổi 1-1 cấp tốc trong 30 giây: Trừ 1 thiết bị mới tại Kho Tổng đưa cho thợ mang đi cứu chuồng, đồng thời nạp 1 thiết bị hỏng vào Kho Hỏng trong 1 transaction duy nhất.

---

## 6. SỬA CHỮA & THANH LÝ (REPAIRS & LIQUIDATIONS RPCS)

### `send_to_repair`
* **Mục đích:** Gom các thiết bị từ Kho Hỏng tạo đơn gửi xưởng sửa chữa cơ điện bên ngoài (`in_repair`).

### `complete_repair`
* **Mục đích:** Nghiệm thu thiết bị sửa xong: Thiết bị đạt chuẩn chuyển từ Kho Hỏng về lại Kho Tổng; thiết bị hỏng hoàn toàn chuyển sang danh sách thanh lý.

### `approve_liquidation` & `complete_liquidation`
* **Mục đích:** Chủ trại duyệt bán thanh lý phế liệu ve chai, xóa sổ khỏi kho và ghi nhận doanh thu phế liệu.

---

## 7. TRẠM BỒN DẦU & XE CƠ GIỚI (FUEL RPCS)

### `create_fuel_dispense`
* **Mục đích:** Ghi nhận lượt bơm dầu Diesel cho xe cơ giới qua mã QR.
* **Xử lý tự động:**
  1. Trừ số lít dầu trong bồn kho.
  2. Lấy số ODO lần đổ trước (`prev_meter`), tính quãng đường hoặc số giờ máy hoạt động (`distance_or_hours`).
  3. Tự động tính chỉ số tiêu hao thực tế: $\text{Lít}/100\text{km} = \frac{\text{Số Lít}}{\text{Quãng đường}} \times 100$.
  4. So sánh với định mức chuẩn của xe để tự động cảnh báo bất thường.

---

## 8. QUẢN TRỊ NGƯỜI DÙNG & BẢO VỆ ĐỊNH DANH (USER ADMIN & SECURITY RPCS)

### `admin_update_profile`
* **Mục đích:** Cập nhật vai trò (Role), khu vực công tác (Zone) và trạng thái của nhân viên nhưng **bảo toàn nguyên vẹn Họ tên và Username**.

### `admin_purge_user_data` (`SECURITY DEFINER`)
* **Thẩm quyền:** Duy nhất vai trò `superuser` (Quản trị hệ thống).
* **Mục đích:** Xóa sạch tài khoản và toàn bộ lịch sử chứng từ liên kết khi cần thanh lọc môi trường test.