# MTP Farm ERP — Hệ Thống Quản Trị Số Hóa Toàn Diện Trại Gà Minh Tân Phát
### (Đơn vị ứng dụng thực tế: Trang Trại Gà Đẻ Trứng Lê Văn Dương — Dầu Tiếng, Bình Dương)

![Next.js](https://img.shields.io/badge/Next.js-15_(App_Router)-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x_(Strict)-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17_%2B_RLS-3ecf8e?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Architecture](https://img.shields.io/badge/Architecture-Modular_ERP_Monolith-purple?style=flat-square)
![Performance](https://img.shields.io/badge/Page_Load_Time-~200ms-success?style=flat-square)
![Offline PWA](https://img.shields.io/badge/PWA-Offline_First_%2B_QR-orange?style=flat-square)
![Tests](https://img.shields.io/badge/Automated_Tests-318_Passed_(55_Files)-brightgreen?style=flat-square)

---

## 📑 MỤC LỤC CHI TIẾT
1. [Tầm Nhìn & Định Hướng Kiến Trúc ERP Nông Nghiệp Thông Minh](#-1-tầm-nhìn--định-hướng-kiến-trúc-erp-nông-nghiệp-thông-minh)
2. [Những Nỗi Đau Thực Tế Tại Trại Gà & Cách Hệ Thống Giải Quyết](#-2-những-nỗi-đau-thực-tế-tại-trại-gà--cách-hệ-thống-giải-quyết)
3. [Đặc Tả Toàn Diện Các Phân Hệ Chức Năng Đang Hoạt Động](#-3-đặc-tả-toàn-diện-các-phân-hệ-chức-năng-đang-hoạt-động)
4. [Cơ Chế Bảo Vệ, Chống Thất Thoát & Kiểm Soát Trách Nhiệm (Audit Trail)](#-4-cơ-chế-bảo-vệ-chống-thất-thoát--kiểm-soát-trách-nhiệm-audit-trail)
5. [Hiệu Năng Vận Hành & Thiết Kế Kỹ Thuật Đạt Chuẩn 200ms](#-5-hiệu-năng-vận-hành--thiết-kế-kỹ-thuật-đạt-chuẩn-200ms)
6. [Lộ Trình Mở Rộng ERP Toàn Diện (Poultry Farm ERP Roadmap)](#-6-lộ-trình-mở-rộng-erp-toàn-diện-poultry-farm-erp-roadmap)
7. [Hướng Dẫn Triển Khai, Vận Hành & Khởi Chạy Nhanh](#-7-hướng-dẫn-triển-khai-vận-hành--khởi-chạy-nhanh)

---

## 🌟 1. TẦM NHÌN & ĐỊNH HƯỚNG KIẾN TRÚC ERP NÔNG NGHIỆP THÔNG MINH

### 1.1. Bối cảnh đặc thù của Trại gà đẻ trứng quy mô công nghiệp
Trang trại gà đẻ trứng thương phẩm Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương) hoạt động theo mô hình chuồng kín (công nghệ làm mát áp suất âm). Đây là một mô hình sản xuất có độ nhạy cảm và rủi ro cực lớn:
* **Độ khẩn cấp sinh tử:** Nếu mất điện lưới giữa trưa hoặc quạt thông gió bị cháy quá 15–20 phút mà không có vật tư thay thế ngay, nhiệt độ và khí độc ($CO_2, NH_3$) sẽ tăng vọt, làm **gà ngạt chết hàng loạt**, gây thiệt hại hàng trăm triệu đến hàng tỷ đồng.
* **Mạng lưới vật tư phức tạp:** Hàng nghìn chủng loại linh kiện cơ điện (motor quạt 1.1kW/1.5kW, tấm cooling pad, béc phun, van phao núm uống, tủ điện điều khiển), thuốc thú y, vắc-xin, bao bì vỉ trứng, phụ tùng xe tải, xe xúc dọn phân.
* **Nhiên liệu tiêu thụ lớn:** Hàng nghìn lít dầu Diesel mỗi tháng cho máy phát điện dự phòng 250kVA, xe ben chở phân, xe xúc lật, xe bồn cám.
* **Nhân sự thực địa đặc thù:** Công nhân chuồng, thợ cơ điện, tài xế thường bận rộn tay chân, không thạo vi tính, cần những công cụ cực kỳ đơn giản, nhanh gọn, bấm được bằng một tay trên điện thoại.

### 1.2. Mô hình Kim Tự Tháp Quản Trị ERP Trại Gà (The 4-Layer Hierarchy)
Hệ thống **MTP Farm ERP** không đơn thuần là một phần mềm kho lẻ, mà được thiết kế theo kiến trúc **Modular Micro-Monolith** vững chắc gồm 4 tầng quản trị:

```
                      ┌──────────────────────────────────────────────┐
                      │            TẦNG 4: TÀI CHÍNH & P&L           │
                      │  Giá thành 1 quả trứng • Lãi/Lỗ toàn trại    │
                      │  Thưởng năng suất chuồng • Báo cáo Giám đốc  │
                      ├──────────────────────────────────────────────┤
                      │      TẦNG 3: DINH DƯỠNG & AN TOÀN SINH HỌC    │
                      │  Tiêu thụ Cám & FCR • Lịch Vắc-xin tự động   │
                      │  Thời gian ngưng thuốc • Quản lý dịch bệnh   │
                      ├──────────────────────────────────────────────┤
                      │        TẦNG 2: SẢN LƯỢNG & ĐÀN GÀ            │
                      │  Lứa gà / Dãy chuồng • Gà chết & Loại thải   │
                      │  Nhật ký thu trứng • Phân loại • % Tỷ lệ đẻ  │
                      ├──────────────────────────────────────────────┤
                      │   TẦNG 1: HẬU CẦN, VẬT TƯ & NHIÊN LIỆU (CỐT LÕI)│
                      │  Kho vật tư đa biến thể • Đổi 1-1 cấp tốc     │
                      │  Quản lý trạm cấp dầu QR • Mượn trả đồ nghề  │
                      │  Vòng đời sửa chữa • Thanh lý • Kiểm kê tự động│
                      └──────────────────────────────────────────────┘
```

> 💡 **Chiến lược phát triển:** Repo hiện tại đã hoàn thiện xuất sắc và làm móng vững chắc cho **TẦNG 1 (Hậu cần, Vật tư & Nhiên liệu)** — tầng gốc rễ quyết định sự sống còn và thông suốt của trang trại. Từ nền tảng này, hệ thống sẵn sàng tích hợp thẳng lên các tầng quản trị sản lượng trứng, thức ăn, thú y và tài chính.

---

## 🔍 2. NHỮNG NỖI ĐAU THỰC TẾ TẠI TRẠI GÀ & CÁCH HỆ THỐNG GIẢI QUYẾT

Dưới đây là bức tranh so sánh chi tiết giữa **Cách làm thủ công trước đây** và **Giải pháp số hóa của MTP Farm ERP**:

| STT | Vấn đề nhức nhối thực tế | Hậu quả & Rủi ro khi làm thủ công | Cách MTP Farm ERP giải quyết triệt để | Tính năng / URL |
|:---:|---|---|---|:---:|
| **1** | **Ghi chép sổ sách giấy rời rạc** | Phiếu viết tay bụi bẩn, ướt rách, dễ thất lạc; cuối tháng kế toán mất hàng tuần cộng trừ thủ công, sai lệch số liệu kho. | **Số hóa 100% chứng từ điện tử:** Tạo phiếu trên điện thoại; sổ cái kho tự động nhảy số theo thời gian thực (Realtime Ledger), lưu vết vĩnh viễn. | `/requisitions`<br>`/receipts`<br>`/issues` |
| **2** | **Giao nhận nội bộ không bằng chứng, thiếu thông báo** | Thủ kho giao đồ cho chuồng không ai ký nhận; khi thiếu hụt thì đổ lỗi qua lại (*"đã đưa rồi"* vs *"chưa nhận được"*), không quy được trách nhiệm. | **Quy trình Giao - Nhận 2 chiều bắt buộc:** Hệ thống bắn **Notification chuông tức thì** đến điện thoại người nhận; người nhận **bắt buộc bấm "Xác nhận đã nhận hàng"** trên app + hỗ trợ chụp ảnh tại chỗ. | `/requisitions`<br>`/issues` |
| **3** | **Không có quy trình thu hồi đồ hỏng (chỉ dựa vào trí nhớ)** | Lấy motor mới thay nhưng đồ cũ vứt lăn lóc ở xưởng; không biết bao nhiêu cái hỏng, cái nào đã đem quấn lại; quản kho nghỉ việc là mất trắng dữ liệu. | **Quy trình Đổi 1-1 bắt buộc (`/defects`):** Chụp ảnh đồ hỏng ➜ Hệ thống tự động trừ 1 hàng mới từ Kho Tổng đi lắp và nạp 1 đồ hỏng vào Kho Hỏng. Gom sửa chữa (`/repairs`) nghiệm thu đạt trả về Kho Tổng; nát quá chuyển Thanh lý ve chai (`/liquidations`). | `/defects`<br>`/repairs`<br>`/liquidations` |
| **4** | **Đổ xăng/dầu/nhớt thiếu quy trình, phụ thuộc quản kho** | Tài xế đổ dầu xe ben, máy xúc phải chạy đi tìm quản kho mở bồn, ghi sổ tay nguệch ngoạc; không đo Odo/giờ chạy, dễ bị rút trộm dầu. | **Trạm cấp dầu quét mã QR 5 giây:** Tem QR dán trên xe, quét mã tự nhận diện xe/tài xế/Odo cũ ➜ Nhập số lít và Odo mới ➜ Tự động tính $L/100km$ hoặc $L/giờ$ và báo động đỏ nếu tiêu hao bất thường. | `/fuel`<br>`/fuel/scan` |
| **5** | **Mọi người không biết trong kho có gì (Độc quyền thông tin)** | Giám đốc, Kỹ thuật, Trưởng chuồng không biết còn bao nhiêu bóng sưởi, dây điện; việc gì cũng phải hỏi quản kho; quản kho vắng mặt là cả trại đình trệ. | **Minh bạch danh mục có hình ảnh & số lượng tồn:** Mọi tài khoản mở app là thấy ngay vật tư kèm ảnh thực tế, thông số, để ở kệ nào, còn bao nhiêu cái; phụ kho hoặc người trực thay tự soạn hàng chính xác 100%. | `/products` |
| **6** | **Đơn đặt hàng nhà cung cấp chỉ mình Quản kho biết** | Hàng về trại, số lượng/giá cả chỉ quản kho nắm; phụ kho ra nhận giùm không biết đối chiếu, dễ nhận thiếu hàng hoặc sai quy cách. | **Số hóa phiếu nhập & Hóa đơn chứng từ:** Lưu chi tiết đơn hàng, đơn giá, người giao; chụp ảnh hóa đơn đỏ/phiếu giao hàng đính kèm; Giám đốc và Phụ kho cùng theo dõi được. | `/receipts` |
| **7** | **Mượn đồ nghề đắt tiền không trả, thất lạc công cụ** | Máy hàn, máy xịt rửa, kìm bấm cáp, thang nhôm cho mượn đi sửa chuồng rồi để quên, thất lạc hàng chục triệu đồng mỗi năm. | **Phân hệ Mượn - Trả dụng cụ (`/tools`):** Theo dõi ai mượn, ngày mượn, hạn trả, mục đích; cảnh báo quá hạn mượn (Overdue alerts) gửi thông báo nhắc trả đồ. | `/tools` |
| **8** | **Không rõ chi phí vận hành của từng dãy chuồng** | Cuối tháng không biết Chuồng Đẻ 1, Chuồng Đẻ 2 hay Nhà Ấp tốn bao nhiêu tiền vật tư, điện, dầu để tính giá thành nuôi. | **Phân bổ chi phí tự động theo Khu vực (`Zone Costing`):** Mọi phiếu xuất kho và cấp dầu đều gắn với Zone/Sub-zone; báo cáo phân tích chi phí từng chuồng sau 1 cú click. | `/reports` |
| **9** | **Kiểm kê kho thủ công sai lệch, mất nhiều ngày** | Hàng nghìn phụ tùng nhỏ (ốc vít, co nối, curoa), kiểm đếm giấy tờ dễ nhầm lẫn, không biết sai ở đâu. | **Kiểm kê theo Kệ quét QR & Tự cân bằng kho (`/stocktake`):** Phân chia theo kệ, phát hiện chênh lệch thừa/thiếu, tự động tạo bút toán cân bằng tồn kho khi duyệt. | `/stocktake` |
| **10**| **Mất mạng internet tại các góc chuồng xa** | Trại gà diện tích nhiều hecta, nhiều góc chuồng sóng 4G/Wifi chập chờn, không thể tải trang. | **Công nghệ PWA Ngoại Tuyến (Offline First):** Cho phép tạo phiếu khi không có mạng; dữ liệu tự động đồng bộ lên server ngay khi có sóng trở lại. | Toàn hệ thống |

---

## 📦 3. ĐẶC TẢ TOÀN DIỆN CÁC PHÂN HỆ CHỨC NĂNG ĐANG HOẠT ĐỘNG

### 3.1. Phân hệ Danh Mục Vật Tư & Đa Biến Thể (`/products`)
* **Quản lý đa biến thể linh hoạt:** Hỗ trợ sản phẩm có nhiều quy cách (Ví dụ: Dây điện Cadivi 1.5/2.5/4.0, Motor quạt 1.1kW/1.5kW 3 pha/1 pha, Bóng sưởi 45W/75W).
* **Vật tư theo bộ (Composite Kits / Combo items):** Hỗ trợ khai báo 1 bộ quạt hút (gồm khung quạt, cánh quạt, motor, pully, dây curoa) ➜ Cho phép xuất nguyên bộ hoặc xuất lẻ từng linh kiện thay thế.
* **Quản lý vị trí lưu kho:** Định vị vật tư theo Mã vị trí / Kệ hàng (Ví dụ: `KHO-CHINH-A1`, `KE-DIEN-02`).
* **Cảnh báo ngưỡng an toàn (Min/Max Stock):** Đổi màu cảnh báo vàng/đỏ khi số lượng tồn kho xuống dưới mức tối thiểu an toàn, nhắc thủ kho lên kế hoạch đặt hàng.

### 3.2. Phân hệ Phiếu Yêu Cầu & Giao Nhận 2 Chiều (`/requisitions`)
* **Giao diện Giỏ hàng thông minh:** Trưởng khu chuồng chọn vật tư như mua sắm online trên điện thoại, nhập lý do xin cấp và chọn khu chuồng nhận.
* **Hỗ trợ làm phiếu thay:** Cho phép Quản lý/Thủ kho tạo phiếu giùm cho công nhân chuồng không có điện thoại thông minh.
* **Quy trình xét duyệt 4 bước chuẩn chỉ:**
  $$\text{Bản nháp (Draft)} \longrightarrow \text{Chờ duyệt (Pending)} \longrightarrow \text{Đã duyệt (Approved)} \longrightarrow \text{Đã giao hàng (Issued)} \longrightarrow \text{Đã nhận đủ (Received)}$$
* **Notification Realtime:** Bắn chuông thông báo tức thì khi phiếu được duyệt hoặc khi thủ kho xuất hàng.

### 3.3. Phân hệ Báo Hỏng & Đổi Mới 1-1 Cấp Tốc (`/defects`)
* **Tốc độ xử lý dưới 30 giây:** Giải quyết các tình huống khẩn cấp (cháy motor quạt giữa trưa nắng làm ngạt gà).
* **Cơ chế hoạt động:**
  1. Người báo hỏng chụp ảnh hiện trạng hỏng hóc, chọn loại hư hỏng và mức độ nghiêm trọng.
  2. Bấm nút **"Đổi 1-1 Cấp Tốc"**.
  3. Hệ thống thực hiện đồng thời 2 nghiệp vụ trong 1 giao dịch an toàn (Atomic Transaction):
     - Xuất 1 món đồ mới từ **Kho Tổng** giao đi lắp chuồng ngay.
     - Nhập 1 món đồ cũ vào **Kho Hỏng** để chờ xử lý.

### 3.4. Chuỗi Vòng Đời Thiết Bị: Sửa Chữa & Thanh Lý Phế Liệu (`/repairs`, `/liquidations`)
* **Gom sửa chữa (`/repairs`):** Gom các motor cháy, máy bơm hỏng từ Kho Hỏng vào một phiếu gửi đi quấn lại hoặc hàn xì bên ngoài. Ghi nhận chi phí sửa chữa.
* **Nghiệm thu kỹ thuật:**
  - **Đạt chuẩn:** Nhập lại **Kho Tổng** làm hàng sẵn sàng tái sử dụng.
  - **Hỏng nát không thể khắc phục:** Chuyển sang luồng Thanh lý phế liệu.
* **Thanh lý ve chai (`/liquidations`):** Xuất bán sắt vụn, nhôm đồng phế liệu cho thương lái, ghi nhận số tiền thu về nộp vào quỹ trại.

### 3.5. Phân hệ Mượn - Trả Dụng Cụ & Đồ Nghề Chuyên Dụng (`/tools`)
* **Quản lý danh mục công cụ đắt tiền:** Máy hàn Inverter, máy mài góc, kìm ép cos, máy xịt rửa cao áp, đồng hồ đo điện, thang nhôm chữ A.
* **Theo dõi trạng thái mượn:** Biết chính xác ai đang cầm đồ nghề nào, mượn từ ngày nào, mục đích sửa ở chuồng nào.
* **Cảnh báo quá hạn (Overdue Tracking):** Tự động phát hiện và gửi thông báo nhắc nhở các trường hợp mượn quá hạn quy định.

### 3.6. Phân hệ Nhiên Liệu Xăng Dầu & Xe Cơ Giới (`/fuel`, `/fuel/scan`)
* **Quản lý phương tiện:** Danh mục toàn bộ xe ben chở phân, xe xúc lật, xe tải chở trứng, máy phát điện Cummins 250kVA.
* **Nhập bồn dầu tổng (`/fuel/receipts`):** Ghi nhận xe bồn Petrolimex vào nhập dầu, lưu hóa đơn, đo hao hụt bồn chứa.
* **Quét mã QR cấp dầu 5 giây (`/fuel/scan`):**
  - Quét mã QR dán trên kính xe / thân máy phát điện.
  - Tự động hiển thị lịch sử đổ dầu, Odo/giờ chạy lần trước.
  - Nhập số lít và Odo mới $\rightarrow$ Hệ thống tự động tính chỉ số tiêu hao ($L/100km$ hoặc $L/giờ$).
  - Đổi màu cảnh báo đỏ nếu phát hiện xe tiêu hao nhiên liệu vượt định mức.

### 3.7. Phân hệ Kiểm Kê Kho & Tự Động Cân Bằng (`/stocktake`)
* Khởi tạo đợt kiểm kê theo từng dãy kệ hoặc toàn bộ kho.
* Quét mã QR đếm số lượng thực tế $\rightarrow$ Hệ thống so khớp với số liệu sổ sách trên hệ thống.
* Thể hiện trực quan chênh lệch (Thừa màu xanh / Thiếu màu đỏ).
* Khi Giám đốc bấm duyệt, hệ thống tự động sinh bút toán điều chỉnh cân bằng kho chính xác 100%.

### 3.8. Trung Tâm Báo Cáo, Phân Tích & In Ấn Chuẩn Hóa (`/reports`)
* **Báo cáo Xuất - Nhập - Tồn (XNT):** Xem biến động xuất nhập tồn của từng mặt hàng theo khoảng ngày bất kỳ.
* **Báo cáo Chi phí theo Chuồng Trại:** Bảng biểu và biểu đồ phân bổ chi phí vật tư, thuốc men đến từng Khu/Dãy chuồng.
* **Báo cáo Tiêu hao Nhiên liệu:** Thống kê chi tiết số lít dầu cấp cho từng xe và máy phát điện.
* **Xuất dữ liệu & In ấn chuẩn thương hiệu:** Hỗ trợ xuất file Excel chi tiết và In PDF A4/A5 chuẩn nhận diện thương hiệu **Trại Gà Đẻ Trứng Lê Văn Dương** có đầy đủ logo, mã QR và chữ ký 4 bên.

---

## 🛡️ 4. CƠ CHẾ BẢO VỆ, CHỐNG THẤT THOÁT & KIỂM SOÁT TRÁCH NHIỆM (AUDIT TRAIL)

1. **Phân quyền 3 cấp độ (Role-Based Access Control):**
   * **`requester` (Trưởng chuồng, Thợ điện, Tài xế):** Tra cứu danh mục, tạo phiếu xin cấp đồ, báo hỏng đổi đồ, bấm xác nhận khi nhận hàng.
   * **`manager` (Thủ kho, Quản lý trại, Kế toán):** Toàn quyền duyệt cấp phát, xuất nhập kho, đổi 1-1, quản lý sửa chữa, thanh lý, nhập bồn dầu, kiểm kê kho.
   * **`superuser` (Chủ trại, Ban Giám đốc):** Toàn quyền quản trị hệ thống, phân quyền người dùng, xem báo cáo tài chính P&L tổng thể.
2. **Bảo mật cơ sở dữ liệu ở tầng Row Level Security (RLS):** Toàn bộ chính sách bảo mật dữ liệu được thực thi trực tiếp trong lõi PostgreSQL, ngăn chặn tuyệt đối việc can thiệp trái phép.
3. **Nhật ký Hệ thống Chi tiết (Full Audit Trail):**
   * 100% mọi hành động (Tạo, Sửa, Xóa, Duyệt, Hủy phiếu, Đổi 1-1, Cân bằng kho) đều được lưu vào bảng `audit_logs`.
   * Lưu chi tiết: Ai làm, lúc mấy giờ, dữ liệu trước khi sửa (Before) và sau khi sửa (After), địa chỉ IP truy cập.

---

## ⚡ 5. HIỆU NĂNG VẬN HÀNH & THIẾT KẾ KỸ THUẬT ĐẠT CHUẨN 200ms

Hệ thống đạt tốc độ phản hồi cực nhanh trên máy tính và điện thoại thực địa:

```
┌────────────────────────┬────────────┬───────────────┬────────────────────────┐
│ Tuyến đường (Route)    │ Trạng thái │ Dung lượng RSC│ Thời gian phản hồi TTFB│
├────────────────────────┼────────────┼───────────────┼────────────────────────┤
│ /admin/vehicles        │   200 OK   │    105.7 KB   │        193.6 ms        │
│ /receipts (Nhập kho)   │   200 OK   │     82.3 KB   │        215.6 ms        │
│ /requisitions (Yêu cầu)│   200 OK   │     95.6 KB   │        228.1 ms        │
│ /dashboard (Tổng quan) │   200 OK   │     84.2 KB   │        231.3 ms        │
│ /products (Danh mục)   │   200 OK   │    171.1 KB   │        233.4 ms        │
│ /fuel (Kho dầu)        │   200 OK   │     69.7 KB   │        245.5 ms        │
│ /tools (Mượn đồ nghề)  │   200 OK   │     79.7 KB   │        251.7 ms        │
│ /reports (Báo cáo)     │   200 OK   │    109.3 KB   │        251.4 ms        │
│ /defects (Báo hỏng)    │   200 OK   │    118.5 KB   │        258.5 ms        │
└────────────────────────┴────────────┴───────────────┴────────────────────────┘
```

* **38 Chỉ mục Database Indexes:** Đánh composite index trên toàn bộ các cột `(status, created_at desc)`, `zone_id`, `supplier_id`, `requester_id`.
* **Bộ nhớ đệm Metadata (`src/lib/cached-metadata.ts`):** Danh mục chuồng trại, nhà cung cấp, vị trí kho được lưu đệm trong RAM Server, nạp dưới **0.1ms** và tự động cập nhật ngay khi Admin chỉnh sửa.
* **Tối ưu hóa Bundle Client:** Thư viện nặng như `xlsx` được nạp động (`dynamic import`) chỉ khi người dùng bấm nút xuất Excel, giúp trang mở lên tức thì.
* **Kiến trúc Dual-Instance:** Tách biệt độc lập Web Production (cổng 3000 chạy service `systemd mtp-web`) và môi trường Dev (cổng 3001).

---

## 🚀 6. LỘ TRÌNH MỞ RỘNG ERP TOÀN DIỆN (POULTRY FARM ERP ROADMAP)

Hệ thống đã có sẵn bản Kế hoạch (Plan) và Đặc tả Kỹ thuật (Spec) tại thư mục `docs/superpowers/` để sẵn sàng kích hoạt mở rộng theo 3 giai đoạn:

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: QUẢN LÝ ĐÀN GÀ & THU HOẠCH TRỨNG THƯƠNG PHẨM              │
│ - Quản lý lứa gà theo từng dãy chuồng, theo dõi gà chết & loại thải    │
│ - Nhật ký nhặt trứng theo ca sáng/chiều, phân loại (loại 1, 2, dập...) │
│ - Tính tức thì % Tỷ lệ đẻ (% Laying Rate) của từng chuồng              │
│ - Xuất bán trứng cho thương lái & Quản lý bảng giá trứng theo ngày     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: THỨC ĂN, CHỈ SỐ FCR & LỊCH THÚ Y VẮC-XIN TỰ ĐỘNG          │
│ - Quản lý cấp cám, định mức g/con/ngày, chỉ số FCR (kg cám / kg trứng) │
│ - Cảnh báo ăn giảm sớm (phát hiện dấu hiệu ủ bệnh trước khi sụt đẻ)    │
│ - Lịch vắc-xin tự động theo tuần tuổi, cảnh báo cách ly thuốc          │
│ - Tự động liên kết trừ tồn kho cám & thuốc trong Kho vật tư            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: TÀI CHÍNH NÔNG TRẠI, GIÁ THÀNH 1 QUẢ TRỨNG & LÃI/LỖ P&L    │
│ - Báo cáo Giá thành sản xuất 1 quả trứng (Cost per Egg) theo ngày      │
│ - Báo cáo P&L Doanh thu - Chi phí toàn trại & từng lứa gà              │
│ - Chấm công ca nhặt trứng & Công thức tính thưởng năng suất chuồng     │
│ - Nhật ký môi trường chuồng (Nhiệt độ, độ ẩm, áp suất quạt hút)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 7. HƯỚNG DẪN TRIỂN KHAI, VẬN HÀNH & KHỞI CHẠY NHANH

### 7.1. Cài đặt và Chạy môi trường phát triển (Dev)
```bash
# 1. Cài đặt dependencies
pnpm install

# 2. Khởi động toàn bộ môi trường Dev (Supabase DB + Dev Server cổng 3001)
bash scripts/dev-up.sh
```

### 7.2. Kiểm tra chất lượng mã nguồn & Kiểm thử tự động
```bash
pnpm typecheck    # Kiểm tra kiểu dữ liệu TypeScript nghiêm ngặt
pnpm test         # Chạy toàn bộ 318 bài test tự động (55 test files)
pnpm lint         # Kiểm tra chuẩn cú pháp mã nguồn
```

### 7.3. Triển khai & Vận hành Web Production (Cổng 3000)
```bash
# 1. Triển khai bản mới sang Production an toàn (Zero-downtime deploy)
bash scripts/deploy.sh

# 2. Kiểm tra trạng thái dịch vụ Production
systemctl status mtp-web

# 3. Xem nhật ký hoạt động thời gian thực
journalctl -u mtp-web -f
```

---

## 📞 THÔNG TIN BẢN QUYỀN & HỖ TRỢ KỸ THUẬT

* **Đơn vị phát triển:** Đội ngũ Kỹ thuật Antigravity
* **Đơn vị vận hành ứng dụng:** Trang Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ kỹ thuật:** 0988 365 238 – 0963 077 879
