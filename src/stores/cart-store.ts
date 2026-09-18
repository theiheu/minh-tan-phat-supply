import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  skuId: string;
  transactionUnitId?: string;
  transactionUnitName?: string;
  factorToBase?: number;
  enteredQuantity: number;
  name: string;
  label: string;
  unit: string | null;
  baseUnitSymbol?: string | null;
  image?: string | null;
  stock?: number | null;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQty: (skuId: string, quantity: number) => void;
  updateUom: (
    skuId: string,
    transactionUnitId: string | undefined,
    transactionUnitName?: string,
    factorToBase?: number
  ) => void;
  removeItem: (skuId: string) => void;
  clear: () => void;
}

// Lưu giỏ soạn yêu cầu qua localStorage → không mất khi refresh trang.
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.skuId === item.skuId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.skuId === item.skuId
                  ? {
                      ...i,
                      enteredQuantity: i.enteredQuantity + item.enteredQuantity,
                      transactionUnitId: item.transactionUnitId ?? i.transactionUnitId,
                      transactionUnitName: item.transactionUnitName ?? i.transactionUnitName,
                      factorToBase: item.factorToBase ?? i.factorToBase,
                      unit: item.unit ?? i.unit,
                      baseUnitSymbol: item.baseUnitSymbol ?? i.baseUnitSymbol,
                    }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      updateQty: (skuId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.skuId !== skuId)
              : state.items.map((i) => (i.skuId === skuId ? { ...i, enteredQuantity: quantity } : i)),
        })),
      updateUom: (skuId, transactionUnitId, transactionUnitName, factorToBase) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.skuId === skuId
              ? {
                  ...i,
                  transactionUnitId,
                  transactionUnitName: transactionUnitName ?? i.transactionUnitName,
                  factorToBase: factorToBase ?? i.factorToBase ?? 1,
                }
              : i,
          ),
        })),
      removeItem: (skuId) =>
        set((state) => ({ items: state.items.filter((i) => i.skuId !== skuId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "mtp-requisition-cart" },
  ),
);
