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
    calls: /api/tasks?page=&pageSize=
--------------------------------------------------------------*/
// export async function fetchTasks({
//   page = 1,
//   pageSize = 10,
// }: {
//   page?: number;
//   pageSize?: number;
// }) {
//   const res = await fetch(
//     `/api/tasks/list?page=${page}&pageSize=${pageSize}`,
//     { cache: "no-store" }
//   );

//   if (!res.ok) throw new Error("Failed to fetch tasks");
//   return res.json(); // {success, data, page, pageSize, total}
// }

// FETCH TASKS FOR SPECIFIC CLIENT (used inside client detail page)
export async function fetchTasks(params?: { clientId?: string }) {
  if (!params?.clientId) {
    throw new Error("clientId is required for fetchTasks()");
  }

  const res = await fetch(
    `/api/tasks/list?clientId=${params.clientId}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json(); // { success, data: [...] }
}


/* -------------------------------------------------------------
    FETCH DOCUMENTS (calls: /api/documents/get )
--------------------------------------------------------------*/
// export async function fetchDocuments(params?: { clientId?: string }) {
//   const qs = new URLSearchParams();
//   if (params?.clientId) qs.set("clientId", params.clientId);

//   const res = await fetch(`/api/documents/get?${qs.toString()}`, {
//     cache: "no-store",
//   });

//   if (!res.ok) throw new Error("Failed to fetch documents");
//   return res.json();
// }
// export async function fetchDocuments() {
//   const res = await fetch("/api/documents/list");
//   if (!res.ok) return [];
//   return res.json();
// }
export async function fetchDocuments({ clientId }: { clientId: string }) {
  const url = `/api/documents/list?clientId=${clientId}`;

  const res = await fetch(url);
  if (!res.ok) return [];

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
export async function assignTask(payload: {
  clientId: number;
  taskTitle: string;
  assignedToRole: string;
  dueDate?: string | null;
  description?: string;
  orderNumber?: number;
}) {
  const res = await fetch("/api/tasks/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: payload.clientId,
      taskTitle: payload.taskTitle,
      assignedToRole: payload.assignedToRole,
      dueDate: payload.dueDate || null,
      description: payload.description || "",
      orderNumber: payload.orderNumber || 1,
    }),
  });

  const json = await res.json();
  
  if (!json.success) throw new Error(json.error || "Failed to assign task");
  return json;
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

export async function fetchDefaultStages() {
  const res = await fetch("/api/stages/default", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch default stages");
  return res.json();
}

export async function fetchClientStages(clientId: number | string) {
  const res = await fetch(`/api/stages/client/get?clientId=${clientId}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch client stages");
  return res.json(); 
}

export async function saveClientStages(payload: {
  clientId: number | string;
  stages: any[];
  subtasks: Record<string, any[]>;
}) {
  const res = await fetch("/api/stages/client/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Failed to save client stages");
  return res.json();
}


// SET STAGE FOR A CLIENT
export async function setStage(payload: {
  clientId: number;
  stageName: string;
}) {
  const res = await fetch("/api/stages/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}
/* -------------------------------------------------------------
    ADMIN — FETCH ALL TASKS (NO CLIENT ID REQUIRED)
    calls: /api/tasks/list
--------------------------------------------------------------*/
export async function fetchAllTasks({
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

  if (!res.ok) throw new Error("Failed to fetch all tasks");
  return res.json(); // {success, data, page, pageSize, total}
}

// FETCH SIMPLE TASKS FOR A CLIENT (used inside client detail page) 
export async function fetchClientTasksSimple(clientId: string) {
  const res = await fetch(`/api/tasks/client?clientId=${clientId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch simple tasks");
  return res.json();
}

// FETCH CLIENT DOCUMENTS (calls: /api/documents/list )

// export async function fetchClientDocuments(clientId: string) {
//   const res = await fetch(`/api/documents/list?clientId=${clientId}`);
//   return res.json();
// }
// export async function fetchClientDocuments(clientId: string) {
//   const res = await fetch(`/api/documents/list?clientId=${clientId}`, {
//     method: "GET",
//     cache: "no-store",
//   });

//   if (!res.ok) {
//     return { data: [] };
//   }

//   const json = await res.json();

//   return {
//     data: json.data || []
//   };
// }
export async function fetchClientDocuments(clientId: string | number) {
  const res = await fetch(`/api/documents/get-by-client?id=${clientId}`);
  return res.json();
}


/* -------------------------------------------------------------
    EMAIL TEMPLATE API CALLS
--------------------------------------------------------------*/
 
// GET all templates
export async function fetchEmailTemplates() {
  const res = await fetch("/api/email-templates/get", { cache: "no-store" });
  const json = await res.json();
  return json.data || [];
}
 
// CREATE template
export async function createEmailTemplate(payload: {
  name: string;
  subject: string;
  body: string;
}) {
  const res = await fetch("/api/email-templates/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
 
  return res.json();
}
 
// UPDATE template
export async function updateEmailTemplate(payload: {
  id: number | string;
  name: string;
  subject: string;
  body: string;
}) {
  const res = await fetch("/api/email-templates/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
 
  return res.json();
}
 
// DELETE template
export async function deleteEmailTemplate(id: number | string) {
  const res = await fetch(`/api/email-templates/delete?id=${id}`, {
    method: "DELETE"
  });
 
  return res.json();
}
 