# 📖 HƯỚNG DẪN 13: QUY ĐỔI ĐƠN VỊ TÍNH & ĐÓNG GÓI VẬT TƯ ĐA CẤP (THÙNG, HỘP, ML, BAO, KG...)

Tài liệu hướng dẫn chi tiết quy trình thiết lập, quản lý và sử dụng tính năng **Quy đổi Đơn vị Tính & Đóng gói Đa cấp** cho Quản trị viên, Thủ kho, Kế toán và Nhân viên trang trại tại Trại gà Minh Tân Phát.

---

## 1. TỔNG QUAN & Ý NGHĨA NGHIỆP VỤ

Trong vận hành trang trại quy mô lớn, nhiều loại vật tư được đóng gói theo nhiều cấp độ khác nhau:
* **Đơn vị đóng gói lớn (Nhập hàng & Lưu kho):** Thùng, Can, Bao lớn, Cuộn, Kiện, Phuy, Pallet.
* **Đơn vị sử dụng lẻ (Xuất kho & Cấp phát trại):** Hộp, Chai, Gói, Vỉ, Lít, ml, Kg, Mét, Viên.

### 🌟 Lợi ích của tính năng:
1. **Linh hoạt tuyệt đối cho người dùng:** Nhân viên trại có thể tùy ý chọn xin vật tư theo bất kỳ đơn vị nào (xin nguyên 1 Thùng hoặc chỉ xin 2 Hộp lẻ).
2. **Quản lý tồn kho duy nhất & an toàn:** Toàn bộ tồn kho thực tế được quy về **Đơn vị cơ sở (nhỏ nhất)**. Hệ thống tự động tính toán số lượng khả dụng của đơn vị lớn hơn mà không cần tạo nhiều mã hàng rời rạc.
3. **Trừ kho tự động chính xác theo sổ cái:** Khi xuất 2 Thùng keo (1 Thùng = 6 Hộp), hệ thống tự động trừ 12 Hộp trong kho mà thủ kho không cần bấm máy tính tay.

---

## 2. HƯỚNG DẪN DÀNH CHO QUẢN TRỊ VIÊN / THỦ KHO: TẠO VẬT TƯ QUY ĐỔI

### Bước 1: Mở giao diện Tạo vật tư
1. Truy cập Menu **Quản trị** ➜ **Vật tư** (`/admin/products`).
2. Bấm nút **"+ Thêm vật tư"** ở góc phải màn hình.

### Bước 2: Chọn Kiểu quản lý "Quy đổi đơn vị"
* Trong bảng chọn *Kiểu quản lý vật tư & đơn vị*, bấm chọn: **"Quy đổi đơn vị"** *(VD 1 Thùng = 6 Hộp 550ml, tự động tính tồn)*.

### Bước 3: Nhập thông tin chung của vật tư
* **Tên vật tư:** Nhập tên chuẩn (VD: `Keo dán bạt trang trại`, `Thuốc sát trùng trang trại Benkocid`).
* **Danh mục:** Chọn danh mục phù hợp (VD: *Keo & Hóa chất kết dính*, *Thuốc thú y*...).
* **Ảnh vật tư:** Tải lên từ 1 đến nhiều ảnh thực tế của sản phẩm.
* **Mô tả:** Nhập tóm tắt công dụng hoặc hướng dẫn sử dụng.

### Bước 4: Khai báo "1. Đơn vị cơ sở (Đơn vị nhỏ nhất để quản lý tồn kho)"
Đây là đơn vị nhỏ nhất mà kho sẽ dùng để lưu trữ và kiểm đếm số lượng thực tế:
* **Tên đơn vị cơ sở (*):** Nhập tên đơn vị lẻ (VD: `Hộp`, `ml`, `Chai`, `Gói`, `Kg`, `Mét`...).
* **Quy cách chi tiết / Thể tích:** Nhập dung tích hoặc kích thước (VD: `550ml`, `1 Lít`, `100g`...).
* **Giá xuất lẻ (đ):** Giá tiền tương ứng cho 1 đơn vị cơ sở (VD: `85000`).
* **Tồn tối thiểu cảnh báo:** Mức tồn kho tối thiểu để kích hoạt cảnh báo đỏ khi sắp hết hàng (VD: `10`).
* **Theo dõi theo số lô & hạn sử dụng:** Tích chọn nếu vật tư là hóa chất/thuốc có hạn dùng.

### Bước 5: Khai báo "2. Đơn vị đóng gói quy đổi"
Đây là các đơn vị đóng gói lớn hơn (Thùng, Bao, Can, Pallet):
* **Tên đơn vị lớn (*):** Nhập tên đơn vị đóng gói (VD: `Thùng`).
* **Tỷ lệ quy đổi (*):** Nhập số lượng đơn vị cơ sở chứa trong 1 đơn vị lớn.  
  *Công thức trực quan:* `1 Thùng = [ 6 ] x Hộp (550ml)`.
* **Giá theo đơn vị này (đ):** Nhập giá của cả thùng (VD: `480000` — có thể rẻ hơn so với mua lẻ từng hộp).
* **Quy cách / Ghi chú đóng gói:** Nhập ghi chú (VD: `1 Thùng = 6 Hộp (550ml)`).
* *(Tùy chọn)* Bấm **"+ Thêm cấp đóng gói"** nếu có cấp lớn hơn (VD: Thêm cấp #2 là `Pallet` với tỷ lệ `1 Pallet = 20 Thùng`).

### Bước 6: Kiểm tra Xem trước & Hoàn tất
* Xem phần **💡 Xem trước công thức quy đổi** ở chân form để rà soát lại thông tin:
  * *Đơn vị cơ sở: 1 Hộp (550ml) — Giá: 85.000 đ*
  * *Đơn vị đóng gói: 1 Thùng = 6 Hộp (550ml) — Giá: 480.000 đ*
* Bấm **"Tạo vật tư"** để hoàn tất.

---

## 3. HƯỚNG DẪN DÀNH CHO NGƯỜI XIN VẬT TƯ: CHỌN ĐƠN VỊ KHI GỬI YÊU CẦU

### Bước 1: Mở xem vật tư
* Vào màn hình **Vật tư** (`/products`) hoặc bấm nút **Quét QR** quét mã dán trên kệ hàng.
* Bấm vào thẻ vật tư (VD: *Keo dán bạt trang trại*).

### Bước 2: Chọn đơn vị cấp phát mong muốn
Hộp thoại chi tiết sẽ hiển thị các đơn vị có sẵn:
* **Chọn Thùng:** Phù hợp khi cần làm diện rộng, thay mới toàn bộ bạt che trại kín.  
  👉 Màn hình hiển thị: *Tồn: 10 Thùng khả dụng*.
* **Chọn Hộp (550ml):** Phù hợp khi chỉ cần dặm vá vết thủng nhỏ.  
  👉 Màn hình hiển thị: *Tồn: 64 Hộp khả dụng*.

### Bước 3: Nhập số lượng & Xem ghi chú quy đổi
* Bấm nút **[ + ] / [ − ]** để chọn số lượng cần (VD: Chọn **2 Thùng**).
* Hệ thống hiển thị ngay dòng nhắc nhở thông minh:  
  👉 *💡 Quy đổi: 2 Thùng = 12 Hộp (550ml). Kho sẽ xuất nguyên kiện cho bạn.*

### Bước 4: Thêm vào giỏ & Tạo phiếu yêu cầu
1. Bấm **"Thêm vào giỏ hàng"**.
2. Mở **Giỏ hàng** ➜ Kiểm tra danh sách vật tư đã chọn với đúng đơn vị (`2 Thùng`).
3. Bấm **"Tạo phiếu yêu cầu"** ➜ Chọn Khu vực/Dãy trại sử dụng ➜ Bấm **"Gửi yêu cầu"**.

---

## 4. HƯỚNG DẪN DÀNH CHO THỦ KHO: DUYỆT CẤP PHÁT & XUẤT/NHẬP KHO

### 4.1. Xuất kho theo Phiếu Yêu cầu (Requisitions)
1. Vào menu **Yêu cầu** (`/requisitions`) ➜ Mở phiếu đã được Kỹ thuật duyệt.
2. Danh sách vật tư thể hiện rõ:
   * **Tên hàng:** Keo dán bạt trang trại
   * **Quy cách yêu cầu:** 1 Thùng = 6 Hộp (550ml)
   * **Số lượng:** 2 Thùng
3. Thủ kho xuất nguyên 2 Thùng giao cho nhân viên trại.
4. Bấm **"Xác nhận xuất kho"** ➜ Hệ thống tự động trừ đúng **12 Hộp** trong cơ sở dữ liệu tồn kho Kho chính.

### 4.2. Nhập kho từ Nhà cung cấp (Receipts)
1. Vào menu **Nhập kho** (`/receipts`) ➜ Bấm **"Tạo phiếu nhập"**.
2. Khi nhà cung cấp giao hàng theo Thùng: Quản kho chọn dòng **"Keo dán bạt — Thùng"**, nhập số lượng **10 Thùng**.
3. Chụp ảnh hóa đơn / biên bản giao nhận ➜ Bấm **"Duyệt nhập kho"**.
4. Hệ thống tự động quy đổi và ghi nhận nhập **60 Hộp** vào `stock_balances` của Kho chính.

---

## 5. BẢNG VÍ DỤ THIẾT LẬP CHUẨN CHO CÁC NHÓM HÀNG THỰC TẾ

| Nhóm hàng | Tên vật tư | Đơn vị cơ sở (Child) | Đơn vị đóng gói quy đổi (Parent) | Tỷ lệ quy đổi |
|---|---|---|---|---|
| **Keo dán & Chống dột** | Keo dán bạt trại kín | `Hộp` (550ml) | `Thùng` | 1 Thùng = 6 Hộp (3.300ml) |
| **Hóa chất sát trùng** | Thuốc sát trùng Benkocid | `Chai` (1 Lít) | `Can` | 1 Can = 5 Chai (5 Lít) |
| **Hóa chất công nghiệp** | Formol sát trùng trại | `Can` (5 Lít) | `Phuy` | 1 Phuy = 40 Can (200 Lít) |
| **Thức ăn chăn nuôi** | Cám gà đẻ siêu trứng | `Bao` (25 Kg) | `Tấn` | 1 Tấn = 40 Bao (1.000 Kg) |
| **Xử lý môi trường** | Vôi bột khử trùng trại | `Kg` | `Bao` | 1 Bao = 25 Kg |
| **Vật tư cơ khí** | Dây kẽm buộc lồng gà | `Mét` | `Cuộn` | 1 Cuộn = 100 Mét |
| **Thuốc thú y** | Men tiêu hóa men sống | `Gói` (100g) | `Hộp` | 1 Hộp = 10 Gói (1 Kg) |
| **Vật tư đóng gói** | Băng keo dán thùng | `Cuộn` | `Cây` / `Thùng` | 1 Cây = 6 Cuộn; 1 Thùng = 36 Cuộn |

---

## 6. CÁC CÂU HỎI THƯỜNG GẶP (FAQ)

### ❓ Q1: Khi kho chỉ còn 4 Hộp lẻ (dưới 1 Thùng), người xin chọn 1 Thùng thì sao?
* **Trả lời:** Tồn khả dụng theo Thùng sẽ hiển thị là **0 Thùng**. Nếu người dùng vẫn chọn xin 1 Thùng, hệ thống sẽ hiển thị cảnh báo màu vàng: *"Vật tư hiện đang hết nguyên thùng, tồn thực tế còn 4 Hộp lẻ. Quản kho sẽ cấp trước số lượng có sẵn hoặc nhập thêm."*

### ❓ Q2: Tôi có thể chỉnh sửa lại tỷ lệ quy đổi sau khi đã tạo vật tư không?
* **Trả lời:** Có. Bạn vào **Quản trị** ➜ **Vật tư** ➜ Bấm nút **"Quy cách & Bộ"** trên dòng vật tư đó. Bạn có thể thay đổi số lượng linh kiện định mức hoặc thêm đơn vị đóng gói mới bất cứ lúc nào.

### ❓ Q3: Khi kiểm kê kho (Stocktake), thủ kho sẽ đếm theo Thùng hay theo Hộp?
* **Trả lời:** Trong phiên kiểm kê kho, hệ thống hiển thị dòng kiểm kê theo **Đơn vị cơ sở (Hộp)**. Bạn chỉ cần đếm tổng số Thùng nguyên $	imes 6$ cộng với số Hộp lẻ bên ngoài rồi nhập tổng số Hộp thực tế vào bảng kiểm kê.

### ❓ Q4: Khi in phiếu giao nhận hoặc phiếu xuất kho PDF, thông tin có rõ ràng không?
* **Trả lời:** Có. Mọi mẫu in phiếu chuẩn đều hiển thị rõ: Số lượng theo đơn vị yêu cầu (VD: `2 Thùng`) và phần chi tiết quy cách (`1 Thùng = 6 Hộp 550ml`) để tài xế và công nhân nhận hàng đối soát chính xác 100%.
