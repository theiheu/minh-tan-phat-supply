# ⚙️ DANH MỤC RPCS, TRIGGERS & POSTGRESQL FUNCTIONS

> Tài liệu tham chiếu chi tiết toàn bộ 77+ hàm lưu trữ (Stored Procedures/RPCs), Triggers và Functions trong cơ sở dữ liệu PostgreSQL của hệ thống **Minh Tân Phát Supply**.

---

## 1. POSTING KERNEL & GIAO DỊCH TỒN KHO APPEND-ONLY

### `_post_inventory_movement` / `post_inventory_movement`
* **Loại:** `SECURITY DEFINER`
* **Mục đích:** Hạt nhân ghi sổ cái kho Append-Only. Thực hiện kiểm tra số dư, trừ/cộng tồn kho trong `stock_balances`, ghi bản ghi mới vào `stock_movements` kèm số dư tức thời `balance_after`.
* **Ràng buộc:** Bảng `stock_movements` được bảo vệ bởi trigger chặn `UPDATE` và `DELETE`.

### `reverse_inventory_movement`
* **Loại:** `SECURITY DEFINER`
* **Mục đích:** Hoàn tác giao dịch kho bằng cách tạo một bút toán movement đối ứng (reversal), bảo toàn tính toàn vẹn và lịch sử kế toán.

### `reserve_stock`, `consume_reservation`, `release_reservation`
* **Mục đích:** Quản lý giữ chỗ tồn kho (Stock Reservation) cho các đơn hàng hoặc phiếu yêu cầu đã duyệt trước khi xuất hàng thực tế.

### `post_assembly` & `post_disassembly`
* **Mục đích:** Nghiệp vụ lắp ráp bộ (Assembled Kit): Trừ tồn kho linh kiện con theo định mức BOM và cộng tồn kho bộ hoàn chỉnh cha (hoặc rã bộ thu hồi linh kiện).

### `post_virtual_kit_issue`
* **Mục đích:** Khi xuất kho Bộ ảo (`kit_type = 'virtual'`), tự động duyệt định mức BOM và trừ tồn kho các SKU linh kiện con tương ứng.

---

## 2. NHẬP KHO NHÀ CUNG CẤP (RECEIPTS RPCS)

### `create_receipt`
* **Mục đích:** Tạo phiếu nhập kho ở trạng thái `draft`, lưu thông tin nhà cung cấp, kho nhập, ảnh hóa đơn VAT và danh sách sản phẩm.

### `post_receipt` / `post_receipt_command`
* **Mục đích:** Phê duyệt hoàn tất phiếu nhập kho (`draft` ➜ `posted`).
* **Xử lý tự động:**
  1. Cộng tồn kho cho tất cả SKU trong phiếu.
  2. Cập nhật đơn giá mua vốn (`cost_price`) vào bảng `skus`.
  3. Tìm kiếm các phiếu yêu cầu **ĐÃ ĐƯỢC DUYỆT (`approved` hoặc `ordered`)** theo thứ tự FIFO để tự động cấp phát (`fulfill_requisition`).
  4. Đồng bộ ảnh hóa đơn sang phiếu yêu cầu được liên kết nếu có.
  5. Lưu vết kết quả `linked_requisition_ids` bền vững.

### `revert_receipt` / `cancel_receipt`
* **Mục đích:** Hủy hoặc hoàn tác phiếu nhập kho thông qua bút toán đảo kho.

### `update_receipt_invoice_images`
* **Mục đích:** Bổ sung hoặc cập nhật danh sách ảnh hóa đơn VAT sau khi lập phiếu.

---

## 3. PHIẾU YÊU CẦU & CẤP PHÁT (REQUISITIONS RPCS)

| Function | Quyền hạn | Trạng thái chuyển đổi | Hành động hệ thống |
|---|---|---|---|
| `create_requisition` | `requester`, `technician` | `[*] ➜ draft / pending` | Tạo giỏ hàng xin cấp vật tư, gắn đích đến là Dãy trại (`sub_zone`). |
| `submit_requisition` | `requester` | `draft ➜ pending` | Chốt giỏ hàng và gửi lên cấp quản lý phê duyệt. |
| `approve_requisition` | `technician`, `warehouse`, `owner` | `pending ➜ approved` | Chấp thuận cấp phát vật tư theo phiếu. |
| `reject_requisition` | `technician`, `warehouse`, `owner` | `pending ➜ rejected` | Từ chối yêu cầu và lưu lý do từ chối. |
| `fulfill_requisition` | `warehouse` | `approved / ordered ➜ issued` | Trừ tồn kho vật lý và ghi sổ cái `stock_movements`. |
| `receive_requisition` | `requester` | `issued ➜ received` | Người nhận bấm xác nhận 2 chiều đã nhận đủ hàng, đóng phiếu. |
| `complete_requisition_direct` | `warehouse`, `owner` | `draft / pending ➜ received` | Cấp phát nhanh trực tiếp tại chỗ không qua chờ duyệt. |
| `return_requisition_items` | `requester`, `warehouse` | `received ➜ returned` | Trả lại số lượng vật tư thừa về kho và cộng lại tồn kho. |
| `update_requisition_invoice_images` | `requester`, `warehouse`, `superuser` | `-` | Đính kèm/cập nhật ảnh hóa đơn mua gấp từ camera mobile. |

---

## 4. XUẤT KHO TRỰC TIẾP (ISSUES RPCS)

### `create_issue` / `post_direct_issue_command`
* **Mục đích:** Tạo phiếu xuất kho nội bộ theo dãy trại (`sub_zone_id`) hoặc xuất bán cho khách hàng.

### `post_issue`
* **Mục đích:** Xác nhận xuất kho ngay lập tức (`draft` ➜ `posted`), trừ tồn kho và ghi nhận chi phí vào Dãy trại đích.

### `revert_issue` / `cancel_issue`
* **Mục đích:** Hoàn tác phiếu xuất kho, sinh movement hoàn tồn lại kho xuất.

---

## 5. BÁO HỎNG & ĐỔI 1-1 CẤP TỐC (DEFECTS & EXCHANGES RPCS)

### `record_defect` / `post_defect_command`
* **Mục đích:** Ghi nhận thiết bị hỏng tại trại (`staging`), bắt buộc lưu ảnh hiện trường và mô tả hư hỏng.

### `create_exchange`, `approve_exchange`, `issue_exchange`, `receive_exchange`
* **Mục đích:** Chu trình đổi 1-1 cấp tốc 30 giây: Trừ 1 thiết bị mới tại Kho Tổng đưa cho thợ mang đi cứu trại, đồng thời nạp 1 thiết bị hỏng vào Kho Hỏng trong 1 transaction duy nhất.

---

## 6. SỬA CHỮA & THANH LÝ (REPAIRS & LIQUIDATIONS RPCS)

### `send_to_repair` / `post_repair_command`
* **Mục đích:** Gom các thiết bị từ Kho Hỏng tạo đơn gửi xưởng sửa chữa cơ điện bên ngoài (`in_repair`).

### `complete_repair`
* **Mục đích:** Nghiệm thu thiết bị sửa xong: Thiết bị đạt chuẩn chuyển từ Kho Hỏng về lại Kho Tổng; thiết bị hỏng hoàn toàn chuyển sang danh sách thanh lý.

### `create_liquidation`, `approve_liquidation`, `complete_liquidation`
* **Mục đích:** Chủ trại duyệt bán thanh lý phế liệu ve chai, xóa sổ khỏi kho và ghi nhận doanh thu phế liệu.

---

## 7. MƯỢN TRẢ DỤNG CỤ ĐỒ NGHỀ (TOOLS RPCS)

### `create_tool_borrowing` & `return_tool_borrowing`
* **Mục đích:** Lập phiếu mượn đồ nghề với ngày hẹn trả (`due_date`) và xác nhận thu hồi khi hoàn trả.

### `claim_tool_reminders`
* **Mục đích:** Cơ chế atomic claim bảo đảm một phiếu mượn quá hạn chỉ gửi 1 email nhắc nhở mỗi ngày, tránh spam hòm thư người dùng.

---

## 8. TRẠM BỒN DẦU & XE CƠ GIỚI (FUEL & VEHICLES RPCS)

### `get_vehicle_by_qr(p_qr_text text)`
* **Mục đích:** Quét chuỗi QR từ tem decal trên cabin xe, giải mã và trả về thông tin xe, khu vực, dãy trại phụ trách (`sub_zone_id`, `sub_zone_name`), loại nhiên liệu và chi tiết lần bơm dầu gần nhất (`last_dispense`).

### `create_fuel_dispense(p_vehicle_id, p_zone_id, p_fuel_type_id, p_quantity, p_current_odo, p_driver_name, p_meter_images, p_notes, p_by, p_sub_zone_id, p_driver_id, p_dispense_type)`
* **Mục đích:** Ghi nhận lượt cấp dầu Diesel đa phương thức.
* **Hỗ trợ 2 chế độ:**
  * `p_dispense_type = 'vehicle'`: Cấp dầu cho phương tiện cá thể, tự động tính quãng đường / giờ máy, so sánh định mức tiêu hao.
  * `p_dispense_type = 'zone'`: Cấp dầu trực tiếp cho Toàn khu hoặc Dãy trại (`sub_zone_id`) phục vụ máy phát điện / dàn quạt khẩn cấp.
* **Xử lý tự động:** Trừ số lít dầu trong bồn kho, ghi sổ cái nhiên liệu, lưu ảnh đồng hồ công tơ mét.

### `create_fuel_receipt` & `cancel_fuel_receipt`
* **Mục đích:** Ghi nhận xe bồn Petrolimex bơm dầu vào bồn tổng và cập nhật sổ cái nhiên liệu.

---

## 9. KIỂM KÊ KHO (STOCKTAKE RPCS)

### `create_stocktake` & `post_stocktake_adjustment_command`
* **Mục đích:** Tạo phiên kiểm kê kho và Chủ trại/Kế toán phê duyệt cân bằng chênh lệch Thừa/Thiếu tự động.

---

## 10. QUẢN TRỊ CHỨNG TỪ CẤP CAO (MASTER DOCUMENT CONTROL RPCS)

### `admin_inspect_document_dependencies(p_kind text, p_id uuid)`
* **Thẩm quyền:** `superuser` và `owner`.
* **Mục đích:** Trích xuất toàn bộ cây chứng từ phụ thuộc (phiếu xuất, phiếu trả, phiếu sửa, phiếu auto-fulfill) và số lượng bản ghi `stock_movements` liên quan trước khi quyết định xóa chứng từ.

### `admin_force_delete_document(p_kind text, p_id uuid, p_cascade boolean, p_reverse_inventory boolean)`
* **Thẩm quyền:** `superuser` và `owner`.
* **Mục đích:** Can thiệp xóa cứng chứng từ rác/sai sót.
* **Tùy chọn an toàn:**
  * `p_reverse_inventory = true`: Tự động sinh movement đối ứng đảo kho bảo toàn số dư trước khi xóa.
  * `p_cascade = true`: Dọn dẹp các chứng từ phụ thuộc cấp dưới theo đúng quy chuẩn.

---

## 11. HỆ THỐNG EMAIL THÔNG BÁO THEO VAI TRÒ (ROLE NOTIFICATIONS RPCS)

### `process_role_email_notifications()`
* **Mục đích:** Xử lý quét hàng đợi các sự kiện chứng từ mới, đối chiếu bảng `notification_preferences` theo từng vai trò và gửi email tổng hợp batch hoặc cảnh báo tức thì qua Nodemailer SMTP.

---

## 12. AI COPILOT RAG RPCS

### `search_ai_knowledge`
* **Mục đích:** Tìm kiếm ngữ nghĩa kết hợp Full-Text Search (Hybrid Search) trên bảng `ai_knowledge_chunks` sử dụng vector embedding và PostgreSQL TSVector.

### `ai_get_stock_summary` & `ai_get_fuel_summary`
* **Mục đích:** Cung cấp context tổng hợp tồn kho và tiêu hao nhiên liệu tức thời cho AI Copilot trả lời nhanh.

---

## 13. QUẢN TRỊ NGƯỜI DÙNG & BẢO MẬT (USER ADMIN & SECURITY RPCS)

### `admin_purge_user_data` (`SECURITY DEFINER`)
* **Thẩm quyền:** Duy nhất vai trò `superuser` (Quản trị hệ thống).
* **Mục đích:** Xóa sạch tài khoản và toàn bộ lịch sử chứng từ liên kết khi cần thanh lọc môi trường test.

### `get_login_email`
* **Mục đích:** Tra cứu email ảo nội bộ tương ứng từ `username` để đăng nhập qua GoTrue Auth mà người dùng không cần nhớ email.

### RBAC Helper Functions
* `is_superuser()`: Kiểm tra user hiện tại có quyền Superuser.
* `is_owner()`: Kiểm tra user có quyền Chủ trại.
* `is_accountant()`: Kiểm tra user có quyền Kế toán.
* `is_warehouse()`: Kiểm tra user có quyền Quản kho.
* `is_technician()`: Kiểm tra user có quyền Kỹ thuật trưởng.
* `is_manager()`: Kiểm tra user thuộc nhóm quản lý (`superuser`, `owner`, `accountant`, `warehouse`).
