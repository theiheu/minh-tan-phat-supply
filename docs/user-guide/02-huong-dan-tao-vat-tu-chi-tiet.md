# 📖 HƯỚNG DẪN CHI TIẾT: TẠO VÀ KHAI BÁO VẬT TƯ (CATALOG WORKFLOW)

> **Phạm vi áp dụng:** Minh Tân Phát Supply — Hệ thống Quản trị Kho & Vật tư Trang trại.  
> **Đối tượng sử dụng:** Quản trị viên (Admin), Quản lý kho (Manager), Kỹ thuật trưởng.  
> **Đường dẫn màn hình:** `/admin/products/new` (Menu: **Quản trị** ➔ **Vật tư** ➔ **Thêm vật tư**).

---

## 📌 MỤC LỤC
1. [Tổng quan về Quy trình Khai báo Vật tư (5 Bước Chuẩn hóa)](#1-tổng-quan-về-quy-trình-khai-báo-vật-tư-5-bước-chuẩn-hóa)
2. [Chi tiết từng bước thực hiện](#2-chi-tiết-từng-bước-thực-hiện)
   - [Bước 1: Thông tin cơ bản & Chọn loại vật tư](#bước-1-thông-tin-cơ-bản--chọn-loại-vật-tư)
   - [Bước 2: Định nghĩa SKU & Cấu trúc Quy cách (1-3 Trục Phân Cấp)](#bước-2-định-nghĩa-sku--cấu-trúc-quy-cách-1-3-trục-phân-cấp)
   - [Bước 3: Khai báo Bộ lắp ráp (BOM - Bill of Materials)](#bước-3-khai-báo-bộ-lắp-ráp-bom---bill-of-materials)
   - [Bước 4: Đơn vị quy đổi & Đóng gói (Packaging UOM)](#bước-4-đơn-vị-quy-đổi--đóng-gói-packaging-uom)
   - [Bước 5: Rà soát thông tin & Kích hoạt](#bước-5-rà-soát-thông-tin--kích-hoạt)
3. [Hướng dẫn mẫu cho 4 loại vật tư thực tế](#3-hướng-dẫn-mẫu-cho-4-loại-vật-tư-thực-tế)
   - [Trường hợp 1: Vật tư đơn nhất (1 SKU duy nhất)](#trường-hợp-1-vật-tư-đơn-nhất-1-sku-duy-nhất)
   - [Trường hợp 2: Vật tư Đa quy cách (Multi-SKU 3 Trục)](#trường-hợp-2-vật-tư-đa-quy-cách-multi-sku-3-trục)
   - [Trường hợp 3: Vật tư có Đơn vị đóng gói quy đổi (Thùng/Hộp/ml)](#trường-hợp-3-vật-tư-có-đơn-vị-đóng-gói-quy-đổi-thùnghộpml)
   - [Trường hợp 4: Bộ lắp ráp Combo (Virtual Kit / Stocked Assembly)](#trường-hợp-4-bộ-lắp-ráp-combo-virtual-kit--stocked-assembly)
4. [Các thao tác sau khi tạo vật tư thành công](#4-các-thao-tác-sau-khi-tạo-vật-tư-thành-công)
5. [Quy tắc chuẩn hóa & Các lỗi thường gặp (Troubleshooting)](#5-quy-tắc-chuẩn-hóa--các-lỗi-thường-gặp-troubleshooting)

---

## 1. TỔNG QUAN VỀ QUY TRÌNH KHAI BÁO VẬT TƯ (5 BƯỚC CHUẨN HÓA)

Hệ thống cung cấp trình thuật sĩ **Catalog Draft Workflow** gồm 5 bước tuần tự giúp khai báo vật tư nhanh chóng, chính xác và không sót thông tin quan trọng:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BƯỚC 1      │     │  BƯỚC 2      │     │  BƯỚC 3      │     │  BƯỚC 4      │     │  BƯỚC 5      │
│  Thông tin   │ ──> │  SKU &       │ ──> │  Bộ lắp ráp  │ ──> │  Đơn vị      │ ──> │  Rà soát &   │
│  cơ bản      │     │  Quy cách    │     │  (BOM)       │     │  Quy đổi     │     │  Kích hoạt   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

- **Bảo toàn dữ liệu nháp:** Hệ thống tự động kiểm tra tính toàn vẹn ở mỗi bước trước khi chuyển sang bước tiếp theo.
- **Hỗ trợ đa dạng nghiệp vụ nông trại:** Phù hợp từ thiết bị trang trại, thuốc sát trùng, vòng bi cơ kim khí, đến dụng cụ xịt rửa và phụ tùng xe tải.

---

## 2. CHI TIẾT TỪNG BƯỚC THỰC HIỆN

### Bước 1: Thông tin cơ bản & Chọn loại vật tư

Truy cập **Quản trị** ➔ **Vật tư** ➔ Bấm nút **"Thêm vật tư"** (góc phải trên cùng).

Tại màn hình **"1. Thông tin cơ bản"**, tiến hành nhập các trường:

| Tên trường | Bắt buộc | Mô tả & Hướng dẫn điền | Ví dụ |
| :--- | :---: | :--- | :--- |
| **Tên vật tư** | ⭐ Có | Tên gọi chung của danh mục vật tư. Đặt tên ngắn gọn, rõ ràng, dễ tìm kiếm. | `Bạc đạn công nghiệp`, `Quạt thông gió trại 1.1kW`, `Keo dán bạt HDPE` |
| **Loại vật tư** | ⭐ Có | Chọn 1 trong 3 cơ chế vận hành tồn kho:<br>• **Vật tư thông thường:** Tồn kho độc lập theo từng SKU con.<br>• **Bộ lắp ráp ảo (Virtual Kit):** Tồn kho tự động tính theo số lượng linh kiện con có thể ráp được. Không nhập kho trực tiếp mã bộ.<br>• **Bộ lắp ráp có tồn (Stocked Assembly):** Quản lý tồn kho riêng cho bộ thành phẩm. Cần lệnh ráp/tháo để chuyển đổi giữa linh kiện và bộ. | Chọn `Vật tư thông thường` cho 90% các loại linh kiện/hàng hóa mua sẵn. |
| **Danh mục phân loại** | Không | Phân nhóm vật tư vào cây danh mục phục vụ lọc báo cáo và cấp quyền (VD: *Cơ kim khí, Điện & Tự động hóa, Thuốc & Sát trùng, Thiết bị trại nuôi*). | Chọn từ danh sách thả xuống. |
| **Từ khóa tìm kiếm** | Không | Các từ viết tắt, tên gọi dân gian, tiếng Việt không dấu hoặc mã thông dụng cách nhau bởi dấu phẩy. Giúp công nhân và thợ tìm ra ngay trên thanh tìm kiếm. | `bac dan, vong bi, koyo, skf, 6203, 6204` |
| **Mô tả / Thông số kỹ thuật** | Không | Ghi chú quy cách chi tiết, hướng dẫn bảo quản, vị trí lắp đặt trên trại hoặc cảnh báo an toàn. | `Vòng bi chịu nhiệt cho motor quạt thông gió dãy trại A1-A5.` |
| **Hình ảnh vật tư** | Không | Tải lên 1 hoặc nhiều ảnh chụp nhận diện thực tế của vật tư (hỗ trợ JPG, PNG, WebP). | Bấm ô tải ảnh hoặc kéo thả file từ máy tính. |

👉 Bấm **"Tiếp tục"** để sang Bước 2.

---

### Bước 2: Định nghĩa SKU & Cấu trúc Quy cách (1-3 Trục Phân Cấp)

Hệ thống cho phép lựa chọn giữa **Vật tư đơn nhất** hoặc **Nhiều quy cách / Biến thể đa tầng (Multi-SKU)**.

#### 🔹 Lựa chọn A: Vật tư đơn nhất (1 SKU duy nhất)
*Dành cho vật tư chỉ có 1 quy cách duy nhất (VD: Thang nhôm rút 3.8m, Đồng hồ đo áp suất 10 bar).*
- **Đơn vị tính cơ bản (Base Unit):** Bắt buộc chọn đơn vị cơ sở nhỏ nhất (VD: *Cái, Bộ, Mét, Kg, Lít*).
- **Mã SKU:** Nhập mã quản lý riêng (VD: `TN-RUT-38`). Nếu để trống, hệ thống sẽ tự sinh mã tự động dạng `SKU-XXXXXX`.
- **Tồn kho tối thiểu cảnh báo:** Mức tồn an toàn tại kho. Khi số lượng khả dụng xuống dưới mức này, hệ thống sẽ cảnh báo trên Dashboard và báo cáo mua sắm.
- **Đơn giá tham khảo (VNĐ):** Giá mua ước tính gần nhất phục vụ tính toán dự toán.
- **Chính sách quản lý định danh:**
  - *Không theo dõi riêng:* Dùng cho ốc vít, bóng đèn, bạc đạn thông thường.
  - *Quản lý theo Số Lô & Hạn sử dụng (FEFO):* Dùng cho vắc-xin, thuốc sát trùng, hóa chất trại nuôi có date.
  - *Quản lý theo Số Serial / Mã thiết bị:* Dùng cho máy phát điện, motor công suất lớn, máy hàn, thiết bị có bảo hành theo serial.

#### 🔹 Lựa chọn B: Nhiều quy cách / Biến thể đa tầng (Multi-SKU 1-3 Trục)
*Dành cho vật tư có nhiều kích cỡ, hãng, tiêu chuẩn (VD: Bạc đạn SKF/Koyo 6203/6204 2RS/ZZ).*

1. **Thiết lập các trục phân cấp (Option Axes - Tối đa 3 trục):**
   - Bấm các nút **Mẫu gợi ý** để điền nhanh:
     - *Bạc đạn / Vòng bi:* `Hãng sản xuất` ➔ `Mã vòng bi` ➔ `Loại nắp`
     - *Bu lông / Ốc vít:* `Chất liệu` ➔ `Đường kính` ➔ `Chiều dài`
     - *Ống nước / Cáp điện:* `Quy cách` ➔ `Độ dày`
     - *Điện / Khí nén:* `Hãng sản xuất` ➔ `Thông số / Công suất`
   - Hoặc tự gõ tên trục theo nhu cầu thực tế (VD: Trục 1: *Thương hiệu*, Trục 2: *Kích cỡ*).
   - Thứ tự các trục sẽ quyết định thứ tự các hàng nút bấm khi người dùng chọn vật tư trên giao diện xin cấp phát và xuất kho.
2. **Khai báo danh sách các dòng biến thể (SKU Matrix):**
   - Bấm **"Thêm dòng quy cách"** để thêm từng biến thể có thực tế trong kho.
   - Nhập giá trị cho từng trục thuộc tính (VD: Hãng = `SKF`, Mã = `6203`, Nắp = `2RS`).
   - Nhập **Mã SKU** (VD: `BD-SKF-6203-2RS`), chọn **Đơn vị tính** (`Cái`), **Tồn tối thiểu**, **Đơn giá** và tải **Hình ảnh riêng** của biến thể (nếu có).

👉 Bấm **"Tiếp tục"** để sang Bước 3.

---

### Bước 3: Khai báo Bộ lắp ráp (BOM - Bill of Materials)

*Bước này dành cho các vật tư được khai báo là **Bộ lắp ráp ảo (Virtual Kit)** hoặc **Bộ lắp ráp có tồn (Stocked Assembly)**.*

- Nếu là vật tư thông thường, hệ thống hiển thị thông báo chưa kích hoạt BOM, bạn có thể bấm **"Tiếp tục"** để bỏ qua bước này.
- Nếu là Bộ lắp ráp:
  1. Trong khung **"Linh kiện BOM"**, bấm vào ô tìm kiếm **"Thêm linh kiện"**.
  2. Gõ tên hoặc mã SKU của linh kiện thành phần cấu tạo nên bộ.
  3. Chọn linh kiện từ danh sách gợi ý.
  4. Nhập **Định mức số lượng (SL/bộ):** Cần bao nhiêu linh kiện này để ghép thành 1 bộ hoàn chỉnh (VD: 1 Thân súng + 1 Khớp nối + 10 Mét dây).
  5. Có thể thêm nhiều linh kiện con khác nhau. Bấm biểu tượng 🗑️ để xóa bớt nếu thêm nhầm.

👉 Bấm **"Tiếp tục"** để sang Bước 4.

---

### Bước 4: Đơn vị quy đổi & Đóng gói (Packaging UOM)

*Bước này phục vụ bài toán xuất/nhập theo bao bì lớn (Thùng, Bao, Can, Hộp, Cuộn) nhưng theo dõi tồn kho theo đơn vị cơ bản (Chai, Gói, Mét, Lít, Cái).*

- Nếu vật tư chỉ dùng 1 đơn vị duy nhất: Bấm **"Tiếp tục"** để sang bước kế tiếp.
- Nếu có nhiều quy cách đóng gói:
  1. Bấm **"Thêm đơn vị đóng gói (Thùng/Hộp/Bao...)"**.
  2. Chọn **Đơn vị giao dịch:** Chọn đơn vị đóng gói (VD: `Thùng`, `Hộp`, `Bao`).
  3. Nhập **Tên hiển thị:** VD `Thùng 24 lon`, `Hộp 10 vỉ`, `Bao 25kg`.
  4. Nhập **Hệ số quy đổi trực tiếp (factorToBase):** 1 đơn vị đóng gói này tương đương bao nhiêu đơn vị cơ sở đã chọn ở Bước 2.
     - *Ví dụ:* 1 Thùng = **24** Lon (ĐVT cơ sở). Hệ số = `24`.
     - *Ví dụ:* 1 Can = **5** Lít. Hệ số = `5`.
  5. Nhập **Mã vạch riêng (Barcode - Tùy chọn):** Mã vạch in trên vỏ thùng lớn để thủ kho quét mã thùng khi nhập/xuất nguyên kiện.

> ⚠️ **Quy tắc quan trọng:** Khai báo quy đổi trực tiếp về **Đơn vị cơ sở chuẩn**. Không tạo chuỗi quy đổi bắc cầu trung gian để tránh sai lệch số thập phân trong kiểm kê.

👉 Bấm **"Tiếp tục"** để sang Bước 5.

---

### Bước 5: Rà soát thông tin & Kích hoạt

Màn hình hiển thị bảng tổng hợp toàn bộ dữ liệu vừa khai báo:
1. **Thông tin chung:** Tên vật tư, danh mục, từ khóa tìm kiếm, loại vật tư.
2. **Danh sách SKU & Quy cách:** Kiểm tra lại mã SKU, đơn vị tính cơ sở, tồn an toàn và đơn giá.
3. **Định mức BOM & Linh kiện cấu thành (nếu có).**
4. **Bảng quy đổi đơn vị đóng gói (nếu có).**

🔍 **Kiểm tra lần cuối:**
- Nếu phát hiện sai sót, bấm trực tiếp vào tên bước trên thanh tiến trình (hoặc bấm nút **"Quay lại"**) để chỉnh sửa.
- Khi dữ liệu đã chuẩn xác, bấm **"Kích hoạt vật tư"** (nút màu cam nổi bật).

🎉 Hệ thống sẽ lưu trữ và kích hoạt vật tư ngay lập tức vào danh mục đang hoạt động!

---

## 3. HƯỚNG DẪN MẪU CHO 4 LOẠI VẬT TƯ THỰC TẾ

### Trường hợp 1: Vật tư đơn nhất (1 SKU duy nhất)
> **Bài toán:** Khai báo quạt thông gió trại gà *Quạt hút trang trại 1.1kW composite*.

1. **Bước 1:**
   - Tên vật tư: `Quạt hút composite 1.1kW 1400x1400`
   - Loại vật tư: `Vật tư thông thường`
   - Danh mục: `Thiết bị trại nuôi`
   - Từ khóa: `quat hut, quat thong gio, composite, 1.1kw, quat trai ga`
2. **Bước 2:**
   - Chọn `Vật tư đơn nhất (1 SKU duy nhất)`
   - Đơn vị tính cơ bản: `Cái`
   - Mã SKU: `QH-COMP-1.1KW`
   - Tồn an toàn: `2`
   - Đơn giá: `4500000`
   - Chính sách định danh: `Quản lý theo Số Serial / Mã thiết bị` (theo dõi số motor gắn vào trại).
3. **Bước 3 & 4:** Bỏ qua.
4. **Bước 5:** Bấm **"Kích hoạt vật tư"**.

---

### Trường hợp 2: Vật tư Đa quy cách (Multi-SKU 3 Trục)
> **Bài toán:** Khai báo danh mục *Bạc đạn công nghiệp* gồm 2 hãng (SKF, Koyo), 2 mã vòng bi (6203, 6204) và 2 loại nắp (2RS cao su, ZZ sắt).

1. **Bước 1:**
   - Tên vật tư: `Bạc đạn công nghiệp`
   - Loại vật tư: `Vật tư thông thường`
   - Danh mục: `Cơ kim khí`
2. **Bước 2:**
   - Chọn `Nhiều quy cách / Biến thể đa tầng (Multi-SKU)`.
   - Thiết lập 3 trục:
     - Trục 1: `Hãng sản xuất`
     - Trục 2: `Mã vòng bi`
     - Trục 3: `Loại nắp`
   - Bấm **"Thêm dòng quy cách"** để nhập các biến thể:
     - *Dòng 1:* Hãng: `SKF` | Mã: `6203` | Nắp: `2RS (Cao su)` | Mã SKU: `BD-SKF-6203-2RS` | ĐVT: `Cái` | Tồn TT: `10`
     - *Dòng 2:* Hãng: `SKF` | Mã: `6203` | Nắp: `ZZ (Sắt)` | Mã SKU: `BD-SKF-6203-ZZ` | ĐVT: `Cái` | Tồn TT: `5`
     - *Dòng 3:* Hãng: `Koyo` | Mã: `6203` | Nắp: `2RS (Cao su)` | Mã SKU: `BD-KOYO-6203-2RS` | ĐVT: `Cái` | Tồn TT: `10`
     - *Dòng 4:* Hãng: `SKF` | Mã: `6204` | Nắp: `2RS (Cao su)` | Mã SKU: `BD-SKF-6204-2RS` | ĐVT: `Cái` | Tồn TT: `8`
3. **Bước 3 & 4:** Bỏ qua (hoặc thêm đơn vị đóng gói `Hộp 10 cái` nếu nhập theo cây bạc đạn).
4. **Bước 5:** Bấm **"Kích hoạt vật tư"**.

---

### Trường hợp 3: Vật tư có Đơn vị đóng gói quy đổi (Thùng/Hộp/ml)
> **Bài toán:** Khai báo *Thuốc sát trùng trại Omnicide* (Đơn vị tính tồn kho là Lít, khi nhập/xuất mua theo Can 5L hoặc Thùng 4 can = 20L).

1. **Bước 1:**
   - Tên vật tư: `Thuốc sát trùng Omnicide`
   - Loại vật tư: `Vật tư thông thường`
   - Danh mục: `Thuốc & Hóa chất sát trùng`
2. **Bước 2:**
   - Đơn vị tính cơ bản: `Lít` (l)
   - Mã SKU: `ST-OMNICIDE-1L`
   - Chính sách định danh: `Quản lý theo Số Lô & Hạn sử dụng (FEFO)` (để kiểm soát date thuốc).
3. **Bước 3:** Bỏ qua BOM.
4. **Bước 4 (Quy đổi đóng gói):**
   - *Dòng 1:* Đơn vị: `Can` | Tên hiển thị: `Can 5 Lít` | Hệ số: `5` Lít | Barcode: `893123450005`
   - *Dòng 2:* Đơn vị: `Thùng` | Tên hiển thị: `Thùng 4 can (20L)` | Hệ số: `20` Lít | Barcode: `893123450020`
5. **Bước 5:** Bấm **"Kích hoạt vật tư"**.

---

### Trường hợp 4: Bộ lắp ráp Combo / Vật tư bộ (Virtual Kit & Stocked Assembly)

#### 🔹 Ví dụ A: Bộ phao cơ tự ngắt nước trang trại (Virtual Kit — Bộ ảo tính tồn theo linh kiện)
> **Bài toán:** Khai báo *Bộ phao cơ ngắt nước phi 27* gồm 2 linh kiện thành phần rời trong kho là *Bóng phao cơ* và *Cần phao cơ (Cụm van)*.

1. **Chuẩn bị linh kiện con trước:**
   - Đảm bảo 2 linh kiện `Bóng phao cơ` (ĐVT: Quả/Cái, SKU: `LK-BONG-PHAO`) và `Cần phao cơ` (ĐVT: Cây/Cái, SKU: `LK-CAN-PHAO`) đã có sẵn trong danh mục vật tư thông thường.
2. **Bước 1 (Thông tin cơ bản):**
   - Tên vật tư: `Bộ phao cơ tự ngắt nước phi 27`
   - Loại vật tư: `Bộ lắp ráp ảo (Virtual Kit)` *(Khuyên dùng để tồn kho tự động tính theo số lượng bóng & cần có sẵn)*
   - Danh mục: `Thiết bị cấp thoát nước` hoặc `Thiết bị trại nuôi`
   - Từ khóa: `phao co, bo phao co, can phao, bong phao, ngat nuoc`
3. **Bước 2 (Quy cách & SKU):**
   - Đơn vị tính cơ bản: `Bộ`
   - Mã SKU: `KIT-PHAO-CO-27`
   - Tồn an toàn tối thiểu: `5`
   - Đơn giá tham khảo: `85,000` VNĐ
4. **Bước 3 (BOM - Khai báo cấu tạo linh kiện):**
   - Bấm **"Thêm linh kiện"** ➔ Chọn `Bóng phao cơ` ➔ Nhập Định mức: `1`
   - Bấm **"Thêm linh kiện"** ➔ Chọn `Cần phao cơ` ➔ Nhập Định mức: `1`
5. **Bước 4 (Quy đổi đóng gói):** Bỏ qua (hoặc thêm `Thùng 10 bộ` nếu có).
6. **Bước 5:** Bấm **"Kích hoạt vật tư"**.

*⚡ Vận hành:* Khi xuất kho 1 Bộ phao cơ, hệ thống tự động trừ 1 Bóng phao và 1 Cần phao khỏi sổ cái kho.

---

#### 🔹 Ví dụ B: Bộ súng xịt áp lực rửa trại cao áp (Stocked Assembly — Bộ có tồn kho riêng)
> **Bài toán:** Khai báo *Bộ súng xịt áp lực* được đóng gói sẵn và lưu kho riêng lẻ theo từng bộ hoàn chỉnh.

1. **Bước 1:**
   - Tên vật tư: `Bộ súng xịt áp lực rửa trại cao áp`
   - Loại vật tư: `Bộ lắp ráp có tồn (Stocked Assembly)`
   - Danh mục: `Dụng cụ & Đồ nghề`
2. **Bước 2:**
   - Đơn vị tính: `Bộ`
   - Mã SKU: `KIT-SUNG-APLUC`
3. **Bước 3 (BOM):**
   - Bấm **"Thêm linh kiện"** và chọn:
     - Linh kiện 1: `Thân súng xịt cao áp Đài Loan` | Số lượng: `1` Cái
     - Linh kiện 2: `Dây áp lực bố thép 15m` | Số lượng: `1` Sợi
     - Linh kiện 3: `Đầu béc xịt chỉnh tia` | Số lượng: `1` Đầu
     - Linh kiện 4: `Khớp nối nhanh ren 22` | Số lượng: `2` Cái
4. **Bước 4:** Bỏ qua.
5. **Bước 5:** Bấm **"Kích hoạt vật tư"**.

*⚡ Vận hành:* Sử dụng màn hình **Lắp ráp & Tháo dỡ** (`/assemblies`) để thực hiện lệnh lắp ráp (trừ 4 linh kiện, tăng 1 bộ súng) hoặc tháo dỡ hoàn trả linh kiện.

---

## 4. CÁC THAO TÁC SAU KHI TẠO VẬT TƯ THÀNH CÔNG

Sau khi kích hoạt, vật tư sẽ xuất hiện ngay trong danh sách **/admin/products** và **/products**. Quản lý kho nên thực hiện ngay các thao tác sau:

1. **In tem mã QR dán kệ / khay đựng:**
   - Bấm vào chi tiết vật tư -> Chọn biến thể SKU.
   - Bấm **"In tem QR"** để in mã dán trực tiếp lên khay đựng hoặc kệ hàng trong kho.
   - Công nhân khi lấy đồ chỉ cần dùng điện thoại quét tem QR là chọn đúng ngay quy cách trong 2 giây.
2. **Tạo phiếu nhập kho đầu kỳ (nếu đã có hàng sẵn):**
   - Vào menu **Nhập kho** ➔ **Tạo phiếu nhập** (`/receipts/new`).
   - Chọn nhà cung cấp và đưa các SKU vừa tạo vào phiếu nhập để cập nhật số lượng tồn kho ban đầu.
3. **Xem thẻ kho & Lịch sử biến động:**
   - Mọi thao tác xuất/nhập/chuyển kho sau này của SKU sẽ tự động ghi sổ cái ledger và vẽ biểu đồ luân chuyển tại trang chi tiết vật tư.

---

## 5. QUY TẮC CHUẨN HÓA & CÁC LỖI THƯỜNG GẶP (TROUBLESHOOTING)

### 📌 Quy tắc đặt mã SKU khuyến nghị
- Dùng ký tự in hoa, số và dấu gạch ngang `-`, không dấu, không khoảng trắng.
- **Cấu trúc chuẩn:** `[Nhóm]-[Quy cách]-[Thông số]`
  - *Ví dụ:* `BD-SKF-6203-2RS`, `BL-INOX-M8X30`, `ST-OMNICIDE-5L`.
- Nếu để trống, hệ thống sẽ tự sinh mã dạng `SKU-XXXXXX`.

---

### ⚠️ Các lỗi thường gặp khi tạo vật tư & Cách khắc phục

| Lỗi gặp phải | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **"Vui lòng nhập tên vật tư"** | Bỏ trống ô tên vật tư ở Bước 1. | Nhập tên vật tư trước khi bấm Tiếp tục. |
| **"Hệ thống hỗ trợ tối đa 3 trục thuộc tính phân cấp"** | Cố gắng thêm nhiều hơn 3 trục phân loại. | Gom nhóm hoặc kết hợp thông số (VD: gộp *Đường kính + Chiều dài* thành *Kích thước M8x30*). |
| **"Quy cách #X còn thiếu giá trị trục Y"** | Chưa điền đủ các ô thuộc tính trong bảng Multi-SKU. | Rà soát và điền đầy đủ giá trị các trục cho tất cả các dòng biến thể. |
| **"Bộ lắp ráp phải có ít nhất 1 linh kiện"** | Chọn loại vật tư là Virtual Kit / Stocked Assembly nhưng chưa thêm linh kiện ở Bước 3. | Vào Bước 3 và dùng công cụ tìm kiếm để chọn ít nhất 1 linh kiện BOM cấu thành. |
| **"Các SKU phải dùng cùng đơn vị cơ sở để áp dụng chung bảng quy đổi"** | Trong bảng Multi-SKU, có SKU dùng ĐVT `Cái`, SKU khác lại dùng `Mét` nhưng lại khai báo quy đổi `Thùng`. | Đồng nhất đơn vị cơ sở cho các SKU nếu muốn dùng chung bảng đóng gói, hoặc tách thành các vật tư riêng biệt. |
| **"Hệ số quy đổi phải ≥ 1"** | Nhập hệ số quy đổi bằng 0 hoặc số âm. | Nhập hệ số nguyên dương thể hiện số đơn vị cơ sở trong 1 kiện đóng gói (VD: `1 Thùng = 12 Hộp`). |
