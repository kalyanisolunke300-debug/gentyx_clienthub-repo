"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/store/ui-store"
import { Settings } from "lucide-react"

export default function ServiceCenterDashboard() {
  const router = useRouter()
  const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId)

  // Fetch only clients assigned to this Service Center
  const { data: clientsData } = useSWR(
    currentServiceCenterId ? ["sc-clients", currentServiceCenterId] : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`)
      const json = await res.json()
      return { data: json.data || [], total: json.data?.length || 0 }
    }
  )

  // Get client IDs for fetching tasks
  const clientIds = (clientsData?.data || []).map((c: any) => c.client_id)

  // Fetch tasks for assigned clients (tasks where client_id is in our assigned list)
  const { data: tasksData } = useSWR(
    clientIds.length > 0 ? ["sc-tasks", clientIds.join(",")] : null,
    async () => {
      // Fetch all tasks and filter by assigned client IDs
      const res = await fetch(`/api/tasks/get`)
      const json = await res.json()
      const allTasks = json.data || []
      // Filter tasks to only show tasks for assigned clients
      const filteredTasks = allTasks.filter((t: any) =>
        clientIds.includes(t.client_id) || clientIds.includes(Number(t.clientId))
      )
      return { data: filteredTasks }
    }
  )

  const clients = clientsData?.data || []
  const tasks = tasksData?.data || []

  const clientCols: Column<any>[] = [
    { key: "client_name", header: "Client" },
    { key: "code", header: "Code" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || r.client_status} /> },
  ]

  // Loading state
  if (!currentServiceCenterId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {/* Header with Settings */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Center Dashboard</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push("/service-center/settings")}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/service-center/clients-list")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Assigned Clients</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{clients.length}</CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/service-center/tasks")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {tasks.filter((t: any) => t.status === "Pending").length}
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/service-center/tasks")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {tasks.filter((t: any) => t.status === "In Progress").length}
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted transition-colors">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {tasks.filter((t: any) => t.status === "Completed").length}
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assigned Clients</CardTitle>
          <Button variant="outline" onClick={() => router.push("/service-center/clients-list")}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={clientCols}
            rows={clients.slice(0, 5)}
            onRowAction={(r: any) => (
              <Button size="sm" onClick={() => router.push(`/service-center/clients/${r.client_id}`)}>
                Open
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
