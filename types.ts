// types.ts
export type UserRole = "ADMIN" | "CLIENT" | "SERVICE_CENTER" | "CPA";

export type ClientProfile = {
  client_id: number;
  client_name: string;
  code?: string;
  client_status: string;
  sla_number?: string;

  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;

  created_at: string;
  updated_at?: string;

  service_center_id?: number;
  cpa_id?: number;

  stage_id?: number;
  stage_name?: string;   // <-- comes from JOIN
  progress: number;      // <-- numeric progress
  status: string;        // <-- task status or client status
};

/* ------------------------- */
export type DocumentFile = {
  id: string;
  clientId: string;
  name: string;
  type: "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
  uploadedByRole: UserRole;
  uploadedAt: string;
  status?: "Uploaded" | "Reviewed" | "Approved" | "Needs Fix";
  notes?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  client_id: string;
  stage?: string;
  assigneeRole: UserRole;
  createdByRole: UserRole;
  status: "Pending" | "In Review" | "Approved" | "Rejected";
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: DocumentFile[];
};

export type Stage = {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  order: number;
};

export type Message = {
  id: string;
  threadId: string;
  participants: { role: UserRole; display: string }[];
  senderRole: UserRole;
  clientId?: string;
  body: string;
  createdAt: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};

export type AuditLog = {
  id: string;
  actorRole: UserRole;
  action: string;
  clientId?: string;
  metadata?: Record<string, any>;
  at: string;
};

export type CPA = {
  cpa_id: number;
  cpa_code: string;
  cpa_name: string;
  email: string;
  created_at: string;
  updated_at?: string;
};

