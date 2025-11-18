"use client"

import { useParams } from "next/navigation"
import useSWR from "swr"
import { fetchClient, fetchTasks, fetchDocuments, fetchMessages } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type Column } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useUIStore } from "@/store/ui-store"

export default function ServiceCenterClientWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { data: client } = useSWR(["client", id], () => fetchClient(id))
  const { data: tasks } = useSWR(["tasks", id], () => fetchTasks({ clientId: id }))
  const { data: docs } = useSWR(["docs", id], () => fetchDocuments({ clientId: id }))
  const { data: msgs } = useSWR(["msgs", id], () => fetchMessages({ clientId: id }))
  const openDrawer = useUIStore((s) => s.openDrawer)

  const taskCols: Column<any>[] = [
    { key: "title", header: "Title" },
    { key: "assigneeRole", header: "Assignee" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
  ]

  const docCols: Column<any>[] = [
    { key: "name", header: "Name" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || "Uploaded"} /> },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{client?.name}</h1>
          <div className="text-sm text-muted-foreground">Stage: {client?.onboardingStage}</div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openDrawer("assignTask", { clientId: id })}>Create Task</Button>
          <Button variant="outline" onClick={() => openDrawer("setStage", { clientId: id })}>
            Set Stage
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <DataTable
            columns={taskCols}
            rows={tasks?.data || []}
            onRowAction={(r: any) => (
              <Button size="sm" variant="outline">
                Approve
              </Button>
            )}
          />
        </TabsContent>
        <TabsContent value="documents">
          <DataTable
            columns={docCols}
            rows={docs || []}
            onRowAction={(r: any) => (
              <Button size="sm" variant="outline">
                Review
              </Button>
            )}
          />
        </TabsContent>
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {(msgs || []).map((m) => (
                <div key={m.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">{m.senderRole}</span>
                    <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{m.body}</p>
                  <Button size="sm" variant="ghost" className="mt-2">
                    Reply
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Recent actions appear here.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
