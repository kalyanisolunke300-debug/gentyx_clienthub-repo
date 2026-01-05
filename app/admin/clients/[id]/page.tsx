// app/admin/clients/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { DataTable, type Column } from "@/components/data-table";

import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Pencil, Eye, Folder, FileText, FileImage, FileSpreadsheet, File as FileIcon, Reply, Paperclip, X, Smile, CheckCircle2, Layers, Building2, Landmark } from "lucide-react";
import { formatPhone } from "@/lib/formatters";


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
  parentMessageId?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
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


  const docs = docsResponse?.data || [];

  const { data: msgsResponse } = useSWR(["msgs", id], () =>
    fetchMessages({ clientId: id })
  );

  const { data: auditsResponse } = useSWR(["audits", id], () =>
    fetchAuditLogs({ clientId: id })
  );
  //const audits: AuditLog[] = auditsResponse || [];
  const audits: AuditLog[] = Array.isArray(auditsResponse?.data)
    ? auditsResponse.data
    : [];


  const { data: stageData } = useSWR(
    ["clientStages", id],
    () => fetch(`/api/stages/client/get?clientId=${id}`).then((r) => r.json())
  );

  const stages = stageData?.data || [];
  const hasStages = Boolean(client?.stage_id);

  //const hasStages = stages.length > 0;  //new check for stages and new added line
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
  const [replyingTo, setReplyingTo] = useState<ClientMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Attachment states
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 10MB", variant: "destructive" });
        return;
      }
      setAttachmentFile(file);
    }
  };

  // Common emojis for quick selection
  const commonEmojis = [
    "😊", "😂", "❤️", "👍", "🎉", "🔥", "✨", "💯",
    "😍", "🤔", "👏", "🙌", "💪", "🚀", "✅", "⭐",
    "😎", "🥳", "😇", "🤝", "📧", "📞", "💼", "📄"
  ];

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

  // useEffect(() => {
  //   if (msgsResponse?.data) setMessages(msgsResponse.data);
  //   else setMessages([]);
  // }, [msgsResponse]);
  useEffect(() => {
    if (Array.isArray(msgsResponse?.data)) {
      setMessages(
        msgsResponse.data.map((m: any) => ({
          id: m.message_id,
          senderRole: m.sender_role,
          body: m.body,
          parentMessageId: m.parent_message_id,
          attachmentUrl: m.attachment_url,
          attachmentName: m.attachment_name,
          createdAt: m.created_at, // ✅ correct mapping
        }))
      );
    } else {
      setMessages([]);
    }
  }, [msgsResponse]);


  const handleSendMessage = async () => {
    if (!messageText.trim() && !attachmentFile) return;

    setIsUploading(true);

    try {
      let attachmentUrl = null;
      let attachmentName = null;

      // Upload attachment if exists
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("clientId", id);
        formData.append("file", attachmentFile);

        const uploadRes = await fetch("/api/messages/upload-attachment", {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json();

        if (!uploadJson.success) {
          toast({ title: "Failed to upload attachment", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        attachmentUrl = uploadJson.attachmentUrl;
        attachmentName = uploadJson.attachmentName;
      }

      await fetch("/api/messages/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: id,
          sender_role: "ADMIN",
          receiver_role: "CLIENT",
          body: messageText || (attachmentFile ? `Sent an attachment: ${attachmentFile.name}` : ""),
          parent_message_id: replyingTo?.id,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        }),
      });

      setMessageText("");
      setAttachmentFile(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Message sent" });

      mutate(["msgs", id]);
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
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
            className={`h-8 px-3 rounded-full text-xs font-medium border-0 ${STATUS_COLORS[r.status || "Not Started"]
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
      render: (row: any) => {
        let Icon = FileIcon;
        const lowerName = row.name.toLowerCase();
        if (lowerName.endsWith(".pdf")) Icon = FileText;
        else if (lowerName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) Icon = FileImage;
        else if (lowerName.match(/\.(xls|xlsx|csv)$/)) Icon = FileSpreadsheet;

        return (
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md text-primary">
              <Icon className="size-4" />
            </div>
            <span className="font-medium text-gray-700">{row.name}</span>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (row: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
          {row.name.split(".").pop() || "FILE"}
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (row: any) => {
        const bytes = row.size || 0;
        if (bytes === 0) return <span className="text-muted-foreground text-xs">0 B</span>;

        const units = ["B", "KB", "MB", "GB", "TB"];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

        return (
          <span className="font-mono text-xs text-muted-foreground">
            {size} {units[i]}
          </span>
        );
      },
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
              {/* <b>Phone:</b> {formatPhone(client?.primary_contact_phone || "") || "—"} */}
              <b>Phone:</b>{" "}
              {client?.primary_contact_phone
                ? formatPhone(client.primary_contact_phone)
                : "—"}
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
            onClick={() => {
              openDrawer("assignTask", {
                clientId: id,
                stageId: client?.stage_id,
              });
            }}
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
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Client Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Code */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-slate-200 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Code</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-800">{client?.code || "—"}</p>
                </div>

                {/* Created */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">Created</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {client?.created_at
                      ? new Date(client.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {client?.created_at
                      ? new Date(client.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ""}
                  </p>
                </div>

                {/* Last Updated */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-amber-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">Last Updated</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {client?.updated_at
                      ? new Date(client.updated_at).toLocaleDateString()
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {client?.updated_at
                      ? new Date(client.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ""}
                  </p>
                </div>

                {/* Progress */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-emerald-100 rounded-lg p-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Progress</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <p className="text-2xl font-bold text-emerald-600">{progress}</p>
                    <p className="text-sm font-medium text-emerald-600 mb-0.5">%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STAGE TIMELINE */}
          <Card>
            <CardContent className="pt-6">
              {stages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No onboarding stages have been set up yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                  >
                    Create Stages
                  </Button>
                </div>
              ) : (
                (() => {
                  // Calculate completed stages count
                  const sortedStages = stages.sort((a: any, b: any) => a.order_number - b.order_number);
                  const completedCount = sortedStages.filter((stage: any) => {
                    const stageWithSubtasks = subtasksByStage.find(
                      (s: any) => s.client_stage_id === stage.client_stage_id
                    );
                    const allSubtasksCompleted =
                      stageWithSubtasks?.subtasks?.length > 0 &&
                      stageWithSubtasks?.subtasks?.every(
                        (st: any) => st.status === "Completed"
                      );
                    return stage.status === "Completed" || allSubtasksCompleted;
                  }).length;
                  const totalStages = sortedStages.length;
                  const remainingCount = totalStages - completedCount;
                  const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : 0;

                  return (
                    <div className="space-y-4">
                      {/* Overall Progress Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-semibold text-emerald-600">{progressPercent}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPercent}%`,
                            background: 'linear-gradient(90deg, #22c55e 0%, #4ade80 50%, #86efac 100%)',
                          }}
                        />
                      </div>

                      {/* Stage Count Text */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{completedCount} of {totalStages} stages completed</span>
                        <span>{remainingCount} remaining</span>
                      </div>

                      {/* Stage Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {sortedStages.map((stage: any, index: number) => {
                          const stageWithSubtasks = subtasksByStage.find(
                            (s: any) => s.client_stage_id === stage.client_stage_id
                          );
                          const allSubtasksCompleted =
                            stageWithSubtasks?.subtasks?.length > 0 &&
                            stageWithSubtasks?.subtasks?.every(
                              (st: any) => st.status === "Completed"
                            );
                          const isCompleted = stage.status === "Completed" || allSubtasksCompleted;
                          const isInProgress = stage.status === "In Progress";

                          return (
                            <span key={stage.client_stage_id} className="flex items-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted
                                  ? "bg-green-50 border border-green-400 text-green-700"
                                  : isInProgress
                                    ? "bg-blue-50 border border-blue-400 text-blue-700 animate-pulse"
                                    : "bg-gray-100 border border-gray-300 text-gray-600"
                                  }`}
                              >
                                {isCompleted && (
                                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                {stage.stage_name}
                              </span>

                              {index < sortedStages.length - 1 && (
                                <span className="mx-2 text-gray-400">→</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>


          {/* ✅ ASSIGN SERVICE CENTER & CPA */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Assigned Team
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Service Center Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Service Center</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-800">
                        {client?.service_center_name || "Not Assigned"}
                      </span>
                    </div>

                    {client?.service_center_email && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <a href={`mailto:${client.service_center_email}`} className="text-sm text-blue-600 hover:underline">
                          {client.service_center_email}
                        </a>
                      </div>
                    )}

                    {!client?.service_center_name && (
                      <p className="text-xs text-gray-400 italic">No service center assigned yet</p>
                    )}
                  </div>
                </div>

                {/* CPA Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-emerald-100 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">CPA</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-800">
                        {client?.cpa_name || "Not Assigned"}
                      </span>
                    </div>

                    {client?.cpa_email && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <a href={`mailto:${client.cpa_email}`} className="text-sm text-emerald-600 hover:underline">
                          {client.cpa_email}
                        </a>
                      </div>
                    )}

                    {!client?.cpa_name && (
                      <p className="text-xs text-gray-400 italic">No CPA assigned yet</p>
                    )}
                  </div>
                </div>
              </div>
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
                    className={`transition-transform ${openStage === stage.client_stage_id ? "rotate-180" : ""
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

          {/* ---------- STAGE SUB-TASKS CARD ---------- */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Onboarding Tasks</CardTitle>

              {/* ✅ SINGLE UPDATE SUB TASKS BUTTON - Only show when there are tasks */}
              {subtasksByStage.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                >
                  Update Onboarding Tasks
                </Button>
              )}
            </CardHeader>


            <CardContent className="space-y-4">
              {subtasksByStage.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No onboarding tasks have been created yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/stages?clientId=${id}`)}
                  >
                    Add Onboarding Tasks
                  </Button>
                </div>
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
                      className={`transition-transform ${openStage === stage.client_stage_id
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

          {/* ---------- CLIENT TASKS CARD ---------- */}
          <Card className="mt-4">
            {/* <CardHeader>
      <CardTitle>Client Tasks</CardTitle>
    </CardHeader>  */}

            <CardHeader className="flex items-center justify-between">
              <CardTitle>Seperate Assigned Tasks</CardTitle>

              {/* Only show when there are tasks */}
              {taskRows.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    openDrawer("assignTask", {
                      clientId: id,
                      stageId: client?.stage_id,
                    });
                  }}
                >
                  Assign Task
                </Button>
              )}

            </CardHeader>

            <CardContent className="space-y-4">

              {taskRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">No separate tasks have been assigned to this client.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openDrawer("assignTask", {
                        clientId: id,
                        stageId: client?.stage_id,
                      });
                    }}
                  >
                    Assign First Task
                  </Button>
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



        </TabsContent>


        {/* ---------- DOCUMENTS ---------- */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Folder className="size-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>Documents</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manage client files and folders
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* ✅ CREATE FOLDER BUTTON */}
                <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
                  ➕ Create Folder
                </Button>

                {/* ✅ UPLOAD DOCUMENT BUTTON */}
                <Button
                  size="sm"
                  onClick={() =>
                    useUIStore.getState().openDrawer("uploadDoc", {
                      clientId: id,
                      clientName: client?.client_name,
                      folderName: selectedFolder,
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <FileIcon className="size-4" /> Upload Document
                  </span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {showCreateFolder && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200">
                  <div className="bg-white p-6 rounded-xl shadow-xl w-[350px] space-y-4 border">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Folder className="size-5 text-amber-500" /> New Folder
                      </h2>
                    </div>

                    <Input
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                      autoFocus
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
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
                            mutate(["docs", id, selectedFolder]);
                            setShowCreateFolder(false);
                            setNewFolderName("");
                          } else {
                            toast({
                              title: "Folder creation failed",
                              description: data.error || "Unable to create folder",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ FOLDER NAVIGATION / BREADCRUMB UI */}
              {selectedFolder && (
                <div className="mb-6 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pl-0 hover:bg-transparent hover:text-primary"
                    onClick={() => setSelectedFolder(null)}
                  >
                    ← All Documents
                  </Button>
                  <span className="text-muted-foreground">/</span>
                  <span className="font-semibold text-gray-800 flex items-center gap-2">
                    <Folder className="size-4 text-amber-500" />
                    {selectedFolder.split("/").pop()}
                  </span>
                </div>
              )}

              {/* ✅ FOLDERS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {docs
                  .filter((i: any) => i.type === "folder")
                  .map((folder: any) => {
                    const fullPath = selectedFolder
                      ? `${selectedFolder}/${folder.name}`
                      : folder.name;

                    // Special folder names for task completion documents
                    const ASSIGNED_TASK_FOLDER = "Assigned Task Completion Documents";
                    const ONBOARDING_FOLDER = "Onboarding Stage Completion Documents";

                    // Special styling for completion document folders
                    const isAssignedTaskFolder = folder.name === ASSIGNED_TASK_FOLDER ||
                      (selectedFolder && selectedFolder.startsWith(ASSIGNED_TASK_FOLDER));
                    const isOnboardingFolder = folder.name === ONBOARDING_FOLDER ||
                      (selectedFolder && selectedFolder.startsWith(ONBOARDING_FOLDER));

                    // Determine styling based on folder type
                    let folderBgClass = "bg-amber-50/30 hover:bg-amber-50 border-gray-100 hover:border-amber-200";
                    let folderIconClass = "text-amber-400 fill-amber-100 group-hover:fill-amber-200";
                    let FolderBadgeIcon = Folder;

                    if (folder.name === ASSIGNED_TASK_FOLDER) {
                      folderBgClass = "bg-green-50/50 hover:bg-green-50 border-green-200 hover:border-green-300";
                      folderIconClass = "text-green-500 fill-green-100 group-hover:fill-green-200";
                      FolderBadgeIcon = CheckCircle2;
                    } else if (folder.name === ONBOARDING_FOLDER) {
                      folderBgClass = "bg-blue-50/50 hover:bg-blue-50 border-blue-200 hover:border-blue-300";
                      folderIconClass = "text-blue-500 fill-blue-100 group-hover:fill-blue-200";
                      FolderBadgeIcon = Layers;
                    } else if (isAssignedTaskFolder) {
                      folderBgClass = "bg-green-50/30 hover:bg-green-50 border-green-100 hover:border-green-200";
                      folderIconClass = "text-green-400 fill-green-100 group-hover:fill-green-200";
                    } else if (isOnboardingFolder) {
                      folderBgClass = "bg-blue-50/30 hover:bg-blue-50 border-blue-100 hover:border-blue-200";
                      folderIconClass = "text-blue-400 fill-blue-100 group-hover:fill-blue-200";
                    }

                    return (
                      <div
                        key={folder.name}
                        onClick={() => setSelectedFolder(fullPath)}
                        className={`group relative flex flex-col items-center justify-center p-6 border rounded-xl 
                          ${folderBgClass}
                          cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md`}
                      >
                        {/* Show special icon or folder icon */}
                        {folder.name === ASSIGNED_TASK_FOLDER || folder.name === ONBOARDING_FOLDER ? (
                          <div className="relative mb-3">
                            <Folder className={`w-12 h-12 ${folderIconClass} transition-colors`} />
                            <div className={`absolute -top-1 -right-1 p-1 rounded-full ${folder.name === ASSIGNED_TASK_FOLDER ? 'bg-green-500' : 'bg-blue-500'}`}>
                              <FolderBadgeIcon className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <Folder className={`w-12 h-12 ${folderIconClass} mb-3 transition-colors`} />
                        )}
                        <span className="text-sm font-medium text-gray-700 text-center truncate w-full px-2">
                          {folder.name}
                        </span>

                        {/* Subtitle for special folders */}
                        {folder.name === ASSIGNED_TASK_FOLDER && (
                          <span className="text-xs text-green-600 mt-1">Task Completions</span>
                        )}
                        {folder.name === ONBOARDING_FOLDER && (
                          <span className="text-xs text-blue-600 mt-1">Stage Completions</span>
                        )}

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
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 text-gray-400 hover:text-red-600 hover:bg-red-50 
                            opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-red-100"
                          title="Delete folder"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* ✅ FILES TABLE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Files ({docs.filter((i: any) => i.type === "file").length})
                  </h3>
                </div>

                {docs.filter((i: any) => i.type === "file").length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <FileIcon className="size-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">No files in this folder</p>
                      <p className="text-sm text-gray-400">Upload a document to get started</p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <DataTable
                      columns={docCols}
                      rows={docs.filter((i: any) => i.type === "file")}
                    />
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>



        {/* ---------- MESSAGES ---------- */}
        <TabsContent value="messages">
          <div className="space-y-6">
            {/* Chat with Client */}
            <FlexibleChat
              clientId={id}
              clientName={client?.client_name ?? undefined}
              currentUserRole="ADMIN"
              recipients={[
                { role: "CLIENT", label: client?.client_name || "Client", color: "bg-blue-500" },
              ]}
              height="500px"
            />

            {/* Links to Service Center and CPA Chat */}
            <Card>
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <p className="text-sm text-muted-foreground">Need to message the assigned team?</p>
                  <div className="flex items-center gap-3">
                    {client?.service_center_id ? (
                      <a
                        href={`/admin/messages?tab=service-centers&scId=${client.service_center_id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        <Building2 className="size-4" />
                        Chat with {client?.service_center_name || "Service Center"}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                        <Building2 className="size-4" />
                        No Service Center Assigned
                      </span>
                    )}
                    {client?.cpa_id ? (
                      <a
                        href={`/admin/messages?tab=cpas&cpaId=${client.cpa_id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                      >
                        <Landmark className="size-4" />
                        Chat with {client?.cpa_name || "CPA"}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                        <Landmark className="size-4" />
                        No CPA Assigned
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------- AUDIT LOG ---------- */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete history of all actions performed on this client
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {audits.length} {audits.length === 1 ? "entry" : "entries"}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <FileText className="size-8 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700">No activity yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Actions like task updates, document uploads, and messages will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {audits.map((a) => {
                    // Determine icon and color based on action
                    const getActionStyle = (action: string) => {
                      if (action.includes("Task created")) return { icon: "📋", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" };
                      if (action.includes("Task") && action.includes("completed")) return { icon: "✅", bg: "bg-green-50", border: "border-green-200", text: "text-green-700" };
                      if (action.includes("Task updated")) return { icon: "✏️", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
                      if (action.includes("Task deleted")) return { icon: "🗑️", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" };
                      if (action.includes("Stage")) return { icon: "🎯", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" };
                      if (action.includes("Document") || action.includes("Folder")) return { icon: "📁", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
                      if (action.includes("Message")) return { icon: "💬", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" };
                      if (action.includes("Service Center") || action.includes("CPA")) return { icon: "👤", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" };
                      if (action.includes("Client")) return { icon: "🏢", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" };
                      return { icon: "📝", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" };
                    };

                    const style = getActionStyle(a.action);

                    const date = new Date(a.at);
                    const dateStr = date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const timeStr = date.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4"
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-full ${style.bg} ${style.border} border flex items-center justify-center text-lg shrink-0`}>
                            {style.icon}
                          </div>

                          {/* Content */}
                          <div>
                            <p className={`font-medium ${style.text}`}>
                              {a.action}
                            </p>
                            {a.actorRole && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mt-1">
                                {a.actorRole}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Date/Time */}
                        <div className="text-right text-xs whitespace-nowrap">
                          <div className="font-medium text-slate-600">{dateStr}</div>
                          <div className="text-slate-400">{timeStr}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
