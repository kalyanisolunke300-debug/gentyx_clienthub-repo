// components/data-table.tsx
"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type Column<T> = {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

export type ServerPage<T> = {
  data: T[]
  page: number
  pageSize: number
  total: number
}

/* -------------------------------------------------------------------------- */
/*                         PAGINATION + SEARCH HOOK                           */
/* -------------------------------------------------------------------------- */

export function useServerTableState(initial?: {
  page?: number
  pageSize?: number
  q?: string
}) {
  const [page, setPage] = React.useState(initial?.page || 1)
  const [pageSize, setPageSize] = React.useState(initial?.pageSize || 10)
  const [q, setQ] = React.useState(initial?.q || "")

  return { page, setPage, pageSize, setPageSize, q, setQ }
}

/* -------------------------------------------------------------------------- */
/*                               TABLE TOOLBAR                                */
/* -------------------------------------------------------------------------- */

export function TableToolbar({
  q,
  setQ,
  onCreate,
  ctaLabel = "Create",
}: {
  q?: string
  setQ?: (value: string) => void
  onCreate?: () => void
  ctaLabel?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ?.(e.target.value)}
        placeholder="Search..."
        className="max-w-xs"
      />
      {onCreate && <Button onClick={onCreate}>{ctaLabel}</Button>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             PAGINATION FOOTER                              */
/* -------------------------------------------------------------------------- */

export function TablePagination({
  page,
  pageSize,
  total,
  setPage,
}: {
  page: number
  pageSize: number
  total: number
  setPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex items-center justify-end gap-2 py-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Prev
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  DATA TABLE                                */
/* -------------------------------------------------------------------------- */

export function DataTable<T>({
  columns,
  rows,
  onRowAction,
  actionsLabel,
  page,
  pageSize,
  total,
  setPage,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowAction?: (row: T) => React.ReactNode
  actionsLabel?: string
  page?: number
  pageSize?: number
  total?: number
  setPage?: (p: number) => void
}) {
  return (
    <div className="w-full rounded-md border">
      {/* TABLE */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)} className={c.className}>
                  {c.header}
                </TableHead>
              ))}

              {onRowAction && (
                <TableHead className="w-24">{actionsLabel || "Actions"}</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={String(c.key)} className={c.className}>
                    {c.render ? c.render(row) : (row as any)[c.key]}
                  </TableCell>
                ))}

                {onRowAction && <TableCell>{onRowAction(row)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION */}
      {total !== undefined && setPage && (
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {Math.max(1, Math.ceil((total || 0) / (pageSize || 1)))}
          </span>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(page || 1) <= 1}
              onClick={() => setPage(Math.max(1, (page || 1) - 1))}
            >
              Prev
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={
                (page || 1) >= Math.ceil((total || 0) / (pageSize || 1))
              }
              onClick={() =>
                setPage(
                  Math.min(
                    Math.ceil((total || 0) / (pageSize || 1)),
                    (page || 1) + 1
                  )
                )
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
