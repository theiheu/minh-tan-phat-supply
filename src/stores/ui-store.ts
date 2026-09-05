import { create } from "zustand";

interface UIState {
  isCartOpen: boolean;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  setCartOpen: (open: boolean) => void;
  toggleCart: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isCartOpen: false,
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  setCartOpen: (open) => set({ isCartOpen: open }),
  toggleCart: () => set((s) => ({ isCartOpen: !s.isCartOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
}));
