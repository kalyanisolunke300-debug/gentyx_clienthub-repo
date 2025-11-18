"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ChevronDown } from "lucide-react"
import { mutate } from "swr"
import {
  fetchClient,
  fetchTasks,
  fetchDocuments,
  fetchMessages,
  fetchAuditLogs,
} from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { StatusPill } from "@/components/widgets/status-pill";
import { ProgressRing } from "@/components/widgets/progress-ring";
import { DataTable, type Column } from "@/components/data-table";

import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

// ------------------ TYPES ------------------
type ClientTask = {
  task_id: number;
  task_title: string;
  assignee_role: string;
  status: string;
  due_date: string | null;
};

type ClientDocument = {
  id: number;
  name: string;
  type: string;
  status: string;
  notes: string | null;
};

type ClientMessage = {
  id: string | number;
  senderRole: string;
  body: string;
  createdAt: string;
};

type AuditLog = {
  id: number;
  action: string;
  actorRole: string;
  at: string | Date;
};

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const { toast } = useToast();

  // ----------------- FETCHING ------------------
  const { data: client } = useSWR(["client", id], () => fetchClient(id));

  const { data: tasksResponse } = useSWR(["tasks", id], () =>
    fetchTasks({ clientId: id })
  );
  const taskRows: ClientTask[] = tasksResponse?.data || [];

  const { data: docsResponse } = useSWR(["docs", id], () =>
    fetchDocuments({ clientId: id })
  );
  const docs: ClientDocument[] = docsResponse?.data || docsResponse || [];

  const { data: msgsResponse } = useSWR(["msgs", id], () =>
    fetchMessages({ clientId: id })
  );

  const { data: auditsResponse } = useSWR(["audits", id], () =>
    fetchAuditLogs({ clientId: id })
  );
  const audits: AuditLog[] = auditsResponse || [];

  const { data: stagesResponse, mutate: mutateStages } = useSWR(
    ["stages", id],
    () => fetch(`/api/stageget?clientId=${id}`).then((r) => r.json())
  );

  const stages = stagesResponse?.data || [];

  // ----------------- MESSAGES HANDLING ------------------
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [openStage, setOpenStage] = useState<number | null>(null);

  const toggleStage = (id: number) => {
    setOpenStage((prev) => (prev === id ? null : id));
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });

      toast({ title: "Task updated" });
      mutate(["tasks", id]); // refresh tasks
      mutateStages(); // refresh stages
    } catch (err) {
      toast({ title: "Failed to update task", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (msgsResponse?.data) setMessages(msgsResponse.data);
    else setMessages([]);
  }, [msgsResponse]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    await fetch("/api/messages/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: id,
        sender_role: "ADMIN",
        receiver_role: "CLIENT",
        body: messageText
      }),
    });

    setMessageText("");
    toast({ title: "Message sent" });

    mutate(["msgs", id]); // refresh messages
  };

  // ----------------- TABLE COLUMNS ------------------
  const taskCols: Column<ClientTask>[] = [
    { key: "task_title", header: "Title" },
    { key: "assignee_role", header: "Assigned User" },
    {
      key: "due_date",
      header: "Due",
      render: (r) =>
        r.due_date ? new Date(r.due_date).toLocaleDateString() : "-",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
  ];

  const docCols: Column<ClientDocument>[] = [
    { key: "name", header: "Name" },
    { key: "type", header: "Type" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status || "Uploaded"} />,
    },
    { key: "notes", header: "Notes" },
  ];

  // ----------------- CLIENT META ------------------
  const clientStatus = client?.status ?? "Not Started";
  const stageName = client?.stage_name ?? "—";
  const progress = client?.progress ?? 0;

  return (
    <div className="grid gap-4">
      {/* ---------- HEADER ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {client?.client_name ?? "Client"}
          </h1>

          <div className="mt-1 flex items-center gap-2 text-sm">
            <StatusPill status={clientStatus} />
            <span>Stage: {stageName}</span>
            {client?.code && (
              <span className="text-muted-foreground">Code: {client.code}</span>
            )}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            Contact: {client?.primary_contact_name} •{" "}
            {client?.primary_contact_email} • {client?.primary_contact_phone}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProgressRing value={progress} />

          <Button
            variant="outline"
            onClick={() =>
              openDrawer("setStage", {
                clientId: id,
                stageId: client?.stage_id,
              })
            }
          >
            Set Stage
          </Button>

          <Button
            onClick={() =>
              openDrawer("assignTask", {
                clientId: id,
                stageId: client?.stage_id,
              })
            }
          >
            Assign Task
          </Button>

          <Button
            variant="secondary"
            onClick={() => openDrawer("uploadDoc", { clientId: id })}
          >
            Upload Doc
          </Button>
        </div>
      </div>

      {/* ---------- TABS ---------- */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="Stages">Stages & Associated Tasks</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
        <TabsContent value="overview" className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div>Client ID: {client?.client_id}</div>
              <div>Code: {client?.code}</div>
              {/* <div>SLA #: {client?.sla_number ?? "-"}</div> */}
              {/* <div>Service Center ID: {client?.service_center_id ?? "-"}</div> */}
              {/* <div>CPA ID: {client?.cpa_id ?? "-"}</div> */}
              <div>
                Created:{" "}
                {client?.created_at
                  ? new Date(client.created_at).toLocaleString()
                  : "-"}
              </div>
              <div>
                Updated:{" "}
                {client?.updated_at
                  ? new Date(client.updated_at).toLocaleString()
                  : "-"}
              </div>
              <div>Stage: {stageName}</div>
              <div>Progress: {progress}%</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Stages">
  <div className="grid gap-4">
    {stages.map((stage: any) => (
      <Card key={stage.stage_id} className="border rounded-lg">
        <CardHeader
          onClick={() => toggleStage(stage.stage_id)}
          className="cursor-pointer flex flex-row items-center justify-between"
        >
          <div>
            <CardTitle>{stage.stage_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Status: {stage.status}
            </p>
          </div>
          <ChevronDown
            className={`transition-transform ${
              openStage === stage.stage_id ? "rotate-180" : ""
            }`}
          />
        </CardHeader>

        {openStage === stage.stage_id && (
          <CardContent className="space-y-3">
            {stage.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks for this stage.</p>
            ) : (
              stage.tasks.map((task: any) => (
                <div
                  key={task.task_id}
                  className="flex items-center justify-between border p-3 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{task.task_title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due:{" "}
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={task.status} />

                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={task.status}
                      onChange={(e) =>
                        updateTaskStatus(task.task_id, e.target.value)
                      }
                    >
                      <option value="PENDING">Pending</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>
    ))}
  </div>
</TabsContent>


        {/* ---------- TASKS ---------- */}
        <TabsContent value="tasks">
          <DataTable
            columns={taskCols}
            rows={taskRows}
            onRowAction={() => (
              <Button size="sm" variant="outline">
                Approve
              </Button>
            )}
          />
        </TabsContent>

        {/* ---------- DOCUMENTS ---------- */}
        <TabsContent value="documents">
          <DataTable
            columns={docCols}
            rows={docs}
            onRowAction={() => (
              <Button size="sm" variant="outline">
                Review
              </Button>
            )}
          />
        </TabsContent>

        {/* ---------- MESSAGES ---------- */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Threaded Q&A</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-md border p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-primary">
                        {m.senderRole}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm">{m.body}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 border-t pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button onClick={handleSendMessage} size="icon">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- AUDIT LOG ---------- */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-2 text-sm">
              {audits.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div>{a.action}</div>
                  <div className="text-muted-foreground">
                    {a.actorRole} • {new Date(a.at).toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
