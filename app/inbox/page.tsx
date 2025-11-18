"use client"

import useSWR from "swr"
import { fetchTasks, fetchMessages } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"

export default function InboxPage() {
  const { data: tasks } = useSWR(["inbox-tasks"], () => fetchTasks())
  const { data: msgs } = useSWR(["inbox-msgs"], () => fetchMessages())

  return (
    <Tabs defaultValue="tasks" className="grid gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
        <TabsTrigger value="approvals">Approvals</TabsTrigger>
      </TabsList>

      <TabsContent value="tasks">
        <Card>
          <CardHeader>
            <CardTitle>Assigned Tasks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(tasks?.data || []).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-sm text-muted-foreground">• {t.clientId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={t.status} />
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="messages">
        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(msgs || []).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">{m.body}</div>
                <Button size="sm" variant="outline">
                  Reply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="approvals">
        <div className="rounded-md border p-6 text-sm text-muted-foreground">No approvals pending. Great job!</div>
      </TabsContent>
    </Tabs>
  )
}
