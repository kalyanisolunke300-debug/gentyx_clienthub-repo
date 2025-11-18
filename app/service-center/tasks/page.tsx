"use client"

import useSWR from "swr"
import { fetchTasks } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { useUIStore } from "@/store/ui-store"

export default function ServiceCenterTasksPage() {
  const { data: tasks } = useSWR(["sc-all-tasks"], () => fetchTasks({ assigneeRole: "SERVICE_CENTER" }))
  const openDrawer = useUIStore((s) => s.openDrawer)

  const taskCols: Column<any>[] = [
    { key: "title", header: "Task Title" },
    { key: "clientId", header: "Client ID" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "dueDate", header: "Due Date" },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <Button onClick={() => openDrawer("assignTask", {})}>Assign Task to Client</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assigned Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={taskCols}
            rows={tasks?.data || []}
            onRowAction={(r: any) => (
              <Button size="sm" variant="outline">
                View
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
