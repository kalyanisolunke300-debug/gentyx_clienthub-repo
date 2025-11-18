"use client"

import useSWR from "swr"
import { fetchDocuments, fetchClients } from "@/lib/api"
import { DataTable, type Column, TableToolbar, useServerTableState, TablePagination } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"

export default function AdminDocumentsPage() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState()
  const { data: docs } = useSWR(["docs", page, pageSize], () => fetchDocuments())
  const { data: clients } = useSWR(["clients"], () => fetchClients({ page: 1, pageSize: 100 }))
  const [notesOpen, setNotesOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [notes, setNotes] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadRole, setUploadRole] = useState("")
  const [uploadUser, setUploadUser] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDocType, setUploadDocType] = useState("")
  const { toast } = useToast()

  const getUsersForRole = () => {
    if (uploadRole === "CLIENT") {
      return clients?.data || []
    }
    // For Service Center and CPA, would fetch from respective lists
    return []
  }

  function handleOpenNotes(doc: any) {
    setSelectedDoc(doc)
    setNotes(doc.notes || "")
    setNotesOpen(true)
  }

  function handleSaveNotes() {
    if (selectedDoc) {
      toast({ title: "Saved", description: "Notes saved successfully" })
      setNotesOpen(false)
    }
  }

  function handleUploadDocument() {
    if (!uploadRole || !uploadUser || !uploadFile) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Simulate upload
    toast({
      title: "Success",
      description: "Document uploaded successfully",
    })

    // Reset form
    setUploadRole("")
    setUploadUser("")
    setUploadFile(null)
    setUploadDocType("")
    setUploadOpen(false)
  }

  const cols: Column<any>[] = [
    {
      key: "clientId",
      header: "Client Name",
      render: (r) => {
        const client = clients?.data?.find((c) => c.id === r.clientId)
        return client?.name || r.clientId
      },
    },
    { key: "name", header: "Document" },
    { key: "type", header: "Type" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || "Uploaded"} /> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => handleOpenNotes(r)}>
          Notes
        </Button>
      ),
    },
  ]

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
      <TablePagination page={page} pageSize={pageSize} total={docs?.length || 0} setPage={setPage} />

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

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="upload-role">Select Role</Label>
              <Select value={uploadRole} onValueChange={setUploadRole}>
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

            {uploadRole && (
              <div className="grid gap-2">
                <Label htmlFor="upload-user">Select User</Label>
                <Select value={uploadUser} onValueChange={setUploadUser}>
                  <SelectTrigger id="upload-user">
                    <SelectValue placeholder="Choose user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getUsersForRole().map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="upload-file">File Upload</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".pdf,.xlsx,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="upload-type">Document Type (Optional)</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger id="upload-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KYC">KYC</SelectItem>
                  <SelectItem value="BANK_STATEMENT">Bank Statement</SelectItem>
                  <SelectItem value="CHART_OF_ACCOUNTS">Chart of Accounts</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
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
  )
}
