import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  /** Whether the sidebar is collapsed (icon-only mode) */
  sidebarCollapsed: boolean
  /** Whether tool content should use full width */
  fullWidthMode: boolean
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void
  /** Toggle full width mode */
  toggleFullWidth: () => void
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Set full width mode */
  setFullWidthMode: (fullWidth: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      fullWidthMode: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleFullWidth: () => set((state) => ({ fullWidthMode: !state.fullWidthMode })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setFullWidthMode: (fullWidth) => set({ fullWidthMode: fullWidth }),
    }),
    {
      name: 'layout-preferences',
    },
  ),
)
