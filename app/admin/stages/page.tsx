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


// type SubTask = { title: string; status: string };
type SubTask = {
  title: string;
  status: string;  // always required for SQL insert
};

export default function StagesPage() {
  const { data } = useSWR(["stages"], () => fetchStagesList());
  const { data: clients } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("clientId");

  const updateSubtask = (stageId: string, index: number, title: string) => {
  setSubTasks(prev => ({
    ...prev,
    [stageId]: (prev[stageId] || []).map((t, i) =>
      i === index ? { ...t, title } : t
    )
    }));
    };

  const [stages, setStages] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isRequired: false });
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [subTasks, setSubTasks] = useState<Record<string, SubTask[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);


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
    const res = await fetch(`/api/stages/client/get?clientId=${selectedClientId}`);
    const json = await res.json();

    if (json.success && json.data.length > 0) {
      // 🟢 Client already has stages — load them
      setStages(
        json.data.map((s: any, index: number) => ({
          id: String(s.client_stage_id),
          name: s.stage_name,
          isRequired: s.is_required ?? false,
          order: s.order_number ?? index + 1,
          status: s.status || "Not Started",
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
        });
      });

      setSubTasks(subs);
    } 
    else {
      // 🟢 FIRST TIME: Load template stages
      if (data?.data) {
        setStages(
          data.data.map((t: any, index: number) => ({
            id: `temp-${index + 1}`,  // unique temp ID
            name: t.stage_name,
            isRequired: t.is_required ?? false,
            order: index + 1,
            status: "Not Started",
          }))
        );
        setSubTasks({});
      }
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
    const newStage = {
      // id: Date.now(),            // <-- always numeric
      // id: `temp-${Date.now()}`,
      id: String(-Date.now()), 
      tempId: true,              // <-- mark as temporary ID
      name: formData.name,
      isRequired: formData.isRequired,
      order: stages.length + 1,
      status: "Not Started",
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
        <CardTitle>Stages</CardTitle>
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
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="client-select">Select Client (Required)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-[291px] justify-between"
                >
                {selectedClientId ? (
                  clients?.data?.find((x: any) => x.client_id.toString() === selectedClientId)?.client_name
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
                          onSelect={() => setSelectedClientId(c.client_id.toString())}
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
                  />

                ))}
              </SortableContext>
            </DndContext>
              {stages.length > 0 && selectedClientId && (
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

                      const formattedStages = stages.map((stage) => ({
                        name: stage.name,
                        isRequired: stage.isRequired,
                        order: stage.order,
                        status: stage.status || "Not Started",
                        subtasks: (subTasks[String(stage.id)] || []).map((t) => ({
                          title: t.title,
                          status: t.status || "Not Started",
                        })),
                      }));

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
                                id: s.client_stage_id,
                                name: s.stage_name,
                                isRequired: s.is_required ?? false,
                                order: s.order_number ?? index + 1,
                                status: s.status || "Not Started",
                              }))
                            );

                            const subs: Record<string, any[]> = {};
                            updated.subtasks.forEach((st: any) => {
                              const key = String(st.client_stage_id);
                              if (!subs[key]) subs[key] = [];
                              subs[key].push({
                                title: st.subtask_title,
                                status: st.status,
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
