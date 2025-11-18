"use client";

import { useContext } from "react";
import { ThemeContext } from "@/components/theme-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sun, Moon, Inbox, HelpCircle, LogOut } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";

export function TopNav() {
  const { theme, setTheme } = useContext(ThemeContext);
  const role = useUIStore((s) => s.role);
  const hasHydrated = useUIStore((s) => s._hasHydrated);
  const router = useRouter();

  // ⛔ hide until hydration to avoid "Role: null"
  if (!hasHydrated) return null;

  function handleLogout() {
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white dark:bg-slate-950">
      <div className="mx-auto flex h-14 items-center gap-3 px-4">
        <div className="font-semibold">Onboarding</div>

        <div className="hidden md:flex flex-1">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search (⌘K)" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/inbox")}>
            <Inbox className="size-5" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => router.push("/help")}>
            <HelpCircle className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="size-5" />
          </Button>

          <div className="ml-2 text-sm text-muted-foreground">Role: {role}</div>
        </div>
      </div>
    </header>
  );
}
