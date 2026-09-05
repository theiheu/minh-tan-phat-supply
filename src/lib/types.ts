import type { Database } from "@/types/database.types";

export type Role = "requester" | "manager";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Variant = Database["public"]["Tables"]["variants"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Zone = Database["public"]["Tables"]["zones"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type StockLocation = Database["public"]["Tables"]["stock_locations"]["Row"];
export type StockBalance = Database["public"]["Tables"]["stock_balances"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];
export type Requisition = Database["public"]["Tables"]["requisitions"]["Row"];
export type RequisitionItem = Database["public"]["Tables"]["requisition_items"]["Row"];
export type Receipt = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptItem = Database["public"]["Tables"]["receipt_items"]["Row"];
export type DefectNote = Database["public"]["Tables"]["defect_notes"]["Row"];
export type DefectNoteItem = Database["public"]["Tables"]["defect_note_items"]["Row"];
export type RepairOrder = Database["public"]["Tables"]["repair_orders"]["Row"];
export type RepairOrderItem = Database["public"]["Tables"]["repair_order_items"]["Row"];
export type LiquidationNote = Database["public"]["Tables"]["liquidation_notes"]["Row"];
export type LiquidationItem = Database["public"]["Tables"]["liquidation_items"]["Row"];
export type StocktakeSession = Database["public"]["Tables"]["stocktake_sessions"]["Row"];
export type StocktakeItem = Database["public"]["Tables"]["stocktake_items"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
