"use client"

import useSWR from "swr"
import { fetchClients, fetchTasks, fetchDocuments } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"

export default function CPADashboard() {
  const { data: clients } = useSWR(["cpa-clients"], () => fetchClients({ page: 1, pageSize: 8 }))
  const { data: tasks } = useSWR(["cpa-tasks"], () => fetchTasks({ assigneeRole: "CPA" }))
  const { data: docs } = useSWR(["cpa-docs"], () => fetchDocuments())
  const router = useRouter()

  const cols: Column<any>[] = [
    { key: "name", header: "Client" },
    { key: "onboardingStage", header: "Stage" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ]

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:bg-muted transition-colors"
          onClick={() => router.push("/cpa/clients-list")}
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
            <CardTitle className="text-sm text-muted-foreground">CPA Tasks Pending</CardTitle>
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
            <CardTitle className="text-sm text-muted-foreground">Docs to Review</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(docs || []).filter((d) => d.status === "Uploaded").length}
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted transition-colors">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Stages Mix</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Clients</CardTitle>
          <Button variant="outline">Create CPA Task</Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={cols}
            rows={clients?.data || []}
            onRowAction={(r: any) => (
              <Button size="sm" onClick={() => router.push(`/cpa/clients/${r.id}`)}>
                Open
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
