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
import { fetchClients, fetchTasks, fetchDocuments } from "@/lib/api";
import { useUIStore } from "@/store/ui-store";
import type { ClientProfile, Task, DocumentFile } from "@/types";

// Shape returned by fetchClients() for this page
type ClientsResponse = {
  data: ClientProfile[];
  total?: number;
};

// Shape returned by fetchTasks()
type TasksResponse = {
  data: Task[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const openDrawer = useUIStore((s) => s.openDrawer);

  // ---------- DATA FETCHING ----------

  // Clients (no pagination needed here)
  const { data: clients } = useSWR<ClientsResponse>(
    ["clients"],
    () => fetchClients({})
  );

  // Tasks (no client filter on dashboard)
  const { data: tasks } = useSWR<TasksResponse>(
    ["tasks"],
    () => fetchTasks({})
  );

  // Documents
  const { data: docs } = useSWR<DocumentFile[]>(
    ["docs"],
    () => fetchDocuments()
  );

  const clientRows: ClientProfile[] = clients?.data ?? [];
  const taskRows: Task[] = tasks?.data ?? [];
  const docRows: DocumentFile[] = docs ?? [];

  // ---------- KPI VALUES ----------

  // If backend doesn't send `total`, fall back to array length
  const totalClients = clients?.total ?? clientRows.length;

  const activeOnboarding = clientRows.filter(
    (c) => c.status === "In Progress"
  ).length;

  const inProgressTasks = taskRows.filter(
    (t) => t.status === "In Review" || t.status === "Pending"
  ).length;

  const overdueTasks = 0; // No overdue logic yet – safe placeholder

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
      onClick: () => router.push("/admin/tasks?status=overdue"),
    },
    {
      label: "Docs Awaiting Review",
      value: docsAwaitingReview,
      icon: FileText,
      color: "text-purple-500",
      helper: "Documents uploaded by clients",
      onClick: () => router.push("/admin/documents"),
    },
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

    // 🔥 SHOW SERVICE CENTER NAME (NOT ID)
    {
      key: "service_center_name",
      header: "Service Center",
    },

    // 🔥 SHOW CPA NAME (NOT ID)
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
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressRing value={r.progress ?? 0} />
          <span className="text-xs">
            {typeof r.progress === "number" ? r.progress : 0}%
          </span>
        </div>
      ),
    },

    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status || "Not Started"} />,
    },
  ];

  // ---------- TASKS TABLE ----------

  const taskCols: Column<Task>[] = [
    { key: "clientId", header: "Client" },
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
    <div className="space-y-6">
      {/* ---------- HEADER ---------- */}
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* ---------- KPI CARDS ---------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          <CardTitle>Clients Overview</CardTitle>
          <Button onClick={() => openDrawer("assignTask", {})}>
            Assign Task
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={clientCols}
            rows={clientRows}
            onRowAction={(row: ClientProfile) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openDrawer("assignTask", { clientId: row.client_id })
                  }
                >
                  Assign
                </Button>
                {/* <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openDrawer("setStage", { clientId: row.client_id })
                  }
                >
                  Set Stage
                </Button> */}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* ---------- OUTSTANDING TASKS TABLE ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={taskCols}
            rows={taskRows}
            onRowAction={(row: Task) => (
              <Button
                size="sm"
                onClick={() =>
                  openDrawer("uploadDoc", { clientId: row.clientId })
                }
              >
                Upload Doc
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
