# Hướng dẫn: Trung tâm Báo cáo & Phân tích

Trang **Báo cáo** (`/reports`) phục vụ Chủ trại, Kế toán và Quản lý kho theo ba khu vực rõ ràng.

## 1. Tổng quan quản trị

Đây là màn hình mặc định khi mở trang Báo cáo. Người dùng có thể:

- Theo dõi giá trị tồn kho, nhập trong kỳ, chi phí xuất dùng và chi phí nhiên liệu.
- Xem các tín hiệu cần chú ý như phương tiện vượt định mức, khu vực tập trung chi phí hoặc sự cố chưa xử lý.
- Xem nhanh các trại và phương tiện có mức sử dụng cao.
- Bấm vào cảnh báo hoặc lối tắt để mở đúng báo cáo chi tiết.

Dùng bộ lọc kỳ báo cáo và kho ở đầu trang để thay đổi phạm vi số liệu.

## 2. Báo cáo nghiệp vụ

Chọn **Báo cáo nghiệp vụ**, sau đó chọn một trong năm sổ:

1. **Xuất – Nhập – Tồn:** tồn đầu kỳ, nhập, xuất, tồn cuối kỳ và giá trị tồn.
2. **Chi phí theo trại:** tổng chi phí vật tư, tỷ trọng và chi tiết vật tư theo khu vực.
3. **Tiêu hao phương tiện:** tổng lít, quãng đường/giờ máy, mức tiêu hao và so sánh định mức.
4. **Đối tác:** tổng hợp nhập hàng theo nhà cung cấp và doanh thu theo khách hàng.
5. **Sổ thẻ kho:** lịch sử bút toán của một vật tư tại một kho.

Các nút **Excel** và **PDF** nằm cạnh bộ lọc của báo cáo đang mở. Riêng Sổ thẻ kho, cần chọn vật tư trước khi xuất file.

## 3. Phân tích chuyên sâu

Chọn **Phân tích chuyên sâu** để mở các dashboard Metabase BI:

- Tổng quan điều hành.
- Chi phí theo dãy trại và khu vực.
- Sức khỏe kho và XNT.
- Nhiên liệu và đội xe.
- Sự cố và bảo trì thiết bị.
- Mua hàng và nhà cung cấp.
- Mượn trả dụng cụ.

Có thể đổi dashboard, làm mới, mở Metabase Studio hoặc xem toàn màn hình. Nếu dịch vụ BI tạm thời không khả dụng, các báo cáo native ở hai khu vực còn lại vẫn hoạt động bình thường.

## 4. Deep link và thao tác quay lại

- `/reports`: Tổng quan quản trị.
- `/reports?section=operations&report=xnt`: báo cáo XNT.
- `/reports?section=bi`: phân tích chuyên sâu.

Nút Back/Forward của trình duyệt khôi phục khu vực báo cáo đã mở.

## 5. Lưu ý quản trị

Cấu hình kết nối Metabase và thông tin truy cập cơ sở dữ liệu phải được quản lý bằng biến môi trường và tài liệu vận hành dành cho quản trị viên. Không lưu mật khẩu hoặc chuỗi kết nối trong hướng dẫn người dùng.
