// /app/admin/cpas/page.tsx


"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function CPAsPage() {
  const [cpas, setCPAs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const [open, setOpen] = useState(false);
  const { toast } = useToast();
const [openClientsModal, setOpenClientsModal] = useState(false);
const [selectedCPA, setSelectedCPA] = useState<any | null>(null);
const [assignedClients, setAssignedClients] = useState<any[]>([]);
const [loadingClients, setLoadingClients] = useState(false);

async function openAssignedClients(cpa: any) {
  setSelectedCPA(cpa);
  setOpenClientsModal(true);
  setLoadingClients(true);

  try {
    const res = await fetch(
      `/api/clients/get-by-cpa?cpaId=${cpa.cpa_id}`
    );

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error);
    }

    setAssignedClients(json.data || []);
  } catch (err) {
    console.error(err);
    toast({
      title: "Error",
      description: "Failed to load assigned clients",
      variant: "destructive",
    });
  } finally {
    setLoadingClients(false);
  }
}

  // ==========================
  // LOAD CPA LIST FROM SQL
  // ==========================
  // useEffect(() => {
  //   async function loadCPAs() {
  //     const res = await fetch("/api/cpas/get");
  //     const json = await res.json();

  //     if (json.success) {
  //       setCPAs(json.data);
  //     }
  //   }

  //   loadCPAs();
  // }, []);
    useEffect(() => {
      async function load() {
        const res = await fetch("/api/cpas/get");
        const json = await res.json();
        setCPAs(json.data || []);
      }
      load();
    }, []);



  // ==========================
  // OPEN MODAL FOR EDIT/NEW
  // ==========================
  function handleOpenDialog(cpa?: any) {
    if (cpa) {
      setEditingId(cpa.cpa_id);
      setFormData({
        name: cpa.cpa_name,
        email: cpa.email ?? "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "" });
    }

    setOpen(true);
  }

  // ==========================
  // SAVE (CREATE OR UPDATE)
  // ==========================
  async function handleSave() {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "CPA Name is required",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      // UPDATE
      const res = await fetch("/api/cpas/update", {
        // method: "PUT",
        method: "POST",

        body: JSON.stringify({
          cpa_id: editingId,
          name: formData.name,
          email: formData.email,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast({ title: "Error", description: json.message, variant: "destructive" });
        return;
      }

      toast({ title: "Updated", description: "CPA updated successfully" });
    } else {
      // CREATE
      const res = await fetch("/api/cpas/add", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        toast({ title: "Error", description: json.message, variant: "destructive" });
        return;
      }

      toast({ title: "Created", description: "New CPA created successfully" });
    }

    // Reload list
    const reload = await fetch("/api/cpas/get");
    setCPAs((await reload.json()).data);

    setOpen(false);
  }

  // ==========================
  // DELETE CPA
  // ==========================
  async function handleDelete(id: number) {
    const res = await fetch("/api/cpas/delete", {
      method: "POST",
      body: JSON.stringify({ cpa_id: id }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Error", description: json.message, variant: "destructive" });
      return;
    }

    toast({ title: "Deleted", description: "CPA deleted" });

    const reload = await fetch("/api/cpas/get");
    setCPAs((await reload.json()).data);
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>CPAs</CardTitle>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>New CPA</Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "New"} CPA</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="CPA Name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="contact@cpa.com"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>

                <Button onClick={handleSave}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="grid gap-2">
        {cpas.map((c) => (
          <div
            key={c.cpa_id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <div className="font-medium">{c.cpa_name}</div>

              {/* <div className="text-xs text-muted-foreground">
                Code: {c.cpa_code} • ID: {c.cpa_id}
              </div> */}
              <div className="text-xs">
                <span className="font-semibold">Email:</span>{" "}
                {c.email || "—"}
              </div>

              <div className="text-xs">
                <span className="font-semibold">Clients Assigned:</span>{" "}
                {c.client_count}
              </div>


            </div>
            <div className="flex gap-2">

              <Button
                size="sm"
                variant="outline"
                onClick={() => openAssignedClients(c)}
              >
                Open
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenDialog(c)}
              >
                Edit
              </Button>

              <Button
                size="sm"
                variant="destructive"
                disabled={c.client_count > 0}
                onClick={() => handleDelete(c.cpa_id)}
              >
                Delete
              </Button>

            </div>

          </div>
        ))}
      </CardContent>

        <Dialog open={openClientsModal} onOpenChange={setOpenClientsModal}>
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          Assigned Clients — {selectedCPA?.cpa_name}
        </DialogTitle>
      </DialogHeader>

      {loadingClients ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading assigned clients...
        </div>
      ) : assignedClients.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No clients assigned to this CPA.
        </div>
      ) : (
        <div className="space-y-3">
          {assignedClients.map((c) => (
            <div
              key={c.client_id}
              className="border rounded p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">{c.client_name}</div>
                {/* <div className="text-xs text-muted-foreground">
                  Code: {c.code}
                </div>
                <div className="text-xs">
                  Status: {c.status || c.client_status || "—"}
                </div> */}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  window.location.href = `/admin/clients/${c.client_id}`
                }
              >
                View Client
              </Button>
            </div>
          ))}
        </div>
      )}
    </DialogContent>
  </Dialog>

    </Card>
  );
}
