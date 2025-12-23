// app/client/page.tsx
"use client"

import useSWR from "swr"
import { fetchClientTasksByClientId, fetchDocuments } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useUIStore } from "@/store/ui-store"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

function formatDueDate(value: any) {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

export default function ClientHome() {
  const role = useUIStore((s) => s.role)
  const currentClientId = useUIStore((s) => s.currentClientId)
  const router = useRouter()

  const [clientId, setClientId] = useState<string | null>(null)

  // ✅ wait for client context from login → cookies → zustand
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId)
    }
  }, [role, currentClientId])

  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useSWR(
    clientId ? ["client-tasks", clientId] : null,
    () => fetchClientTasksByClientId(clientId!),
    { revalidateOnFocus: false }
  )

  const {
    data: docs,
    isLoading: docsLoading,
    error: docsError,
  } = useSWR(
    clientId ? ["client-docs", clientId] : null,
    () => fetchDocuments({ clientId: clientId! }),
    { revalidateOnFocus: false }
  )

  const topTasks = useMemo(() => {
    const list = (tasks?.data || []) as any[]
    // optional: sort by due date (soonest first) if dueDate exists
    return list
      .slice()
      .sort((a, b) => {
        const ad = a?.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
        const bd = b?.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
        return ad - bd
      })
      .slice(0, 5)
  }, [tasks])

  const topDocs = useMemo(() => {
    return ((docs || []) as any[]).slice(0, 5)
  }, [docs])

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/client/messages")}
            >
              Ask a Question
            </Button>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Newest tasks and messages appear here.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>My Tasks</CardTitle>
            <Button size="sm" onClick={() => router.push("/client/tasks")}>
              View All
            </Button>
          </CardHeader>

          <CardContent className="grid gap-2">
            {!clientId || tasksLoading ? (
              <div className="text-sm text-muted-foreground">Loading tasks…</div>
            ) : tasksError ? (
              <div className="text-sm text-red-600">Failed to load tasks.</div>
            ) : topTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks assigned yet.</div>
            ) : (
              topTasks.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Due: {formatDueDate(t.dueDate)}
                    </div>
                  </div>

                  <StatusPill status={t.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>My Documents</CardTitle>
          <Button
            variant="secondary"
            onClick={() => router.push("/client/documents")}
          >
            Upload Document
          </Button>
        </CardHeader>

        <CardContent className="grid gap-2">
          {!clientId || docsLoading ? (
            <div className="text-sm text-muted-foreground">Loading documents…</div>
          ) : docsError ? (
            <div className="text-sm text-red-600">Failed to load documents.</div>
          ) : topDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No documents uploaded yet.</div>
          ) : (
            topDocs.map((d: any) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.name}</div>
                </div>
                <StatusPill status={d.status || "Uploaded"} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}