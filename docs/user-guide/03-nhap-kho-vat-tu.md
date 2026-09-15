# 📖 HƯỚNG DẪN 03: NHẬP KHO TỪ NHÀ CUNG CẤP & HÓA ĐƠN VAT

Quy trình nhận hàng từ Nhà cung cấp (NCC), lập phiếu nhập kho, chụp ảnh hóa đơn VAT và cập nhật giá vốn.

---

## 1. QUY TRÌNH NHẬP KHO TỪNG BƯỚC (Quản kho)

```
  [1. Nhận hàng tại cổng] ──► [2. Kiểm đếm & Chụp hóa đơn] ──► [3. Lập phiếu nhập trên máy] ──► [4. Kế toán duyệt & Cộng kho]
```

1. **Bước 1:** Vào menu **Nhập kho** ➜ Bấm **"Tạo phiếu nhập"** (`/receipts/new`).
2. **Bước 2:** Chọn **Nhà cung cấp** (hoặc tạo nhanh NCC mới).
3. **Bước 3:** Chọn **Vị trí kho nhập** (thường là *Kho Tổng*).
4. **Bước 4:** Thêm từng món hàng:
   * Chọn tên vật tư / biến thể.
   * Nhập **Số lượng thực nhận**.
   * Nhập **Đơn giá mua** (nếu có hóa đơn).
5. **Bước 5 (Quan trọng):** Tải lên **Ảnh chụp Phiếu giao hàng / Hóa đơn đỏ VAT** của nhà cung cấp để đối soát tài chính sau này.
6. **Bước 6:** Bấm **"Lưu phiếu nhập kho"**.

---

## 2. KẾT QUẢ XỬ LÝ CỦA HỆ THỐNG
* Tồn kho của các món hàng tự động cộng thêm vào kho đích ngay tức thì.
* Hệ thống tự động ghi nhận biến động vào Sổ cái kho (`stock_movements`).
* Kế toán và Chủ trại có thể xem lại ảnh hóa đơn gốc bất kỳ lúc nào để kiểm toán chi phí.
