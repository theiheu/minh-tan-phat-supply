export type StockLocationOption = {
  id: string;
  name: string;
  code?: string;
};

export interface BomItemRequirement {
  id: string;
  componentSkuId: string;
  componentSkuCode: string;
  componentProductName: string;
  componentSummary: string;
  baseQuantity: number;
  wastagePercent: number;
  baseUnitSymbol: string;
  requiredQuantity: number;
  availableOnHand: number;
  isAvailable: boolean;
}

export interface BomVersionOption {
  id: string;
  bomHeaderId: string;
  versionNumber: number;
  status: string;
  changeReason: string | null;
  createdAt: string;
}

export interface SkuBomDetails {
  skuId: string;
  skuCode: string;
  productName: string;
  summary: string;
  baseUnitSymbol: string;
  inventoryPolicy: "stocked_assembly" | "virtual_kit" | string;
  activeVersionId: string | null;
  selectedVersionId: string | null;
  versions: BomVersionOption[];
  items: BomItemRequirement[];
  onHandQuantity: number;
}

export interface DisassemblyItemRowState {
  componentSkuId: string;
  componentSkuCode: string;
  componentProductName: string;
  componentSummary: string;
  baseUnitSymbol: string;
  baseQuantityPerUnit: number;
  expectedQuantity: number;
  recoveredQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  recoveryLocationId: string;
  damagedLocationId: string;
  isValid: boolean;
  totalAllocated: number;
}

export interface AssemblyExecutionResult {
  success: boolean;
  movementId?: string;
  error?: string;
}

export interface DisassemblyExecutionResult {
  success: boolean;
  movementId?: string;
  error?: string;
}
