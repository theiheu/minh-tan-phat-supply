import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from "@powersync/web";
import { createClient } from "@/lib/supabase/client";

export interface PowerSyncConnectorConfig {
  powersyncUrl?: string;
}

export class MinhTanPhatPowerSyncConnector implements PowerSyncBackendConnector {
  private powersyncUrl: string;

  constructor(config?: PowerSyncConnectorConfig) {
    this.powersyncUrl =
      config?.powersyncUrl ||
      process.env.NEXT_PUBLIC_POWERSYNC_URL ||
      "";
  }

  /**
   * Lấy JWT token từ phiên đăng nhập Supabase Auth hiện tại
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!this.powersyncUrl) {
      // PowerSync URL chưa được cấu hình (ví dụ môi trường test/local standalone)
      return null;
    }

    try {
      const supabase = createClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        return null;
      }

      return {
        endpoint: this.powersyncUrl,
        token: session.access_token,
      };
    } catch (err) {
      console.warn("[PowerSync] Lỗi khi lấy thông tin xác thực Supabase:", err);
      return null;
    }
  }

  /**
   * Đẩy các thay đổi offline từ SQLite local lên Supabase PostgreSQL qua RPCs
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const supabase = createClient();

    try {
      for (const op of transaction.crud) {
        await this.processCrudOperation(op, supabase);
      }
      await transaction.complete();
    } catch (err) {
      console.error("[PowerSync] Lỗi khi xử lý hàng đợi tải lên (Upload Queue):", err);
      throw err;
    }
  }

  /**
   * Xử lý từng tác vụ mutation cục bộ bằng các Stored Procedure (RPC) an toàn
   */
  private async processCrudOperation(op: CrudEntry, supabase: ReturnType<typeof createClient>) {
    const { table, op: opType, opData } = op;

    // 1. Tạo phiếu yêu cầu cấp phát vật tư (Requisition)
    if (table === "requisitions" && (opType === UpdateType.PUT || opType === UpdateType.PATCH)) {
      if (!opData) return;
      
      const items = Array.isArray(opData.items) ? opData.items : [];
      const { error } = await supabase.rpc("create_requisition", {
        p_items: items.map((i: any) => ({
          sku_id: i.sku_id || i.skuId,
          transaction_unit_id: i.transaction_unit_id || i.transactionUnitId || null,
          entered_quantity: i.entered_quantity || i.enteredQuantity || i.quantity,
        })),
        p_zone_id: opData.zone_id || opData.zoneId,
        p_sub_zone_id: opData.sub_zone_id || opData.subZoneId || null,
        p_purpose: opData.purpose || "Yêu cầu cấp phát ngoại tuyến",
        p_type: opData.requisition_type || "new_supply",
        p_linked_defect_id: null as unknown as string,
        p_requester_id: opData.requester_id || opData.requesterId,
      });

      if (error) {
        throw new Error(`[PowerSync Upload: create_requisition] ${error.message}`);
      }
      return;
    }

    // 2. Ghi nhận cấp phát nhiên liệu xe cơ giới (Fuel Dispense)
    if (table === "fuel_dispenses" && (opType === UpdateType.PUT || opType === UpdateType.PATCH)) {
      if (!opData) return;

      const { error } = await supabase.rpc("create_fuel_dispense", {
        p_vehicle_id: (opData.vehicle_id || opData.vehicleId || null) as unknown as string,
        p_zone_id: (opData.zone_id || opData.zoneId || null) as unknown as string,
        p_fuel_type_id: opData.fuel_type_id || opData.fuelTypeId,
        p_quantity: opData.quantity,
        p_current_odo: (opData.current_odo || opData.currentOdo || null) as unknown as number,
        p_driver_name: (opData.driver_name || opData.driverName || null) as unknown as string,
        p_driver_id: (opData.driver_id || opData.driverId || null) as unknown as string,
        p_by: opData.dispenser_id || opData.dispenserId || opData.by,
        p_meter_images: opData.meter_images || [],
        p_notes: (opData.notes || null) as unknown as string,
        p_sub_zone_id: (opData.sub_zone_id || opData.subZoneId || null) as unknown as string,
      });

      if (error) {
        throw new Error(`[PowerSync Upload: fuel_dispense] ${error.message}`);
      }
      return;
    }

    // 3. Mượn dụng cụ ngoại tuyến (Tool Borrowing)
    if (table === "tool_borrowings" && (opType === UpdateType.PUT || opType === UpdateType.PATCH)) {
      if (!opData) return;

      const items = Array.isArray(opData.items) ? opData.items : [];
      const { error } = await supabase.rpc("create_tool_borrowing", {
        p_items: items.map((i: any) => ({
          sku_id: i.sku_id || i.skuId,
          quantity: i.quantity,
        })),
        p_zone_id: (opData.zone_id || opData.zoneId || null) as unknown as string,
        p_purpose: (opData.purpose || "Mượn dụng cụ").trim(),
        p_expected_return_date: (opData.expected_return_date || opData.expectedReturnDate || null) as unknown as string,
        p_borrower_id: opData.borrower_id || opData.borrowerId,
        p_sub_zone_id: (opData.sub_zone_id || opData.subZoneId || null) as unknown as string,
      });

      if (error) {
        throw new Error(`[PowerSync Upload: tool_borrowing] ${error.message}`);
      }
      return;
    }
  }
}
