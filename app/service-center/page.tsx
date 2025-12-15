"use client"

import useSWR from "swr"
import { fetchClients, fetchTasks, fetchDocuments } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"

export default function ServiceCenterDashboard() {
  const { data: clients } = useSWR(["sc-clients"], () => fetchClients({ page: 1, pageSize: 8 }))
  const { data: tasks } = useSWR(["sc-tasks"], () => fetchTasks({ assigneeRole: "SERVICE_CENTER" }))
  const { data: docs } = useSWR(["sc-docs"], () => fetchDocuments())

  const router = useRouter()

  const clientCols: Column<any>[] = [
    { key: "name", header: "Client" },
    { key: "onboardingStage", header: "Stage" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ]

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/service-center/clients-list")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Assigned Clients</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{clients?.total ?? 0}</CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/inbox?filter=pending")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending Client Tasks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(tasks?.data || []).filter((t) => t.status === "Pending").length}
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/documents?filter=awaiting-review")}
        >
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Docs Awaiting Review</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(docs || []).filter((d) => d.status === "Uploaded").length}
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted transition-colors">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">0</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Clients</CardTitle>
          <Button variant="outline" onClick={() => router.push("/inbox")}>
            Work Queue
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={clientCols}
            rows={clients?.data || []}
            onRowAction={(r: any) => (
              <Button size="sm" onClick={() => router.push(`/service-center/clients/${r.id}`)}>
                Open
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
