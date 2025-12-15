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
import { useToast } from "@/hooks/use-toast";
import { mutate } from "swr";
import { useRouter } from "next/navigation";
import { ClientTaskModal } from "@/components/widgets/client-task-modal";
import { useState } from "react";


const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Completed": "bg-green-100 text-green-700",
};


type TaskRow = {
  id: number;
  clientId: number;
  title: string;
  assigneeRole: string;
  status: string;
  dueDate: string;
};

export default function AdminTasksPage() {
  const router = useRouter();
  const [openClientTasks, setOpenClientTasks] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState<any[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);


  const { toast } = useToast();
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
  const allTasks: TaskRow[] = tasksData?.data || [];

  const cols: Column<TaskRow>[] = [
  {
    key: "clientId",
    header: "Client Name",
    render: (row) => getClientName(row.clientId),
  },
  { key: "title", header: "Task" },
  {
    key: "assigneeRole",
    header: "Assigned User",
    render: (row) => row.assigneeRole || "Unknown",
  },

  // ✅ NEW DUE DATE COLUMN (INSERTED HERE)
  {
    key: "dueDate",
    header: "Due",
    render: (row) =>
      row.dueDate
        ? new Date(row.dueDate).toLocaleDateString()
        : "-",
  },

{
  key: "status",
  header: "Status",
  render: (row) => (
    <Select
      value={row.status || "Not Started"}
      onValueChange={async (value) => {
        await fetch("/api/tasks/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: row.id,
            status: value,
          }),
        });

        mutate(["tasks"]); // ✅ refresh table
      }}
    >
      <SelectTrigger
        className={`h-8 px-3 rounded-full text-xs font-medium border-0 ${STATUS_COLORS[row.status || "Not Started"]}`}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
},


  // ✅ ACTIONS COLUMN (LAST + CENTERED)
  {
    key: "actions",
    header: "Actions",
    className: "text-center",
    render: (row) => (
      <div className="flex items-center justify-center gap-2 w-full">
        {/* ✅ EDIT */}
       {/* ✅ VIEW CLIENT TASKS */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const tasksForClient = allTasks.filter(
              (t) => Number(t.clientId) === Number(row.clientId)
            );

            setSelectedClientTasks(tasksForClient);
            setSelectedClientName(getClientName(row.clientId));
            setSelectedClientId(row.clientId); // ✅ REQUIRED FOR VIEW CLIENT BUTTON
            setOpenClientTasks(true);
          }}

        >
          All Tasks
        </Button>

        {/* ✅ EDIT */}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            openDrawer("assignTask", {
              taskId: row.id,
            })
          }
        >
          Edit
        </Button>

        {/* ✅ DELETE */}
        <Button
          size="sm"
          variant="destructive"
          onClick={async () => {
            if (!confirm("Delete this task?")) return;

            const res = await fetch("/api/tasks/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                task_id: row.id,
              }),
            });

            if (res.ok) {
              toast({ title: "Task deleted" });
              mutate(["tasks"]);
            } else {
              toast({
                title: "Failed to delete task",
                variant: "destructive",
              });
            }
          }}
        >
          Delete
        </Button>

      </div>
    ),
  },
];


  
  // ✅ APPLY SEARCH FILTER
  const filteredTasks = allTasks.filter((task) => {
    if (!q) return true;

    const search = q.toLowerCase();

    return (
      task.title?.toLowerCase().includes(search) ||
      task.status?.toLowerCase().includes(search) ||
      getClientName(task.clientId)?.toLowerCase().includes(search)
    );
  });

  // ✅ PAGINATION AFTER FILTER
  const total = filteredTasks.length;

  const rows = filteredTasks.slice(
    (page - 1) * pageSize,
    page * pageSize
  );


  // MATERIAL STYLE COUNTER
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <Button onClick={() => openDrawer("assignTask", {})}>
          Assign Task
        </Button>
      </div>

      {/* SEARCH */}
      <TableToolbar q={q} setQ={setQ} />

      {/* TABLE */}
      <DataTable
        columns={cols}
        rows={rows}
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
    <ClientTaskModal
      open={openClientTasks}
      onClose={() => setOpenClientTasks(false)}
      clientName={selectedClientName}
      clientId={selectedClientId}   // ✅ PASS CLIENT ID
      tasks={selectedClientTasks}
    />


    </div>
  );
}
