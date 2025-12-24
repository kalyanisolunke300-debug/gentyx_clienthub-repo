"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { useUIStore } from "@/store/ui-store"
import { useRouter } from "next/navigation"

export default function ServiceCenterTasksPage() {
  const router = useRouter()

  // Fetch all tasks assigned to SERVICE_CENTER
  const { data: allTasksData, isLoading } = useSWR(
    ["sc-all-tasks"],
    async () => {
      const res = await fetch("/api/tasks/list")
      const json = await res.json()
      return json.data || []
    }
  )

  // Filter to only SERVICE_CENTER tasks
  const serviceCenterTasks = (allTasksData || []).filter(
    (task: any) => task.assigneeRole === "SERVICE_CENTER"
  )

  const taskCols: Column<any>[] = [
    { key: "title", header: "Task Title" },
    { key: "clientName", header: "Client Name" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "dueDate", header: "Due Date", render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—" },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tasks Assigned to You ({serviceCenterTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading tasks...</span>
            </div>
          ) : serviceCenterTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No tasks assigned to you yet
            </div>
          ) : (
            <DataTable
              columns={taskCols}
              rows={serviceCenterTasks}
              onRowAction={(r: any) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/service-center/clients/${r.clientId}`)}
                >
                  View Client
                </Button>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
