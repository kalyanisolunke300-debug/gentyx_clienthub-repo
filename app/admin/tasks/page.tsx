// app/admin/tasks/page.tsx
"use client";

import useSWR from "swr";
import { fetchTasks, fetchClients } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  useServerTableState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { StatusPill } from "@/components/widgets/status-pill";

type TaskRow = {
  id: number;
  clientId: number;
  title: string;
  assigneeRole: string;
  status: string;
};

export default function AdminTasksPage() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();

  // Tasks – server-side pagination only (no q wired yet)
  const { data: tasksData } = useSWR(["tasks", page, pageSize], () =>
    fetchTasks({ page, pageSize })
  );

  // Clients – for client_name mapping
  const { data: clientsData } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );

  const openDrawer = useUIStore((s) => s.openDrawer);

  const getClientName = (clientId: number) => {
    const list = clientsData?.data || [];
    const found = list.find((c: any) => c.client_id === clientId);
    return found?.client_name ?? `Client #${clientId}`;
  };

  const cols: Column<TaskRow>[] = [
    {
      key: "clientId",
      header: "Client Name",
      render: (row) => getClientName(row.clientId),
    },
    {
      key: "title",
      header: "Title",
    },
    {
      key: "assigneeRole",
      header: "Assigned User",
      render: (row) => {
        switch (row.assigneeRole) {
          case "CLIENT":
            return getClientName(row.clientId);
          case "SERVICE_CENTER":
            return "Service Center";
          case "CPA":
            return "CPA";
          default:
            return row.assigneeRole;
        }
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  const rows = (tasksData?.data || []) as TaskRow[];

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Button onClick={() => openDrawer("assignTask", {})}>
          Create Task
        </Button>
      </div>

      {/* SEARCH (currently only client-side, not passed to API) */}
      <TableToolbar q={q} setQ={setQ} />

      {/* TABLE */}
      <DataTable
        columns={cols}
        rows={rows}
        onRowAction={(row: TaskRow) => (
          <Button size="sm" variant="outline">
            Preview Email
          </Button>
        )}
      />

      {/* PAGINATION */}
      <TablePagination
        page={tasksData?.page || 1}
        pageSize={tasksData?.pageSize || 10}
        total={tasksData?.total || 0}
        setPage={setPage}
      />
    </div>
  );
}
