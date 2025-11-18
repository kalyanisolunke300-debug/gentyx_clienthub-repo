"use client"

import useSWR from "swr"
import { fetchTasks, fetchDocuments } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useUIStore } from "@/store/ui-store"
import { useRouter } from "next/navigation"

export default function ClientHome() {
  const role = useUIStore((s) => s.role)
  const currentClientId = useUIStore((s) => s.currentClientId)
  const router = useRouter()

  const clientId = role === "CLIENT" ? currentClientId || "cli-1" : undefined

  const { data: tasks } = useSWR(["client-tasks", clientId], () => fetchTasks({ assigneeRole: "CLIENT", clientId }), {
    revalidateOnFocus: false,
  })
  const { data: docs } = useSWR(["client-docs", clientId], () => fetchDocuments({ clientId }), {
    revalidateOnFocus: false,
  })

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Current stage and progress shown on your client profile.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Inbox</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push("/client/messages")}>
              Ask a Question
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Newest tasks and messages appear here.</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>My Tasks</CardTitle>
            <Button size="sm" onClick={() => router.push("/client/tasks")}>
              View All
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(tasks?.data || []).slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                <div>{t.title}</div>
                <StatusPill status={t.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>My Documents</CardTitle>
          <Button variant="secondary" onClick={() => router.push("/client/documents")}>
            Upload Document
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(docs || []).slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border p-2">
              <div>{d.name}</div>
              <StatusPill status={d.status || "Uploaded"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
