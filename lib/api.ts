// lib/api.ts
import type { ClientProfile } from "@/types";

/* -------------------------------------------------------------
    FETCH CLIENT LIST  (calls:  /api/clients/get )
--------------------------------------------------------------*/
export async function fetchClients({
  page = 1,
  pageSize = 10,
  q = "",
}: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    q,
  });

  const res = await fetch(`/api/clients/get?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

/* -------------------------------------------------------------
    FETCH SINGLE CLIENT BY ID (calls: /api/clients/[id]/get )
--------------------------------------------------------------*/
export async function fetchClient(id: string) {
  const res = await fetch(`/api/clients/${id}/get`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch client");
  const json = await res.json();
  return json.data as ClientProfile;
}

/* -------------------------------------------------------------
    (OLD) CLIENT-SPECIFIC TASKS — used in Client Detail Page
    calls: /api/tasks/get?clientId=123
--------------------------------------------------------------*/
export async function fetchClientTasks(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/tasks/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch tasks for client");
  return res.json();
}

/* -------------------------------------------------------------
    (NEW) ADMIN — FETCH ALL TASKS
    calls: /api/tasks/list?page=&pageSize=
--------------------------------------------------------------*/
export async function fetchTasks({
  page = 1,
  pageSize = 10,
}: {
  page?: number;
  pageSize?: number;
}) {
  const res = await fetch(
    `/api/tasks/list?page=${page}&pageSize=${pageSize}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json(); // {success, data, page, pageSize, total}
}

/* -------------------------------------------------------------
    FETCH DOCUMENTS (calls: /api/documents/get )
--------------------------------------------------------------*/
export async function fetchDocuments(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/documents/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

/* -------------------------------------------------------------
    FETCH MESSAGES (calls: /api/messages/get )
--------------------------------------------------------------*/
export async function fetchMessages(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/messages/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

/* -------------------------------------------------------------
    FETCH AUDIT LOGS (calls: /api/audit/get )
--------------------------------------------------------------*/
export async function fetchAuditLogs(params?: { clientId?: string }) {
  const qs = new URLSearchParams();
  if (params?.clientId) qs.set("clientId", params.clientId);

  const res = await fetch(`/api/audit/get?${qs.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}
/* -------------------------------------------------------------
    ASSIGN TASK (calls: /api/tasks/add )
--------------------------------------------------------------*/
// FIXED: Updated payload type to match backend fields
export async function assignTask(payload: {
  taskTitle?: string;
  title?: string;
  clientId: string | number;
  assignedToRole?: string;
  assigneeRole?: string;
  dueDate?: string | null;
  assignedUsers?: string[];
  stageId?: number;
  orderNumber?: number;
}) {

  console.log("API assignTask payload:", payload);

  const res = await fetch("/api/tasks/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskTitle: payload.title,
      clientId: Number(payload.clientId),
      assignedToRole: payload.assigneeRole,
      dueDate: payload.dueDate || null,
      // temporarily not using assignedUsers — backend update next
      stageId: 1,
      orderNumber: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("assignTask API Error:", text);
    throw new Error("Failed to assign task");
  }

  return res.json();
}


// FETCH SERVICE CENTERS
export async function fetchServiceCenters() {
  const res = await fetch("/api/service-centers/get", { cache: "no-store" });
  const json = await res.json();
  return json; // must contain { success, data }
}

// FETCH CPAs (already working)
export async function fetchCPAs() {
  const res = await fetch("/api/cpas/get", { cache: "no-store" });
  return res.json();
}

// FETCH MASTER STAGES (NO CLIENT ID NEEDED)
export async function fetchStagesList() {
  const res = await fetch("/api/stages/list", { cache: "no-store" });
  const json = await res.json();
  return json; // must return { success, data }
}


/* -------------------------------------------------------------
    CREATE NEW CLIENT  (calls: /api/clients/add )
--------------------------------------------------------------*/
export type NewClientPayload = {
  clientName: string;
  code?: string;
  slaNumber?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  serviceCenterId?: number | null;
  cpaId?: number | null;
  stageId?: number | null;
  associatedUsers: {
    name: string;
    email: string;
    role: string;
  }[];
};

export async function createClient(payload: any) {

  console.log("FINAL PAYLOAD SENT TO BACKEND:", payload);

  const res = await fetch("/api/clients/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to create client");
  return res.json();
}

