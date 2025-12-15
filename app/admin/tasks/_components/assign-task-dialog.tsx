// app/admin/tasks/_components/assign-task-dialog.tsx
"use client";

import { useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { assignTask, fetchClients } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function AssignTaskDialog() {
  const { closeDrawer } = useUIStore();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [assigneeRole, setAssigneeRole] = useState("CLIENT");
  const [dueDate, setDueDate] = useState("");

  const { data: clientsData } = useSWR("clients-mini", () =>
    fetchClients({ page: 1, pageSize: 100 })
  );

  const clients = clientsData?.data || [];

  async function handleAssign() {
    if (!title.trim() || !clientId) {
      toast({
        title: "Missing Fields",
        description: "Task title and client name are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await assignTask({
        title,
        clientId,
        assigneeRole,
        dueDate,
      });

      toast({ title: "Success", description: "Task assigned successfully." });

      closeDrawer();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign task",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Assign Task</h2>

      {/* Task Title */}
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input
          placeholder="Enter task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Client Name */}
      <div className="grid gap-2">
        <Label>Client Name</Label>
        <Select onValueChange={(v) => setClientId(v)} value={clientId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c: any) => (
              <SelectItem key={c.client_id} value={String(c.client_id)}>
                {c.client_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assignee Role */}
      <div className="grid gap-2">
        <Label>Assignee Role</Label>
        <Select value={assigneeRole} onValueChange={(v) => setAssigneeRole(v)}>
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

      {/* Due Date */}
      <div className="grid gap-2">
        <Label>Due Date</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={closeDrawer}>
          Cancel
        </Button>
        <Button onClick={handleAssign}>Assign</Button>
      </div>
    </div>
  );
}
