// app/admin/stages/page.tsx
"use client";
import { useEffect } from "react";

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
import { SortableStageItem } from "./sortable-stage-item";

import useSWR from "swr";
import { fetchStagesList, fetchClients } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
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

import { ChevronsUpDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ProgressRing } from "@/components/widgets/progress-ring";

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
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("clientId");

  // Simplified: Just update subtask data - useEffect handles all cascade calculations
  const updateSubtask = (stageId: string, index: number, updates: Partial<SubTask>) => {
    setSubTasks((prev) => {
      const updatedSubtasksMap = { ...prev };
      const currentStageSubtasks = [...(updatedSubtasksMap[stageId] || [])];

      // Update the specific subtask
      currentStageSubtasks[index] = { ...currentStageSubtasks[index], ...updates };
      updatedSubtasksMap[stageId] = currentStageSubtasks;

      // Return updated subtasks - useEffect will handle status & cascade updates
      return updatedSubtasksMap;
    });
  };

  const [stages, setStages] = useState<Stage[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isRequired: false });
  const [clientOpen, setClientOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [subTasks, setSubTasks] = useState<Record<string, SubTask[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [templatePreviewStages, setTemplatePreviewStages] = useState<any[]>([]);


  useEffect(() => {
    if (!showTemplateSelector) return;

    (async () => {
      const res = await fetch("/api/default-stage-templates/list");
      const json = await res.json();

      if (json.success) {
        setDefaultTemplates(json.data);
      }
    })();
  }, [showTemplateSelector]);

  // Auto Stage Status Calculator
  const computeStageStatus = (tasks: SubTask[] = []) => {
    if (tasks.length === 0) return "Not Started";

    const allCompleted = tasks.every(t => (t.status || "").toLowerCase() === "completed");
    if (allCompleted) return "Completed";

    // If any task is In Progress or Completed, stage is In Progress
    const anyStarted = tasks.some(t => {
      const s = (t.status || "").toLowerCase();
      return s === "in progress" || s === "completed";
    });
    if (anyStarted) return "In Progress";

    return "Not Started";
  };

  // Master Effect: Single source of truth for stage status and cascade calculations
  useEffect(() => {
    if (stages.length === 0) return;

    setStages((prevStages) => {
      // Sort stages by order for proper cascade processing
      const sortedStages = [...prevStages].sort((a, b) => a.order - b.order);

      let hasChanges = false;

      // PASS 1: Update Status & Self-Correction for each stage
      const stagesWithStatus = sortedStages.map((s) => {
        const tasks = subTasks[s.id] || [];
        const newStatus = computeStageStatus(tasks);
        const nowCompleted = newStatus === "Completed";

        // Auto-set start date if In Progress (only if not already set)
        const newStartDate = s.start_date ?? (newStatus === "In Progress" ? todayISO() : null);
        // Auto-set completed_at if Completed
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

      // PASS 2: Cascade Start Dates based on LATEST completed subtask from previous stage
      // This MUST re-evaluate every stage's start_date based on current subtask data
      const finalStages = stagesWithStatus.map((stage, idx) => {
        if (idx === 0) return stage; // First stage has no previous stage

        const prevStage = stagesWithStatus[idx - 1];
        const prevTasks = subTasks[prevStage.id] || [];

        // Get the LATEST completed subtask's due_date from the previous stage
        const latestCompletedDate = getLatestCompletedSubtaskDate(prevTasks);

        // Always update if there's a new latest date that's different
        if (latestCompletedDate) {
          // Normalize both dates for comparison (handle potential format differences)
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
  }, [subTasks, stages.length]); // Re-run when subTasks change or stages are added/removed

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (clientIdFromUrl) {
      setSelectedClientId(clientIdFromUrl);
    }
  }, [clientIdFromUrl]);

  useEffect(() => {
    if (!selectedClientId) return;

    (async () => {
      setShowTemplateSelector(false);
      setSelectedTemplateId("");
      const res = await fetch(`/api/stages/client/get?clientId=${selectedClientId}`);
      const json = await res.json();

      if (json.success && json.data.length > 0) {
        // Client already has stages — load them
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


        // Load subtasks
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
      }
      else {
        // Client has NO stages → show template selector
        setStages([]);
        setSubTasks({});
        setShowTemplateSelector(true);
      }
    })();
  }, [selectedClientId, data]);


  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
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
      toast({
        title: "Error",
        description: "Stage name is required",
        variant: "destructive",
      });
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
    setDeleteId(null);

    toast({ title: "Deleted", description: "Stage deleted successfully" });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Onboarding Stages</CardTitle>
        <div className="flex items-center gap-2">
          {/* ✅ LIVE PROGRESS RING - Only show when client has stages */}
          {selectedClientId && !showTemplateSelector && stages.length > 0 && (
            <ProgressRing
              value={(() => {
                if (stages.length === 0) return 0;

                const completedCount = stages.filter((stage) => {
                  const tasks = subTasks[String(stage.id)] || [];
                  // A stage is completed if it has tasks and ALL are completed
                  // If no tasks, it is NOT completed (or handle as you wish, but "Not Started" is safer)
                  if (tasks.length === 0) return false;
                  return tasks.every((t) => (t.status || "").toLowerCase() === "completed");
                }).length;

                return Math.round((completedCount / stages.length) * 100);
              })()}

              completedStages={
                stages.filter((stage) => {
                  const tasks = subTasks[String(stage.id)] || [];
                  if (tasks.length === 0) return false;
                  return tasks.every((t) => (t.status || "").toLowerCase() === "completed");
                }).length
              }
              totalStages={stages.length}
            />
          )}

          {/* ✅ MANAGE DEFAULT STAGES - Always visible */}
          <Button
            variant="outline"
            onClick={() => router.push("/admin/stages/default")}
          >
            Manage Default Stages
          </Button>

          {/* ✅ VIEW CLIENT BUTTON - Only when client selected and has stages */}
          {selectedClientId && !showTemplateSelector && (
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/clients/${selectedClientId}`)}
            >
              View Client
            </Button>
          )}

          {/* ✅ ADD STAGE BUTTON - Only when client selected and not in template selector */}
          {selectedClientId && !showTemplateSelector && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-1 size-4" /> Add Stage
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Stage</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Stage Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., KYC, Accounting Setup"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="required"
                      checked={formData.isRequired}
                      onChange={(e) =>
                        setFormData({ ...formData, isRequired: e.target.checked })
                      }
                      className="rounded"
                    />
                    <Label htmlFor="required" className="cursor-pointer">
                      Required stage
                    </Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>



      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="client-select">Select Client (Required)</Label>
          <Popover open={clientOpen} onOpenChange={setClientOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-[291px] justify-between"
              >
                {selectedClientId ? (
                  clients?.data?.find(
                    (x: any) => x.client_id.toString() === selectedClientId
                  )?.client_name
                ) : (
                  <span className="font-normal text-muted-foreground">
                    Choose a client to manage their stages
                  </span>
                )}

                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search client..." />

                <CommandList className="max-h-60 overflow-y-auto">
                  <CommandEmpty>No client found.</CommandEmpty>

                  <CommandGroup>
                    {clients?.data?.map((c: any) => (
                      <CommandItem
                        key={c.client_id}
                        value={c.client_name}
                        onSelect={() => {
                          setSelectedClientId(c.client_id.toString());
                          setClientOpen(false); // ✅ AUTO CLOSE DROPDOWN
                        }}
                      >
                        {c.client_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>


        </div>

        {selectedClientId && (
          <div className="grid gap-2">
            {showTemplateSelector && (
              <Card className="border border-dashed p-4">
                <CardHeader>
                  <CardTitle>Select Default Stage Template</CardTitle>
                  <p className="text-sm text-muted-foreground pt-1">
                    This client currently has no stages assigned. You can select a template below or start manually to create stages from scratch.
                  </p>
                </CardHeader>
                {templatePreviewStages.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-semibold mb-2">
                      Template Stage Preview
                    </p>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {templatePreviewStages.map((s, index) => (
                        <div key={index} className="border rounded-md p-3 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium flex items-center gap-2">
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border">{index + 1}</span>
                              {s.stage_name}
                            </span>
                            {s.is_required && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                Required
                              </span>
                            )}
                          </div>

                          {s.subtasks && s.subtasks.length > 0 ? (
                            <ul className="ml-8 space-y-1">
                              {s.subtasks.map((task: any, tIdx: number) => (
                                <li key={tIdx} className="text-sm text-muted-foreground flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  {task.title}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground ml-8 italic">No subtasks</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <Select
                      value={selectedTemplateId}
                      onValueChange={async (value) => {
                        setSelectedTemplateId(value);

                        // 🔍 Fetch preview stages for selected template
                        const res = await fetch(
                          `/api/default-stages/list?templateId=${value}`
                        );
                        const json = await res.json();

                        if (json.success) {
                          setTemplatePreviewStages(json.data);
                        } else {
                          setTemplatePreviewStages([]);
                        }
                      }}
                    >

                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>

                      <SelectContent>
                        {defaultTemplates.map((t) => (
                          <SelectItem
                            key={t.template_id}
                            value={String(t.template_id)}
                          >
                            {t.template_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      disabled={!selectedTemplateId}
                      onClick={async () => {
                        const res = await fetch(
                          `/api/default-stages/list?templateId=${selectedTemplateId}`
                        );
                        const json = await res.json();

                        if (json.success) {
                          const newSubtasks: Record<string, SubTask[]> = {};

                          const newStages = json.data.map((s: any, idx: number) => {
                            const stageId = `temp-${idx + 1}`;

                            // Convert template subtasks to client subtasks format
                            if (s.subtasks && Array.isArray(s.subtasks)) {
                              newSubtasks[stageId] = s.subtasks.map((st: any) => ({
                                title: st.title || "",
                                status: "Not Started",
                                due_date: undefined
                              }));
                            } else {
                              newSubtasks[stageId] = [];
                            }

                            return {
                              id: stageId,
                              name: s.stage_name,
                              isRequired: s.is_required ?? false,
                              order: idx + 1,
                              status: "Not Started",
                              start_date: null,
                              completed_at: null,
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

                    <Button
                      variant="outline"
                      className="border-2 border-gray-400 hover:bg-gray-50"
                      onClick={() => {
                        setShowTemplateSelector(false);
                        setStages([]);
                        setSubTasks({});
                      }}
                    >
                      Start Manually
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTemplateSelector(false);
                        setSelectedClientId("");
                        setTemplatePreviewStages([]);
                        setStages([]);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when manual mode is active but no stages created yet */}
            {!showTemplateSelector && stages.length === 0 && (
              <Card className="border border-dashed p-6">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="rounded-full bg-amber-100 p-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      No Stages Assigned Yet
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                      This client doesn&apos;t have any onboarding stages configured yet.
                      Start adding stages to track their onboarding progress.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="mr-1 size-4" /> Add First Stage
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowTemplateSelector(true)}
                    >
                      Use Template Instead
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {!showTemplateSelector && stages.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >

                <SortableContext
                  items={stages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {stages.map((stage) => (
                    <SortableStageItem
                      key={`stage-${stage.id}`}
                      stage={stage}
                      subtasks={subTasks}
                      addSubtask={(id: string | number, title: string) => {
                        const key = id.toString();
                        const safeTitle = title?.trim() || "";

                        // Simply add the subtask - useEffect will handle cascade
                        setSubTasks(prev => ({
                          ...prev,
                          [key]: [
                            ...(prev[key] || []),
                            { title: safeTitle, status: "Not Started" }
                          ],
                        }));
                      }}


                      removeSubtask={(id, idx) => {
                        const key = id.toString();

                        // Simply remove the subtask - useEffect will handle cascade
                        setSubTasks(prev => ({
                          ...prev,
                          [key]: (prev[key] || []).filter((_, i) => i !== idx),
                        }));
                      }}


                      updateSubtask={updateSubtask}     // <-- ✅ ADD THIS LINE

                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}

                      onStageStatusChange={(id: string, status: string) =>
                        setStages((prev) =>
                          prev.map((s) =>
                            s.id === id ? { ...s, status } : s
                          )
                        )
                      }
                      onStageStartDateChange={(id, startDate) =>
                        setStages((prev) =>
                          prev.map((s) =>
                            String(s.id) === String(id)
                              ? {
                                ...s,
                                start_date: startDate,
                                status:
                                  s.status === "Not Started" && startDate ? "In Progress" : s.status,
                              }
                              : s
                          )
                        )
                      }

                    />

                  ))}
                </SortableContext>
              </DndContext>
            )}
            {stages.length > 0 && selectedClientId && !showTemplateSelector && (
              <div className="flex justify-center gap-4 pt-4">

                {/* CANCEL BUTTON */}
                <Button
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>


                {/* SAVE BUTTON */}
                <Button
                  disabled={isSaving}
                  onClick={async () => {
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

                    console.log("FINAL PAYLOAD:", payload);

                    try {
                      const res = await fetch("/api/stages/client/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });

                      const json = await res.json();

                      if (!json.success) {
                        toast({
                          title: "Save Failed",
                          description: json.error,
                          variant: "destructive",
                        });
                      } else {
                        toast({
                          title: "Success",
                          description: "Client stages saved successfully",
                        });

                        const reload = await fetch(`/api/stages/client/get?clientId=${selectedClientId}`);
                        const updated = await reload.json();

                        if (updated.success) {
                          setStages(
                            updated.data.map((s: any, index: number) => ({
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
                          updated.subtasks.forEach((st: any) => {
                            const key = String(st.client_stage_id);
                            if (!subs[key]) subs[key] = [];
                            subs[key].push({
                              title: st.subtask_title,
                              status: st.status,
                              due_date: st.due_date ? st.due_date.substring(0, 10) : "",
                            });
                          });

                          setSubTasks(subs);
                        }

                        toast({
                          title: "Updated",
                          description: "All stages reloaded successfully",
                        });
                      }

                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to save stages. Please try again.",
                        variant: "destructive",
                      });
                    }

                    setIsSaving(false);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? "Saving..." : "💾 Save Stages"}
                </Button>
              </div>
            )}

            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel? All unsaved changes will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex justify-end gap-2 pt-4">
                  <AlertDialogCancel>Back</AlertDialogCancel>

                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => window.location.reload()}
                  >
                    Yes, Cancel
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>

          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Stage Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., KYC, Accounting Setup"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-required"
                checked={formData.isRequired}
                onChange={(e) =>
                  setFormData({ ...formData, isRequired: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="edit-required" className="cursor-pointer">
                Required stage
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
