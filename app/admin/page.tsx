// app/admin/page.tsx
"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  UserCheck,
  ListChecks,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { DataTable, type Column } from "@/components/data-table";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { StatusPill } from "@/components/widgets/status-pill";
import { fetchClients, fetchAllTasks, fetchDocuments, fetchStagesList } from "@/lib/api";



import type { ClientProfile, Task, DocumentFile } from "@/types";
import { useState, useMemo } from "react";
import { ClientTaskModal } from "@/components/widgets/client-task-modal";

// Shape returned by fetchClients()
type ClientsResponse = {
  data: ClientProfile[];
  total?: number;
};

// Shape returned by fetchTasks()
type TasksResponse = {
  data: Task[];
};

// We will extend Task with client_name for the table
type TaskRowWithClientName = Task & { client_name: string };

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

export default function AdminDashboard() {
  const router = useRouter();

  // ✅ SEARCH STATES (MUST BE INSIDE COMPONENT)
  const [clientSearch, setClientSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [openClientTasks, setOpenClientTasks] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState<any[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);


  // ---------- DATA FETCHING ----------

  // 1. Clients (Load ALL for clients kpi + funnel)
  const { data: clients } = useSWR<ClientsResponse>(
    ["clients"],
    () => fetchClients({ page: 1, pageSize: 500 })
  );

  // 2. Tasks (Load ALL for tasks kpi + chart)
  const { data: tasks } = useSWR<TasksResponse>(
    ["dashboard-tasks"],
    () => fetchAllTasks({ page: 1, pageSize: 500 })
  );

  // 3. Documents
  const { data: docs } = useSWR<DocumentFile[]>(
    ["docs"],
    () => fetchDocuments({ clientId: "" })
  );

  // 4. Master Stages (for correct Funnel ordering)
  const { data: masterStages } = useSWR(
    ["master-stages"],
    () => fetchStagesList()
  );

  const clientRows: ClientProfile[] = clients?.data ?? [];
  const taskRows: Task[] = tasks?.data ?? [];
  const docRows: DocumentFile[] = docs ?? [];

  // ---------- PAGINATION STATE ----------

  // Clients pagination
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(5);

  // Tasks pagination
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(5);


  // ---------- DATA PROCESSING: CLIENTS ----------
  // ✅ FILTERED CLIENTS (SEARCH)
  const filteredClients = useMemo(() => {
    return clientRows.filter((c) =>
      c.client_name?.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clientRows, clientSearch]);

  // ✅ PAGINATED CLIENTS
  const paginatedClients = filteredClients.slice(
    (clientPage - 1) * clientPageSize,
    clientPage * clientPageSize
  );

  const clientTotalPages = Math.ceil(filteredClients.length / clientPageSize);
  const clientStart = filteredClients.length
    ? (clientPage - 1) * clientPageSize + 1
    : 0;
  const clientEnd = Math.min(clientPage * clientPageSize, filteredClients.length);


  // ---------- DATA PROCESSING: TASKS ----------
  // Build Client Map
  const clientNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    clientRows.forEach((c) => {
      if (c.client_id != null) map[c.client_id] = c.client_name;
    });
    return map;
  }, [clientRows]);

  // Extend tasks with client names
  const tasksWithClientNames = useMemo(() => {
    return taskRows.map((t) => {
      const anyTask = t as any;
      const clientId =
        typeof anyTask.client_id !== "undefined"
          ? anyTask.client_id
          : anyTask.clientId;

      return {
        ...t,
        client_name:
          (clientId != null ? clientNameMap[clientId] : undefined) || "Unknown",
      } as TaskRowWithClientName;
    });
  }, [taskRows, clientNameMap]);

  // ✅ FILTERED TASKS
  const filteredTasks = useMemo(() => {
    return tasksWithClientNames.filter((t) => {
      const term = taskSearch.toLowerCase();
      return (
        t.title?.toLowerCase().includes(term) ||
        t.client_name?.toLowerCase().includes(term)
      );
    });
  }, [tasksWithClientNames, taskSearch]);

  // ✅ PAGINATED TASKS
  const paginatedTasks = filteredTasks.slice(
    (taskPage - 1) * taskPageSize,
    taskPage * taskPageSize
  );

  const taskTotalPages = Math.ceil(filteredTasks.length / taskPageSize);
  const taskStart = filteredTasks.length
    ? (taskPage - 1) * taskPageSize + 1
    : 0;
  const taskEnd = Math.min(taskPage * taskPageSize, filteredTasks.length);


  // ---------- KPI VALUES ----------

  const totalClients = clients?.total ?? clientRows.length;
  const activeOnboarding = clientRows.filter((c) => c.status === "In Progress").length;
  const inProgressTasks = taskRows.filter(
    (t) => t.status === "In Review" || t.status === "Pending" || t.status === "In Progress"
  ).length;

  const now = new Date();
  const overdueTasks = taskRows.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due < now && t.status !== "Approved" && t.status !== "Completed";
  }).length;


  // ---------- CHART DATA: ONBOARDING FUNNEL ----------
  const stageChart = useMemo(() => {
    // 1. Count clients per stage
    const counts: Record<string, number> = {};
    clientRows.forEach((c) => {
      const stage = c.stage_name || "Unassigned";
      counts[stage] = (counts[stage] || 0) + 1;
    });

    // 2. Use Master Stage Order if available
    let orderedData = [];
    if (masterStages?.data && Array.isArray(masterStages.data)) {
      // Create a map for fast lookup of order
      const masterOrder = masterStages.data; // array of { id, name, ... }

      // Iterate master list to ensure correct order
      orderedData = masterOrder.map((m: any) => ({
        name: m.stage_name || m.name, // robust check
        count: counts[m.stage_name || m.name] || 0
      }));

      // Add "Completed" at the end if it exists in counts but not in master list
      if (counts["Completed"]) {
        orderedData.push({ name: "Completed", count: counts["Completed"] });
      }

      // Add "Unassigned" or others not in master list?
      // For a funnel, we usually just want the main stages + maybe completed.
      // Let's stick to master list + Completed.
    } else {
      // Fallback: just entries
      orderedData = Object.entries(counts).map(([name, count]) => ({
        name,
        count,
      }));
    }

    // Filter out 0 counts? Or keep them to show gaps? Keeping them is better for "Funnel" visualization.
    return orderedData;
  }, [clientRows, masterStages]);


  // ---------- CHART DATA: TASKS BY ROLE (STACKED) ----------
  const tasksByRoleChart = useMemo(() => {
    // 1. Identify all Roles
    const roles = Array.from(new Set(taskRows.map(t => t.assigneeRole || "Unassigned")));

    // 2. Identify all Statuses (for stacks)
    // const statuses = Array.from(new Set(taskRows.map(t => t.status))); 
    // Simplify statuses to meaningful groups if needed, or use raw.
    const statuses = ["Pending", "In Review", "In Progress", "Completed", "Approved"];

    // 3. Build data
    return roles.map(role => {
      const row: any = { role };
      statuses.forEach(status => {
        row[status] = taskRows.filter(t =>
          (t.assigneeRole || "Unassigned") === role &&
          (t.status || "Pending") === status
        ).length;
      });
      return row;
    });
  }, [taskRows]);


  // ---------- KPIS CONFIG ----------
  const kpis = [
    {
      label: "Total Clients",
      value: totalClients,
      icon: Users,
      color: "text-blue-500",
      helper: "View all onboarded clients",
      onClick: () => router.push("/admin/clients"),
    },
    {
      label: "Active Onboarding",
      value: activeOnboarding,
      icon: UserCheck,
      color: "text-emerald-500",
      helper: "Clients currently in onboarding",
      onClick: () => router.push("/admin/clients?status=active"),
    },
    {
      label: "Tasks In Progress",
      value: inProgressTasks,
      icon: ListChecks,
      color: "text-amber-500",
      helper: "Tasks currently being worked on",
      onClick: () => router.push("/admin/tasks?status=in-progress"),
    },
    {
      label: "Overdue Tasks",
      value: overdueTasks,
      icon: Clock,
      color: "text-red-500",
      helper: "Tasks past their due date",
      onClick: () => router.push("/admin/tasks?filter=overdue"),
    },
  ];


  // ---------- TABLE COLUMNS ----------
  const clientCols: Column<ClientProfile>[] = [
    { key: "client_name", header: "Client" },
    { key: "service_center_name", header: "Service Center" },
    { key: "cpa_name", header: "CPA" },
    { key: "stage_name", header: "Stage" },
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
      header: "Status",
      render: (r) => <StatusPill status={r.status || "Not Started"} />,
    },
  ];

  const taskCols: Column<TaskRowWithClientName>[] = [
    { key: "client_name", header: "Client" },
    { key: "title", header: "Title" },
    { key: "assigneeRole", header: "Assigned User" },
    {
      key: "dueDate",
      header: "Due",
      render: (r) =>
        r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* ---------- HEADER ---------- */}
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        {/* ---------- KPI CARDS ---------- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card
              key={k.label}
              className="cursor-pointer border border-slate-200/70 shadow-sm transition hover:shadow-md"
              onClick={k.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{k.label}</CardTitle>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{k.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ---------- CHARTS ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Onboarding Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Funnel</CardTitle>
              <p className="text-sm text-muted-foreground">
                Current distribution of clients across stages
              </p>
            </CardHeader>
            <CardContent className="h-72">
              {stageChart.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageChart} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                      {stageChart.map((_entry: { name: string; count: number }, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tasks by Role */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks by Role</CardTitle>
              <p className="text-sm text-muted-foreground">
                Task load distribution and status per role
              </p>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByRoleChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="role" />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="In Review" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="In Progress" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Approved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Completed" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ---------- CLIENTS TABLE ---------- */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Clients Overview</CardTitle>
              <input
                type="text"
                placeholder="Search client..."
                className="border rounded px-3 py-1 text-sm w-64"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientPage(1);
                }}
              />
            </div>
          </CardHeader>

          <CardContent>
            <DataTable
              columns={clientCols}
              rows={paginatedClients}
              onRowAction={(row: ClientProfile) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/admin/clients/${row.client_id}`)}
                >
                  Open
                </Button>
              )}
            />
            {/* Pagination Controls */}
            <PaginationControls
              page={clientPage}
              pageSize={clientPageSize}
              total={filteredClients.length}
              start={clientStart}
              end={clientEnd}
              onPageChange={setClientPage}
              onPageSizeChange={(s: number) => { setClientPageSize(s); setClientPage(1); }}
              totalPages={clientTotalPages}
            />
          </CardContent>
        </Card>

        {/* ---------- OUTSTANDING TASKS TABLE ---------- */}
        <Card>
          <CardHeader className="flex items-center gap-3">
            <CardTitle>Outstanding Tasks</CardTitle>
            <input
              type="text"
              placeholder="Search task or client..."
              className="border rounded px-3 py-1 text-sm w-64"
              value={taskSearch}
              onChange={(e) => {
                setTaskSearch(e.target.value);
                setTaskPage(1);
              }}
            />
          </CardHeader>

          <CardContent>
            <DataTable
              columns={taskCols}
              rows={paginatedTasks}
              onRowAction={(row: any) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const tasksForClient = tasksWithClientNames.filter(
                      (t: any) =>
                        Number(t.client_id ?? t.clientId) ===
                        Number(row.client_id ?? row.clientId)
                    );
                    setSelectedClientTasks(tasksForClient);
                    setSelectedClientName(row.client_name);
                    setSelectedClientId(row.client_id ?? row.clientId);
                    setOpenClientTasks(true);
                  }}
                >
                  All Tasks
                </Button>
              )}
            />
            {/* Pagination Controls */}
            <PaginationControls
              page={taskPage}
              pageSize={taskPageSize}
              total={filteredTasks.length}
              start={taskStart}
              end={taskEnd}
              onPageChange={setTaskPage}
              onPageSizeChange={(s: number) => { setTaskPageSize(s); setTaskPage(1); }}
              totalPages={taskTotalPages}
            />
          </CardContent>
        </Card>
      </div>

      <ClientTaskModal
        open={openClientTasks}
        onClose={() => setOpenClientTasks(false)}
        clientName={selectedClientName}
        clientId={selectedClientId}
        tasks={selectedClientTasks}
      />
    </>
  );
}

// Helper for Pagination to reduce code duplication
interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalPages: number;
}

function PaginationControls({
  page, pageSize, total, start, end, onPageChange, onPageSizeChange, totalPages
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2 text-sm">
        <span>Items per page:</span>
        <select
          className="border rounded px-2 py-1"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[5, 10, 20, 50, 100].map((s: number) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span>
          {start}–{end} of {total} items
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          disabled={page === totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
