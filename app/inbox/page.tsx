"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { fetchAllTasks, fetchMessages } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusPill } from "@/components/widgets/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Search,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  Clock
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

interface Task {
  id: number;
  stageId: number;
  clientId: number;
  clientName: string;
  title: string;
  assigneeRole: string;
  status: string;
  dueDate: string | null;
  created_at: string;
}

interface Message {
  message_id: number;
  client_id: number;
  client_name: string;
  sender_role: string;
  receiver_role: string;
  body: string;
  parent_message_id: number | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatDateTime(dateString: string): { date: string; time: string; relative: string } {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMins < 1) relative = "Just now";
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: diffDays > 365 ? "numeric" : undefined
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }),
    relative
  };
}

function formatDueDate(dateString: string | null): string {
  if (!dateString) return "No due date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// Main Inbox Page Component
// ─────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  const { data: tasksResponse, isLoading: tasksLoading } = useSWR(
    ["inbox-tasks"],
    () => fetchAllTasks({ page: 1, pageSize: 100 })
  )

  const { data: msgsResponse, isLoading: msgsLoading } = useSWR(
    ["inbox-msgs"],
    () => fetchMessages()
  )

  const tasks = ((tasksResponse?.data || []) as Task[]).filter(
    (t) => t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const messages = ((msgsResponse?.data || []) as Message[]).filter(
    (m) => m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Reply - navigate to client's messages tab
  const handleReply = (clientId: number) => {
    router.push(`/admin/clients/${clientId}?tab=messages`);
  };

  // Handle Open Task - navigate to client's tasks tab
  const handleOpenTask = (clientId: number) => {
    router.push(`/admin/clients/${clientId}?tab=tasks`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">
          Manage your tasks, messages, and approvals
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search tasks and messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="w-fit">
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {messages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approvals
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasksLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                // Empty state
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No tasks match your search" : "No tasks assigned yet"}</p>
                </div>
              ) : (
                // Task list
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{task.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {task.clientName || `Client #${task.clientId}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {task.assigneeRole || "Unassigned"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDueDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <StatusPill status={task.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenTask(task.clientId)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {msgsLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                // Empty state
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No messages match your search" : "No messages yet"}</p>
                </div>
              ) : (
                // Message list
                messages.map((msg) => {
                  const dateTime = formatDateTime(msg.created_at);
                  return (
                    <div
                      key={msg.message_id}
                      className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium text-sm">
                          {msg.sender_role?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium">{msg.sender_role}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3.5 w-3.5" />
                              {msg.client_name || `Client #${msg.client_id}`}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {msg.body}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {dateTime.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {dateTime.time}
                            </span>
                            <span className="text-muted-foreground/60">
                              ({dateTime.relative})
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 ml-4"
                        onClick={() => handleReply(msg.client_id)}
                      >
                        Reply
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No approvals pending. Great job!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
