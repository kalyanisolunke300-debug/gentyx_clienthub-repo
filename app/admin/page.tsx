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
  FileText,
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
} from "recharts";
import { DataTable, type Column } from "@/components/data-table";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { StatusPill } from "@/components/widgets/status-pill";
// import { fetchClients, fetchTasks, fetchDocuments } from "@/lib/api";
import { fetchClients, fetchAllTasks, fetchDocuments } from "@/lib/api";

import { useUIStore } from "@/store/ui-store";
import type { ClientProfile, Task, DocumentFile } from "@/types";
import { useState } from "react";
import { ClientTaskModal } from "@/components/widgets/client-task-modal";




// Shape returned by fetchClients() for this page
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

export default function AdminDashboard() {
  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  // ✅ SEARCH STATES (MUST BE INSIDE COMPONENT)
  const [clientSearch, setClientSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [openClientTasks, setOpenClientTasks] = useState(false);
  const [selectedClientTasks, setSelectedClientTasks] = useState<any[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);


  // ---------- DATA FETCHING ----------

  // Clients (no pagination needed here)
  const { data: clients } = useSWR<ClientsResponse>(
    ["clients"],
    () => fetchClients({ page: 1, pageSize: 500 })  // 👈 LOAD ALL CLIENTS
  );


  // // Tasks (no client filter on dashboard)
  // const { data: tasks } = useSWR<TasksResponse>(
  //   ["tasks"],
  //   () => fetchTasks({})
  // );

  // Tasks — load ALL tasks for dashboard
  const { data: tasks } = useSWR<TasksResponse>(
    ["dashboard-tasks"],
    () => fetchAllTasks({ page: 1, pageSize: 200 })
  );

  // Documents
  const { data: docs } = useSWR<DocumentFile[]>(
    ["docs"],
    () => fetchDocuments({ clientId: "" })
  );

  const clientRows: ClientProfile[] = clients?.data ?? [];
  const taskRows: Task[] = tasks?.data ?? [];
  const docRows: DocumentFile[] = docs ?? [];

  // ---------- PAGINATION STATE ----------

  // Clients pagination
  const [clientPage, setClientPage] = useState(1);
  // const clientPageSize = 10;

  // Tasks pagination
  const [taskPage, setTaskPage] = useState(1);
  // const taskPageSize = 10;

  // NEW – page size dropdown state
  const [clientPageSize, setClientPageSize] = useState(5);
  const [taskPageSize, setTaskPageSize] = useState(5);

  // Paginated results - Client Table
  // ✅ FILTERED CLIENTS (SEARCH)
  const filteredClients = clientRows.filter((c) =>
    c.client_name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // ✅ PAGINATED CLIENTS (AFTER SEARCH)
  const paginatedClients = filteredClients.slice(
    (clientPage - 1) * clientPageSize,
    clientPage * clientPageSize
  );

  const clientTotalPages = Math.ceil(filteredClients.length / clientPageSize);
  const clientStart = filteredClients.length
    ? (clientPage - 1) * clientPageSize + 1
    : 0;
  const clientEnd = Math.min(clientPage * clientPageSize, filteredClients.length);


  // Paginated results - tasks Table
  // ✅ FILTERED TASKS (SEARCH BY TASK TITLE OR CLIENT)
  const filteredTasks = taskRows.filter((t: any) => {
    const titleMatch = t.title?.toLowerCase().includes(taskSearch.toLowerCase());
    const clientMatch =
      t.clientName?.toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.client_name?.toLowerCase().includes(taskSearch.toLowerCase());

    return titleMatch || clientMatch;
  });

  // ✅ PAGINATED TASKS (AFTER SEARCH)
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

  // If backend doesn't send `total`, fall back to array length
  const totalClients = clients?.total ?? clientRows.length;

  const activeOnboarding = clientRows.filter(
    (c) => c.status === "In Progress"
  ).length;

  const inProgressTasks = taskRows.filter(
    (t) => t.status === "In Review" || t.status === "Pending"
  ).length;

  // const overdueTasks = 0; // No overdue logic yet – safe placeholder
  // ---------- OVERDUE TASKS ----------
  const now = new Date();

  const overdueTasks = taskRows.filter((t) => {
    if (!t.dueDate) return false;

    const due = new Date(t.dueDate);

    // Overdue = past due date AND not approved
    return due < now && t.status !== "Approved";
  }).length;


  const docsAwaitingReview = docRows.filter(
    (d) => d.status === "Uploaded"
  ).length;

  // ---------- KPI CARDS ----------

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
    // {
    //   label: "Docs Awaiting Review",
    //   value: docsAwaitingReview,
    //   icon: FileText,
    //   color: "text-purple-500",
    //   helper: "Documents uploaded by clients",
    //   onClick: () => router.push("/admin/documents"),
    // },
  ];

  // ---------- CHART DATA (Onboarding Stages) ----------

  const stageData = clientRows.reduce<Record<string, number>>((acc, c) => {
    const stage = c.stage_name || "Not Set";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  const stageChart = Object.entries(stageData).map(([name, count]) => ({
    name,
    count,
  }));

  // ---------- TASKS BY ROLE CHART ----------

  const tasksByRole = ["CLIENT", "SERVICE_CENTER", "CPA"].map((role) => ({
    role,
    Pending: taskRows.filter(
      (t) => t.assigneeRole === role && t.status === "Pending"
    ).length,
    "In Review": taskRows.filter(
      (t) => t.assigneeRole === role && t.status === "In Review"
    ).length,
  }));

  // ---------- CLIENTS TABLE ----------

  const clientCols: Column<ClientProfile>[] = [
    {
      key: "client_name",
      header: "Client",
    },
    {
      key: "service_center_name",
      header: "Service Center",
    },
    {
      key: "cpa_name",
      header: "CPA",
    },
    {
      key: "stage_name",
      header: "Stage",
    },
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

  // ---------- BUILD CLIENT LOOKUP + MERGE INTO TASKS ----------

  // Map: client_id -> client_name
  const clientNameMap: Record<number, string> = {};
  clientRows.forEach((c) => {
    if (c.client_id != null) {
      clientNameMap[c.client_id] = c.client_name;
    }
  });

  // Extend each task with client_name
  const tasksWithClientNames: TaskRowWithClientName[] = taskRows.map((t) => {
    const anyTask = t as any;

    // Support both DB shapes: client_id (snake) or clientId (camel)
    const clientId: number | undefined =
      typeof anyTask.client_id !== "undefined"
        ? anyTask.client_id
        : anyTask.clientId;

    return {
      ...t,
      client_name:
        (clientId != null ? clientNameMap[clientId] : undefined) ||
        "Unknown",
    };
  });



  // ---------- TASKS TABLE (show client id directly) ----------
  // const taskCols: Column<any>[] = [
  //   {
  //     key: "client",            // virtual key, just for the table
  //     header: "Client",
  //     render: (row: any) => row.client_id ?? row.clientId ?? "-",
  //   },
  //   { key: "title", header: "Title" },
  //   { key: "assigneeRole", header: "Assigned User" },
  //   {
  //     key: "dueDate",
  //     header: "Due",
  //     render: (r: any) =>
  //       r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-",
  //   },
  //   {
  //     key: "status",
  //     header: "Status",
  //     render: (r: any) => <StatusPill status={r.status} />,
  //   },
  // ];

const taskCols: Column<TaskRowWithClientName>[] = [
  {
    key: "client_name",
    header: "Client",
  },
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
      {/* <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"> */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

        {kpis.map((k) => (
          <Card
            key={k.label}
            className="cursor-pointer border border-slate-200/70 shadow-sm transition hover:shadow-md"
            onClick={k.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {k.label}
              </CardTitle>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {k.helper}
              </p>
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
          </CardHeader>
          <CardContent className="h-64">
            {stageChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No onboarding data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Role */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Role</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tasksByRole}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Pending" fill="#f59e0b" />
                <Bar dataKey="In Review" fill="#3b82f6" />
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

        {/* <Button onClick={() => openDrawer("assignTask", {})}>
          Assign Task
        </Button> */}
      </CardHeader>

        <CardContent>
          <DataTable
            columns={clientCols}
            rows={paginatedClients}
            onRowAction={(row: ClientProfile) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/admin/clients/${row.client_id}`)}
                >
                  Open
                </Button>
              </div>
            )}
          />

          {/* Pagination Buttons */}
            <div className="flex items-center justify-between mt-4">

              {/* LEFT SIDE: items per page + count */}
              <div className="flex items-center gap-2 text-sm">
                <span>Items per page:</span>

                <select
                  className="border rounded px-2 py-1"
                  value={clientPageSize}
                  onChange={(e) => {
                    setClientPageSize(Number(e.target.value));
                    setClientPage(1);
                  }}
                >
                  {[5, 10, 20, 50, 100].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <span>
                  {clientStart}–{clientEnd} of {clientRows.length} items
                </span>
              </div>

              {/* RIGHT SIDE: Prev Next */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={clientPage === 1}
                  onClick={() => setClientPage(clientPage - 1)}
                >
                  Prev
                </Button>

                <Button
                  variant="outline"
                  disabled={clientPage === clientTotalPages}
                  onClick={() => setClientPage(clientPage + 1)}
                >
                  Next
                </Button>
              </div>

            </div>

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
            rows={tasksWithClientNames.slice(
              (taskPage - 1) * taskPageSize,
              taskPage * taskPageSize
            )}

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

          {/* Pagination Buttons */}
          <div className="flex items-center justify-between mt-4">

            <div className="flex items-center gap-2 text-sm">
              <span>Items per page:</span>

              <select
                className="border rounded px-2 py-1"
                value={taskPageSize}
                onChange={(e) => {
                  setTaskPageSize(Number(e.target.value));
                  setTaskPage(1);
                }}
              >
                {[5, 10, 20, 50, 100].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <span>
                {taskStart}–{taskEnd} of {taskRows.length} items
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={taskPage === 1}
                onClick={() => setTaskPage(taskPage - 1)}
              >
                Prev
              </Button>

              <Button
                variant="outline"
                disabled={taskPage === taskTotalPages}
                onClick={() => setTaskPage(taskPage + 1)}
              >
                Next
              </Button>
            </div>

          </div>


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

