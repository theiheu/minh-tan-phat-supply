# 🔄 VÒNG ĐỜI CHỨNG TỪ & MÁY TRẠNG THÁI (STATE MACHINES & DOCUMENT LIFECYCLES)

> Tài liệu đặc tả các máy trạng thái (State Machines), điều kiện chuyển đổi (State Transitions), vai trò có thẩm quyền, tiến trình 5 cột mốc và quy tắc khóa dữ liệu (Immutability Rules) của toàn bộ các loại chứng từ trong hệ thống **Minh Tân Phát Supply**.

---

## 1. PHIẾU YÊU CẦU VẬT TƯ (REQUISITIONS 5-STAGE MILESTONE STATE MACHINE)

Phiếu xin cấp vật tư trang trại trải qua tiến trình 5 cột mốc kiểm soát rõ ràng nhằm đảm bảo đúng mục đích sử dụng, theo dõi tình trạng đặt hàng NCC và có xác nhận giao nhận 2 chiều:

```mermaid
stateDiagram-v2
    [*] --> draft: 1. Tạo nháp (Requester/Technician)
    draft --> pending: Gửi duyệt (submit_requisition)
    draft --> cancelled: Hủy phiếu nháp
    pending --> approved: 2. Kỹ thuật / Quản kho duyệt (approve_requisition)
    pending --> rejected: Kỹ thuật / Quản kho từ chối (reject_requisition)
    pending --> cancelled: Người tạo hủy phiếu
    approved --> ordered: 3. Quản kho/Kế toán đánh dấu Đang đặt hàng NCC
    approved --> issued: 4. Xuất cấp phát ngay (fulfill_requisition)
    ordered --> issued: 4. Hàng về kho ➔ Xuất cấp phát (fulfill_requisition)
    issued --> received: 5. Người nhận bấm Xác nhận đã nhận đủ (receive_requisition)
    received --> returned: Hoàn trả vật tư thừa về kho (return_requisition_items)
    received --> [*]: Hoàn tất vòng đời
    returned --> [*]: Đã nhập lại kho phần thừa
    rejected --> [*]
    cancelled --> [*]
```

### Chi tiết các trạng thái & Cột mốc Requisition:
| Cột mốc / Trạng thái | Tên tiếng Việt | Quyền thao tác | Hành động hệ thống |
|---|---|---|---|
| `draft` | **Bản nháp** | `requester`, `technician` | Chưa trừ kho. Người tạo có thể tự do thêm/bớt vật tư trong giỏ hàng. |
| `pending` | **Chờ phê duyệt** | `technician`, `warehouse`, `owner` | Đã khóa chỉnh sửa nội dung. Đang chờ Kỹ thuật trưởng hoặc Quản lý khu phê duyệt. |
| `approved` | **Đã phê duyệt** | `warehouse`, `accountant` | Đã chấp thuận cấp phát. Phiếu sẵn sàng để Quản kho xuất hàng (hoặc tự động fulfill khi nhập kho mới). |
| `ordered` | **Đang đặt hàng** | `warehouse`, `accountant` | Đánh dấu vật tư đang được đặt từ Nhà cung cấp ngoài (chờ giao hàng về trại). |
| `issued` | **Đã xuất hàng** | `warehouse` (thực hiện) | Tồn kho vật lý trong hệ thống đã bị trừ. Hàng đang trên đường giao về trại. |
| `received` | **Đã nhận đủ** | `requester` (xác nhận) | Người nhận bấm xác nhận 2 chiều trên app. Phiếu đóng lại hoàn tất. |
| `rejected` | **Bị từ chối** | `technician`, `warehouse` | Ghi nhận lý do từ chối (ví dụ: xin vượt định mức), không xuất hàng. |
| `cancelled` | **Đã hủy** | Người tạo phiếu | Người tạo chủ động hủy khi không còn nhu cầu. |

### Quản lý Hóa đơn & Ảnh chứng từ giao nhận:
* Người yêu cầu hoặc Quản kho có thể upload trực tiếp ảnh hóa đơn VAT / phiếu giao hàng (`invoice_images`) từ camera điện thoại.
* Khi phiếu yêu cầu được liên kết với Phiếu nhập kho (`auto_fulfilled_by_receipt_id`), ảnh hóa đơn sẽ được đồng bộ 2 chiều tự động.

---

## 2. PHIẾU NHẬP KHO NHÀ CUNG CẤP (RECEIPTS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Tạo phiếu nhập & Chụp ảnh hóa đơn (create_receipt)
    draft --> posted: Duyệt nhập kho & Tự động cấp phát (post_receipt)
    draft --> cancelled: Hủy phiếu nhập (cancel_receipt)
    posted --> cancelled: Hoàn tác nhập kho - Reversal Movement (revert_receipt)
    posted --> [*]: Tồn kho đã cộng & Lưu sổ cái
    cancelled --> [*]
```

### Quy tắc tự động cấp phát khi nhập kho (Auto-Fulfill):
1. Khi Quản kho bấm **Hoàn tất nhập kho (`post_receipt`)**, tồn kho sẽ được cộng ngay lập tức.
2. Hệ thống tự động tìm các Phiếu yêu cầu **ĐÃ ĐƯỢC PHÊ DUYỆT (`approved` hoặc `ordered`)** theo thứ tự thời gian tạo tăng dần (FIFO).
3. Tự động xuất kho (`fulfill_requisition`) cho các phiếu này và lưu vết kết quả bền vững vào bảng audit và `linked_requisition_ids`.
4. *Lưu ý quan trọng:* Các phiếu đang ở trạng thái `pending` (chưa duyệt) sẽ **không** bị tự động xuất hàng để đảm bảo nguyên tắc quản trị.

---

## 3. PHIẾU XUẤT KHO TRỰC TIẾP (ISSUES STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Tạo phiếu xuất nội bộ / Bán hàng (create_issue)
    draft --> posted: Xác nhận xuất kho & Trừ tồn ngay (post_issue)
    draft --> cancelled: Hủy phiếu nháp
    posted --> cancelled: Hoàn tác xuất kho - Reversal Movement (revert_issue)
    posted --> [*]: Đã trừ tồn & Ghi nhận chi phí dãy trại
    cancelled --> [*]
```

---

## 4. QUY TRÌNH BÁO HỎNG & ĐỔI 1-1 CẤP TỐC (DEFECTS & EXCHANGES)

```mermaid
stateDiagram-v2
    [*] --> Defect_Staging: Báo hỏng tại trại kèm >= 1 ảnh (record_defect)
    Defect_Staging --> Quick_Exchange: Chọn Đổi 1-1 Cấp Tốc (create_exchange)
    Quick_Exchange --> Exchange_Approved: Duyệt đổi (approve_exchange)
    Exchange_Approved --> Exchange_Issued: Xuất hàng mới từ Kho Tổng & nạp đồ hỏng (issue_exchange)
    Exchange_Issued --> Exchange_Received: Thợ nhận hàng mang đi lắp (receive_exchange)
    Defect_Staging --> Repair_Staging: Gom đi sửa chữa (send_to_repair)
    Defect_Staging --> Liquidation_Staging: Chuyển thanh lý ve chai (create_liquidation)
```

---

## 5. ĐƠN SỬA CHỮA CƠ ĐIỆN (REPAIR ORDERS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> in_repair: Gom motor cháy gửi xưởng quấn (send_to_repair)
    in_repair --> returned_to_stock: Nghiệm thu đạt chuẩn ➜ Nhập lại Kho Tổng (complete_repair)
    in_repair --> liquidation: Thợ báo cháy nát không sửa được ➜ Chuyển Thanh lý
    in_repair --> cancelled: Hủy đơn sửa (cancel_repair)
    returned_to_stock --> [*]
    liquidation --> [*]
    cancelled --> [*]
```

---

## 6. MƯỢN TRẢ DỤNG CỤ ĐỒ NGHỀ (TOOL BORROWINGS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> borrowed: Cho thợ mượn đồ nghề & Hẹn ngày trả (create_tool_borrowing)
    borrowed --> returned: Mang trả đồ nghề còn nguyên vẹn (return_tool_borrowing)
    borrowed --> cancelled: Hủy phiếu mượn nhầm
    returned --> [*]: Hoàn tất thu hồi dụng cụ
    cancelled --> [*]
```
* **Cảnh báo quá hạn (Overdue Alert):** Khi `CURRENT_DATE > due_date` và `status = 'borrowed'`, hệ thống tự động gắn huy hiệu màu đỏ cảnh báo trên màn hình Quản kho và gửi email đôn đốc thu hồi.

---

## 7. TRẠM BỒN DẦU DIESEL & CẤP DẦU ĐA PHƯƠNG THỨC (FUEL STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> Fuel_Receipt: Xe bồn Petrolimex vào nhập dầu (create_fuel_receipt)
    Fuel_Receipt --> Bulk_Tank: Tồn kho bồn dầu tăng

    state Fuel_Dispensing {
        [*] --> Mode_Selection
        Mode_Selection --> Vehicle_Mode: Cấp dầu Phương tiện (dispense_type = vehicle)
        Mode_Selection --> Zone_Mode: Cấp dầu Toàn khu / Dãy trại (dispense_type = zone)
        Vehicle_Mode --> Meter_Verification: Quét QR xe + Nhập ODO/giờ máy + Chụp đồng hồ
        Zone_Mode --> Zone_Allocation: Chọn Khu & Dãy trại đích + Chụp đồng hồ
        Meter_Verification --> Deduct_And_Audit
        Zone_Allocation --> Deduct_And_Audit
    }

    Bulk_Tank --> Fuel_Dispensing
    Deduct_And_Audit --> [*]: Trừ tồn bồn dầu + Tính L/100km hoặc L/h + Phân bổ chi phí
```

---

## 8. PHIÊN KIỂM KÊ KHO (STOCKTAKE SESSIONS STATE MACHINE)

```mermaid
stateDiagram-v2
    [*] --> draft: Mở phiên kiểm kê vị trí kho (create_stocktake)
    draft --> draft: Quét mã QR & Nhập số thực tế (Ghi nhận difference + ảnh)
    draft --> posted: Chủ trại / Kế toán duyệt cân bằng tồn kho (post_stocktake)
    draft --> cancelled: Hủy phiên kiểm kê
    posted --> [*]: Tồn kho tự động điều chỉnh khớp 100% thực tế
    cancelled --> [*]
```

---

## 9. QUẢN TRỊ CHỨNG TỪ CẤP CAO (MASTER DOCUMENT CONTROL LIFECYCLE)

```mermaid
stateDiagram-v2
    [*] --> Inspect_Dependencies: Superuser/Owner gọi admin_inspect_document_dependencies
    Inspect_Dependencies --> Safe_Evaluation: Kiểm tra cây chứng từ liên kết & số lượng stock movements
    Safe_Evaluation --> Hard_Delete_Direct: Không có phụ thuộc ➜ Xóa trực tiếp
    Safe_Evaluation --> Cascade_Or_Reverse: Có phụ thuộc phát sinh
    Cascade_Or_Reverse --> Reversal_Ledger: p_reverse_inventory = true ➜ Sinh bút toán đảo tồn kho
    Cascade_Or_Reverse --> Cascade_Cleanup: p_cascade = true ➜ Dọn dẹp chứng từ phụ thuộc
    Reversal_Ledger --> Document_Purged
    Cascade_Cleanup --> Document_Purged
    Hard_Delete_Direct --> Document_Purged
    Document_Purged --> [*]
```
