import type { Role } from "@/lib/types";

export type EmailTemplateKind = "action" | "result" | "finance" | "driver";

export interface DocumentItemSummary {
  name: string;
  quantity: number | string;
  unit?: string | null;
  note?: string | null;
}

export interface BusinessSubject {
  type:
    | "requisition"
    | "receipt"
    | "issue"
    | "liquidation"
    | "stocktake"
    | "defect"
    | "repair"
    | "repair_order"
    | "tool_borrowing"
    | "fuel_receipt"
    | "fuel_dispense"
    | "exchange"
    | "transfer"
    | "assembly";
  id: string;
}

export interface EventParticipantMap {
  requesterId?: string | null;
  driverId?: string | null;
  borrowerId?: string | null;
  reporterId?: string | null;
  creatorId?: string | null;
}

export type ParticipantKey = keyof EventParticipantMap;

export interface RequisitionEventPayload {
  code: string;
  requesterName?: string;
  zoneName?: string;
  purpose?: string;
  itemSummary?: string;
  items?: DocumentItemSummary[];
  handlerName?: string;
  reason?: string;
}

export interface ReceiptEventPayload {
  code: string;
  supplierName?: string;
  totalAmount?: number;
  invoiceNumber?: string;
  itemCount?: number;
  items?: DocumentItemSummary[];
  receiverName?: string;
  notes?: string;
}

export interface IssueEventPayload {
  code: string;
  destinationType?: "zone" | "customer";
  zoneName?: string;
  customerName?: string;
  totalAmount?: number;
  itemCount?: number;
  items?: DocumentItemSummary[];
  issuerName?: string;
  notes?: string;
}

export interface LiquidationEventPayload {
  code: string;
  itemCount?: number;
  items?: DocumentItemSummary[];
  reason?: string;
  totalProceeds?: number;
  handlerName?: string;
}

export interface StocktakeEventPayload {
  code: string;
  sessionName: string;
  locationName?: string;
  varianceCount?: number;
  varianceValue?: number;
  discrepancyCount?: number;
  discrepancySummary?: string;
  items?: DocumentItemSummary[];
  handlerName?: string;
}

export interface DefectEventPayload {
  code: string;
  equipmentName?: string;
  reporterName?: string;
  locationName?: string;
  reason?: string;
  items?: DocumentItemSummary[];
  resolutionType?: "repair" | "exchange" | "liquidation";
}

export interface RepairEventPayload {
  code: string;
  equipmentName?: string;
  vendorName?: string;
  vendor?: string;
  technicianName?: string;
  expectedReturnAt?: string;
  itemCount?: number;
  items?: DocumentItemSummary[];
  totalCost?: number;
  cost?: number;
  handlerName?: string;
  notes?: string;
}

export interface ToolEventPayload {
  code: string;
  toolNames?: string;
  borrowerName?: string;
  expectedReturnDate?: string;
  overdueDays?: number;
  handlerName?: string;
  purpose?: string;
  itemCount?: number;
  items?: DocumentItemSummary[];
}

export interface FuelEventPayload {
  code: string;
  fuelTypeName: string;
  quantity: number;
  unit: string;
  vehicleCode?: string;
  vehicleName?: string;
  currentOdo?: number;
  odoUnit?: string;
  zoneName?: string;
  supplierName?: string;
  totalAmount?: number;
  driverName?: string;
  dispenserName?: string;
  notes?: string;
}

export interface ExchangeEventPayload {
  code: string;
  handlerName?: string;
  reason?: string;
  items?: DocumentItemSummary[];
}

export interface TransferEventPayload {
  code?: string;
  fromLocationName?: string;
  toLocationName?: string;
  itemCount?: number;
  items?: DocumentItemSummary[];
  handlerName?: string;
  delta?: number;
  reason?: string;
  skuName?: string;
}

export interface AssemblyEventPayload {
  code?: string;
  kitSkuName?: string;
  quantity?: number;
  unit?: string;
  componentLocationName?: string;
  finishedLocationName?: string;
  handlerName?: string;
  items?: DocumentItemSummary[];
}

export interface BusinessEventPayloadMap {
  "requisition.submitted": RequisitionEventPayload;
  "requisition.approved": RequisitionEventPayload;
  "requisition.rejected": RequisitionEventPayload;
  "requisition.fulfilled": RequisitionEventPayload;
  "requisition.cancelled": RequisitionEventPayload;
  "requisition.received": RequisitionEventPayload;
  "requisition.returned": RequisitionEventPayload;

  "receipt.created": ReceiptEventPayload;
  "receipt.approved": ReceiptEventPayload;
  "receipt.posted": ReceiptEventPayload;
  "receipt.cancelled_or_reversed": ReceiptEventPayload;

  "issue.created": IssueEventPayload;
  "issue.sale_posted": IssueEventPayload;
  "issue.internal_action_required": IssueEventPayload;
  "issue.cancelled": IssueEventPayload;

  "liquidation.created": LiquidationEventPayload;
  "liquidation.approved": LiquidationEventPayload;
  "liquidation.completed": LiquidationEventPayload;
  "liquidation.rejected": LiquidationEventPayload;

  "stocktake.created": StocktakeEventPayload;
  "stocktake.posted_with_variance": StocktakeEventPayload;
  "stocktake.posted_without_variance": StocktakeEventPayload;
  "stocktake.completed_discrepancy": StocktakeEventPayload;
  "stocktake.cancelled": StocktakeEventPayload;

  "transfer.completed": TransferEventPayload;
  "stock.adjusted": TransferEventPayload;

  "assembly.completed": AssemblyEventPayload;
  "disassembly.completed": AssemblyEventPayload;

  "defect.created": DefectEventPayload;
  "defect.resolution_selected": DefectEventPayload;
  "defect.sent_to_liquidation": DefectEventPayload;

  "repair.sent": RepairEventPayload;
  "repair.ready_for_acceptance": RepairEventPayload;
  "repair.accepted_and_returned": RepairEventPayload;
  "repair.completed": RepairEventPayload;

  "tool.borrowed": ToolEventPayload;
  "tool.due_soon": ToolEventPayload;
  "tool.overdue_started": ToolEventPayload;
  "tool.returned": ToolEventPayload;
  "tool.cancelled": ToolEventPayload;

  "fuel.receipt_completed": FuelEventPayload;
  "fuel.receipt_cancelled": FuelEventPayload;
  "fuel.dispensed": FuelEventPayload;
  "fuel.dispense_cancelled_or_adjusted": FuelEventPayload;

  "exchange.created": ExchangeEventPayload;
  "exchange.approved": ExchangeEventPayload;
  "exchange.rejected": ExchangeEventPayload;
  "exchange.issued": ExchangeEventPayload;
  "exchange.received": ExchangeEventPayload;
}

export type BusinessEventKey = keyof BusinessEventPayloadMap;

export interface EventPolicy<K extends BusinessEventKey = BusinessEventKey> {
  key: K;
  templateKind: EmailTemplateKind;
  targetRoles: Role[];
  targetParticipants: ParticipantKey[];
  excludeActor: boolean;
  allowsFinancialData: boolean;
  getSubjectTitle: (payload: BusinessEventPayloadMap[K]) => string;
  getLink: (subject: BusinessSubject) => string;
}

export interface BusinessEventInput<K extends BusinessEventKey = BusinessEventKey> {
  event: K;
  actorId?: string | null;
  subject: BusinessSubject;
  participants?: EventParticipantMap;
  payload: BusinessEventPayloadMap[K];
}
