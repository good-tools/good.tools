import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  /** Desktop sidebar hidden (persisted) */
  sidebarCollapsed: boolean
  /** Mobile drawer open (not persisted) */
  mobileNavOpen: boolean
  /** Command palette open (not persisted) */
  paletteOpen: boolean
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
  setPaletteOpen: (open: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      paletteOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
    }),
    { name: 'layout-preferences', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
)
