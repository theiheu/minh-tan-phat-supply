# 🐔 MTP Farm ERP — BẢN THUYẾT TRÌNH HỆ THỐNG QUẢN TRỊ TRẠI GÀ TOÀN DIỆN
### Đơn vị áp dụng: Trang Trại Gà Đẻ Trứng Lê Văn Dương (Minh Tân, Dầu Tiếng, Bình Dương)

> 🎯 **Mục tiêu tài liệu:** Bản thuyết minh trực quan, ngắn gọn, dùng để trình chiếu và giải trình trực tiếp với Ban Giám đốc / Các Sếp về **Các vấn đề nhức nhối thực tế tại trại gà**, **Cách hệ thống giải quyết triệt để**, và **Định hướng mở rộng ERP toàn diện**.

---

## 📊 BẢNG TỔNG HỢP HIỆU QUẢ ĐỔI MỚI (DÀNH CHO LÃNH ĐẠO)

```
┌────────────────────────────────┬───────────────────────────┬───────────────────────────┐
│ HẠNG MỤC QUẢN TRỊ              │ TRƯỚC ĐÂY (LÀM THỦ CÔNG)  │ BÂY GIỜ (MTP FARM ERP)    │
├────────────────────────────────┼───────────────────────────┼───────────────────────────┤
│ ⏱️ Thời gian đổi motor quạt cứu gà│ 30 - 45 phút (Gà ngạt chết)│ ⚡ Dưới 30 giây (Lắp ngay) │
│ ⛽ Đổ dầu xe ben, máy xúc, máy phát│ Ghi sổ tay, dễ rút trộm dầu│ 📱 Quét QR 5s, đo định mức│
│ 📦 Tra cứu hàng tồn trong kho   │ Phụ thuộc 100% vào Quản kho│ 🔍 Ai cũng xem được trên App│
│ 🤝 Giao nhận vật tư nội bộ     │ Miệng/Không ký, hay cãi nhau│ 🔔 Chuông báo + Bấm xác nhận│
│ ♻️ Thu hồi đồ hỏng / Sửa chữa  │ Bỏ xưởng, dựa vào trí nhớ │ 🔄 Vòng đời khép kín tự động│
│ 🧾 Nhập hàng Nhà cung cấp       │ Chỉ quản kho biết giá     │ 📸 Chụp lưu hóa đơn đối soát│
│ 📈 Báo cáo chi phí từng chuồng │ Mất 3 - 5 ngày cộng sổ tay│ 📊 Xem biểu đồ tức thì 1 click│
│ 📶 Sóng yếu / Mất mạng chuồng xa│ Đơ ứng dụng, không làm được│ 🌐 Ngoại tuyến Offline 100% │
└────────────────────────────────┴───────────────────────────┴───────────────────────────┘
```

---

## 🚨 PHẦN I: 6 TÌNH HUỐNG THỰC TẾ & LỜI GIẢI MTP FARM ERP

### 🔴 TÌNH HUỐNG 1: Motor quạt chuồng bị cháy giữa trưa nắng — Cứu đàn gà ngạt thở

```
❌ TRƯỚC ĐÂY: Motor cháy ➜ Chạy đi tìm Quản kho ➜ Viết giấy xin ➜ Chờ duyệt ➜ Mất 30-45p ➜ GÀ NGẠT CHẾT
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Mở App chụp ảnh hỏng ➜ Bấm nút [ĐỔI 1-1] ➜ Xuất ngay motor mới đi lắp (DƯỚI 30 GIÂY) ➜ CỨU ĐÀN GÀ
```

* **Nỗi đau thực tế:** Chuồng kín trại gà nuôi hàng chục nghìn con. Mất điện hoặc cháy quạt thông gió giữa trưa nắng quá 15 phút là nhiệt độ vọt lên, gà ngạt khí độc chết hàng loạt thiệt hại tiền tỷ. Nếu bắt làm thủ tục giấy tờ xin duyệt rườm rà thì gà chết trước khi có đồ thay.
* **MTP ERP giải quyết triệt để:**
  - **Tính năng Đổi 1-1 Cấp Tốc (`/defects`):** Thao tác 1 chạm trên điện thoại.
  - Hệ thống tự động thực hiện đồng thời: Xuất 1 motor mới từ **Kho Tổng** đem đi lắp ngay, và nạp 1 motor cháy vào **Kho Hỏng**.
  - **Thời gian xử lý: Đúng 30 giây.** Vừa cứu sống đàn gà, vừa không làm sai lệch tồn kho.

---

### 🔴 TÌNH HUỐNG 2: Giao nhận vật tư cho chuồng — Chấm dứt cãi vã & Thất thoát đồ

```
❌ TRƯỚC ĐÂY: Giao đồ bằng miệng ➜ Không ký nhận ➜ Cuối tháng thiếu đồ ➜ Đổ lỗi: 'Tôi đưa rồi' vs 'Tôi chưa nhận'
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Quản lý duyệt ➜ Kho xuất hàng ➜ Chuông reo điện thoại ➜ Người nhận BẮT BUỘC BẤM 'XÁC NHẬN ĐÃ NHẬN'
```

* **Nỗi đau thực tế:** Đưa bóng đèn sưởi, vỉ trứng, thuốc men cho công nhân chuồng hoặc thợ điện cầm đi mà không có bằng chứng. Khi kiểm kho thấy thiếu thì người giao nói một đằng, người nhận nói một nẻo, không ai chịu trách nhiệm, thất thoát hàng chục triệu đồng mỗi tháng.
* **MTP ERP giải quyết triệt để:**
  - **Quy trình Giao - Nhận 2 chiều minh bạch:**
    1. Trưởng chuồng tạo phiếu yêu cầu trên điện thoại $\rightarrow$ Quản lý duyệt.
    2. Thủ kho soạn hàng giao $\rightarrow$ Hệ thống lập tức bắn **Notification chuông báo** về máy người nhận.
    3. Người nhận kiểm tra đủ đồ và **bắt buộc bấm nút "Đã nhận hàng"** trên app + hỗ trợ chụp ảnh đối soát.
  - Không ai chối bỏ được trách nhiệm, chống thất thoát triệt để.

---

### 🔴 TÌNH HUỐNG 3: Vật tư hỏng chất đống — Không còn phụ thuộc vào trí nhớ cá nhân

```
❌ TRƯỚC ĐÂY: Đồ hỏng vứt lăn lóc ở xưởng ➜ Quản kho nhớ trong đầu ➜ Quản kho nghỉ việc = MẤT TRẮNG DỮ LIỆU
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Motor hỏng ➜ Vào Kho Hỏng ➜ Gom đi quấn lại (Đạt ➜ Kho Tổng | Nát quá ➜ Bán ve chai nộp tiền quỹ)
```

* **Nỗi đau thực tế:** Quạt cháy, máy bơm hỏng thay ra bị vứt đống ở góc xưởng. Không ai biết có bao nhiêu cái còn sửa được, cái nào đã đem thợ quấn lại. Toàn bộ nằm trong "trí nhớ" của quản kho. Quản kho ốm hoặc nghỉ việc là xưởng cơ điện thành bãi rác vô chủ.
* **MTP ERP giải quyết triệt để:**
  - **Vòng đời thiết bị khép kín 3 bước:**
    1. **Thu hồi bắt buộc:** Khi Đổi 1-1, đồ hỏng tự động nhập vào **Kho Hỏng**.
    2. **Gom sửa chữa (`/repairs`):** Gom các motor hỏng gửi đi thợ ngoài quấn lại, ghi nhận chi phí sửa. Thợ giao về nghiệm thu đạt $\rightarrow$ Nhập lại **Kho Tổng** tái sử dụng.
    3. **Thanh lý ve chai (`/liquidations`):** Thiết bị nát không thể phục hồi $\rightarrow$ Lập phiếu bán phế liệu, lưu số kg và đơn giá, tiền nộp về quỹ trang trại minh bạch.

---

### 🔴 TÌNH HUỐNG 4: Đổ dầu xe ben, máy xúc, máy phát điện — Quét mã QR chống rút trộm

```
❌ TRƯỚC ĐÂY: Tài xế tìm Quản kho mở bồn ➜ Ghi sổ tay ➜ Không đo Odo/giờ chạy ➜ DỄ BỊ RÚT TRỘM DẦU / GIAN LẬN
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Quét Tem QR dán trên xe (5 giây) ➜ Tự nhận diện xe & Odo cũ ➜ Nhập số lít ➜ TỰ ĐỘNG TÍNH ĐỊNH MỨC
```

* **Nỗi đau thực tế:** Trại có dàn xe ben chở phân, xe xúc lật, xe bồn cám và máy phát điện 250kVA tiêu thụ hàng nghìn lít dầu/tháng. Ghi sổ tay rất dễ gian lận số lít, không kiểm soát được xe nào chạy hao dầu bất thường, quản kho phải túc trực bên bồn dầu cả ngày.
* **MTP ERP giải quyết triệt để:**
  - **Quét mã QR 5 giây (`/fuel`):** Mỗi xe/máy phát dán 1 **Tem QR chống nước**. Quét mã là tự nhận diện xe, tài xế và số Odo/giờ máy lần trước.
  - **Đo định mức tự động:** Nhập số lít và Odo mới $\rightarrow$ Hệ thống tự tính: **Lít/100km** (xe tải) hoặc **Lít/giờ** (máy xúc, máy phát).
  - **Cảnh báo gian lận:** Đổi màu **CẢNH BÁO ĐỎ** ngay lập tức nếu xe chạy tốn dầu vượt định mức quy định.

---

### 🔴 TÌNH HUỐNG 5: Mọi người không biết trong kho còn gì — Chấm dứt độc quyền thông tin

```
❌ TRƯỚC ĐÂY: Không ai biết trong kho còn gì ➜ Việc gì cũng phải hỏi Quản kho ➜ Quản kho vắng là TRẠI ĐÌNH TRỆ
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Mở App thấy ngay: Ảnh thực tế + Vị trí Kệ + Số lượng tồn ➜ Phụ kho/Người trực thay tự soạn chuẩn 100%
```

* **Nỗi đau thực tế:** Giám đốc, Kỹ thuật viên, Trưởng chuồng không biết kho còn bao nhiêu cái bóng đèn, bao nhiêu mét dây điện. Mọi thứ phụ thuộc 100% vào một mình quản kho. Quản kho bận việc hoặc nghỉ là không ai biết hàng ở đâu để lấy.
* **MTP ERP giải quyết triệt để:**
  - **Danh mục vật tư thông minh (`/products`):** Mọi nhân viên mở app là thấy danh mục đầy đủ: tên, hình ảnh thực tế, thông số kỹ thuật, vị trí lưu ở kệ nào (`KHO-A-KE-01`) và số lượng tồn khả dụng.
  - **Không còn phụ thuộc:** Phụ kho hoặc người trực thay chỉ cần nhìn app là đi lấy đúng kệ, soạn đúng đồ trong 2 phút.

---

### 🔴 TÌNH HUỐNG 6: Nhập hàng Nhà cung cấp — Phụ kho & Sếp cùng đối soát được

```
❌ TRƯỚC ĐÂY: Hàng về trại chỉ Quản kho biết giá & số lượng ➜ Phụ kho nhận giùm dễ bị hớ / nhận thiếu hàng
────────────────────────────────────────────────────────────────────────────────────────────────────────
✅ BÂY GIỜ : Số hóa phiếu nhập + Chụp ảnh hóa đơn đỏ/phiếu giao ➜ Giám đốc & Phụ kho cùng kiểm tra chéo tức thì
```

* **Nỗi đau thực tế:** Xe giao hàng chở vật tư từ đại lý về trại, đơn giá bao nhiêu, đặt bao nhiêu món chỉ có quản kho chính nắm. Nếu phụ kho ra nhận thay thì không có cơ sở đối chiếu, dễ nhận thiếu hàng hoặc sai quy cách.
* **MTP ERP giải quyết triệt để:**
  - **Phiếu nhập kho số hóa (`/receipts`):** Lưu chi tiết đơn giá, quy cách, tên nhà cung cấp, biển số xe giao.
  - **Lưu trữ hóa đơn chứng từ:** Chụp ảnh hóa đơn đỏ/phiếu giao hàng đính kèm vào phiếu trên app.
  - Phụ kho hay Ban Giám đốc đều mở app kiểm tra và đối chiếu chéo số lượng thực nhận bất kỳ lúc nào.

---

## 🗺️ PHẦN II: SƠ ĐỒ LUỒNG VẬN HÀNH TỔNG THỂ CỦA TRANG TRẠI

```
                                  ┌─────────────────────────────┐
                                  │     NHÀ CUNG CẤP VẬT TƯ     │
                                  └──────────────┬──────────────┘
                                                 │ Nhập hàng + Chụp hóa đơn (/receipts)
                                                 ▼
                                  ┌─────────────────────────────┐
                       ┌────────► │   KHO TỔNG (MAIN STOCK)     │ ◄────────┐
                       │          └──────────────┬──────────────┘          │
                       │                         │                         │
          Nghiệm thu   │                         │ Xuất cấp theo           │ Nhập lại
          sửa đạt      │                         │ phiếu duyệt (/issues)   │ sau khi mượn
                       │                         ▼                         │
             ┌─────────┴─────────┐     ┌───────────────────┐     ┌─────────┴─────────┐
             │   XƯỞNG SỬA CHỮA  │     │ CÁC DÃY CHUỒNG GÀ │     │ MƯỢN TRẢ ĐỒ NGHỀ  │
             │    (/repairs)     │     │  (ZONES / KHU A-B)│     │     (/tools)      │
             └─────────▲─────────┘     └─────────┬─────────┘     └───────────────────┘
                       │                         │
                       │ Gom đồ                  │ Đổi 1-1 cấp tốc trong 30s
                       │ đi sửa                  │ Thu hồi đồ cháy hỏng (/defects)
                       │                         ▼
                       │               ┌───────────────────┐
                       └────────────── │     KHO HỎNG      │
                                       │ (DEFECT LOCATION) │
                                       └─────────┬─────────┘
                                                 │
                                                 │ Hỏng nát không sửa được
                                                 ▼
                                       ┌───────────────────┐
                                       │ THANH LÝ PHẾ LIỆU │ ───► Thu tiền ve chai nộp quỹ
                                       │  (/liquidations)  │
                                       └───────────────────┘
```

---

## 🚀 PHẦN III: ĐỊNH HƯỚNG MỞ RỘNG ERP TOÀN DIỆN CHO TRẠI GÀ (ERP VISION)

Hệ thống hiện tại đã hoàn thiện nền móng vững chắc ở **Khâu Hậu cần - Vật tư - Nhiên liệu**. Định hướng tiếp theo sẽ mở rộng thành **Hệ sinh thái ERP Trại Gà Thông Minh (3 Giai đoạn tiếp theo)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: QUẢN LÝ ĐÀN GÀ & SẢN LƯỢNG TRỨNG HÀNG NGÀY                │
│ - Quản lý lứa gà theo chuồng, theo dõi gà chết/loại thải hàng ngày.    │
│ - Nhật ký nhặt trứng theo ca sáng/chiều, phân loại (loại 1, 2, dập...). │
│ - Tự động tính % Tỷ lệ đẻ (% Laying Rate) của từng dãy chuồng.         │
│ - Quản lý bảng giá trứng theo ngày & xuất bán trứng cho thương lái.    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: THỨC ĂN, CHỈ SỐ FCR & LỊCH THÚ Y VẮC-XIN TỰ ĐỘNG          │
│ - Định mức ăn g/con/ngày, tính chỉ số FCR (kg cám / kg trứng).         │
│ - Cảnh báo ăn giảm sớm (báo động gà ủ bệnh trước khi sụt đẻ).          │
│ - Lịch vắc-xin tự động theo tuần tuổi + Cảnh báo thời gian ngưng thuốc.│
│ - Tự động trừ tồn kho Cám và Thuốc từ Kho Tổng.                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: TÀI CHÍNH NÔNG TRẠI, GIÁ THÀNH 1 QUẢ TRỨNG & LÃI/LỖ P&L    │
│ - Báo cáo Giá thành sản xuất 1 quả trứng (Cost per Egg) theo ngày.     │
│   (Cám + Khấu hao gà giống + Thuốc + Điện/Dầu + Vật tư + Nhân công)    │
│ - Báo cáo Lãi/Lỗ ròng (P&L) theo ngày/tháng của toàn trại.             │
│ - Chấm công ca nhặt trứng & Thưởng năng suất chuồng (% đẻ cao, ít vỡ). │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ PHẦN IV: CÔNG NGHỆ & TỐC ĐỘ PHẢN HỒI SIÊU TỐC (~200ms)

* **Tốc độ cực nhanh trên điện thoại:** Nhờ áp dụng Next.js 15 Server Components kết hợp **38 Database Indexes** và **RAM Cache Metadata**, thời gian mở trang chỉ mất **~200ms**, vuốt chạm mượt mà.
* **Vận hành an toàn 24/7:** Web Production (cổng 3000) được hệ điều hành quản lý tự động, tự bật khi mở máy, không bao giờ bị sập.
* **Ngoại tuyến 100% (PWA):** Đi sâu vào các góc chuồng xa mất sóng 4G/Wifi vẫn thao tác bình thường, tự đồng bộ khi có mạng lại.

---

## 📞 THÔNG TIN BẢN QUYỀN & HỖ TRỢ

* **Đơn vị phát triển:** Đội ngũ Kỹ thuật Antigravity
* **Đơn vị áp dụng:** Trang Trại Gà Đẻ Trứng Lê Văn Dương
* **Địa chỉ:** Ấp Tân Tiến, Xã Minh Tân, Huyện Dầu Tiếng, Tỉnh Bình Dương
* **Hotline hỗ trợ kỹ thuật:** 0988 365 238 – 0963 077 879
