// app/admin/clients/page.tsx
"use client";

import useSWR from "swr";
import { fetchClients } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  TablePagination,
  useServerTableState,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import type { ClientProfile } from "@/types";

export default function AdminClientsList() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();
  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  // ---------- FETCH CLIENTS ----------
  const { data } = useSWR(
    ["clients", page, pageSize, q],
    () => fetchClients({ page, pageSize, q }),
    { keepPreviousData: true }
  );

  const clientRows: ClientProfile[] = data?.data || [];

  // ---------- TABLE COLUMNS ----------
  const cols: Column<ClientProfile>[] = [
    { key: "client_name", header: "Client" },

    // 🔥 SHOW SERVICE CENTER NAME INSTEAD OF ID
    { key: "service_center_name", header: "Service Center" },

    // 🔥 SHOW CPA NAME INSTEAD OF ID
    { key: "cpa_name", header: "CPA" },

    { key: "stage_name", header: "Stage" },

    {
      key: "progress",
      header: "Progress",
      render: (row) => (
        <div className="flex items-center gap-2">
          <ProgressRing value={row.progress ?? 0} />
          <span className="text-xs">{row.progress ?? 0}%</span>
        </div>
      ),
    },

    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status || "Not Started"} />,
    },
  ];

  return (
    <div className="grid gap-4">
      {/* ---------- PAGE HEADER ---------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>

        <div className="flex items-center gap-2">
          {/* <Button
            variant="secondary"
            onClick={() => openDrawer("assignTask", {})}
          >
            Bulk Assign
          </Button> */}

          <Button onClick={() => router.push("/admin/clients/new")}>
            New Client
          </Button>
        </div>
      </div>

      {/* ---------- SEARCH BAR ---------- */}
      <TableToolbar q={q} setQ={setQ} />

      {/* ---------- CLIENTS TABLE ---------- */}
      <DataTable
        columns={cols}
        rows={clientRows}
        onRowAction={(row: ClientProfile) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/admin/clients/${row.client_id}`)}
            >
              Open
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openDrawer("assignTask", {
                  clientId: row.client_id,
                  clientName: row.client_name,
                  prefilledClient: true,
                })
              }
            >
              Assign
            </Button>
          </div>
        )}
      />

      {/* ---------- PAGINATION ---------- */}
      <TablePagination
        page={data?.page || 1}
        pageSize={data?.pageSize || 10}
        total={data?.total || 0}
        setPage={setPage}
      />
    </div>
  );
}
