// "use client";

// import type React from "react";
// import { TopNav } from "./top-nav";
// import { Sidebar } from "./sidebar";
// import { RightDrawer } from "./right-drawer";
// import { RoleBadge } from "@/components/widgets/role-badge";
// import { useUIStore } from "@/store/ui-store";

// export default function AppShell({ children }: { children: React.ReactNode }) {
//   const hasHydrated = useUIStore((s) => s._hasHydrated);

//   if (!hasHydrated) {
//     return (
//       <div className="flex items-center justify-center h-screen w-screen">
//         <div className="text-sm text-muted-foreground">Loading…</div>
//       </div>
//     );
//   }

//   return (
//     <div className="h-screen w-screen flex overflow-hidden">

//       {/* ---------- FIXED SIDEBAR WITH CLIENTHUB LOGO ---------- */}
//       <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r bg-sidebar z-30 flex-col overflow-hidden">

//         {/* LOGO SECTION */}
//         <div className="h-24 flex flex-col items-center justify-center px-4 border-b bg-sidebar">
//           <img
//             src="/images/imagepng.png"
//             alt="ClientHub Logo"
//             className="w-36 h-auto object-contain"
//           />
//         </div>

//         {/* SIDEBAR MENU */}
//         <div className="flex-1">
//           <Sidebar />
//         </div>

//       </aside>

//       {/* ---------- MAIN CONTENT ---------- */}
//       <div className="flex flex-col flex-1 ml-0 md:ml-64">

//         {/* TOP NAV */}
//         <div className="fixed top-0 left-0 md:left-64 right-0 z-40">
//           <TopNav />
//         </div>

//         {/* SCROLLABLE AREA */}
//         <main className="flex-1 overflow-y-auto mt-14 p-4 bg-muted/40">
//           <div className="min-h-[calc(100vh-56px)]">
//             {children}

//             {/* FOOTER */}
//             <footer className="mt-10 border-t pt-4 text-sm text-muted-foreground">
//               <div className="flex items-center justify-between">
//                 <span>
//                   © {new Date().getFullYear()} HubOne Systems – ClientHub
//                 </span>
//                 <RoleBadge />
//               </div>
//             </footer>
//           </div>
//         </main>
//       </div>

//       {/* RIGHT DRAWER */}
//       <RightDrawer />
//     </div>
//   );
// }
"use client";

import type React from "react";
import { useEffect } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { RightDrawer } from "./right-drawer";
import { RoleBadge } from "@/components/widgets/role-badge";
import { useUIStore } from "@/store/ui-store";

/* -------------------------------------------------------
   Helper: read cookie on client
------------------------------------------------------- */
function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)")
  );

  return match ? decodeURIComponent(match[2]) : null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  // ✅ ALL HOOKS MUST BE INSIDE COMPONENT
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const setRole = useUIStore((s) => s.setRole);
  const setCurrentClientId = useUIStore((s) => s.setCurrentClientId);

  /* -------------------------------------------------------
     Hydrate Zustand from cookies (runs once on mount)
  ------------------------------------------------------- */
  useEffect(() => {
    if (!hasHydrated) return;

    const role = getCookie("clienthub_role");
    const clientId = getCookie("clienthub_clientId");

    if (role) {
      setRole(role as any);
    }

    if (clientId) {
      setCurrentClientId(clientId);
    }
  }, [hasHydrated, setRole, setCurrentClientId]);

  /* -------------------------------------------------------
     Prevent render until Zustand rehydrates
  ------------------------------------------------------- */
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* ---------- FIXED SIDEBAR WITH CLIENTHUB LOGO ---------- */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r bg-sidebar z-30 flex-col overflow-hidden">
        {/* LOGO SECTION */}
        <div className="h-24 flex flex-col items-center justify-center px-4 border-b bg-sidebar">
          <img
            src="/images/imagepng.png"
            alt="ClientHub Logo"
            className="w-36 h-auto object-contain"
          />
        </div>

        {/* SIDEBAR MENU */}
        <div className="flex-1">
          <Sidebar />
        </div>
      </aside>

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="flex flex-col flex-1 ml-0 md:ml-64">
        {/* TOP NAV */}
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
                  © {new Date().getFullYear()} HubOne Systems – ClientHub
                </span>
                <RoleBadge />
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* RIGHT DRAWER */}
      <RightDrawer />
    </div>
  );
}
