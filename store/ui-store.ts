
// store/ui-store.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/types";

type DrawerView = "assignTask" | "setStage" | "uploadDoc" | null;

type UIState = {
  // ROLE
  role: UserRole | null;
  setRole: (r: UserRole | null) => void;

  // HYDRATION STATE (fixes flicker)
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  // CLIENT CONTEXT
  currentClientId?: string;
  setCurrentClientId: (id?: string) => void;

  // DRAWER
  rightDrawerOpen: boolean;
  drawerView: DrawerView;
  drawerContext?: Record<string, any>;
  openDrawer: (view: NonNullable<DrawerView>, ctx?: Record<string, any>) => void;
  closeDrawer: () => void;

  // DEV TOOLS
  dev: {
    impersonateClientId?: string;
    showDevToolbar: boolean;
    toggleDevToolbar: () => void;

    simulateError: boolean;
    toggleSimulateError: () => void;

    simulateEmpty: boolean;
    toggleSimulateEmpty: () => void;
  };
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // ROLE
      role: null,
      setRole: (r) => set({ role: r }),

      // HYDRATION CONTROL
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      // CLIENT CONTEXT
      currentClientId: undefined,
      setCurrentClientId: (id) => set({ currentClientId: id }),

      // DRAWER
      rightDrawerOpen: false,
      drawerView: null,
      drawerContext: undefined,
      openDrawer: (view, ctx) =>
        set({ rightDrawerOpen: true, drawerView: view, drawerContext: ctx }),
      closeDrawer: () =>
        set({ rightDrawerOpen: false, drawerView: null, drawerContext: undefined }),

      // DEV TOOLS
      dev: {
        impersonateClientId: undefined,

        showDevToolbar: false,
        toggleDevToolbar: () =>
          set((s) => ({
            dev: { ...s.dev, showDevToolbar: !s.dev.showDevToolbar },
          })),

        simulateError: false,
        toggleSimulateError: () =>
          set((s) => ({
            dev: { ...s.dev, simulateError: !s.dev.simulateError },
          })),

        simulateEmpty: false,
        toggleSimulateEmpty: () =>
          set((s) => ({
            dev: { ...s.dev, simulateEmpty: !s.dev.simulateEmpty },
          })),
      },
    }),
    {
      name: "clienthub-ui",

      // Only store role (avoid saving dev tools/settings)
      partialize: (state) => ({
        role: state.role,
        currentClientId: state.currentClientId,
      }),

      // Hydration callback → fixes flicker
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
    }
  )
);