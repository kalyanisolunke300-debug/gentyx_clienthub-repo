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
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import type { ClientProfile } from "@/types";

export default function AdminClientsList() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();
  const [clientPageSize, setClientPageSize] = useState(5);
  const searchParams = useSearchParams();

  // Read status filter from URL, default to "ALL"
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Initialize filter from URL on mount
  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus) {
      // Map URL param to filter value
      if (urlStatus === "active" || urlStatus === "In Progress") {
        setStatusFilter("In Progress");
      } else if (urlStatus === "completed" || urlStatus === "Completed") {
        setStatusFilter("Completed");
      } else if (urlStatus === "not-started" || urlStatus === "Not Started") {
        setStatusFilter("Not Started");
      }
    }
  }, [searchParams]);

  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  // ---------- FETCH CLIENTS ----------
  const { data } = useSWR(
    ["clients", page, clientPageSize, q],
    () => fetchClients({ page, pageSize: clientPageSize, q }),
    { keepPreviousData: true }
  );

  const allClientRows: ClientProfile[] = data?.data || [];

  // Apply status filter
  const clientRows = statusFilter === "ALL"
    ? allClientRows
    : allClientRows.filter((c) => {
      const clientStatus = (c.status || "").toLowerCase();
      const filterValue = statusFilter.toLowerCase();
      return clientStatus === filterValue;
    });

  // ---- Client Pagination Calculations ----
  const clientTotalItems = clientRows.length;

  const clientTotalPages = Math.ceil(clientTotalItems / clientPageSize);

  const clientStart = clientTotalItems > 0 ? (page - 1) * clientPageSize + 1 : 0;
  const clientEnd = Math.min(page * clientPageSize, clientTotalItems);

  // Paginate filtered rows
  const paginatedRows = clientRows.slice(
    (page - 1) * clientPageSize,
    page * clientPageSize
  );

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

      {/* ---------- SEARCH & FILTERS ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <TableToolbar q={q} setQ={setQ} />

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter !== "ALL" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusFilter("ALL");
              setPage(1);
            }}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {/* ---------- CLIENTS TABLE ---------- */}
      <DataTable
        columns={cols}
        rows={paginatedRows}
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
