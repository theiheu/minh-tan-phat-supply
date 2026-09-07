import { create } from "zustand";

interface UIState {
  isCartOpen: boolean;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  slipModal: { type: string; id: string } | null;
  setCartOpen: (open: boolean) => void;
  toggleCart: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  openSlipModal: (type: string, id: string) => void;
  closeSlipModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isCartOpen: false,
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  slipModal: null,
  setCartOpen: (open) => set({ isCartOpen: open }),
  toggleCart: () => set((s) => ({ isCartOpen: !s.isCartOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  openSlipModal: (type, id) => set({ slipModal: { type, id } }),
  closeSlipModal: () => set({ slipModal: null }),
}));
