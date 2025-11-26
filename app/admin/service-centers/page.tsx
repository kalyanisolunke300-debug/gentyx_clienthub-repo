// app/admin/service-centers/page.tsx
"use client";

import { useEffect, useState } from "react";
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
import { Plus, X } from "lucide-react";

type AssociatedUser = {
  id?: number;
  name: string;
  email: string;
  role: string;
};

type ServiceCenter = {
  center_id: number;
  center_code: string;
  center_name: string;
  email: string;
  users: AssociatedUser[];
};

export default function ServiceCentersPage() {
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [editing, setEditing] = useState<ServiceCenter | null>(null);

  const [formData, setFormData] = useState({
    center_name: "",
    center_code: "",
    email: "",
  });

  const [users, setUsers] = useState<AssociatedUser[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "User",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

// ------------------------------
// LOAD SERVICE CENTERS
// ------------------------------
async function loadCenters() {
  try {
    const res = await fetch("/api/service-centers/list?page=1&pageSize=100");

    if (!res.ok) {
      toast({
        title: "Error",
        description: `Failed to load service centers (${res.status})`,
        variant: "destructive",
      });
      return;
    }

    const json = await res.json();

    // Handle different possible shapes: { data: [...] } or just [...]
    const raw = Array.isArray(json)
      ? json
      : json.data ?? json.centers ?? json.serviceCenters ?? [];

    // 🔴 IMPORTANT PART: normalize field names
    const centers: ServiceCenter[] = raw.map((c: any) => ({
      center_id: c.center_id ?? c.centerId ?? c.id,
      center_name: c.center_name ?? c.name,
      center_code: c.center_code ?? c.code ?? "",   // 🔥 ALWAYS SET THIS
      email: c.email,
      users: c.users ?? [],
    }));

    setServiceCenters(centers);
  } catch (error) {
    console.error(error);
    toast({
      title: "Error",
      description: "Failed to load service centers",
      variant: "destructive",
    });
  }
}

  useEffect(() => {
    loadCenters();
  }, []);

  // ------------------------------
  // OPEN DIALOG
  // ------------------------------
  function openDialog(center?: ServiceCenter) {
  if (center) {
    setEditing(center);

    setFormData({
      center_name: center.center_name ?? "",
      center_code: center.center_code ?? "",   // keep hidden but required
      email: center.email ?? "",
    });

    setUsers(center.users || []);

  } else {
    setEditing(null);

    setFormData({ center_name: "", center_code: "", email: "" });

    setUsers([]);
  }

  setOpen(true);
}


  // ------------------------------
  // USERS
  // ------------------------------
  function addUser() {
    if (!newUser.name || !newUser.email) {
      toast({
        title: "Error",
        description: "Name & Email are required",
        variant: "destructive",
      });
      return;
    }

    setUsers([...users, { ...newUser }]);
    setNewUser({ name: "", email: "", role: "User" });
  }

  function removeUser(index: number) {
    setUsers(users.filter((_, i) => i !== index));
  }

  // ------------------------------
  // CREATE / UPDATE
  // ------------------------------
async function saveCenter() {
  if (!formData.center_name) {
    toast({
      title: "Error",
      description: "Center Name is required",
      variant: "destructive",
    });
    return;
  }

  setIsSaving(true); // START LOADING

  try {
    let payload: any;

    if (!editing) {
      payload = {
        name: formData.center_name,
        email: formData.email,
        users: users.map(u => ({
          name: u.name,
          email: u.email,
          role: u.role,
        })),
      };
    } else {
      payload = {
        center_id: editing.center_id,
        center_name: formData.center_name,
        center_code: formData.center_code,
        email: formData.email,
        users: users.map(u => ({
          name: u.name,
          email: u.email,
          role: u.role,
        })),
      };
    }

    const res = await fetch(
      editing ? "/api/service-centers/update" : "/api/service-centers/create",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Error", description: json.error, variant: "destructive" });
      return;
    }

    toast({
      title: editing ? "Updated" : "Created",
      description: `Service Center ${editing ? "updated" : "created"} successfully`,
    });

    setOpen(false);
    loadCenters();
  } finally {
    setIsSaving(false); // STOP LOADING
  }
}

  // ------------------------------
  // DELETE
  // ------------------------------
  async function deleteCenter(center_id: number) {
    if (!confirm("Are you sure you want to delete this service center?")) return;

    const res = await fetch(`/api/service-centers/delete?id=${center_id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Error", description: json.error, variant: "destructive" });
      return;
    }

    toast({ title: "Deleted", description: "Service Center deleted" });
    loadCenters();
  }

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle>Service Centers</CardTitle>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>New Service Center</Button>
          </DialogTrigger>

          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "New"} Service Center</DialogTitle>
            </DialogHeader>

            <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveCenter();
                }}
              >
              {/* Name */}
              <div className="grid gap-2">
                <Label>Center Name</Label>
                <Input
                  value={formData.center_name}
                  onChange={(e) =>
                    setFormData({ ...formData, center_name: e.target.value })
                  }
                />
              </div>

              {/* Code */}
              {/* Hidden Center Code */}
              <input type="hidden" value={formData.center_code} />

              {/* <div className="grid gap-2">
                <Label>Center Code</Label>
                <Input
                  value={formData.center_code}
                  onChange={(e) =>
                    setFormData({ ...formData, center_code: e.target.value })
                  }
                />
              </div> */}

              {/* Email */}
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              {/* Users */}
              <div className="border-t pt-4">
                <Label className="font-semibold">Associated Users</Label>

                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Input
                    placeholder="Name"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Role"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                  />
                </div>

                <Button className="w-full mt-2" variant="outline" onClick={addUser}>
                  <Plus className="mr-2 h-4" /> Add User
                </Button>

                {users.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {users.map((user, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center border p-2 rounded"
                      >
                        <div>
                          <div className="font-semibold">{user.name}</div>
                          <div className="text-xs">{user.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.role}
                          </div>
                        </div>

                        <Button size="sm" variant="ghost" onClick={() => removeUser(i)}>
                          <X />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Updating..." : editing ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-2">
        {serviceCenters.map((center) => (
          <div
            key={center.center_id}
            className="border rounded p-3 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{center.center_name}</div>
              <div className="text-xs text-muted-foreground">{center.center_code}</div>
              <div className="text-xs">{center.email}</div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openDialog(center)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteCenter(center.center_id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
