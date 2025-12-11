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
  fetchClientDocuments,
  fetchServiceCenters,   // ✅ ADD
  fetchCPAs              // ✅ ADD
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2 } from "lucide-react";
import { Pencil, Eye } from "lucide-react";



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
  // ✅ Service Center & CPA Assignment State
  const [serviceCenters, setServiceCenters] = useState<any[]>([]);
  const [cpas, setCpas] = useState<any[]>([]);

  const [selectedServiceCenter, setSelectedServiceCenter] = useState<number | null>(null);
  const [selectedCPA, setSelectedCPA] = useState<number | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

 
  useEffect(() => {
    fetchServiceCenters().then((res) => {
      if (res?.success) setServiceCenters(res.data || []);
    });

    fetchCPAs().then((res) => {
      if (res?.success) setCpas(res.data || []);
    });
  }, []);


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


// const { data: docsResponse } = useSWR(
//   ["docs", id, selectedFolder],
//   () =>
//     selectedFolder
//       ? fetch(`/api/documents/get?clientId=${id}&folder=${selectedFolder}`).then(r => r.json())
//       : fetch(`/api/documents/get?clientId=${id}&mode=folders`).then(r => r.json())
// );

const { data: docsResponse } = useSWR(
  ["docs", id, selectedFolder],
  () =>
    selectedFolder
      ? fetch(`/api/documents/get-by-client?id=${id}&folder=${selectedFolder}`).then(r => r.json())
      : fetch(`/api/documents/get-by-client?id=${id}`).then(r => r.json())
);


// const docs = selectedFolder
//   ? docsResponse?.files || []
//   : docsResponse?.folders || [];
// API always returns { success, data: [...] }
// selectedFolder = show files, no selectedFolder = show folders

const docs = docsResponse?.data || [];



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
const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed"] as const;

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "bg-amber-100 text-amber-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Completed": "bg-green-100 text-green-700",
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
  render: (r) => (
    <Select
      value={r.status || "Not Started"}
      onValueChange={async (value) => {
        try {
          await fetch("/api/tasks/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: r.task_id,
              status: value, // ✅ must match SQL CHECK constraint
            }),
          });

          mutate(["clientTasksSimple", id]); // ✅ refresh client task tab only
          toast({ title: "Task status updated" });
        } catch {
          toast({
            title: "Failed to update status",
            variant: "destructive",
          });
        }
      }}
    >
      <SelectTrigger
        className={`h-8 px-3 rounded-full text-xs font-medium border-0 ${
          STATUS_COLORS[r.status || "Not Started"]
        }`}
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
},

  // ✅ ACTIONS MUST ALWAYS BE LAST
 {
  key: "actions",
  header: "Actions",
  className: "text-center", // ✅ centers the HEADER
  render: (r) => (
    <div className="flex items-center justify-center gap-2 w-full">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          openDrawer("assignTask", {
            clientId: id,
            taskId: r.task_id,
          })
        }
      >
        Edit
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={async () => {
          if (!confirm("Delete this task?")) return;

          const res = await fetch("/api/tasks/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: r.task_id }),
          });

          if (res.ok) {
            toast({ title: "Task deleted" });
            mutate(["clientTasksSimple", id]);
          } else {
            toast({
              title: "Failed to delete task",
              variant: "destructive",
            });
          }
        }}
      >
        Delete
      </Button>
    </div>
  ),
}
];


  // const docCols: Column<any>[] = [
  //   { key: "name", header: "Name" },
  //   { key: "type", header: "Type" },
  //   {
  //     key: "size",
  //     header: "Size",
  //     render: (r) => `${(r.size / 1024).toFixed(1)} KB`,
  //   },
  // ];
//   async function handleDeleteDocument(doc: any) {
//   if (!confirm(`Delete document "${doc.name}"?`)) return;

//   const res = await fetch("/api/documents/delete", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       clientId: id,
//       fileName: doc.name,
//       fileType: doc.type,       // IMG, PDF, XLSX...
//       // documentId: doc.id,       // DB ID
//     }),
//   });

//   if (!res.ok) {
//     alert("Failed to delete");
//     return;
//   }

//   mutate(["docs", id]); // Refresh table
// }


const docCols: Column<any>[] = [
  {
    key: "name",
    header: "Name",
  },
  {
    key: "type",
    header: "Type",
  },
  {
    key: "size",
    header: "Size",
  },
  {
    key: "actions",
    header: "Actions",
    render: (row: any) => (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.open(row.url, "_blank")}
        >
          Preview
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDeleteDocument(row)}
        >
          <Trash2 className="w-4 h-4 text-white" />
        </Button>
      </div>
    ),
  },
];

async function handleDeleteDocument(doc: any) {
  if (!confirm(`Delete document "${doc.name}"?`)) return;

  console.log("🔥 Deleting document:", doc);

  // The backend expects: fullPath = "client-2/folder/file.png"
  const res = await fetch("/api/documents/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: id,
      fullPath: doc.fullPath, // ✅ VERY IMPORTANT
    }),
  });

  const json = await res.json();
  console.log("DELETE RESPONSE:", json);

  if (!json.success) {
    alert("Failed to delete document.");
    return;
  }

  mutate(["docs", id, null]); // refresh root
  mutate(["docs", id, selectedFolder]); // refresh folder

  alert("Document deleted successfully!");
}




  // ----------------- CLIENT META ------------------
  const clientStatus = client?.status ?? "Not Started";
  const stageName = client?.stage_name ?? "—";
  const progress = client?.progress ?? 0;
  
  useEffect(() => {
    if (client?.service_center_id) {
      setSelectedServiceCenter(client.service_center_id);
    }

    if (client?.cpa_id) {
      setSelectedCPA(client.cpa_id);
    }
  }, [client]);
  
  async function handleSaveAssignment() {
  try {
    const res = await fetch("/api/clients/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: Number(id),
        service_center_id: selectedServiceCenter,
        cpa_id: selectedCPA,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || "Update failed");
    }

    toast({ title: "Service Center & CPA updated successfully" });

    // ✅ Refresh client data
    mutate(["client", id]);

  } catch (err) {
    console.error("SAVE ASSIGNMENT ERROR:", err);
    toast({
      title: "Failed to update assignment",
      variant: "destructive",
    });
  }
}


  return (
    <div className="grid gap-4">
      {/* ---------- HEADER ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {client?.client_name ?? "Client"}
          </h1>

          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-6">
            <span>
              <b>Phone:</b> {client?.primary_contact_phone || "—"}
            </span>

            <span>
              <b>Email:</b> {client?.primary_contact_email || "—"}
            </span>
          </div>

        </div>

        <div className="flex items-center gap-2">
          <ProgressRing
            value={progress}
            completedStages={client?.completed_stages}
            totalStages={client?.total_stages}
          />

          
        <Button
          variant="outline"
          onClick={() => router.push(`/admin/stages?clientId=${id}`)}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Stage
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
          variant="outline"
          onClick={() => router.push(`/admin/clients/edit/${id}`)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Client
        </Button>




          {/* <Button
            variant="secondary"
            onClick={() => openDrawer("uploadDoc", { clientId: id })}
          >
            Upload Doc
          </Button> */}
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
      {/* <div>Client ID: {client?.client_id}</div> */}
      <div><b>Code:</b> {client?.code}</div>

      <div>
        <b>Created:</b>{" "}
        {client?.created_at
          ? new Date(client.created_at).toLocaleString()
          : "-"}
      </div>

      <div>
        <b>Last Updated:</b>{" "}
        {client?.updated_at
          ? new Date(client.updated_at).toLocaleString()
          : "-"}
      </div>

      <div><b>Progress:</b> {progress}%</div>

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
            .map((stage: any, index: number) => {

              // ✅ NEW RULE:
              // GREEN if:
              // 1) Stage status is Completed
              // 2) OR all subtasks under this stage are Completed

              const stageWithSubtasks = subtasksByStage.find(
                (s: any) => s.client_stage_id === stage.client_stage_id
              );

              const allSubtasksCompleted =
                stageWithSubtasks?.subtasks?.length > 0 &&
                stageWithSubtasks.subtasks.every(
                  (st: any) => st.status === "Completed"
                );

              const isCompleted =
                stage.status === "Completed" || allSubtasksCompleted;

              return (
                <span key={stage.client_stage_id} className="flex items-center">
                  <span
                    className={`px-2 py-1 rounded-md border text-xs ${
                      isCompleted
                        ? "bg-green-100 border-green-300 text-green-800"
                        : stage.status === "In Progress"
                        ? "bg-blue-100 border-blue-300 text-blue-800"
                        : "bg-red-100 border-red-300 text-red-800"
                    }`}
                  >
                    {stage.stage_name}
                  </span>

                  {index < stages.length - 1 && (
                    <span className="mx-2 text-muted-foreground">→</span>
                  )}
                </span>
              );
            })}

        </div>
      )}
    </CardContent>
  </Card>

  {/* ✅ ASSIGN SERVICE CENTER & CPA */}
  <Card>
    <CardHeader>
      <CardTitle>Assign Service Center & CPA</CardTitle>
    </CardHeader>

    <CardContent className="grid gap-4 text-sm">

      <div className="grid gap-2">
        <div><b>Current Service Center:</b> {client?.service_center_name || "Not Assigned"}</div>
        <div><b>Current CPA:</b> {client?.cpa_name || "Not Assigned"}</div>
      </div>
{/* 
      <div className="grid grid-cols-2 gap-4">

        <div className="grid gap-1">
          <label className="text-xs font-medium">Service Center</label>
          <select
            className="border rounded px-2 py-2"
            value={selectedServiceCenter ?? ""}
            onChange={(e) => setSelectedServiceCenter(Number(e.target.value))}
          >
            <option value="">Select</option>
            {serviceCenters.map((sc) => (
              <option key={sc.service_center_id} value={sc.service_center_id}>
                {sc.center_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-medium">CPA</label>
          <select
            className="border rounded px-2 py-2"
            value={selectedCPA ?? ""}
            onChange={(e) => setSelectedCPA(Number(e.target.value))}
          >
            <option value="">Select</option>
            {cpas.map((cp) => (
              <option key={cp.cpa_id} value={cp.cpa_id}>
                {cp.cpa_name}
              </option>
            ))}
          </select>
        </div>

      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAssignment}>
          Save Assignment
        </Button>
      </div> */}

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
{/* ---------- TOP ACTION BAR FOR TASKS ---------- */}
<div className="flex justify-end mb-4">
  {/* <Button
    onClick={() =>
      openDrawer("assignTask", {
        clientId: id,
        stageId: client?.stage_id,
      })
    }
  >
    Assign Task
  </Button> */}
</div>

  {/* ---------- CLIENT TASKS CARD ---------- */}
  <Card className="mt-4">
    {/* <CardHeader>
      <CardTitle>Client Tasks</CardTitle>
    </CardHeader>  */}
  <CardHeader className="flex items-center justify-between">
    <CardTitle>Seperate Assigned Tasks</CardTitle>

    <Button
      size="sm"
      onClick={() =>
        openDrawer("assignTask", {
          clientId: id,
          stageId: client?.stage_id,
        })
      }
    >
      Assign Task
    </Button>
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
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>Onboarding Tasks</CardTitle>

      {/* ✅ SINGLE UPDATE SUB TASKS BUTTON */}
      <Button
        size="sm"
        onClick={() => router.push(`/admin/stages?clientId=${id}`)}
      >
        Update Onboarding Tasks
      </Button>
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
      <div
        className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-muted transition"
        onClick={() =>
          setOpenStage((prev) =>
            prev === stage.client_stage_id
              ? null
              : stage.client_stage_id
          )
        }
      >
        {/* LEFT SIDE */}
        <div>
          <p className="font-semibold">{stage.stage_name}</p>
          <p className="text-xs text-muted-foreground">
            Status: {stage.status}
          </p>
        </div>

        {/* RIGHT SIDE (ARROW ONLY – NO CLICK HANDLER HERE) */}
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

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {/* <span>Order: {st.order_number ?? "-"}</span> */}

                    <span>
                      Due : {" "}
                      {st.due_date
                        ? new Date(st.due_date).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
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
  <div className="border rounded-md p-6 grid gap-4">

    {/* Always show Upload Document button */}
<div className="flex justify-end gap-2">

  {/* ✅ CREATE FOLDER BUTTON */}
  <Button
    variant="outline"
    onClick={() => setShowCreateFolder(true)}
  >
    ➕ Create Folder
  </Button>

  {/* ✅ UPLOAD DOCUMENT BUTTON */}
<Button
  onClick={() =>
    useUIStore.getState().openDrawer("uploadDoc", { 
      clientId: id,
      clientName: client?.client_name,
      folderName: selectedFolder, // ✅ THIS WAS MISSING
    })
  }
  // disabled={!selectedFolder} // ✅ prevents upload without folder
>
  Upload Document
</Button>


</div>

{showCreateFolder && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg w-[350px] space-y-4">

      <h2 className="text-lg font-semibold">Create Folder</h2>

      <Input
        placeholder="Enter folder name"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setShowCreateFolder(false);
            setNewFolderName("");
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={async () => {
            if (!newFolderName.trim()) return;

            const res = await fetch("/api/documents/create-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: id,
                folderName: newFolderName,
                parentFolder: selectedFolder,
              }),
            });

            const data = await res.json();

            if (data.success) {
              toast({ title: "Folder created successfully" });
              mutate(["docs", id, null]); // ✅ forces folder view refresh
              setShowCreateFolder(false);
              setNewFolderName("");
            } else {
              toast({ title: "Folder creation failed", variant: "destructive" });
            }
          }}
        >
          Create
        </Button>
      </div>

    </div>
  </div>
)}


{/* ✅ ROOT VIEW: FOLDERS + ROOT FILES, ELSE FOLDER CONTENTS */}
{!selectedFolder ? (
  <>
    {docs.length === 0 ? (
      <div className="w-full text-center py-10 text-gray-500 text-sm">
        No documents available for this client.
      </div>
    ) : (
      <>
        {/* ---------- ROOT FOLDERS GRID ---------- */}
        {/* {docs.filter((i: any) => i.type === "folder").length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {docs
              .filter((i: any) => i.type === "folder")
              .map((folder: any) => (
                <div
                  key={folder.name}
                  onClick={() => setSelectedFolder(folder.name)} // root → go into that folder
                  className="cursor-pointer border rounded p-4 text-center hover:bg-muted transition"
                >
                  📁 {folder.name}
                </div>
              ))}
          </div>
        )} */}
<div className="grid grid-cols-4 gap-4 mb-6">
  {docs
    .filter((i: any) => i.type === "folder")
    .map((folder: any) => (
      <div
        key={folder.name}
        className="relative border rounded p-4 hover:bg-muted transition cursor-pointer group"
        onClick={() => setSelectedFolder(folder.name)}
      >
        📁 {folder.name}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`Delete folder "${folder.name}"?`)) return;

            fetch("/api/documents/delete-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clientId: id,
                folderPath: folder.name,
              }),
            }).then(() => mutate(["docs", id, null]));
          }}
          className="absolute top-2 right-2 bg-red-600 p-2 rounded-md hover:bg-red-700 transition"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>
      </div>
    ))}
</div>



        {/* ---------- ROOT FILES TABLE ---------- */}
        {docs.filter((i: any) => i.type === "file").length > 0 && (
          <DataTable
            columns={docCols}
            rows={docs.filter((i: any) => i.type === "file")}
          />
        )}
      </>
    )}
  </>
) : (
  <>
    {/* ✅ BACK TO ALL DOCUMENTS BUTTON */}
    <Button
      variant="outline"
      className="mb-4"
      onClick={() => setSelectedFolder(null)}
    >
      ← See All Documents
    </Button>

    {/* ✅ SHOW SUBFOLDERS INSIDE CURRENT FOLDER */}
    {/* {docs.filter((i: any) => i.type === "folder").length > 0 && (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {docs
          .filter((i: any) => i.type === "folder")
          .map((folder: any) => (
            <div
              key={folder.name}
              onClick={() =>
                setSelectedFolder(
                  selectedFolder ? `${selectedFolder}/${folder.name}` : folder.name
                )
              }
              className="cursor-pointer border rounded p-4 text-center hover:bg-muted transition"
            >
              📁 {folder.name}
            </div>
          ))}
      </div>
    )} */}

<div className="grid grid-cols-4 gap-4 mb-6">
  {docs
    .filter((i: any) => i.type === "folder")
    .map((folder: any) => {
      const fullPath = selectedFolder
        ? `${selectedFolder}/${folder.name}`
        : folder.name;

      return (
        <div
          key={folder.name}
          className="relative border rounded p-4 hover:bg-muted transition cursor-pointer group"
          onClick={() => setSelectedFolder(fullPath)}
        >
          📁 {folder.name}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm(`Delete folder "${folder.name}"?`)) return;

              fetch("/api/documents/delete-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId: id,
                  folderPath: fullPath,
                }),
              }).then(() => mutate(["docs", id, selectedFolder]));
            }}
            className="absolute top-2 right-2 bg-red-600 p-2 rounded-md hover:bg-red-700 transition"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      );
    })}
</div>


    {/* ✅ FILE TABLE INSIDE SELECTED FOLDER */}
    {docs.filter((i: any) => i.type === "file").length === 0 ? (
      <div className="text-center py-10 text-gray-500 text-sm">
        No files in this folder.
      </div>
    ) : (
      <DataTable
        columns={docCols}
        rows={docs.filter((i: any) => i.type === "file")}
      />
    )}
  </>
)}


      </div>
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
