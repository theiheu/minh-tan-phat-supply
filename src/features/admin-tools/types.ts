export type AdminDocKind =
  | "receipt"
  | "issue"
  | "requisition"
  | "defect"
  | "exchange"
  | "repair"
  | "liquidation"
  | "stocktake"
  | "fuel_receipt"
  | "fuel_dispense"
  | "requisition_return";

export interface DocumentDependency {
  kind: AdminDocKind;
  id: string;
  code: string;
  status: string;
  created_at?: string;
}

export interface DocumentInspectResult {
  document: {
    id: string;
    code: string;
    status: string;
    created_at: string;
    [key: string]: unknown;
  };
  dependencies: DocumentDependency[];
  movements_count: number;
  can_direct_delete: boolean;
}

export interface AdminDeleteInput {
  kind: AdminDocKind;
  id: string;
  cascade?: boolean;
  reason: string;
}

export interface AdminReopenInput {
  kind: AdminDocKind;
  id: string;
  reason: string;
}

export interface AdminOverrideMetaInput {
  kind: AdminDocKind;
  id: string;
  createdAt?: string | null;
  actorId?: string | null;
  notes?: string | null;
  reason: string;
}

export interface AdminDocumentListItem {
  id: string;
  kind: AdminDocKind;
  kindLabel: string;
  code: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  creatorName?: string | null;
  zoneOrPartner?: string | null;
  summary?: string | null;
  totalAmount?: number | null;
  canReopen: boolean;
}

export interface AdminDocumentFilters {
  kind?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
