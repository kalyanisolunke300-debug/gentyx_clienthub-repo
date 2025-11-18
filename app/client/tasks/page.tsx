"use client"

import useSWR from "swr"
import { fetchTasks } from "@/lib/api"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/store/ui-store"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

export default function ClientTasks() {
  const role = useUIStore((s) => s.role)
  const currentClientId = useUIStore((s) => s.currentClientId)
  const { toast } = useToast()
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  const clientId = role === "CLIENT" ? currentClientId || "cli-1" : undefined

  const { data } = useSWR(["client-tasks", clientId], () => fetchTasks({ assigneeRole: "CLIENT", clientId }), {
    revalidateOnFocus: false,
  })

  function handleCompleteTask(taskId: string) {
    setCompletedTasks((prev) => new Set([...prev, taskId]))
    toast({ title: "Success", description: "Task marked as complete." })
  }

  const cols: Column<any>[] = [
    { key: "title", header: "Title" },
    { key: "stage", header: "Stage" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={completedTasks.has(r.id) ? "Approved" : r.status} />,
    },
  ]

  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">My Tasks</h1>
      <DataTable
        columns={cols}
        rows={data?.data || []}
        onRowAction={(r: any) => (
          <Button
            size="sm"
            variant="outline"
            disabled={completedTasks.has(r.id)}
            onClick={() => handleCompleteTask(r.id)}
          >
            {completedTasks.has(r.id) ? "Completed" : "Complete"}
          </Button>
        )}
      />
    </div>
  )
}
