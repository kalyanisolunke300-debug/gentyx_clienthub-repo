// app/client/messages/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useUIStore } from "@/store/ui-store";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { fetchClient } from "@/lib/api";

export default function ClientMessages() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);

  const [clientId, setClientId] = useState<string | null>(null);

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Fetch client data to get service center info
  const { data: client } = useSWR(
    clientId ? ["client", clientId] : null,
    () => fetchClient(clientId!)
  );

  // Fetch service center name if assigned
  const { data: serviceCenterData } = useSWR(
    client?.service_center_id ? ["sc", client.service_center_id] : null,
    async () => {
      const res = await fetch(`/api/service-centers/${client!.service_center_id}/get`);
      const json = await res.json();
      return json.data;
    }
  );

  const serviceCenterName = serviceCenterData?.center_name;

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Communicate with your admin, service center, and CPA team
        </p>
      </div>

      <FlexibleChat
        clientId={clientId}
        serviceCenterName={serviceCenterName}
        currentUserRole="CLIENT"
        recipients={[
          { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
          { role: "SERVICE_CENTER", label: serviceCenterName || "Service Center", color: "bg-emerald-500" },
          { role: "CPA", label: "CPA", color: "bg-amber-500" },
        ]}
        height="600px"
      />
    </div>
  );
}
