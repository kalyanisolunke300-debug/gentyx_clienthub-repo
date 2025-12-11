// app/admin/documents/page.tsx
"use client";

import useSWR, { mutate } from "swr";                // ⬅ add mutate
import { fetchDocuments, fetchClients } from "@/lib/api";
import {
  DataTable,
  type Column,
  TableToolbar,
  useServerTableState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/widgets/status-pill";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export default function AdminDocumentsPage() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState();

  const { data: docs } = useSWR(["docs", page, pageSize], () =>
    fetchDocuments({ clientId: "" })
  );
  const { data: clients } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 100 })
  );

  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [notes, setNotes] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadRole, setUploadRole] = useState("");
  const [uploadUser, setUploadUser] = useState("");         // clientId
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");   // PDF / IMG / etc

  const { toast } = useToast();

  // ------- helpers ---------

  const getUsersForRole = () => {
    if (uploadRole === "CLIENT") {
      // backend clients: client_id, client_name
      return clients?.data || [];
    }
    // TODO: add service centers / CPAs once those APIs exist
    return [];
  };

  function handleOpenNotes(doc: any) {
    setSelectedDoc(doc);
    setNotes(doc.notes || "");
    setNotesOpen(true);
  }

  function handleSaveNotes() {
    if (selectedDoc) {
      toast({ title: "Saved", description: "Notes saved successfully" });
      setNotesOpen(false);
    }
  }

  async function handlePreview(doc: any) {
    console.log("Preview triggered", doc);

    try {
      const res = await fetch(
        `/api/documents/get-sas?path=${encodeURIComponent(doc.path)}`
      );

      const data = await res.json();

      console.log("Preview SAS URL:", data);

      if (!data.sasUrl) {
        alert("Failed to generate preview link.");
        return;
      }

      window.open(data.sasUrl, "_blank");
    } catch (err) {
      console.error("Preview error:", err);
    }
  }

  // auto-detect file type from extension
  function detectFileType(file: File): string {
    const ext = file.name.split(".").pop()?.toUpperCase() || "OTHER";
    const typeMap: Record<string, string> = {
      PDF: "PDF",
      XLSX: "XLSX",
      XLS: "XLSX",
      DOCX: "DOCX",
      DOC: "DOCX",
      JPG: "IMG",
      JPEG: "IMG",
      PNG: "IMG",
      GIF: "IMG",
    };
    return typeMap[ext] || "OTHER";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);

    if (file) {
      const type = detectFileType(file);
      setUploadDocType(type);
    } else {
      setUploadDocType("");
    }
  }

  // ------- REAL upload handler ---------
  async function handleUploadDocument() {
  if (!uploadRole || !uploadUser || !uploadFile || !uploadDocType) {
    toast({
      title: "Error",
      description: "Please fill in all required fields",
      variant: "destructive",
    });
    return;
  }

  const formData = new FormData();
  formData.append("clientId", uploadUser);     // user dropdown gives clientId
  formData.append("fileType", uploadDocType);  // PDF / IMG / DOCX
  formData.append("file", uploadFile);

  try {
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    toast({ title: "Success", description: "Document uploaded successfully" });

    setUploadOpen(false);

    // Refresh UI
    location.reload();

  } catch (err: any) {
    toast({
      title: "Upload error",
      description: err.message,
      variant: "destructive",
    });
  }
}

  const cols: Column<any>[] = [
    {
      key: "clientId",
      header: "Client Name",
      render: (r) => {
        const client = clients?.data?.find(
          (c: any) => c.client_id === r.clientId
        );
        return client?.client_name || "Unknown";
      },
    },
    { key: "name", header: "Document" },
    { key: "type", header: "Type" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status || "Uploaded"} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex w-[150px] justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenNotes(r)}
          >
            Notes
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePreview(r)}
          >
            Preview
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1 size-4" /> Upload Document
        </Button>
      </div>

      <TableToolbar q={q} setQ={setQ} />
      <DataTable columns={cols} rows={docs || []} />
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={docs?.length || 0}
        setPage={setPage}
      />

      {/* Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Notes: {selectedDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes for this document..."
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNotesOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNotes}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="upload-role">Select Role</Label>
              <Select
                value={uploadRole}
                onValueChange={(value) => {
                  setUploadRole(value);
                  setUploadUser("");
                }}
              >
                <SelectTrigger id="upload-role">
                  <SelectValue placeholder="Choose role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Client</SelectItem>
                  <SelectItem value="SERVICE_CENTER">Service Center</SelectItem>
                  <SelectItem value="CPA">CPA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User */}
            {uploadRole && (
              <div className="grid gap-2">
                <Label htmlFor="upload-user">Select User</Label>
                <Select
                  value={uploadUser}
                  onValueChange={setUploadUser}
                >
                  <SelectTrigger id="upload-user">
                    <SelectValue placeholder="Choose user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getUsersForRole().map((user: any) => (
                      <SelectItem
                        key={user.client_id}
                        value={String(user.client_id)}
                      >
                        {user.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* File */}
            <div className="grid gap-2">
              <Label htmlFor="upload-file">File Upload</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.gif"
                onChange={handleFileChange}
              />
            </div>

            {/* File Type (PDF / XLSX / IMG etc) */}
            <div className="grid gap-2">
              <Label htmlFor="upload-type">File Type</Label>
              <Select
                value={uploadDocType}
                onValueChange={setUploadDocType}
              >
                <SelectTrigger id="upload-type">
                  <SelectValue placeholder="Select file type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="XLSX">XLSX</SelectItem>
                  <SelectItem value="DOCX">DOCX</SelectItem>
                  <SelectItem value="IMG">IMG</SelectItem>
                  <SelectItem value="OTHER">OTHER</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUploadDocument}>Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
