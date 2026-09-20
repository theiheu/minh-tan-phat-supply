"use client";

import { useQuery, useStatus } from "@powersync/react";
import { usePowerSyncState } from "./provider";

export interface PowerSyncCatalogItem {
  id: string;
  code: string | null;
  name: string;
  sku_code: string | null;
  product_name: string;
  category_id: string | null;
  category_name: string | null;
  base_unit_name: string | null;
  base_unit_symbol: string | null;
  price: number | null;
  min_stock: number;
  sku_status: string;
}

/**
 * Tra cứu danh mục SKU và Vật tư trực tiếp từ SQLite local (độ trễ 0ms)
 */
export function usePowerSyncCatalog(options?: {
  q?: string;
  categoryId?: string;
  activeOnly?: boolean;
}) {
  const { isReady } = usePowerSyncState();
  const activeOnly = options?.activeOnly ?? true;
  const q = options?.q?.trim()?.toLowerCase() ?? "";
  const categoryId = options?.categoryId ?? "";

  let sql = `
    SELECT 
      s.id,
      s.sku_code,
      s.sku_code as code,
      s.price,
      s.min_stock,
      s.sku_status,
      p.id as product_id,
      p.name as product_name,
      p.name as name,
      p.category_id,
      c.name as category_name,
      u.name as base_unit_name,
      u.symbol as base_unit_symbol
    FROM skus s
    LEFT JOIN products p ON s.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN units u ON s.base_unit_id = u.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (activeOnly) {
    sql += ` AND (s.sku_status = 'active' OR s.sku_status IS NULL)`;
  }

  if (categoryId) {
    sql += ` AND p.category_id = ?`;
    params.push(categoryId);
  }

  if (q) {
    sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(s.sku_code) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?)`;
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  sql += ` ORDER BY p.name ASC LIMIT 100`;

  // useQuery tự động re-render khi SQLite local có thay đổi
  const { data, isLoading, error } = useQuery<PowerSyncCatalogItem>(sql, params);

  return {
    items: data ?? [],
    isLoading: !isReady || isLoading,
    error,
  };
}

export interface PowerSyncVehicleItem {
  id: string;
  code: string;
  name: string;
  type: string;
  zone_id: string | null;
  default_driver: string | null;
  fuel_type_id: string | null;
  fuel_type_name: string | null;
  current_odo: number;
  odo_unit: string;
  fuel_norm: number | null;
  qr_token: string;
  is_active: number;
}

/**
 * Tra cứu danh sách xe cơ giới & máy móc nông trại từ SQLite local
 */
export function usePowerSyncVehicles(options?: { q?: string; activeOnly?: boolean }) {
  const { isReady } = usePowerSyncState();
  const activeOnly = options?.activeOnly ?? true;
  const q = options?.q?.trim()?.toLowerCase() ?? "";

  let sql = `
    SELECT 
      v.id,
      v.code,
      v.name,
      v.type,
      v.zone_id,
      v.default_driver,
      v.fuel_type_id,
      ft.name as fuel_type_name,
      v.current_odo,
      v.odo_unit,
      v.fuel_norm,
      v.qr_token,
      v.is_active
    FROM vehicles v
    LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (activeOnly) {
    sql += ` AND v.is_active = 1`;
  }

  if (q) {
    sql += ` AND (LOWER(v.name) LIKE ? OR LOWER(v.code) LIKE ? OR LOWER(COALESCE(v.default_driver, '')) LIKE ?)`;
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  sql += ` ORDER BY v.name ASC`;

  const { data, isLoading, error } = useQuery<PowerSyncVehicleItem>(sql, params);

  return {
    vehicles: data ?? [],
    isLoading: !isReady || isLoading,
    error,
  };
}

export interface PowerSyncZoneItem {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Tra cứu danh sách dãy chuồng & khu vực trại từ SQLite local
 */
export function usePowerSyncZones() {
  const { isReady } = usePowerSyncState();
  const sql = `SELECT id, name, description FROM zones WHERE deleted_at IS NULL ORDER BY name ASC`;
  const { data, isLoading, error } = useQuery<PowerSyncZoneItem>(sql);

  return {
    zones: data ?? [],
    isLoading: !isReady || isLoading,
    error,
  };
}

export interface PowerSyncRequisitionItem {
  id: string;
  code: string;
  requester_id: string;
  zone_id: string | null;
  purpose: string;
  status: string;
  requisition_type: string;
  created_at: string;
}

/**
 * Tra cứu danh sách phiếu yêu cầu từ SQLite local
 */
export function usePowerSyncRequisitions(options?: { status?: string; requesterId?: string }) {
  const { isReady } = usePowerSyncState();
  let sql = `SELECT id, code, requester_id, zone_id, purpose, status, requisition_type, created_at FROM requisitions WHERE 1=1`;
  const params: any[] = [];

  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }

  if (options?.requesterId) {
    sql += ` AND requester_id = ?`;
    params.push(options.requesterId);
  }

  sql += ` ORDER BY created_at DESC LIMIT 50`;

  const { data, isLoading, error } = useQuery<PowerSyncRequisitionItem>(sql, params);

  return {
    requisitions: data ?? [],
    isLoading: !isReady || isLoading,
    error,
  };
}

/**
 * Theo dõi trạng thái kết nối & tiến trình đồng bộ của PowerSync
 */
export function usePowerSyncSyncStatus() {
  const status = useStatus();
  const { isReady, error } = usePowerSyncState();

  return {
    isReady,
    isConnected: status?.connected ?? false,
    isConnecting: status?.connecting ?? false,
    hasSynced: status?.hasSynced ?? false,
    lastSyncedAt: status?.lastSyncedAt ?? null,
    downloading: status?.downloading ?? false,
    uploading: status?.uploading ?? false,
    error: error || status?.dataFlowStatus?.uploadError || status?.dataFlowStatus?.downloadError || null,
  };
}
