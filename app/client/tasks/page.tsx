// app/client/tasks/page.tsx

"use client";

import useSWR from "swr";
import { fetchClientTasksByClientId } from "@/lib/api";
import { DataTable, type Column } from "@/components/data-table";
import { StatusPill } from "@/components/widgets/status-pill";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function ClientTasks() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const setCurrentClientId = useUIStore((s) => s.setCurrentClientId);
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string | null>(null);

  // Helper function to get cookie value
  function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }

  // ✅ Load clientId from Zustand OR cookies as fallback
  useEffect(() => {
    // First try Zustand
    if (currentClientId) {
      setClientId(currentClientId);
      return;
    }

    // Fallback: Read from cookie
    const cookieClientId = getCookie("clienthub_clientId");
    if (cookieClientId) {
      setClientId(cookieClientId);
      setCurrentClientId(cookieClientId);
    }
  }, [role, currentClientId, setCurrentClientId]);

  const { data, isLoading } = useSWR(
    clientId ? `/api/tasks/client/${clientId}` : null,
    () => fetchClientTasksByClientId(clientId!),
    { revalidateOnFocus: false }
  );

  const cols: Column<any>[] = [
    { key: "title", header: "Title" },
    { key: "stage", header: "Stage" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
  ];

  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">My Tasks</h1>

      <DataTable
        columns={cols}
        rows={data?.data || []}
        onRowAction={(r: any) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast({ title: "Success", description: "Task marked as complete." })
            }
          >
            Complete
          </Button>
        )}
      />
    </div>
  );
}
