// app/admin/tasks/page.tsx
"use client";

import useSWR from "swr";
import { fetchAllTasks, fetchClients } from "@/lib/api";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskRow = {
  id: number;
  clientId: number;
  title: string;
  assigneeRole: string;
  status: string;
};

export default function AdminTasksPage() {
  const { page, setPage, pageSize, setPageSize, q, setQ } = useServerTableState();

  // Load ALL tasks so frontend pagination works
  const { data: tasksData } = useSWR(["tasks"], () =>
    fetchAllTasks({ page: 1, pageSize: 500 })
  );

  // Load clients for name mapping
  const { data: clientsData } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 500 })
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
    { key: "title", header: "Title" },
    {
      key: "assigneeRole",
      header: "Assigned User",
      render: (row) => row.assigneeRole || "Unknown",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status} />,
    },
  ];

  // FRONTEND PAGINATION
  const allTasks: TaskRow[] = tasksData?.data || [];
  const total = allTasks.length;

  const rows = allTasks.slice((page - 1) * pageSize, page * pageSize);

  // MATERIAL STYLE COUNTER
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Button onClick={() => openDrawer("assignTask", {})}>
          Create Task
        </Button>
      </div>

      {/* SEARCH */}
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

      {/* MATERIAL STYLE PAGINATION BAR */}
      <div className="flex items-center justify-between text-sm text-muted-foreground py-3 px-1 border-t">

        {/* ITEMS PER PAGE DROPDOWN */}
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setPage(1); // reset to page 1
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* COUNT DISPLAY */}
        <div>
          {start}–{end} of {total} items
        </div>
      </div>

      {/* BOTTOM PAGINATION BUTTONS */}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        setPage={setPage}
      />
    </div>
  );
}
