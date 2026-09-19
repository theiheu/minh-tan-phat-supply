import type { BusinessEventInput, BusinessEventKey, EventPolicy } from "../server/event-types";
import type { ResolvedRecipient } from "../server/resolve-recipients";
import { formatItemsToSummaryString, type EmailFourLinesSummary } from "./base-layout";
import { renderActionEmail } from "./action-email";
import { renderResultEmail } from "./result-email";
import { renderFinanceEmail } from "./finance-email";
import { renderDriverEmail } from "./driver-email";

export interface RenderRoleEmailOptions<K extends BusinessEventKey> {
  policy: EventPolicy<K>;
  recipient: ResolvedRecipient;
  input: BusinessEventInput<K>;
  link: string;
  baseUrl?: string;
}

function formatVND(amount?: number | null): string {
  if (amount === undefined || amount === null) return "0 ₫";
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function build4LinesSummary<K extends BusinessEventKey>(
  input: BusinessEventInput<K>,
  p: any,
): EmailFourLinesSummary {
  const event = input.event;
  const itemsSummary = formatItemsToSummaryString(
    p.items,
    p.itemSummary || p.toolNames || p.equipmentName || (p.fuelTypeName ? `${p.quantity} ${p.unit} ${p.fuelTypeName}` : undefined)
  );

  let actionLine = `🔔 Thông báo cập nhật phiếu ${p.code || ""}`;
  const locationOrPartner = p.zoneName || p.locationName || p.supplierName || p.customerName || p.vendorName || p.fromLocationName || p.toLocationName || "";

  if (event === "requisition.submitted") {
    actionLine = `🔔 [CẦN PHÊ DUYỆT] ${p.requesterName || "Người yêu cầu"} đã gửi phiếu yêu cầu cấp phát mới`;
  } else if (event === "requisition.approved") {
    actionLine = `✅ [ĐÃ PHÊ DUYỆT] Phiếu yêu cầu cấp phát đã được phê duyệt`;
  } else if (event === "requisition.rejected") {
    actionLine = `❌ [BỊ TỪ CHỐI] Phiếu yêu cầu cấp phát bị từ chối`;
  } else if (event === "requisition.fulfilled") {
    actionLine = `📦 [ĐÃ XUẤT CẤP PHÁT] Thủ kho ${p.handlerName ? `(${p.handlerName}) ` : ""}đã xuất kho cấp phát vật tư`;
  } else if (event === "requisition.cancelled") {
    actionLine = `⛔ [ĐÃ HỦY] Phiếu yêu cầu cấp phát đã được hủy`;
  } else if (event === "requisition.received") {
    actionLine = `🤝 [ĐÃ NHẬN VẬT TƯ] Người yêu cầu ${p.handlerName ? `(${p.handlerName}) ` : ""}đã nhận đủ vật tư`;
  } else if (event === "requisition.returned") {
    actionLine = `↩️ [HOÀN TRẢ VẬT TƯ] Đã hoàn trả vật tư về kho lưu trữ`;
  } else if (event === "receipt.created") {
    actionLine = `📝 [TẠO PHIẾU ĐẶT HÀNG] Đã tạo phiếu đặt hàng / nhập kho mới`;
  } else if (event === "receipt.approved") {
    actionLine = `✅ [DUYỆT ĐƠN ĐẶT HÀNG] Đã duyệt đơn đặt hàng / Chờ nhập kho`;
  } else if (event === "receipt.posted") {
    actionLine = `📥 [ĐÃ NHẬP KHO] Thủ kho ${p.receiverName || p.handlerName || ""} đã hoàn tất nhập kho hàng hóa`;
  } else if (event === "receipt.cancelled_or_reversed") {
    actionLine = `⛔ [HỦY NHẬP KHO] Phiếu nhập kho đã được hủy / đảo bút toán`;
  } else if (event === "issue.created") {
    actionLine = `📝 [TẠO PHIẾU XUẤT KHO] Đã tạo phiếu xuất kho mới`;
  } else if (event === "issue.sale_posted") {
    actionLine = `💰 [XUẤT BÁN HÀNG] Thủ kho ${p.issuerName || p.handlerName || ""} đã hoàn tất xuất bán hàng`;
  } else if (event === "issue.internal_action_required") {
    actionLine = `📤 [CẦN XUẤT KHO] Phiếu xuất kho nội bộ cần thủ kho chuẩn bị và xuất hàng`;
  } else if (event === "issue.cancelled") {
    actionLine = `⛔ [HỦY PHIẾU XUẤT] Phiếu xuất kho đã được hủy bỏ`;
  } else if (event === "liquidation.created") {
    actionLine = `📝 [ĐỀ XUẤT THANH LÝ] Tạo mới đề xuất thanh lý vật tư/tài sản`;
  } else if (event === "liquidation.approved") {
    actionLine = `📝 [ĐÃ DUYỆT THANH LÝ] Phiếu đề xuất thanh lý đã được duyệt`;
  } else if (event === "liquidation.completed") {
    actionLine = `💸 [HOÀN TẤT THANH LÝ] Đã hoàn tất thủ tục thanh lý vật tư/tài sản`;
  } else if (event === "liquidation.rejected") {
    actionLine = `❌ [TỪ CHỐI THANH LÝ] Đề xuất thanh lý tài sản bị từ chối`;
  } else if (event === "stocktake.created") {
    actionLine = `📋 [KHỞI TẠO KIỂM KÊ] Khởi tạo kỳ kiểm kê kho: ${p.sessionName || p.code}`;
  } else if (event === "stocktake.posted_with_variance" || event === "stocktake.completed_discrepancy") {
    actionLine = `📊 [CHỐT KIỂM KÊ - CÓ CHÊNH LỆCH] Đã chốt kỳ kiểm kê kho ${p.sessionName || p.code}`;
  } else if (event === "stocktake.posted_without_variance") {
    actionLine = `✅ [CHỐT KIỂM KÊ - KHỚP 100%] Đã chốt kỳ kiểm kê kho ${p.sessionName || p.code}`;
  } else if (event === "stocktake.cancelled") {
    actionLine = `⛔ [HỦY KỲ KIỂM KÊ] Đã hủy kỳ kiểm kê kho ${p.sessionName || p.code}`;
  } else if (event === "transfer.completed") {
    actionLine = `🔄 [ĐIỀU CHUYỂN KHO] Đã hoàn tất điều chuyển kho nội bộ`;
  } else if (event === "stock.adjusted") {
    actionLine = `⚙️ [ĐIỀU CHỈNH TỒN KHO] Ghi nhận điều chỉnh tồn kho`;
  } else if (event === "assembly.completed") {
    actionLine = `📦 [LẮP RÁP THÀNH PHẨM] Hoàn tất lệnh lắp ráp bộ thành phẩm theo BOM`;
  } else if (event === "disassembly.completed") {
    actionLine = `🔧 [THÁO DỠ THÀNH PHẨM] Hoàn tất lệnh tháo dỡ bộ thành phẩm theo BOM`;
  } else if (event === "tool.borrowed") {
    actionLine = `🔧 [ĐÃ BÀN GIAO DỤNG CỤ] Bàn giao dụng cụ cho ${p.borrowerName || "nhân sự"}`;
  } else if (event.startsWith("tool.due_soon")) {
    actionLine = `⏰ [SẮP ĐẾN HẠN TRẢ] Dụng cụ bạn mượn sắp đến hạn trả trong 24 giờ`;
  } else if (event.startsWith("tool.overdue")) {
    actionLine = `🚨 [QUÁ HẠN HOÀN TRẢ] Dụng cụ mượn đã quá hạn hoàn trả theo quy định`;
  } else if (event === "tool.returned") {
    actionLine = `✅ [ĐÃ HOÀN TRẢ DỤNG CỤ] Đã hoàn tất nhận lại dụng cụ về kho`;
  } else if (event === "fuel.dispensed") {
    actionLine = `⛽ [CẤP PHÁT NHIÊN LIỆU] Cấp phát ${p.quantity} ${p.unit} ${p.fuelTypeName} cho xe ${p.vehicleCode || ""}`;
  } else if (event === "fuel.receipt_completed") {
    actionLine = `🛢️ [NHẬP KHO NHIÊN LIỆU] Đã nhập kho ${p.quantity} ${p.unit} ${p.fuelTypeName}`;
  } else if (event === "defect.created") {
    actionLine = `⚠️ [BÁO HỎNG VẬT TƯ/THIẾT BỊ] ${p.reporterName || "Kỹ thuật"} đã báo hỏng cần kiểm tra`;
  } else if (event === "defect.resolution_selected") {
    actionLine = `📋 [ĐÃ CHỌN PHƯƠNG ÁN] Xác nhận phương án xử lý thiết bị báo hỏng`;
  } else if (event === "defect.sent_to_liquidation") {
    actionLine = `🏷️ [CHUYỂN THANH LÝ] Thiết bị hỏng được chuyển sang đề xuất thanh lý`;
  } else if (event === "repair.sent") {
    actionLine = `🚚 [GỬI ĐI SỬA CHỮA] Đã chuyển thiết bị cho ${p.vendorName || "đơn vị ngoài"} sửa chữa`;
  } else if (event === "repair.ready_for_acceptance") {
    actionLine = `🔍 [CHỜ NGHIỆM THU SỬA CHỮA] Thiết bị đã sửa xong, chờ kỹ thuật kiểm tra`;
  } else if (event === "repair.accepted_and_returned") {
    actionLine = `✅ [NGHIỆM THU HOÀN TẤT] Thiết bị sửa chữa đã nghiệm thu nhập lại kho`;
  } else if (event === "exchange.created") {
    actionLine = `🔄 [ĐỀ XUẤT ĐỔI MỚI] Phiếu đổi mới vật tư hỏng chờ phê duyệt`;
  } else if (event === "exchange.approved") {
    actionLine = `✅ [ĐÃ DUYỆT ĐỔI MỚI] Phiếu đổi mới đã duyệt, thủ kho chuẩn bị xuất hàng`;
  } else if (event === "exchange.rejected") {
    actionLine = `❌ [TỪ CHỐI ĐỔI MỚI] Đề xuất đổi mới vật tư bị từ chối`;
  } else if (event === "exchange.issued") {
    actionLine = `📦 [ĐÃ XUẤT ĐỔI MỚI] Đã xuất kho vật tư mới thay thế`;
  } else if (event === "exchange.received") {
    actionLine = `🤝 [ĐÃ NHẬN ĐỔI MỚI] Đã nhận đủ vật tư mới thay thế`;
  }

  const codeAndLocationLine = locationOrPartner
    ? `Mã: ${p.code || "---"} | Nơi nhận / Đối tác: ${locationOrPartner}`
    : `Mã phiếu: ${p.code || "---"}`;

  const purposeOrNote = p.reason || p.purpose || p.notes || (p.cost ? `Chi phí sửa: ${formatVND(p.cost)}` : undefined);

  return {
    actionLine,
    codeAndLocationLine,
    itemsSummaryLine: itemsSummary,
    purposeOrNoteLine: purposeOrNote,
  };
}

export function renderRoleEmail<K extends BusinessEventKey>({
  policy,
  recipient,
  input,
  link,
  baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "",
}: RenderRoleEmailOptions<K>): string {
  const fullUrl = link.startsWith("http") ? link : `${baseUrl.replace(/\/+$/, "")}${link}`;
  const title = policy.getSubjectTitle(input.payload);
  const p = input.payload as any;

  const summary4Lines = build4LinesSummary(input, p);

  // 1. Template KIND: driver (dành riêng cho tài xế)
  if (policy.templateKind === "driver" && recipient.role === "driver") {
    return renderDriverEmail({
      summary4Lines,
      docCode: p.code,
      title,
      vehicleCode: p.vehicleCode,
      vehicleName: p.vehicleName,
      fuelTypeName: p.fuelTypeName,
      quantity: p.quantity,
      unit: p.unit,
      currentOdo: p.currentOdo,
      odoUnit: p.odoUnit,
      zoneName: p.zoneName,
      dispenserName: p.dispenserName,
      notes: p.notes,
      ctaUrl: fullUrl,
    });
  }

  // 2. Template KIND: finance (chỉ khi recipient là accountant hoặc owner hoặc superuser)
  if (policy.templateKind === "finance" && (recipient.role === "accountant" || recipient.role === "owner" || recipient.role === "superuser")) {
    return renderFinanceEmail({
      summary4Lines,
      docCode: p.code,
      title,
      summary: `Hệ thống đã ghi nhận giao dịch tài chính cho mã chứng từ ${p.code || ""}.`,
      details: {
        "Đối tác / Nhà cung cấp:": p.supplierName,
        "Khách hàng:": p.customerName,
        "Khu vực / Kho:": p.zoneName ?? p.locationName,
        "Số dòng hàng:": p.items?.length ? `${p.items.length} mặt hàng` : p.itemCount,
        "Lý do / Ghi chú:": p.reason ?? p.notes,
      },
      items: p.items,
      totalAmount: p.totalAmount ?? p.totalProceeds ?? p.varianceValue,
      invoiceNumber: p.invoiceNumber,
      ctaUrl: fullUrl,
    });
  }

  // 3. Template KIND: action
  if (policy.templateKind === "action") {
    let instruction = "Phiếu yêu cầu thao tác kiểm tra, xử lý hoặc chuẩn bị xuất nhập kho từ bạn.";
    if (input.event === "requisition.submitted") {
      instruction = `Người yêu cầu ${p.requesterName ? `(${p.requesterName}) ` : ""}đã gửi phiếu yêu cầu cấp phát mới. Kế toán / Quản lý vui lòng xem xét và phê duyệt.`;
    } else if (input.event === "requisition.approved") {
      instruction = "Phiếu yêu cầu cấp phát đã được phê duyệt. Bộ phận liên quan vui lòng chuẩn bị và thực hiện cấp phát.";
    } else if (input.event === "receipt.created") {
      instruction = `Phiếu đặt hàng / nhập kho mới ${p.code ? `(${p.code}) ` : ""}đã được tạo. Kế toán / Ban quản lý vui lòng xem xét và duyệt đơn đặt hàng.`;
    } else if (input.event === "receipt.approved") {
      instruction = `Đơn đặt hàng ${p.code ? `(${p.code}) ` : ""}đã được phê duyệt. Quản kho vui lòng kiểm đếm khi hàng về và duyệt nhập kho.`;
    } else if (input.event === "issue.created") {
      instruction = `Phiếu xuất kho mới ${p.code ? `(${p.code}) ` : ""}đã được tạo. Quản kho vui lòng kiểm tra và thực hiện xuất hàng.`;
    } else if (input.event === "issue.internal_action_required") {
      instruction = "Phiếu xuất kho nội bộ cần kiểm tra và chuẩn bị xuất hàng.";
    } else if (input.event === "liquidation.created") {
      instruction = `Đề xuất thanh lý tài sản ${p.code ? `(${p.code}) ` : ""}cần Kế toán / Ban quản lý kiểm tra và phê duyệt.`;
    } else if (input.event === "liquidation.approved") {
      instruction = "Đề xuất thanh lý đã được duyệt. Thủ kho vui lòng tiến hành thủ tục thanh lý theo quy định.";
    } else if (input.event === "stocktake.created") {
      instruction = `Kỳ kiểm kê kho "${p.sessionName || p.code}" đã được khởi tạo. Bộ phận liên quan vui lòng kiểm đếm số lượng thực tế.`;
    } else if (input.event.startsWith("tool.due_soon")) {
      instruction = "Dụng cụ bạn đang mượn sắp đến hạn trả trong vòng 24 giờ. Vui lòng sắp xếp hoàn trả đúng hạn.";
    } else if (input.event.startsWith("tool.overdue")) {
      instruction = "Dụng cụ đã quá hạn hoàn trả theo thời gian đăng ký. Vui lòng mang đến kho hoàn trả ngay.";
    } else if (input.event.startsWith("defect.created")) {
      instruction = "Thiết bị / vật tư báo hỏng mới cần bộ phận kỹ thuật kiểm tra và lựa chọn phương án xử lý.";
    } else if (input.event.startsWith("defect.resolution_selected")) {
      instruction = "Đã có phương án xử lý vật tư báo hỏng. Bộ phận liên quan vui lòng kiểm tra và tiếp tục thực hiện.";
    } else if (input.event.startsWith("defect.sent_to_liquidation")) {
      instruction = "Vật tư hỏng đã được chuyển sang danh sách đề xuất thanh lý.";
    } else if (input.event === "exchange.created") {
      instruction = "Phiếu đề xuất đổi mới vật tư cần quản lý xem xét và phê duyệt.";
    } else if (input.event === "exchange.approved") {
      instruction = "Phiếu đổi mới vật tư đã được phê duyệt. Chuẩn bị xuất hàng đổi mới.";
    } else if (input.event === "repair.sent") {
      instruction = "Thiết bị đã được gửi đi sửa chữa đơn vị ngoài. Kỹ thuật viên vui lòng theo dõi tiến độ.";
    } else if (input.event === "repair.ready_for_acceptance") {
      instruction = "Thiết bị đã sửa chữa xong và chờ kỹ thuật viên kiểm tra nghiệm thu trước khi nhập lại kho.";
    }

    return renderActionEmail({
      summary4Lines,
      docCode: p.code,
      title,
      instructions: instruction,
      details: {
        "Người yêu cầu / Người báo:": p.requesterName ?? p.reporterName ?? p.borrowerName,
        "Khu vực / Trại:": p.zoneName ?? p.locationName,
        "Mục đích / Lý do:": p.purpose ?? p.reason,
        "Thiết bị / Dụng cụ:": p.equipmentName ?? p.toolNames,
        "Hạn trả:": p.expectedReturnDate,
      },
      items: p.items,
      ctaUrl: fullUrl,
    });
  }

  // 4. Default: Result Email (thông báo kết quả cho Requester, Quản kho, Kế toán,...)
  let badgeText = "ĐÃ HOÀN TẤT";
  let badgeBg = "#059669";

  if (input.event.endsWith(".rejected") || input.event.includes("rejected")) {
    badgeText = "BỊ TỪ CHỐI";
    badgeBg = "#dc2626";
  } else if (input.event.endsWith(".cancelled") || input.event.includes("cancelled")) {
    badgeText = "ĐÃ HỦY";
    badgeBg = "#71717a";
  } else if (input.event === "requisition.received" || input.event === "exchange.received") {
    badgeText = "ĐÃ NHẬN VẬT TƯ";
    badgeBg = "#059669";
  } else if (input.event === "requisition.returned") {
    badgeText = "HOÀN TRẢ VẬT TƯ";
    badgeBg = "#0284c7";
  } else if (input.event === "requisition.fulfilled") {
    badgeText = "ĐÃ CẤP PHÁT";
    badgeBg = "#ea580c";
  } else if (input.event.startsWith("receipt.")) {
    badgeText = "NHẬP KHO";
    badgeBg = "#059669";
  } else if (input.event.startsWith("issue.")) {
    badgeText = "XUẤT KHO";
    badgeBg = "#059669";
  } else if (input.event.startsWith("transfer.") || input.event.startsWith("stock.")) {
    badgeText = "CHUYỂN KHO";
    badgeBg = "#0284c7";
  } else if (input.event.startsWith("assembly.") || input.event.startsWith("disassembly.")) {
    badgeText = "LẮP RÁP";
    badgeBg = "#059669";
  } else if (input.event.startsWith("fuel.")) {
    badgeText = "NHIÊN LIỆU";
    badgeBg = "#ea580c";
  } else if (input.event.startsWith("tool.borrowed")) {
    badgeText = "ĐÃ BÀN GIAO";
    badgeBg = "#ea580c";
  } else if (input.event.startsWith("tool.returned")) {
    badgeText = "ĐÃ HOÀN TRẢ";
    badgeBg = "#059669";
  } else if (input.event.startsWith("repair.accepted_and_returned") || input.event.startsWith("repair.completed")) {
    badgeText = "ĐÃ NHẬP LẠI KHO";
    badgeBg = "#059669";
  }

  let summary = `Trạng thái của phiếu ${p.code || ""} đã được cập nhật thành công.`;
  if (input.event === "requisition.approved") {
    summary = `Phiếu yêu cầu cấp phát ${p.code} đã được phê duyệt thành công.`;
  } else if (input.event === "requisition.rejected") {
    summary = `Phiếu yêu cầu cấp phát ${p.code} bị từ chối.${p.reason ? ` Lý do: ${p.reason}` : ""}`;
  } else if (input.event === "receipt.posted") {
    summary = `Đã hoàn tất nhập hàng cho mã ${p.code}${p.supplierName ? ` từ NCC ${p.supplierName}` : ""}.`;
  } else if (input.event === "receipt.cancelled_or_reversed") {
    summary = `Phiếu nhập ${p.code} đã được hủy / đảo bút toán trên hệ thống.`;
  } else if (input.event === "issue.sale_posted") {
    summary = `Đã hoàn tất xuất bán hàng cho mã ${p.code}${p.customerName ? ` cho khách ${p.customerName}` : ""}.`;
  } else if (input.event === "issue.cancelled") {
    summary = `Phiếu xuất kho ${p.code} đã được hủy bỏ trên hệ thống.`;
  } else if (input.event === "requisition.fulfilled") {
    summary = `Đã hoàn tất xuất cấp phát vật tư cho phiếu ${p.code}. Bạn có thể tiến hành nhận hàng.`;
  } else if (input.event === "requisition.received") {
    summary = `Người yêu cầu ${p.handlerName ? `(${p.handlerName}) ` : ""}đã xác nhận nhận đủ vật tư cho phiếu ${p.code}.`;
  } else if (input.event === "requisition.returned") {
    summary = `Nhân sự ${p.handlerName ? `(${p.handlerName}) ` : ""}đã hoàn trả vật tư về kho lưu trữ cho phiếu ${p.code}.`;
  } else if (input.event === "transfer.completed") {
    summary = `Đã hoàn tất điều chuyển ${p.itemCount ? `${p.itemCount} mặt hàng` : "vật tư"} giữa các vị trí kho.`;
  } else if (input.event === "stock.adjusted") {
    summary = `Đã ghi nhận điều chỉnh tồn kho (Chênh lệch: ${p.delta && p.delta > 0 ? `+${p.delta}` : p.delta || 0}). Lý do: ${p.reason || "N/A"}.`;
  } else if (input.event === "assembly.completed") {
    summary = `Đã hoàn tất lệnh lắp ráp bộ thành phẩm ${p.kitSkuName || ""} (Số lượng: ${p.quantity || 1}) theo BOM.`;
  } else if (input.event === "disassembly.completed") {
    summary = `Đã hoàn tất lệnh tháo dỡ bộ thành phẩm (Số lượng: ${p.quantity || 1}) theo BOM.`;
  } else if (input.event === "exchange.issued") {
    summary = `Đã xuất hàng mới thay thế cho phiếu đổi mới ${p.code}.`;
  } else if (input.event === "exchange.received") {
    summary = `Người yêu cầu ${p.handlerName ? `(${p.handlerName}) ` : ""}đã xác nhận nhận vật tư đổi mới thay thế cho phiếu ${p.code}.`;
  } else if (input.event === "fuel.receipt_completed") {
    summary = `Đã hoàn tất nhập kho nhiên liệu ${p.fuelTypeName ?? ""} (${p.quantity} ${p.unit ?? ""}) theo phiếu ${p.code}.`;
  } else if (input.event === "fuel.dispensed") {
    summary = `Đã hoàn tất cấp phát nhiên liệu xe ${p.vehicleCode ?? ""} (${p.quantity} ${p.unit ?? ""}) theo phiếu ${p.code}.`;
  } else if (input.event === "tool.borrowed") {
    summary = `Đã bàn giao dụng cụ thành công cho nhân sự theo phiếu ${p.code}.`;
  } else if (input.event === "tool.returned") {
    summary = `Đã hoàn tất nhận lại dụng cụ bàn giao theo phiếu ${p.code}.`;
  } else if (input.event === "repair.accepted_and_returned") {
    summary = `Thiết bị đã hoàn tất sửa chữa và được nghiệm thu nhập lại kho theo phiếu ${p.code}.`;
  }

  return renderResultEmail({
    summary4Lines,
    docCode: p.code,
    title,
    badgeText,
    badgeBg,
    summary,
    details: {
      "Nhà cung cấp:": p.supplierName,
      "Khách hàng:": p.customerName,
      "Khu vực / Trại:": p.zoneName ?? p.locationName,
      "Thiết bị / Vật tư:": p.equipmentName ?? p.toolNames ?? p.kitSkuName,
      "Nhiên liệu:": p.fuelTypeName ? `${p.fuelTypeName} (${p.quantity} ${p.unit})` : undefined,
      "Số dòng hàng:": p.items?.length ? `${p.items.length} mặt hàng` : p.itemCount,
      "Lý do:": p.reason,
      "Người thực hiện:": p.handlerName ?? p.receiverName ?? p.issuerName ?? p.dispenserName,
      "Ghi chú:": p.notes,
    },
    items: p.items,
    ctaUrl: fullUrl,
  });
}
