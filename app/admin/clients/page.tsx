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
import { useState } from "react";

import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import type { ClientProfile } from "@/types";

export default function AdminClientsList() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();
  const [clientPageSize, setClientPageSize] = useState(5);

  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  // ---------- FETCH CLIENTS ----------
  const { data } = useSWR(
    ["clients", page, clientPageSize, q],
    () => fetchClients({ page, pageSize: clientPageSize, q }),
    { keepPreviousData: true }
  );


  const clientRows: ClientProfile[] = data?.data || [];
  // ---- Client Pagination Calculations ----
  const clientTotalItems = data?.total || clientRows.length;

  const clientTotalPages = Math.ceil(clientTotalItems / clientPageSize);

  const clientStart = (page - 1) * clientPageSize + 1;
  const clientEnd = Math.min(page * clientPageSize, clientTotalItems);

  // ---------- TABLE COLUMNS ----------
  const cols: Column<ClientProfile>[] = [
    { key: "client_name", header: "Client" },

    // 🔥 SHOW SERVICE CENTER NAME INSTEAD OF ID
    { key: "service_center_name", header: "Service Center" },

    // 🔥 SHOW CPA NAME INSTEAD OF ID
    { key: "cpa_name", header: "CPA" },

    { key: "stage_name", header: "Current Stage" },

    {
      key: "progress",
      header: "Progress",
      render: (row) => (
        <div className="flex items-center gap-2">
        <ProgressRing
          value={row.progress ?? 0}
          completedStages={row.completed_stages}
          totalStages={row.total_stages}
        />

        </div>
      ),
    },

    {
      key: "status",
      header: "Current Status",
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

            {/* <Button
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
            </Button> */}
          </div>
        )}
      />

      {/* ---------- PAGINATION ---------- */}
      <div className="flex items-center justify-between px-2 py-3 text-sm">

        {/* LEFT SIDE — ITEMS PER PAGE */}
        <div className="flex items-center gap-2">
          <span>Items per page</span>

          <select
            className="border rounded px-2 py-1"
            value={clientPageSize}
            onChange={(e) => setClientPageSize(Number(e.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span>
            {clientStart}–{clientEnd} of {clientTotalItems} items
          </span>
        </div>

        {/* RIGHT SIDE — PREV / NEXT (existing pagination) */}
        <TablePagination
          page={page}
          pageSize={clientPageSize}
          total={clientTotalItems}
          setPage={setPage}
        />
      </div>

    </div>
  );
}
