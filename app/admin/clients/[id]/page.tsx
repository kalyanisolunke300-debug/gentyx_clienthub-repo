// app/admin/clients/[id]/page.tsx
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
  fetchClientTasksSimple,
  fetchClientDocuments   // ✅ ADD THIS
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
import { useRouter } from "next/navigation";


// ------------------ TYPES ------------------
type ClientTask = {
  task_id: number;
  task_title: string;
  assigned_to_role: string;
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

type StageItem = {
  client_stage_id: number;
  stage_name: string;
  order_number: number;
  status: string;
};


export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const openDrawer = useUIStore((s) => s.openDrawer);
  const { toast } = useToast();
  const router = useRouter();

  // ----------------- FETCHING ------------------
  const { data: client } = useSWR(["client", id], () => fetchClient(id));


  const { data: clientTasksResponse } = useSWR(
    ["clientTasksSimple", id],
    () => fetchClientTasksSimple(id)
  );


const taskRows: ClientTask[] = clientTasksResponse?.data || [];

// ----------------- TASK PAGINATION ------------------
const [taskPage, setTaskPage] = useState(1);
const [taskPageSize, setTaskPageSize] = useState(5);

const totalTasks = taskRows.length;
const totalTaskPages = Math.ceil(totalTasks / taskPageSize);

const paginatedTasks = taskRows.slice(
  (taskPage - 1) * taskPageSize,
  taskPage * taskPageSize
);


  const { data: docsResponse } = useSWR(["docs", id], () =>
  fetchClientDocuments(id)
  );

const docs =
  docsResponse?.data?.map((doc: any) => ({
    name: doc.name,
    type: doc.type,
    size: doc.size,
    path: doc.path,
    url: doc.url,   // ✅ VERY IMPORTANT
  })) || [];

  const { data: msgsResponse } = useSWR(["msgs", id], () =>
    fetchMessages({ clientId: id })
  );

  const { data: auditsResponse } = useSWR(["audits", id], () =>
    fetchAuditLogs({ clientId: id })
  );
  const audits: AuditLog[] = auditsResponse || [];

  const { data: stageData } = useSWR(
    ["clientStages", id],
    () => fetch(`/api/stages/client/get?clientId=${id}`).then((r) => r.json())
  );

  const stages = stageData?.data || [];
  const subtasksFlat = stageData?.subtasks || [];

  const subtasksByStage = stages.map((stage: any) => ({
    ...stage,
    subtasks: subtasksFlat.filter(
      (s: any) => s.client_stage_id === stage.client_stage_id
    ),
  }));

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
      // mutateStages(); // refresh stages
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

  { key: "assigned_to_role", header: "Assigned User" },

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



  const docCols: Column<any>[] = [
    { key: "name", header: "Name" },
    { key: "type", header: "Type" },
    {
      key: "size",
      header: "Size",
      render: (r) => `${(r.size / 1024).toFixed(1)} KB`,
    },
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
            onClick={() => router.push(`/admin/stages?clientId=${id}`)}
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
          {/* <TabsTrigger value="Stages">Stages & Associated Tasks</TabsTrigger> */}
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
 <TabsContent value="overview" className="grid gap-4">
  {/* CLIENT SUMMARY */}
  <Card>
    <CardHeader><CardTitle>Client Summary</CardTitle></CardHeader>
    <CardContent className="grid gap-2 text-sm">
      <div>Client ID: {client?.client_id}</div>
      <div>Code: {client?.code}</div>
      <div>
        Created: {client?.created_at ? new Date(client.created_at).toLocaleString() : "-"}
      </div>
      <div>
        Updated: {client?.updated_at ? new Date(client.updated_at).toLocaleString() : "-"}
      </div>
      <div>Stage: {stageName}</div>
      <div>Progress: {progress}%</div>
    </CardContent>
  </Card>

  {/* STAGE TIMELINE */}
  <Card>
    <CardHeader><CardTitle>Stage Timeline</CardTitle></CardHeader>
    <CardContent className="text-sm">
      {stages.length === 0 ? (
        <div className="text-muted-foreground">No stages found for this client.</div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {stages
            .sort((a: any, b: any) => a.order_number - b.order_number)
            .map((stage: any, index: number) => (

              <span key={stage.client_stage_id} className="flex items-center">
                <span
                  className={`px-2 py-1 rounded-md border text-xs ${
                    stage.status === "In Progress"
                      ? "bg-blue-100 border-blue-300 text-blue-800"
                      : stage.status === "Completed"
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-gray-100 border-gray-300 text-gray-700"
                  }`}
                >
                  {stage.stage_name}
                </span>

                {index < stages.length - 1 && (
                  <span className="mx-2 text-muted-foreground">→</span>
                )}
              </span>
            ))}
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
        {/* ---------- STAGES & TASKS ---------- */}



        <TabsContent value="Stages">
  <div className="grid gap-4">
    {stages.map((stage: any) => (
      <Card key={stage.client_stage_id} className="border rounded-lg">
        <CardHeader
          onClick={() => toggleStage(stage.client_stage_id)}
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
              openStage === stage.client_stage_id ? "rotate-180" : ""
            }`}
          />
        </CardHeader>

        {openStage === stage.client_stage_id && (
          <CardContent className="space-y-3">
        {(stage.subtasks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No subtasks for this stage.</p>
        ) : (
          (stage.subtasks ?? []).map((st: any) => (
            <div
              key={st.subtask_id}
              className="flex items-center justify-between border p-2 rounded"
            >
              <div>
                <p className="font-medium">{st.subtask_title}</p>
                <p className="text-xs text-muted-foreground">
                  Order: {st.order_number ?? "-"}
                </p>
              </div>

              <StatusPill status={st.status} />
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

  {/* ---------- CLIENT TASKS CARD ---------- */}
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>Client Tasks</CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">

      {taskRows.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
          No tasks available for this client.
        </div>
      ) : (
        <>
          {/* ---------- TABLE ---------- */}
          <DataTable
            columns={taskCols}
            rows={paginatedTasks}
            onRowAction={() => (
              <Button size="sm" variant="outline">
                Approve
              </Button>
            )}
          />

          {/* ---------- PAGINATION UI ---------- */}
          <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">

            {/* Items per page */}
            <div className="flex items-center gap-2">
              <span>Items per page:</span>
              <select
                className="border rounded px-2 py-1"
                value={taskPageSize}
                onChange={(e) => {
                  setTaskPageSize(Number(e.target.value));
                  setTaskPage(1);
                }}
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Page info */}
            <div>
              {`${(taskPage - 1) * taskPageSize + 1}–${Math.min(
                taskPage * taskPageSize,
                totalTasks
              )} of ${totalTasks} items`}
            </div>

            {/* Prev / Next buttons */}
            <div className="flex items-center gap-2">
              <span>Page {taskPage} of {totalTaskPages}</span>

              <Button
                variant="outline"
                size="sm"
                disabled={taskPage <= 1}
                onClick={() => setTaskPage(taskPage - 1)}
              >
                Prev
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={taskPage >= totalTaskPages}
                onClick={() => setTaskPage(taskPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

    </CardContent>
  </Card>

  {/* ---------- STAGE SUB-TASKS CARD ---------- */}
  <Card className="mt-6">
    <CardHeader>
      <CardTitle>Stage Sub-Tasks</CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">
      {subtasksByStage.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stage subtasks found.
        </p>
      )}

      {subtasksByStage.map((stage: any) => (
        <div
          key={stage.client_stage_id}
          className="border rounded-lg"
        >
          {/* Stage Row */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer"
            onClick={() =>
              setOpenStage((prev) =>
                prev === stage.client_stage_id
                  ? null
                  : stage.client_stage_id
              )
            }
          >
            <div>
              <p className="font-semibold">{stage.stage_name}</p>
              <p className="text-xs text-muted-foreground">
                Status: {stage.status}
              </p>
            </div>

            <ChevronDown
              className={`transition-transform ${
                openStage === stage.client_stage_id
                  ? "rotate-180"
                  : ""
              }`}
            />
          </div>

          {/* Subtasks */}
          {openStage === stage.client_stage_id && (
            <div className="border-t p-3 space-y-2">
              {stage.subtasks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No subtasks in this stage.
                </p>
              )}

              {stage.subtasks.map((st: any) => (
                <div
                  key={st.subtask_id}
                  className="flex items-center justify-between border p-2 rounded"
                >
                  <div>
                    <p className="font-medium">
                      {st.subtask_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Order: {st.order_number ?? "-"}
                    </p>
                  </div>

                  <StatusPill status={st.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </CardContent>
  </Card>

</TabsContent>


        {/* ---------- DOCUMENTS ---------- */}
        <TabsContent value="documents">
        {docs.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No documents available for this client.
          </div>
        ) : (
          <DataTable
            columns={docCols}
            rows={docs}
            onRowAction={(row) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!row.url) {
                    alert("URL missing");
                    return;
                  }
                  window.open(row.url, "_blank");
                }}
              >
                Preview
              </Button>
            )}

          />
        )}
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
