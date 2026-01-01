// app/admin/clients/new/page.tsx
"use client";

import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClient,
  fetchServiceCenters,
  fetchCPAs,
  fetchStagesList,
} from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Plus, X } from "lucide-react";

const Schema = z.object({
  client_name: z.string().min(2, "Company name is required"),
  primary_contact_name: z.string().min(2, "Primary contact name is required"),
  primary_contact_email: z.string().min(1, "Email is required").email("Valid email required"),
  primary_contact_phone: z.string().min(1, "Phone number is required"),
  service_center_id: z.string().optional(),
  cpa_id: z.string().optional(),
  // stage_id: z.string().optional(),
});

// Helper function to format phone as 555-888-3333
function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type AssociatedUser = {
  id: string;
  name: string;
  email: string;
  role: "Client User" | "Service Center User" | "CPA User";
};

export default function NewClientPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [associatedUsers, setAssociatedUsers] = useState<AssociatedUser[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Client User" as const,
  });

  /* ------------------- FETCH SQL DATA ------------------- */
  const { data: serviceCenters } = useSWR("service-centers-list", fetchServiceCenters);
  const { data: cpas } = useSWR("cpas-list", fetchCPAs);
  const { data: stages } = useSWR("stages-master-list", fetchStagesList);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      client_name: "",
      primary_contact_name: "",
      primary_contact_email: "",
      primary_contact_phone: "",
      service_center_id: "",
      cpa_id: "",
      // stage_id: "",
    },
  });

  /* ------------------- ADD USER ------------------- */
  function addUser() {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email required",
        variant: "destructive",
      });
      return;
    }

    setAssociatedUsers([...associatedUsers, { id: `user-${Date.now()}`, ...newUser }]);
    setNewUser({ name: "", email: "", role: "Client User" });
  }

  /* ------------------- REMOVE USER ------------------- */
  function removeUser(id: string) {
    setAssociatedUsers(associatedUsers.filter((u) => u.id !== id));
  }

  /* ------------------- SUBMIT FORM ------------------- */
  async function onSubmit(values: z.infer<typeof Schema>) {
    try {
      setIsSubmitting(true);

      const res = await createClient({
        clientName: values.client_name,
        primaryContactName: values.primary_contact_name,
        primaryContactEmail: values.primary_contact_email,
        primaryContactPhone: values.primary_contact_phone,
        // 👇 FIXED FIELD NAME & VALUE
        service_center_id: Number(values.service_center_id) || null,

        cpaId: Number(values.cpa_id) || null,
        // stageId: Number(values.stage_id) || null,
        associatedUsers,
      });

      // ✅ Check for API error response
      if (!res.success) {
        toast({
          title: "Error",
          description: res.error || "Failed to create client",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Client Created",
        description: "New client added successfully",
        variant: "success",
      });

      router.push(`/admin/clients/${res.clientId}`);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ------------------- UI ------------------- */
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New Client</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3">

          {/* Company Name */}
          <div className="grid gap-2">
            <Label>Company Name <span className="text-red-500">*</span></Label>
            <Input {...form.register("client_name")} placeholder="Acme LLC" />
            {form.formState.errors.client_name && (
              <p className="text-xs text-red-500">{form.formState.errors.client_name.message}</p>
            )}
          </div>

          {/* Primary Contact */}
          <div className="grid gap-2">
            <Label>Primary Contact <span className="text-red-500">*</span></Label>
            <Input {...form.register("primary_contact_name")} placeholder="John Doe" />
            {form.formState.errors.primary_contact_name && (
              <p className="text-xs text-red-500">{form.formState.errors.primary_contact_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label>Email <span className="text-red-500">*</span></Label>
            <Input {...form.register("primary_contact_email")} placeholder="john@example.com" />
            {form.formState.errors.primary_contact_email && (
              <p className="text-xs text-red-500">{form.formState.errors.primary_contact_email.message}</p>
            )}
          </div>
          {/* Phone */}
          <div className="grid gap-2">
            <Label>Phone <span className="text-red-500">*</span></Label>
            <Controller
              control={form.control}
              name="primary_contact_phone"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="555-888-3333"
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value);
                    field.onChange(formatted);
                  }}
                />
              )}
            />
            {form.formState.errors.primary_contact_phone && (
              <p className="text-xs text-red-500">{form.formState.errors.primary_contact_phone.message}</p>
            )}
          </div>

          {/* Service Center */}
          <div className="grid gap-2">
            <Label>Service Center</Label>

            <Select
              value={form.watch("service_center_id")}
              onValueChange={(v) => form.setValue("service_center_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign service center" />
              </SelectTrigger>

              <SelectContent>
                {(serviceCenters?.data || []).map((sc: any) => (
                  <SelectItem
                    key={sc.service_center_id}
                    value={String(sc.service_center_id)}
                  >
                    {sc.center_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {/* CPA */}
          <div className="grid gap-2">
            <Label>CPA</Label>

            <Select
              value={form.watch("cpa_id")}
              onValueChange={(v) => form.setValue("cpa_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign CPA" />
              </SelectTrigger>

              <SelectContent>
                {(cpas?.data || []).map((c: any) => (
                  <SelectItem key={c.cpa_id} value={String(c.cpa_id)}>
                    {c.cpa_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          {/* Associated Users */}
          <div className="border-t pt-4 mt-4">
            <Label className="font-semibold">Associated Users</Label>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input
                placeholder="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />

              <Input
                placeholder="Email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />

              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser({ ...newUser, role: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client User">Client User</SelectItem>
                  <SelectItem value="Service Center User">Service Center User</SelectItem>
                  <SelectItem value="CPA User">CPA User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" className="w-full mt-2" variant="outline" onClick={addUser}>
              <Plus className="mr-1 size-4" /> Add another user
            </Button>

            {associatedUsers.length > 0 && (
              <div className="space-y-2 mt-2">
                {associatedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between border p-2 rounded-md">
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs">{u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.role}</div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => removeUser(u.id)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>

            <Button disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
              {isSubmitting ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
