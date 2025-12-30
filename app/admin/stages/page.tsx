"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";

// DnD Libraries
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

// Local Components
import { SortableStageItem } from "./sortable-stage-item";
import { fetchStagesList, fetchClients, fetchEmailTemplates } from "@/lib/api";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
} from "@/components/ui/command";

import { ProgressRing } from "@/components/widgets/progress-ring";
import { useToast } from "@/hooks/use-toast";

// Icons
import {
  Plus, ChevronsUpDown, Search, User,
  Settings, Copy, Save, XCircle, LayoutTemplate,
  Trello, CheckCircle2, Mail, Send, FileText, Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- TYPES ---
type SubTask = {
  title: string;
  status: string;
  due_date?: string | null;
};

type Stage = {
  id: string;
  name: string;
  isRequired: boolean;
  order: number;
  status: string;
  start_date?: string | null;
  completed_at?: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// Helper: Get the latest completed subtask with a due_date from a stage
const getLatestCompletedSubtaskDate = (tasks: SubTask[]): string | null => {
  const completedWithDate = tasks.filter(
    (t) => (t.status || "").toLowerCase() === "completed" && t.due_date
  );

  if (completedWithDate.length === 0) return null;

  completedWithDate.sort((a, b) => {
    const dateA = new Date(a.due_date!).getTime();
    const dateB = new Date(b.due_date!).getTime();
    return dateB - dateA;
  });

  return completedWithDate[0].due_date || null;
};


export default function StagesPage() {
  const { data } = useSWR(["stages"], () => fetchStagesList());
  const { data: clients } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );
  const { data: emailTemplates } = useSWR(["emailTemplates"], () => fetchEmailTemplates());

  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("clientId");
  const router = useRouter();
  const { toast } = useToast();

  // --- STATE ---
  const [stages, setStages] = useState<Stage[]>([]);
  const [subTasks, setSubTasks] = useState<Record<string, SubTask[]>>({});

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isRequired: false });

  // UI States
  const [clientOpen, setClientOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [templatePreviewStages, setTemplatePreviewStages] = useState<any[]>([]);

  // Email Dialog States
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<string>("");
  const [emailMode, setEmailMode] = useState<"template" | "manual">("template");
  const [manualEmailData, setManualEmailData] = useState({ subject: "", body: "" });
  const [templateEmailData, setTemplateEmailData] = useState({ subject: "", body: "" });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Get selected client details
  const selectedClient = clients?.data?.find(
    (c: any) => c.client_id.toString() === selectedClientId
  );

  // Update Subtask Logic
  const updateSubtask = (stageId: string, index: number, updates: Partial<SubTask>) => {
    setSubTasks((prev) => {
      const updatedSubtasksMap = { ...prev };
      const currentStageSubtasks = [...(updatedSubtasksMap[stageId] || [])];
      currentStageSubtasks[index] = { ...currentStageSubtasks[index], ...updates };
      updatedSubtasksMap[stageId] = currentStageSubtasks;
      return updatedSubtasksMap;
    });
  };

  // --- EFFECTS ---

  // Load Templates
  useEffect(() => {
    if (!showTemplateSelector) return;
    (async () => {
      const res = await fetch("/api/default-stage-templates/list");
      const json = await res.json();
      if (json.success) setDefaultTemplates(json.data);
    })();
  }, [showTemplateSelector]);

  // Compute Stage Status
  const computeStageStatus = (tasks: SubTask[] = []) => {
    if (tasks.length === 0) return "Not Started";
    const allCompleted = tasks.every(t => (t.status || "").toLowerCase() === "completed");
    if (allCompleted) return "Completed";
    const anyStarted = tasks.some(t => {
      const s = (t.status || "").toLowerCase();
      return s === "in progress" || s === "completed";
    });
    if (anyStarted) return "In Progress";
    return "Not Started";
  };

  // Master Effect: Cascade Calculations
  useEffect(() => {
    if (stages.length === 0) return;

    setStages((prevStages) => {
      const sortedStages = [...prevStages].sort((a, b) => a.order - b.order);
      let hasChanges = false;

      // PASS 1: Status & Self-Correction
      const stagesWithStatus = sortedStages.map((s) => {
        const tasks = subTasks[s.id] || [];
        const newStatus = computeStageStatus(tasks);
        const nowCompleted = newStatus === "Completed";
        const newStartDate = s.start_date ?? (newStatus === "In Progress" ? todayISO() : null);
        const newCompletedAt = nowCompleted ? (s.completed_at ?? todayISO()) : null;

        if (
          s.status !== newStatus ||
          s.start_date !== newStartDate ||
          s.completed_at !== newCompletedAt
        ) {
          hasChanges = true;
          return { ...s, status: newStatus, start_date: newStartDate, completed_at: newCompletedAt };
        }
        return s;
      });

      // PASS 2: Cascade Start Dates
      const finalStages = stagesWithStatus.map((stage, idx) => {
        if (idx === 0) return stage;
        const prevStage = stagesWithStatus[idx - 1];
        const prevTasks = subTasks[prevStage.id] || [];
        const latestCompletedDate = getLatestCompletedSubtaskDate(prevTasks);

        if (latestCompletedDate) {
          const currentStartDate = stage.start_date ? stage.start_date.substring(0, 10) : null;
          const newStartDate = latestCompletedDate.substring(0, 10);
          if (currentStartDate !== newStartDate) {
            hasChanges = true;
            return { ...stage, start_date: newStartDate };
          }
        }
        return stage;
      });

      return hasChanges ? finalStages : prevStages;
    });
  }, [subTasks, stages.length]);


  // Initial Load from URL
  useEffect(() => {
    if (clientIdFromUrl) setSelectedClientId(clientIdFromUrl);
  }, [clientIdFromUrl]);

  // Fetch Client Stages
  useEffect(() => {
    if (!selectedClientId) return;

    (async () => {
      setShowTemplateSelector(false);
      setSelectedTemplateId("");
      const res = await fetch(`/api/stages/client/get?clientId=${selectedClientId}`);
      const json = await res.json();

      if (json.success && json.data.length > 0) {
        setStages(
          json.data.map((s: any, index: number) => ({
            id: String(s.client_stage_id),
            name: s.stage_name,
            isRequired: s.is_required ?? false,
            order: s.order_number ?? index + 1,
            status: s.status || "Not Started",
            start_date: s.start_date ? String(s.start_date).substring(0, 10) : null,
            completed_at: s.completed_at ? String(s.completed_at).substring(0, 10) : null,
          }))
        );

        const subs: Record<string, any[]> = {};
        json.subtasks.forEach((st: any) => {
          const key = String(st.client_stage_id);
          if (!subs[key]) subs[key] = [];
          subs[key].push({
            title: st.subtask_title,
            status: st.status,
            due_date: st.due_date ? st.due_date.substring(0, 10) : "",
          });
        });
        setSubTasks(subs);
      } else {
        setStages([]);
        setSubTasks({});
        setShowTemplateSelector(true);
      }
    })();
  }, [selectedClientId, data]);


  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, idx) => ({
      ...s,
      order: idx + 1,
    }));
    setStages(reordered);
  }

  // --- ACTION HANDLERS ---
  function handleOpenDialog(stage?: any) {
    if (stage) {
      setEditingId(stage.id);
      setFormData({ name: stage.name, isRequired: stage.isRequired });
      setEditOpen(true);
    } else {
      setEditingId(null);
      setFormData({ name: "", isRequired: false });
      setOpen(true);
    }
  }

  function handleSave() {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Stage name is required", variant: "destructive" });
      return;
    }

    if (editingId) {
      setStages((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, name: formData.name, isRequired: formData.isRequired }
            : s
        )
      );
      toast({ title: "Updated", description: "Stage updated successfully" });
      setEditOpen(false);
    } else {
      const newStage: Stage = {
        id: String(-Date.now()),
        name: formData.name,
        isRequired: formData.isRequired,
        order: stages.length + 1,
        status: "Not Started",
        start_date: null,
        completed_at: null,
      };
      setStages((prev) => [...prev, newStage]);
      toast({ title: "Created", description: "Stage created successfully" });
      setOpen(false);
    }
  }

  function handleDelete(id: string) {
    const updated = stages
      .filter((s) => s.id !== id)
      .map((s, index) => ({ ...s, order: index + 1 }));

    setStages(updated);
    setSubTasks((prev) => {
      const copy = { ...prev };
      delete copy[String(id)];
      return copy;
    });
    toast({ title: "Deleted", description: "Stage deleted successfully" });
  }

  // --- SAVE TO SERVER ---
  async function handleServerSave() {
    // Validate that all subtasks have title and due_date
    for (const stage of stages) {
      const tasks = subTasks[String(stage.id)] || [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (!task.title || task.title.trim() === "") {
          toast({
            title: "Validation Error",
            description: `Stage "${stage.name}": Sub-task ${i + 1} is missing a task name.`,
            variant: "destructive",
          });
          return;
        }
        if (!task.due_date) {
          toast({
            title: "Validation Error",
            description: `Stage "${stage.name}": Sub-task "${task.title}" is missing a due date.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSaving(true);
    const formattedStages = stages.map((stage) => {
      const tasks = subTasks[String(stage.id)] || [];
      const autoStatus = computeStageStatus(tasks);
      return {
        name: stage.name,
        isRequired: stage.isRequired,
        order: stage.order,
        status: autoStatus,
        start_date: stage.start_date ?? null,
        completed_at: autoStatus === "Completed" ? (stage.completed_at ?? todayISO()) : null,
        subtasks: tasks.map((t) => ({
          title: t.title,
          status: t.status || "Not Started",
          due_date: t.due_date || null,
        })),
      };
    });

    const payload = {
      clientId: Number(selectedClientId),
      stages: formattedStages,
    };

    try {
      const res = await fetch("/api/stages/client/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        toast({ title: "Save Failed", description: json.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Client stages saved successfully" });
        // Reload to sync IDs
        const reload = await fetch(`/api/stages/client/get?clientId=${selectedClientId}`);
        const updated = await reload.json();
        if (updated.success) {
          setStages(updated.data.map((s: any, idx: number) => ({
            id: String(s.client_stage_id),
            name: s.stage_name,
            isRequired: s.is_required,
            order: s.order_number ?? idx + 1,
            status: s.status,
            start_date: s.start_date ? String(s.start_date).slice(0, 10) : null,
            completed_at: s.completed_at ? String(s.completed_at).slice(0, 10) : null
          })));

          // Reload Subtasks
          const subs: Record<string, any[]> = {};
          updated.subtasks.forEach((st: any) => {
            const key = String(st.client_stage_id);
            if (!subs[key]) subs[key] = [];
            subs[key].push({
              title: st.subtask_title, status: st.status, due_date: st.due_date ? st.due_date.slice(0, 10) : ""
            });
          });
          setSubTasks(subs);
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save stages.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  // --- SEND EMAIL HANDLER ---
  async function handleSendEmail() {
    if (!selectedClient) {
      toast({ title: "Error", description: "No client selected", variant: "destructive" });
      return;
    }

    const clientEmail = selectedClient.primary_contact_email;
    if (!clientEmail) {
      toast({ title: "Error", description: "Client has no email address", variant: "destructive" });
      return;
    }

    let subject = "";
    let body = "";

    if (emailMode === "template") {
      if (!selectedEmailTemplate) {
        toast({ title: "Error", description: "Please select an email template", variant: "destructive" });
        return;
      }
      if (!templateEmailData.subject.trim() || !templateEmailData.body.trim()) {
        toast({ title: "Error", description: "Subject and body are required", variant: "destructive" });
        return;
      }
      // Use the editable template data (which user may have customized)
      subject = templateEmailData.subject;
      body = templateEmailData.body;
    } else {
      if (!manualEmailData.subject.trim() || !manualEmailData.body.trim()) {
        toast({ title: "Error", description: "Subject and body are required", variant: "destructive" });
        return;
      }
      subject = manualEmailData.subject;
      body = manualEmailData.body;
    }

    setIsSendingEmail(true);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          subject,
          body,
          clientName: selectedClient.client_name,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: "Email Sent",
          description: `Email successfully sent to ${clientEmail}`,
        });
        setEmailDialogOpen(false);
        setSelectedEmailTemplate("");
        setManualEmailData({ subject: "", body: "" });
        setTemplateEmailData({ subject: "", body: "" });
      } else {
        toast({
          title: "Failed to send email",
          description: json.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  }


  // --- RENDER ---
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Onboarding Stages</h1>
          <p className="text-muted-foreground mt-1">Manage and track client onboarding progress.</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedClientId && !showTemplateSelector && stages.length > 0 && (
            <div className="hidden md:flex mr-2">
              <ProgressRing
                value={(() => {
                  if (stages.length === 0) return 0;
                  const completedCount = stages.filter((stage) => {
                    const tasks = subTasks[String(stage.id)] || [];
                    return tasks.length > 0 && tasks.every((t) => (t.status || "").toLowerCase() === "completed");
                  }).length;
                  return Math.round((completedCount / stages.length) * 100);
                })()}
                completedStages={
                  stages.filter((stage) => {
                    const tasks = subTasks[String(stage.id)] || [];
                    return tasks.length > 0 && tasks.every((t) => (t.status || "").toLowerCase() === "completed");
                  }).length
                }
                totalStages={stages.length}
              />
            </div>
          )}

          <Button variant="outline" onClick={() => router.push("/admin/stages/default")} className="gap-2">
            <Settings className="h-4 w-4" /> Manage Defaults Stages
          </Button>

          {selectedClientId && !showTemplateSelector && (
            <Button variant="outline" onClick={() => router.push(`/admin/clients/${selectedClientId}`)} className="gap-2">
              <User className="h-4 w-4" /> View Client
            </Button>
          )}

          {selectedClientId && !showTemplateSelector && (
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(true)}
              className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Mail className="h-4 w-4" /> Send Email
            </Button>
          )}

          {selectedClientId && !showTemplateSelector && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="size-4" /> Add Stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Stage</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Stage Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Initial Document Review"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="required" className="cursor-pointer">Mark as Required</Label>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Create Stage</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>


      {/* MAIN CONTENT AREA */}
      <div className="grid gap-6">

        {/* CLIENT SELECTOR BAR */}
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full md:w-auto">
              <Label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
                Select Client to Manage
              </Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full md:w-[400px] justify-between h-10">
                    {selectedClientId ? (
                      clients?.data?.find((x: any) => x.client_id.toString() === selectedClientId)?.client_name || "Unknown Client"
                    ) : (
                      <span className="text-muted-foreground font-normal">Select a client...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search clients..." />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
                      <CommandGroup>
                        {clients?.data?.map((c: any) => (
                          <CommandItem
                            key={c.client_id}
                            value={c.client_name}
                            onSelect={() => {
                              setSelectedClientId(c.client_id.toString());
                              setClientOpen(false);
                            }}
                          >
                            <CheckCircle2 className={cn("mr-2 h-4 w-4", selectedClientId === String(c.client_id) ? "opacity-100" : "opacity-0")} />
                            {c.client_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Info */}
            {selectedClientId && (
              <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground border-l pl-6 h-10">
                <div>
                  <span className="font-semibold text-foreground">{stages.length}</span> Stages Defined
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    {stages.filter(s => s.status === "Completed").length}
                  </span> Completed
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* STAGE TIMELINE VISUALIZATION - After client selector */}
        {selectedClientId && !showTemplateSelector && stages.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Stage Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 py-2">
                {stages
                  .sort((a, b) => a.order - b.order)
                  .map((stage, index) => {
                    const tasks = subTasks[String(stage.id)] || [];
                    const allSubtasksCompleted =
                      tasks.length > 0 &&
                      tasks.every((t) => (t.status || "").toLowerCase() === "completed");
                    const isCompleted = stage.status === "Completed" || allSubtasksCompleted;
                    const isInProgress = stage.status === "In Progress";

                    return (
                      <span key={stage.id} className="flex items-center">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted
                            ? "bg-green-100 border border-green-300 text-green-800 shadow-sm"
                            : isInProgress
                              ? "bg-blue-100 border border-blue-300 text-blue-800 shadow-sm animate-pulse"
                              : "bg-gray-100 border border-gray-300 text-gray-600"
                            }`}
                        >
                          {stage.name}
                        </span>
                        {index < stages.length - 1 && (
                          <span className="mx-3 text-muted-foreground font-bold">→</span>
                        )}
                      </span>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CONTENT WHEN CLIENT SELECTED */}
        {selectedClientId && (
          <div className="space-y-6">

            {/* TEMPLATE SELECTOR STATE */}
            {showTemplateSelector && (
              <Card className="border-dashed border-2">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2">
                    <LayoutTemplate className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Set Up Onboarding Journey</CardTitle>
                  <CardDescription className="max-w-md mx-auto">
                    This client has no stages configured. Choose a template to get started quickly, or build from scratch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-w-3xl mx-auto w-full py-6">
                  <div className="grid gap-6">
                    <div className="flex gap-3">
                      <Select
                        value={selectedTemplateId}
                        onValueChange={async (value) => {
                          setSelectedTemplateId(value);
                          const res = await fetch(`/api/default-stages/list?templateId=${value}`);
                          const json = await res.json();
                          if (json.success) setTemplatePreviewStages(json.data);
                          else setTemplatePreviewStages([]);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-11">
                          <SelectValue placeholder="Select a Template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {defaultTemplates.map(t => (
                            <SelectItem key={t.template_id} value={String(t.template_id)}>
                              {t.template_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        className="h-11 px-6"
                        disabled={!selectedTemplateId}
                        onClick={async () => {
                          const res = await fetch(`/api/default-stages/list?templateId=${selectedTemplateId}`);
                          const json = await res.json();
                          if (json.success) {
                            const newSubtasks: Record<string, SubTask[]> = {};
                            const newStages = json.data.map((s: any, idx: number) => {
                              const stageId = `temp-${idx + 1}`;
                              if (s.subtasks && Array.isArray(s.subtasks)) {
                                newSubtasks[stageId] = s.subtasks.map((st: any) => ({
                                  title: st.title || "", status: "Not Started", due_date: undefined
                                }));
                              } else {
                                newSubtasks[stageId] = [];
                              }
                              return {
                                id: stageId, name: s.stage_name, isRequired: s.is_required ?? false,
                                order: idx + 1, status: "Not Started", start_date: null, completed_at: null
                              };
                            });
                            setStages(newStages);
                            setSubTasks(newSubtasks);
                            setShowTemplateSelector(false);
                            setTemplatePreviewStages([]);
                          }
                        }}
                      >
                        Apply Template
                      </Button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                    </div>

                    <Button variant="outline" className="w-full" onClick={() => { setShowTemplateSelector(false); setStages([]); setSubTasks({}); }}>
                      Start from Scratch
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SHOW PREVIEW WHEN SELECTING TEMPLATE */}
            {showTemplateSelector && templatePreviewStages.length > 0 && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Template Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {templatePreviewStages.map((s, idx) => (
                      <div key={idx} className="bg-background border rounded p-3 flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                        <div>
                          <div className="font-medium text-sm">{s.stage_name}</div>
                          {s.subtasks?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {s.subtasks.length} subtasks included
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            {/* STAGES LIST (Active Workspace) */}
            {!showTemplateSelector && stages.length > 0 && (
              <div className="space-y-6">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {stages.map((stage) => (
                        <SortableStageItem
                          key={`stage-${stage.id}`}
                          stage={stage}
                          subtasks={subTasks}
                          addSubtask={(id, title) => {
                            const key = id.toString();
                            setSubTasks(prev => ({
                              ...prev,
                              [key]: [...(prev[key] || []), { title: title?.trim() || "", status: "Not Started" }]
                            }));
                          }}
                          removeSubtask={(id, idx) => {
                            const key = id.toString();
                            setSubTasks(prev => ({
                              ...prev, [key]: (prev[key] || []).filter((_, i) => i !== idx)
                            }));
                          }}
                          updateSubtask={updateSubtask}
                          onEdit={handleOpenDialog}
                          onDelete={handleDelete}
                          onStageStatusChange={(id, status) =>
                            setStages(prev => prev.map(s => s.id === id ? { ...s, status } : s))
                          }
                          onStageStartDateChange={(id, date) =>
                            setStages(prev => prev.map(s => String(s.id) === String(id) ?
                              { ...s, start_date: date, status: s.status === "Not Started" && date ? "In Progress" : s.status } : s))
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* ACTION BAR */}
                <div className="sticky bottom-4 mx-auto max-w-2xl bg-background/80 backdrop-blur-md border rounded-full shadow-lg p-2 flex items-center justify-center gap-3">
                  <div className="text-sm font-medium mr-2 pl-3">
                    {stages.length} Stages configured
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-destructive" onClick={() => setCancelOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" /> Discard Changes
                  </Button>
                  <Button size="sm" className="rounded-full px-6" disabled={isSaving} onClick={handleServerSave}>
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save All Changes"}
                  </Button>
                </div>

                <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? Any modifications made since the last save will be lost properly.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex justify-end gap-2 pt-2">
                      <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => window.location.reload()}>
                        Yes, Discard
                      </AlertDialogAction>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* EMPTY STATE ( Manual Start ) */}
            {!showTemplateSelector && stages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-lg bg-muted/10">
                <div className="bg-muted p-4 rounded-full mb-4">
                  <Trello className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Workspace Ready</h3>
                <p className="text-sm text-muted-foreground max-w-sm text-center mb-6">
                  You have started a manual configuration. Click below to add your first stage.
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" /> Add First Stage
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Stage Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-required"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-required" className="cursor-pointer">Required stage</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EMAIL DIALOG */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Send Email to Client
            </DialogTitle>
            <DialogDescription>
              Send an email to <span className="font-semibold">{selectedClient?.client_name}</span> ({selectedClient?.primary_contact_email})
            </DialogDescription>
          </DialogHeader>

          <Tabs value={emailMode} onValueChange={(v) => setEmailMode(v as "template" | "manual")} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template" className="gap-2">
                <FileText className="h-4 w-4" />
                Use Template
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Edit3 className="h-4 w-4" />
                Manual Email
              </TabsTrigger>
            </TabsList>

            {/* TEMPLATE MODE */}
            <TabsContent value="template" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Email Template</Label>
                <Select
                  value={selectedEmailTemplate}
                  onValueChange={(value) => {
                    setSelectedEmailTemplate(value);
                    // Load template content into editable fields
                    const template = emailTemplates?.find((t: any) => t.id.toString() === value);
                    if (template) {
                      setTemplateEmailData({
                        subject: template.subject || "",
                        body: template.body || ""
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground">{t.subject}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Editable Template Content */}
              {selectedEmailTemplate && (
                <div className="space-y-4">
                  {/* Auto-fill Button */}
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm text-blue-700 flex-1">
                      <strong>Tip:</strong> Click "Auto-Fill" to replace template variables with this client&apos;s information.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        setTemplateEmailData((prev) => ({
                          subject: prev.subject
                            .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                            .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || ""),
                          body: prev.body
                            .replace(/\{\{clientName\}\}/gi, selectedClient?.client_name || "")
                            .replace(/\{\{Client_Name\}\}/gi, selectedClient?.client_name || "")
                            .replace(/\{\{Company_Name\}\}/gi, "MySage ClientHub")
                            .replace(/\{\{Support_Email\}\}/gi, "support@clienthub.com")
                        }));
                        toast({ title: "Auto-filled", description: "Template variables replaced with client info" });
                      }}
                    >
                      Auto-Fill Variables
                    </Button>
                  </div>

                  {/* Editable Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="template-subject">Subject</Label>
                    <Input
                      id="template-subject"
                      value={templateEmailData.subject}
                      onChange={(e) => setTemplateEmailData({ ...templateEmailData, subject: e.target.value })}
                      placeholder="Email subject..."
                    />
                  </div>

                  {/* Editable Body */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="template-body">Email Body</Label>
                      <span className="text-xs text-muted-foreground">HTML supported • Edit as needed</span>
                    </div>
                    <Textarea
                      id="template-body"
                      value={templateEmailData.body}
                      onChange={(e) => setTemplateEmailData({ ...templateEmailData, body: e.target.value })}
                      placeholder="Email content..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Variables Helper */}
                  <div className="bg-muted/50 p-3 rounded-lg border">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Quick Insert Variables (inserts at end)</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { var: "{{clientName}}", label: "Client Name" },
                        { var: "{{taskTitle}}", label: "Task Title" },
                        { var: "{{dueDate}}", label: "Due Date" },
                        { var: "{{stageName}}", label: "Stage Name" },
                        { var: "{{Company_Name}}", label: "Company" },
                        { var: "{{Support_Email}}", label: "Support Email" },
                      ].map((item) => (
                        <Badge
                          key={item.var}
                          variant="outline"
                          className="bg-background cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => {
                            // Get the textarea element
                            const textarea = document.getElementById("template-body") as HTMLTextAreaElement;
                            if (textarea) {
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const currentValue = templateEmailData.body;
                              // Insert at cursor position
                              const newValue = currentValue.substring(0, start) + item.var + currentValue.substring(end);
                              setTemplateEmailData((prev) => ({
                                ...prev,
                                body: newValue
                              }));
                              // Restore focus and cursor position after state update
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + item.var.length, start + item.var.length);
                              }, 0);
                            } else {
                              // Fallback: append to end
                              setTemplateEmailData((prev) => ({
                                ...prev,
                                body: prev.body + item.var
                              }));
                            }
                          }}
                        >
                          + {item.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Live Preview</span>
                    </div>
                    <div className="p-4 bg-white max-h-[300px] overflow-y-auto">
                      <div
                        className="text-sm"
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        dangerouslySetInnerHTML={{
                          __html: templateEmailData.body
                            // Handle all clientName variations
                            .replace(/\{\{clientName\}\}/gi, `<span class="bg-yellow-200 px-1 rounded font-medium">${selectedClient?.client_name || "{{clientName}}"}</span>`)
                            .replace(/\{\{Client_Name\}\}/gi, `<span class="bg-yellow-200 px-1 rounded font-medium">${selectedClient?.client_name || "{{Client_Name}}"}</span>`)
                            // Handle other variables with highlighting
                            .replace(/\{\{taskTitle\}\}/gi, `<span class="bg-blue-200 px-1 rounded">{{taskTitle}}</span>`)
                            .replace(/\{\{dueDate\}\}/gi, `<span class="bg-green-200 px-1 rounded">{{dueDate}}</span>`)
                            .replace(/\{\{stageName\}\}/gi, `<span class="bg-purple-200 px-1 rounded">{{stageName}}</span>`)
                            .replace(/\{\{Company_Name\}\}/gi, `<span class="bg-orange-200 px-1 rounded">{{Company_Name}}</span>`)
                            .replace(/\{\{Support_Email\}\}/gi, `<span class="bg-pink-200 px-1 rounded">{{Support_Email}}</span>`)
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!selectedEmailTemplate && emailTemplates?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No Email Templates Found</p>
                  <p className="text-sm mt-1">Create templates in the Email Templates section first.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/admin/email-templates")}
                  >
                    Go to Email Templates
                  </Button>
                </div>
              )}

              {!selectedEmailTemplate && emailTemplates?.length > 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a template above to get started</p>
                </div>
              )}
            </TabsContent>

            {/* MANUAL MODE */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="manual-subject">Subject</Label>
                <Input
                  id="manual-subject"
                  value={manualEmailData.subject}
                  onChange={(e) => setManualEmailData({ ...manualEmailData, subject: e.target.value })}
                  placeholder="Enter email subject..."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manual-body">Email Body</Label>
                  <span className="text-xs text-muted-foreground">HTML supported</span>
                </div>
                <Textarea
                  id="manual-body"
                  value={manualEmailData.body}
                  onChange={(e) => setManualEmailData({ ...manualEmailData, body: e.target.value })}
                  placeholder="Enter email content..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              {/* Variables Helper */}
              <div className="bg-muted/50 p-3 rounded-lg border">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Quick Insert Variables</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { var: "{{clientName}}", label: "Client Name" },
                    { var: "{{taskTitle}}", label: "Task Title" },
                    { var: "{{dueDate}}", label: "Due Date" },
                    { var: "{{stageName}}", label: "Stage Name" },
                    { var: "{{Company_Name}}", label: "Company" },
                    { var: "{{Support_Email}}", label: "Support Email" },
                  ].map((item) => (
                    <Badge
                      key={item.var}
                      variant="outline"
                      className="bg-background cursor-pointer hover:bg-primary/10"
                      onClick={() => {
                        // Get the textarea element
                        const textarea = document.getElementById("manual-body") as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const currentValue = manualEmailData.body;
                          // Insert at cursor position
                          const newValue = currentValue.substring(0, start) + item.var + currentValue.substring(end);
                          setManualEmailData((prev) => ({
                            ...prev,
                            body: newValue
                          }));
                          // Restore focus and cursor position after state update
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + item.var.length, start + item.var.length);
                          }, 0);
                        } else {
                          // Fallback: append to end
                          setManualEmailData((prev) => ({
                            ...prev,
                            body: prev.body + item.var
                          }));
                        }
                      }}
                    >
                      + {item.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setSelectedEmailTemplate("");
                setManualEmailData({ subject: "", body: "" });
                setTemplateEmailData({ subject: "", body: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={
                isSendingEmail ||
                (emailMode === "template" && (!selectedEmailTemplate || !templateEmailData.subject || !templateEmailData.body)) ||
                (emailMode === "manual" && (!manualEmailData.subject || !manualEmailData.body))
              }
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {isSendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
