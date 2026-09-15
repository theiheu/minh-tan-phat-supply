# 🗄️ MÔ HÌNH CƠ SỞ DỮ LIỆU & LƯỢC ĐỒ QUAN HỆ (DATABASE SCHEMA & ERD)

Toàn bộ cấu trúc cơ sở dữ liệu PostgreSQL của hệ thống **Minh Tân Phát Supply** được thiết kế chuẩn hóa, tuân thủ các ràng buộc toàn vẹn khóa ngoại (Referential Integrity) và bảo mật cấp hàng (Row Level Security).

---

## 1. SƠ ĐỒ QUAN HỆ THỰC THỂ CỐT LÕI (CORE ERD)

```
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │    zones     │◄────────┤  sub_zones   │         │  suppliers   │
  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
         │                        │                        │
         ▼                        ▼                        ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │   profiles   │         │ requisitions │◄────────┤   receipts   │
  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
         │                        │                        │
         │                        ▼                        ▼
         │                 ┌──────────────┐         ┌──────────────┐
         │                 │requisition_  │         │receipt_items │
         │                 │    items     │         └──────┬───────┘
         │                 └──────────────┘                │
         ▼                                                 ▼
  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
  │stock_movement│────────►│   variants   │◄────────┤   products   │
  └──────────────┘         └──────┬───────┘         └──────┬───────┘
                                  │                        │
                                  ▼                        ▼
                           ┌──────────────┐         ┌──────────────┐
                           │stock_balances│         │  categories  │
                           └──────────────┘         └──────────────┘
```

---

## 2. DANH MỤC CÁC BẢNG CHÍNH (KEY TABLES)

### A. Người Dùng & Phân Quyền
* **`profiles`**: Thông tin định danh nhân sự (`id`, `name`, `username`, `email`, `role`, `zone_id`, `is_active`, `is_protected`).
* **`zones`**: Khu vực công tác / Cơ sở sản xuất (Khu A, Khu B, Cơ sở 1...).
* **`sub_zones`**: Phân xưởng / Trại chăn nuôi trực thuộc khu vực (Trại A1, Trại A2, Xưởng cơ điện...).
* **`audit_logs`**: Nhật ký kiểm toán mọi hành động tạo, sửa, xóa, khóa tài khoản và chứng từ.

### B. Hàng Hóa & Tồn Kho
* **`products`**: Sản phẩm gốc (Tên, Mã sản phẩm, Danh mục, Đơn vị tính cơ sở).
* **`variants`**: Biến thể / Quy cách đóng gói (Mã vạch Barcode, Mã QR, Đơn vị quy đổi, Giá mua, Giá bán, Tồn kho tối thiểu).
* **`stock_locations`**: Vị trí kho vật lý (Kho Tổng, Kho Cơ Điện, Kho Thuốc, Kho Hỏng...).
* **`stock_balances`**: Bảng tồn kho thời gian thực theo từng vị trí kho (`variant_id`, `location_id`, `quantity`).
* **`stock_movements`**: Sổ cái ghi nhận 100% biến động tăng/giảm tồn kho.

### C. Chứng Từ Nhập - Xuất - Cấp Phát
* **`receipts` & `receipt_items`**: Phiếu nhập kho từ Nhà cung cấp kèm ảnh hóa đơn VAT và giá nhập.
* **`issues` & `issue_items`**: Phiếu xuất kho nội bộ (cấp cho khu chuồng hoặc xuất bán).
* **`requisitions` & `requisition_items`**: Phiếu yêu cầu xin cấp vật tư từ chuồng trại (duyệt 2 cấp).
* **`requisition_returns` & `requisition_return_items`**: Phiếu trả lại vật tư thừa về kho.

### D. Báo Hỏng, Sửa Chữa & Đổi 1-1
* **`defect_notes` & `defect_note_items`**: Phiếu báo hỏng vật tư/thiết bị từ các khu chuồng.
* **`exchange_notes`**: Phiếu đổi 1-1 cấp tốc (Lấy đồ mới từ Kho Tổng, gom đồ hỏng về Kho Hỏng).
* **`repair_orders` & `repair_order_items`**: Đơn gửi thiết bị đi xưởng sửa chữa & nghiệm thu.
* **`liquidation_notes` & `liquidation_items`**: Phiếu thanh lý bán phế liệu thiết bị không thể sửa.

### E. Quản Lý Dụng Cụ Đồ Nghề & Kho Dầu
* **`tool_borrowings` & `tool_borrowing_items`**: Lượt mượn / trả dụng cụ đồ nghề có hẹn ngày trả.
* **`vehicles`**: Danh mục xe ben, xe xúc, xe tải, máy phát điện có mã QR và định mức tiêu hao.
* **`fuel_dispenses`**: Lịch sử bơm dầu Diesel cho từng xe (Số lít, Số ODO/giờ máy).
* **`fuel_movements`**: Biến động nhập/xuất kho bồn dầu.

---

## 3. CÁC RPCs VÀ DATABASE FUNCTIONS QUAN TRỌNG

| Function / RPC | Loại | Mục đích |
|---|---|---|
| `admin_update_profile` | `SECURITY DEFINER` | Cập nhật vai trò, khu vực, email, trạng thái của người dùng (giữ nguyên Họ tên). |
| `admin_purge_user_data` | `SECURITY DEFINER` | Xóa sạch tài khoản và toàn bộ lịch sử chứng từ liên kết (chỉ `superuser`). |
| `adjust_stock` | `SECURITY DEFINER` | Thực hiện giao dịch cộng/trừ tồn kho và ghi `stock_movements` an toàn. |
| `_move_stock` | `SECURITY DEFINER` | Điều chuyển hàng giữa 2 vị trí kho trong 1 transaction duy nhất. |
| `is_manager` / `is_warehouse` | `STABLE SQL` | Kiểm tra nhanh quyền hạn của người dùng đang đăng nhập (`auth.uid()`). |
