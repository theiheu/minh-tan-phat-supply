export type ToolStatus = "borrowed" | "returned" | "cancelled";

export interface ToolBorrowingItemWithVariant {
  id: string;
  borrowing_id: string;
  variant_id: string;
  quantity: number;
  returned_quantity: number;
  notes?: string | null;
  variant?: {
    id: string;
    sku?: string | null;
    name?: string | null;
    unit?: string | null;
    product?: {
      id: string;
      name: string;
      code?: string | null;
      image_url?: string | null;
      category?: {
        name: string;
      } | null;
    } | null;
  } | null;
}

export interface ToolBorrowingRow {
  id: string;
  code: string;
  borrower_id: string;
  zone_id?: string | null;
  purpose: string;
  borrowed_at: string;
  expected_return_date?: string | null;
  returned_at?: string | null;
  issued_by?: string | null;
  received_back_by?: string | null;
  notes?: string | null;
  status: ToolStatus;
  created_at: string;
  updated_at: string;
  borrower?: {
    id: string;
    full_name: string | null;
    username?: string | null;
  } | null;
  zone?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
  issued_by_profile?: {
    id: string;
    full_name: string | null;
    username?: string | null;
  } | null;
  received_back_by_profile?: {
    id: string;
    full_name: string | null;
    username?: string | null;
  } | null;
  items?: ToolBorrowingItemWithVariant[];
}
