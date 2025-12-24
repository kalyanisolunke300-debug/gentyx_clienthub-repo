"use client"

import useSWR from "swr"
import { DataTable, type Column, TableToolbar, useServerTableState, TablePagination } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { useUIStore } from "@/store/ui-store"

export default function ServiceCenterClientsPage() {
  const { q, setQ } = useServerTableState()
  const router = useRouter()
  const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId)

  const [stageFilter, setStageFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Fetch only clients assigned to this Service Center
  const { data, isLoading } = useSWR(
    currentServiceCenterId ? ["sc-clients-list", currentServiceCenterId] : null,
    async () => {
      const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`)
      const json = await res.json()
      return json.data || []
    }
  )

  const clients = data || []

  // Apply filters
  const filteredClients = clients.filter((client: any) => {
    const matchesStage = stageFilter === "all" || client.stage_name === stageFilter || client.onboardingStage === stageFilter
    const matchesStatus = statusFilter === "all" || client.status === statusFilter || client.client_status === statusFilter
    const matchesSearch = !q ||
      client.client_name?.toLowerCase().includes(q.toLowerCase()) ||
      client.code?.toLowerCase().includes(q.toLowerCase())
    return matchesStage && matchesStatus && matchesSearch
  })

  const cols: Column<any>[] = [
    { key: "client_name", header: "Client Name" },
    { key: "code", header: "Code" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status || r.client_status} /> },
    {
      key: "actions",
      header: "Action",
      render: (r) => (
        <Button size="sm" onClick={() => router.push(`/service-center/clients/${r.client_id}`)}>
          View
        </Button>
      ),
    },
  ]

  if (!currentServiceCenterId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assigned Clients ({clients.length})</h1>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="stage">Filter by Stage</Label>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger id="stage">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="KYC">KYC</SelectItem>
              <SelectItem value="Docs Review">Docs Review</SelectItem>
              <SelectItem value="Accounting Setup">Accounting Setup</SelectItem>
              <SelectItem value="Go-Live">Go-Live</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Filter by Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <TableToolbar q={q} setQ={setQ} />
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading clients...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No clients assigned to this service center
        </div>
      ) : (
        <DataTable columns={cols} rows={filteredClients} />
      )}
    </div>
  )
}
