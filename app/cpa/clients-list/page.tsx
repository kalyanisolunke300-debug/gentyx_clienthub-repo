"use client"

import useSWR from "swr"
import { fetchClients } from "@/lib/api"
import { DataTable, type Column, TableToolbar, useServerTableState, TablePagination } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/widgets/status-pill"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { Label } from "@/components/ui/label"

export default function CPAClientsPage() {
  const { page, setPage, pageSize, q, setQ } = useServerTableState()
  const { data } = useSWR(["cpa-clients", page, pageSize, q], () => fetchClients({ page, pageSize, q }), {
    keepPreviousData: true,
  })
  const router = useRouter()
  const [stageFilter, setStageFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const cols: Column<any>[] = [
    { key: "name", header: "Client Name" },
    { key: "onboardingStage", header: "Stage" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "actions",
      header: "Action",
      render: (r) => (
        <Button size="sm" onClick={() => router.push(`/cpa/clients/${r.id}`)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assigned Clients</h1>
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
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <TableToolbar q={q} setQ={setQ} />
      <DataTable columns={cols} rows={data?.data || []} />
      <TablePagination
        page={data?.page || 1}
        pageSize={data?.pageSize || 10}
        total={data?.total || 0}
        setPage={setPage}
      />
    </div>
  )
}
