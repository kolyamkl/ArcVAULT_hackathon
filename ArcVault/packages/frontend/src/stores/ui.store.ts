import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Quick Pay modal
  quickPayOpen: boolean;
  openQuickPay: () => void;
  closeQuickPay: () => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Global UI state store.
 *
 * Manages sidebar toggle, Quick Pay modal visibility, and theme preference.
 * Used by the app shell (sidebar, header) and the Quick Pay FAB/modal.
 */
export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Quick Pay
  quickPayOpen: false,
  openQuickPay: () => set({ quickPayOpen: true }),
  closeQuickPay: () => set({ quickPayOpen: false }),

  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
