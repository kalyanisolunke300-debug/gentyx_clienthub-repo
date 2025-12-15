//app/client/documents/page.tsx
"use client"

import useSWR from "swr"
import { fetchDocuments } from "@/lib/api"
import { DataTable, type Column } from "@/components/data-table"
import { StatusPill } from "@/components/widgets/status-pill"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/store/ui-store"
import { Upload } from "lucide-react"

export default function ClientDocuments() {
  const role = useUIStore((s) => s.role)
  const currentClientId = useUIStore((s) => s.currentClientId)

  /* Only fetch documents for the current client, ensure proper visibility */
  const clientId = role === "CLIENT" ? currentClientId || "cli-1" : undefined

  // const { data } = useSWR(["client-docs", clientId], () => fetchDocuments({ clientId }), { revalidateOnFocus: false })
  const { data } = useSWR(
  ["client-docs", clientId],
  () => fetchDocuments({ clientId: clientId ?? "" }),
  { revalidateOnFocus: false }
);


  const cols: Column<any>[] = [
    { key: "name", header: "Name" },
    { key: "type", header: "Type" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || "Uploaded"} /> },
    { key: "notes", header: "Notes" },
    {
      key: "uploadedAt",
      header: "Uploaded",
      render: (r) => new Date(r.uploadedAt).toLocaleDateString(),
    },
  ]

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My Documents</h1>
          <p className="text-sm text-muted-foreground">Manage your onboarding documents</p>
        </div>
        <Button onClick={() => useUIStore.getState().openDrawer("uploadDoc", { clientId })}>
          <Upload className="mr-2 size-4" /> Upload Document
        </Button>
      </div>
      {/* -------------------------------
      CUSTOM EMPTY STATE LOGIC
      ------------------------------- */}
      {(!data || data.length === 0) ? (
        <div className="w-full border rounded-md p-10 text-center grid gap-3">
          <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>

          <Button
            size="sm"
            onClick={() => useUIStore.getState().openDrawer("uploadDoc", { clientId })}
          >
            <Upload className="mr-2 size-4" />
            Add Document
          </Button>
        </div>
      ) : (
        <DataTable columns={cols} rows={data} />
      )}
    </div>
  )
}
