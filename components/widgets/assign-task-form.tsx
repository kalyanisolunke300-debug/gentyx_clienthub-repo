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
  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);  
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
      title: "Upload KYC",
      clientId: prefilledClientId,
      assigneeRole: "CLIENT",
      dueDate: "",
      assignedUsers: [],
    },
  });

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

  /* ------------------- SUBMIT LOGIC ------------------- */
  // async function onSubmit(values: z.infer<typeof Schema>) {
  //   console.log("🧩 Assign Task Form Data:", values); // ✅ Corrected

  //   if (!values.title.trim()) {
  //     toast({
  //       title: "Error",
  //       description: "Title is required",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   if (assignedUsers.length === 0) {
  //     toast({
  //       title: "Error",
  //       description: "Please select at least one user",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  //   if (!values.clientId) {
  //     toast({
  //       title: "Error",
  //       description: "Client ID is required",
  //       variant: "destructive",
  //     });
  //     return;
  //   }

  // const payload = {
  //   taskTitle: values.title,               // rename title → taskTitle
  //   clientId: Number(values.clientId),
  //   assignedToRole: values.assigneeRole,   // rename assigneeRole → assignedToRole
  //   dueDate: values.dueDate || null,
  //   description: "",                       // backend expects description
  //   orderNumber: 1,                        // backend expects orderNumber
  //   // assignedUsers removed (your SQL table does NOT support it)
  // };

  //   console.log("🚀 Final Payload Sent to assignTask():", payload);

  //   try {
  //       await assignTask(payload);

  //       // 🔄 Refresh UI 
  //       mutate(["tasks", payload.clientId]);
  //       mutate(["stages", payload.clientId]);

  //       toast({
  //         title: "Task Assigned",
  //         description: "The task has been added successfully.",
  //       });
  //       closeDrawer();

  //   } catch (error: any) {
  //     console.error("❌ Error assigning task:", error);
  //     toast({
  //       title: "Error",
  //       description: error.message || "Failed to assign task.",
  //       variant: "destructive",
  //     });
  //   }
  // }
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

    await assignTask(payload);

    // 🔄 Refresh UI 
    mutate(["tasks", payload.clientId]);
    mutate(["stages", payload.clientId]);

    toast({
      title: "Task Assigned",
      description: "The task has been added successfully.",
    });

    closeDrawer();

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
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
      {/* Title */}
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input {...form.register("title")} placeholder="Task title" />
      </div>

      {/* Client Dropdown */}
      {assigneeRole === "CLIENT" && (
        <div className="grid gap-2">
          <Label>Client Name</Label>
          <Select
            value={form.watch("clientId")}
            onValueChange={(v) => form.setValue("clientId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients?.data?.map((c: any) => (
                <SelectItem key={c.client_id} value={String(c.client_id)}>
                  {c.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {isSubmitting ? "Assigning..." : "Assign"}
        </Button>

      </div>
    </form>
  );
}
