# 🛡️ MA TRẬN PHÂN QUYỀN & VAI TRÒ (RBAC MATRIX)

Hệ thống phân quyền chuẩn hóa **7 vai trò** được thiết kế chính xác theo chuỗi quản trị vận hành trang trại chăn nuôi công nghiệp Minh Tân Phát.

---

## 1. HỆ THỐNG 7 VAI TRÒ CHUẨN HÓA

```
  1. 👑 Quản trị hệ thống (superuser)    ─── Toàn quyền kỹ thuật, bảo mật, xóa sạch dữ liệu
  2. 💼 Chủ trại (owner)                  ─── Toàn quyền xem báo cáo tài chính, duyệt cân bằng
  3. 📊 Kế toán (accountant)              ─── Quản lý giá mua/bán, hóa đơn, công nợ, duyệt sổ
  4. 📦 Quản kho (warehouse)              ─── Toàn quyền xuất/nhập/chuyển kho, đổi 1-1, kiểm kê
  5. 🔧 Kỹ thuật (technician)             ─── Quản lý cơ sở/khu chuồng, duyệt cấp 1 phiếu vật tư
  6. 📋 Người yêu cầu (requester)         ─── Công nhân chuồng, thợ: xin cấp vật tư, mượn đồ
  7. 🚛 Tài xế (driver)                   ─── Lái xe ben, xe xúc: quét QR đổ dầu, nhập ODO
```

---

## 2. MA TRẬN QUYỀN HẠN THEO TỪNG CHỨC NĂNG

| Chức năng / Menu | `superuser` | `owner` | `accountant` | `warehouse` | `technician` | `requester` | `driver` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Xem Danh mục Vật tư & Tra tồn** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Tạo mới / Sửa Vật tư, Mã QR** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Xem Bảng giá mua, Giá vốn** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Lập Phiếu Nhập Kho từ NCC** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lập Phiếu Xuất Kho Nội bộ** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lập Phiếu Yêu Cầu Vật Tư** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Duyệt Phiếu Yêu Cầu (Cấp 1 - Khu)** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Xuất Hàng theo Phiếu Yêu Cầu** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Đổi 1-1 Cấp Tốc (Đồ hỏng lấy đồ mới)** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Quản lý Đơn Sửa Chữa & Thanh Lý** | ✅ | ✅ | ✅ | ✅ | ✅ (đề xuất) | ❌ | ❌ |
| **Quản lý Mượn / Trả Dụng Cụ** | ✅ | ✅ | ✅ | ✅ | ✅ (mượn) | ✅ (mượn) | ❌ |
| **Cấp Dầu Diesel (Trạm bồn nội bộ)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Quét QR Xe đổ dầu & Nhập ODO** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Kiểm Kê Kho & Cân Bằng Tồn** | ✅ | ✅ | ✅ (duyệt) | ✅ | ❌ | ❌ | ❌ |
| **Xem Báo Cáo Tổng Hợp Chi Phí** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Xem Báo Cáo Tiêu Hao Khu Vực** | ✅ | ✅ | ✅ | ✅ | ✅ (khu mình) | ❌ | ❌ |
| **Quản Lý Người Dùng & Phân Quyền** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Xóa Vĩnh Viễn Tài Khoản (Chưa có phiếu)** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Xóa Sạch Dữ Liệu Lịch Sử (Force Purge)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. CÁC NGUYÊN TẮC BẢO VỆ DỮ LIỆU ĐẶC BIỆT

### 1. Bất Biến Định Danh (Immutable Identity):
* **Họ và tên (`name`)** và **Tên đăng nhập (`username`)** được khóa cố định ngay sau khi tạo tài khoản thông qua PostgreSQL Trigger (`trg_profiles_prevent_identity_change`).
* Không một vai trò nào (kể cả quản lý) có thể sửa đổi tên đăng nhập hoặc họ tên để tránh mạo danh và sai lệch lịch sử ký duyệt chứng từ.

### 2. Chính Sách Hybrid Archive (Xóa & Lưu Trữ Thông Minh):
* **Đối với tài khoản tạo nhầm / chưa có phiếu:** Cho phép **Xóa vĩnh viễn** khỏi cơ sở dữ liệu.
* **Đối với tài khoản đã từng lập phiếu/giao dịch:**
  * **Kế toán & Chủ trại:** Chỉ được **Lưu trữ / Đánh dấu nghỉ việc (Archive)** nhằm khóa đăng nhập và bảo toàn 100% chứng từ lịch sử.
  * **Quản trị hệ thống (`superuser`):** Được quyền **Xóa sạch vĩnh viễn (Force Purge)** qua RPC `admin_purge_user_data` khi cần dọn dẹp môi trường test hoặc thanh lọc triệt để.

### 3. Tài Khoản Hệ Thống (`is_protected = true`):
* Tài khoản quản trị gốc được bảo vệ bởi trigger `trg_profiles_protect_system_account`.
* Không thể bị khóa, không thể bị xóa hoặc hạ quyền bởi bất kỳ tài khoản nào khác.
