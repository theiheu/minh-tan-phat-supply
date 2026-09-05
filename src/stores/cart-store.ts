import { create } from "zustand";

export interface CartItem {
  variantId: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (variantId: string, quantity: number) => void;
  updateQty: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()((set) => ({
  items: [],
  addItem: (variantId, quantity) =>
    set((state) => {
      const existing = state.items.find((i) => i.variantId === variantId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: i.quantity + quantity } : i,
          ),
        };
      }
      return { items: [...state.items, { variantId, quantity }] };
    }),
  updateQty: (variantId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.variantId !== variantId)
          : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    })),
  removeItem: (variantId) =>
    set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
  clear: () => set({ items: [] }),
}));
