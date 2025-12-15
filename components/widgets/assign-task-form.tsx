// components/widgets/assign-task-form.tsx
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assignTask,
  fetchClients,
  fetchServiceCenters,
  fetchCPAs,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { mutate } from "swr";


/* -------------------- ZOD SCHEMA -------------------- */
const Schema = z.object({
  title: z.string().min(2, "Title is required"),
  clientId: z.string().optional(),
  assigneeRole: z.enum(["CLIENT", "SERVICE_CENTER", "CPA"]),
  dueDate: z.string().optional(),
  assignedUsers: z.array(z.string()).optional(),
  
});

/* ======================= FORM ======================= */
export function AssignTaskForm({ context }: { context?: Record<string, any> }) {
  const isEditMode = Boolean(context?.taskId);
  const { data: taskData } = useSWR(
  isEditMode ? ["edit-task", context?.taskId] : null,
  async () => {
    const res = await fetch(`/api/tasks/get?taskId=${context?.taskId}`);
    return res.json();
  }
  );

  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);  
  const [clientSearch, setClientSearch] = useState(""); // ✅ FIX FOR SEARCH FOCUS

  /* ------------------- LOAD SQL DATA ------------------- */
  const { data: clients } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );

  const { data: serviceCenters } = useSWR(["service-centers"], () =>
    fetchServiceCenters()
  );

  const { data: cpas } = useSWR(["cpas"], () => fetchCPAs());

  const prefilledClientId = context?.clientId ? String(context.clientId) : "";

  /* ------------------- FORM SETUP ------------------- */
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      title: context?.taskTitle || "",
      clientId: prefilledClientId,
      assigneeRole: context?.assignedToRole || "CLIENT",
      dueDate: context?.dueDate
        ? new Date(context.dueDate).toISOString().split("T")[0]
        : "",
      assignedUsers: [],
    },
  });
  useEffect(() => {
    if (!isEditMode || !taskData) return;

    form.reset({
      title: taskData.task_title,
      clientId: String(taskData.client_id),
      assigneeRole: taskData.assigned_to_role,
      dueDate: taskData.due_date
        ? new Date(taskData.due_date).toISOString().split("T")[0]
        : "",
    });

  }, [taskData, isEditMode]);


  /* ------------- LOAD USER DROPDOWN OPTIONS ------------- */
  useEffect(() => {
    const role = form.getValues("assigneeRole");
    const selectedClientId = form.getValues("clientId");

    if (role === "CLIENT" && selectedClientId) {
      const selected = clients?.data?.find(
        (c: any) => String(c.client_id) === String(selectedClientId)
      );

      if (selected) {
        setUserOptions([
          {
            id: String(selected.client_id),
            name: selected.client_name,
          },
        ]);
      }
    }

    if (role === "SERVICE_CENTER") {
      setUserOptions(
        serviceCenters?.map((sc: any) => ({
          id: String(sc.service_center_id),
          name: sc.center_name,
        })) || []
      );
    }

    if (role === "CPA") {
      setUserOptions(
        cpas?.map((c: any) => ({
          id: String(c.cpa_id),
          name: c.cpa_name,
        })) || []
      );
    }
  }, [
    form.watch("assigneeRole"),
    form.watch("clientId"),
    clients,
    serviceCenters,
    cpas,
  ]);

async function onSubmit(values: z.infer<typeof Schema>) {
  console.log("🧩 Assign Task Form Data:", values);

  if (isSubmitting) return; // ⛔ Prevent double click
  setIsSubmitting(true);    // 🔥 Start loading

  try {
    if (!values.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (assignedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one user",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (!values.clientId) {
      toast({
        title: "Error",
        description: "Client ID is required",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const payload = {
      taskTitle: values.title,
      clientId: Number(values.clientId),
      assignedToRole: values.assigneeRole,
      dueDate: values.dueDate || null,
      description: "",
      orderNumber: 1,
    };

    console.log("🚀 Final Payload Sent to assignTask():", payload);
    if (isEditMode) {
      await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: context?.taskId,
          taskTitle: values.title,
          status: context?.status || "Pending",
          dueDate: values.dueDate || null,
          assignedToRole: values.assigneeRole,
        }),
      });

      toast({ title: "Task Updated" });
    } else {
      await assignTask(payload);

      toast({
        title: "Task Assigned",
        description: "The task has been added successfully.",
      });
    }


  // 🔄 Refresh UI 
  mutate(["tasks"]);
  mutate(["clients"]);

  if (!isEditMode) {
    toast({
      title: "Task Assigned",
      description: "The task has been added successfully.",
    });
  }

  setTimeout(() => {
    closeDrawer();
  }, 400);


  } catch (error: any) {
    console.error("❌ Error assigning task:", error);
    toast({
      title: "Error",
      description: error.message || "Failed to assign task.",
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);   // 🔥 Turn loading OFF
  }
}

  const assigneeRole = form.watch("assigneeRole");

  /* ======================= UI ======================= */
  /* ======================= UI ======================= */
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">

      {/* ✅ DYNAMIC FORM TITLE */}
      <h2 className="text-lg font-semibold mb-2">
        {isEditMode ? "Update Task" : "Assign Task"}
      </h2>

{/* Title */}
<div className="grid gap-2">
  <Label>Title</Label>
  <Input {...form.register("title")} placeholder="Task title" />
</div>

{/* ✅ TRUE SEARCHABLE CLIENT DROPDOWN (NO FOCUS JUMP, SAME AS STAGES) */}
{assigneeRole === "CLIENT" && (
  <div className="grid gap-2">
    <Label>Client Name</Label>

    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between"
        >
          {clients?.data?.find(
            (c: any) => String(c.client_id) === form.watch("clientId")
          )?.client_name || "Select client"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search client..." />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>

            <CommandGroup className="max-h-64 overflow-y-auto">
              {clients?.data?.map((c: any) => (
              <CommandItem
                key={c.client_id}
                value={c.client_name}
                onSelect={() => {
                  form.setValue("clientId", String(c.client_id));
                  (document.activeElement as HTMLElement)?.blur(); // ✅ AUTO-CLOSE POPOVER
                }}
              >

                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      String(c.client_id) === form.watch("clientId")
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {c.client_name}
                </CommandItem>
              ))}
            </CommandGroup>

          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
)}



      {/* Role */}
      <div className="grid gap-2">
        <Label>Assignee Role</Label>
        <Select
          value={form.watch("assigneeRole")}
          onValueChange={(v) => form.setValue("assigneeRole", v as any)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SERVICE_CENTER">Service Center</SelectItem>
            <SelectItem value="CPA">CPA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users */}
      <div className="grid gap-2">
        <Label>Select Users</Label>

        <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
          {userOptions.length > 0 ? (
            userOptions.map((u: any) => (
              <div key={u.id} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id={u.id}
                  checked={assignedUsers.includes(u.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAssignedUsers([...assignedUsers, u.id]);
                    } else {
                      setAssignedUsers(
                        assignedUsers.filter((i) => i !== u.id)
                      );
                    }
                  }}
                />
                <Label htmlFor={u.id}>{u.name}</Label>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              No users available
            </p>
          )}
        </div>
      </div>

      {/* Due Date */}
      <div className="grid gap-2">
        <Label>Due Date</Label>
        <Input
          type="date"
          {...form.register("dueDate")}
          onFocus={(e) => e.currentTarget.showPicker?.()}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 mt-3">
        <Button type="button" variant="outline" onClick={closeDrawer}>
          Cancel
        </Button>
      
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEditMode ? "Updating..." : "Assigning..."
            : isEditMode ? "Update Task" : "Assign"}
        </Button>

      </div>
    </form>
  );
}
