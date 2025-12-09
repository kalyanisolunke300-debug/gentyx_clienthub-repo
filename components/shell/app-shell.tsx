// components/shell/app-shell.tsx
"use client";

import type React from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { RightDrawer } from "./right-drawer";
import { RoleBadge } from "@/components/widgets/role-badge";
import { useUIStore } from "@/store/ui-store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const hasHydrated = useUIStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">

      {/* ---------- FIXED SIDEBAR WITH ONBOARDING TITLE ---------- */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r bg-sidebar z-30 flex-col overflow-hidden">

        {/* ✅ ONBOARDING TITLE ABOVE SIDEBAR */}
        <div className="h-14 flex items-center px-4 border-b bg-sidebar">
          <h1 className="text-lg font-bold tracking-wide text-primary">
            Onboarding
          </h1>
        </div>

        {/* ✅ SIDEBAR BELOW TITLE */}
        <div className="flex-1">
          <Sidebar />
        </div>

      </aside>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="flex flex-col flex-1 ml-0 md:ml-64">

        {/* FIXED TOP NAV (SHIFTED RIGHT) */}
        <div className="fixed top-0 left-0 md:left-64 right-0 z-40">
          <TopNav />
        </div>

        {/* SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto mt-14 p-4 bg-muted/40">
          <div className="min-h-[calc(100vh-56px)]">
            {children}

            {/* FOOTER */}
            <footer className="mt-10 border-t pt-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  © {new Date().getFullYear()} Onboarding
                </span>
                <RoleBadge />
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* DRAWER */}
      <RightDrawer />
    </div>
  );
}
