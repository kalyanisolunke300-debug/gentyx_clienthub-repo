// shell/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Users,
  FileText,
  ListChecks,
  Library,
  Building2,
  Landmark,
  BarChart2,
  Mail,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const role = useUIStore((s) => s.role);
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const pathname = usePathname();
  const router = useRouter();

  // ⛔ Prevent sidebar flicker
  if (!hasHydrated || !role) return null;

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutGrid },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
    { href: "/admin/stages", label: "Onboarding Stages", icon: Library },
    { href: "/admin/service-centers", label: "Service Centers", icon: Building2 },
    { href: "/admin/cpas", label: "CPAs", icon: Landmark },
    { href: "/admin/reports", label: "Reports", icon: BarChart2 },
    { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
    // { href: "/admin/documents", label: "Documents", icon: FileText },
  ];

  const clientLinks = [
    { href: "/client", label: "Home", icon: LayoutGrid },
    { href: "/client/tasks", label: "My Tasks", icon: ListChecks },
    { href: "/client/stages", label: "Onboarding Stages", icon: Library },
    { href: "/client/documents", label: "Documents", icon: FileText },
    { href: "/client/messages", label: "Messages", icon: Mail },
    { href: "/client/reports", label: "Reports", icon: BarChart2 },
    { href: "/client/profile", label: "Profile", icon: Users },
    { href: "/client/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "FAQ", icon: HelpCircle },
  ];

  const scLinks = [
    { href: "/service-center", label: "Dashboard", icon: LayoutGrid },
    { href: "/service-center/clients-list", label: "Clients", icon: Users },
    { href: "/service-center/tasks", label: "Tasks", icon: ListChecks },
    { href: "/inbox", label: "Work Queue", icon: ListChecks },
  ];

  const cpaLinks = [
    { href: "/cpa", label: "Dashboard", icon: LayoutGrid },
    { href: "/cpa/clients-list", label: "Clients", icon: Users },
    { href: "/inbox", label: "Work Queue", icon: ListChecks },
  ];

  // Admin and other roles use common links, clients have settings built-in
  const commonLinks = role === "CLIENT" ? [] : [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "FAQ", icon: HelpCircle },
  ];

  const roleLinks =
    role === "ADMIN" ? adminLinks :
      role === "CLIENT" ? clientLinks :
        role === "SERVICE_CENTER" ? scLinks :
          cpaLinks;

  function handleLogout() {
    router.push("/login");
  }

  return (
    <div className="flex flex-col h-full w-full p-2">
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
        {[...roleLinks, ...commonLinks].map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (pathname.startsWith(href + "/") && pathname !== "/admin" && href !== "/admin");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-2 mt-auto shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
