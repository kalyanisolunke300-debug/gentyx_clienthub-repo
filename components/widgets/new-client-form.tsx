// components/widgets/new-client-form.tsx
"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";

import { createClient, fetchServiceCenters, fetchCPAs } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const NewClientSchema = z.object({
  clientName: z.string().min(2, "Company name is required"),
  code: z.string().optional(),
  slaNumber: z.string().optional(),
  primaryContactName: z.string().min(2, "Primary contact is required"),
  primaryContactEmail: z
    .string()
    .email("Valid email required")
    .min(3, "Email is required"),
  primaryContactPhone: z.string().optional(),
  serviceCenterId: z.string().optional(),
  cpaId: z.string().optional(),
  stageId: z.string().optional(),
  associatedUsers: z
    .array(
      z.object({
        name: z.string().min(1, "Name required"),
        email: z.string().email("Valid email required"),
        role: z.string().min(1, "Role required"),
      })
    )
    .optional(),
});

type FormValues = z.infer<typeof NewClientSchema>;

export function NewClientForm() {
  const { toast } = useToast();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

  // Load Service Centers & CPAs
  const { data: serviceCentersData } = useSWR(
    ["service-centers"],
    () => fetchServiceCenters(),
    { revalidateOnFocus: false }
  );

  const { data: cpasData } = useSWR(["cpas"], () => fetchCPAs(), {
    revalidateOnFocus: false,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(NewClientSchema),
    defaultValues: {
      clientName: "",
      code: "",
      slaNumber: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      serviceCenterId: "",
      cpaId: "",
      stageId: "",
      associatedUsers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "associatedUsers",
  });

  async function onSubmit(values: FormValues) {
    try {
      setSubmitting(true);

      const payload = {
        clientName: values.clientName,
        code: values.code || undefined,
        slaNumber: values.slaNumber || undefined,
        primaryContactName: values.primaryContactName,
        primaryContactEmail: values.primaryContactEmail,
        primaryContactPhone: values.primaryContactPhone || "",
        serviceCenterId: values.serviceCenterId
          ? Number(values.serviceCenterId)
          : null,
        cpaId: values.cpaId ? Number(values.cpaId) : null,
        stageId: values.stageId ? Number(values.stageId) : null,
        associatedUsers: (values.associatedUsers || []).map((u) => ({
          name: u.name,
          email: u.email,
          role: u.role,
        })),
      };

      const res = await createClient(payload);

      if (!res.success) {
        throw new Error(res.error || "Failed to create client");
      }

      toast({
        title: "Client created",
        description: "New client has been added and tasks seeded.",
      });

      // Redirect back to Clients list
      router.push("/admin/clients");
    } catch (err: any) {
      console.error("NewClientForm error:", err);
      toast({
        title: "Error",
        description: err?.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const serviceCenters = serviceCentersData?.data || [];
  const cpas = cpasData?.data || [];

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid gap-4 max-w-3xl"
    >
      {/* Company Name */}
      <div className="grid gap-2">
        <Label>Company Name</Label>
        <Input
          {...form.register("clientName")}
          placeholder="Acme LLC"
        />
        {form.formState.errors.clientName && (
          <p className="text-xs text-red-500">
            {form.formState.errors.clientName.message}
          </p>
        )}
      </div>

      {/* Primary Contact */}
      <div className="grid gap-2">
        <Label>Primary Contact</Label>
        <Input
          {...form.register("primaryContactName")}
          placeholder="Jane Doe"
        />
      </div>

      {/* Email */}
      <div className="grid gap-2">
        <Label>Email</Label>
        <Input
          type="email"
          {...form.register("primaryContactEmail")}
          placeholder="jane@example.com"
        />
      </div>

      {/* Phone */}
      <div className="grid gap-2">
        <Label>Phone</Label>
        <Input
          {...form.register("primaryContactPhone")}
          placeholder="+1-555-555-5555"
        />
      </div>

      {/* Code + SLA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Code</Label>
          <Input {...form.register("code")} placeholder="CLI-001" />
        </div>

        <div className="grid gap-2">
          <Label>SLA Number</Label>
          <Input
            {...form.register("slaNumber")}
            placeholder="SLA-2025-01"
          />
        </div>
      </div>

      {/* Service Center */}
      <div className="grid gap-2">
        <Label>Service Center</Label>
        <Select
          value={form.watch("serviceCenterId") || ""}
          onValueChange={(v) => form.setValue("serviceCenterId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Assign service center" />
          </SelectTrigger>
          <SelectContent>
            {serviceCenters.map((sc: any) => (
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
          value={form.watch("cpaId") || ""}
          onValueChange={(v) => form.setValue("cpaId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Assign CPA" />
          </SelectTrigger>
          <SelectContent>
            {cpas.map((c: any) => (
              <SelectItem
                key={c.cpa_id}
                value={String(c.cpa_id)}
              >
                {c.cpa_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Initial Stage */}
      {/* If you already have stages API, you can hook it here.
          For now, simple free-text / numeric entry: */}
      <div className="grid gap-2">
        <Label>Initial Stage ID</Label>
        <Input
          {...form.register("stageId")}
          placeholder="e.g. 1"
        />
        <p className="text-xs text-muted-foreground">
          (For now, enter the Stage ID manually. We can hook a stages dropdown
          later.)
        </p>
      </div>

      {/* Associated Users */}
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-medium">Associated Users</p>
            <p className="text-xs text-muted-foreground">
              Team members who will access this client.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ name: "", email: "", role: "Client User" })
            }
          >
            + Add another user
          </Button>
        </div>

        <div className="grid gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-[1fr,1fr,150px,auto] gap-2 items-end"
            >
              <div className="grid gap-1">
                <Label className="text-xs">Name</Label>
                <Input
                  {...form.register(`associatedUsers.${index}.name` as const)}
                  placeholder="User name"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Email</Label>
                <Input
                  {...form.register(
                    `associatedUsers.${index}.email` as const
                  )}
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Role</Label>
                <Input
                  {...form.register(`associatedUsers.${index}.role` as const)}
                  placeholder="Client User"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
              >
                ✕
              </Button>
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No associated users yet. You can add them later.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/clients")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Client"}
        </Button>
      </div>
    </form>
  );
}
