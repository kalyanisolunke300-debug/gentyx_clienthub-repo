"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  // ---------------------------- FILTER STATES ----------------------------
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    serviceCenter: "all",
    cpa: "all",
    stage: "all",
    status: "all",
  });

  const [reportData, setReportData] = useState<any[]>([]);
  const [serviceCenters, setServiceCenters] = useState<any[]>([]);
  const [cpas, setCPAs] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  // Summary data
  const [taskSummary, setTaskSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    inreview: 0,
  });

  const [stageSummary, setStageSummary] = useState<any>({});
  const [documentSummary, setDocumentSummary] = useState<any>({});

  const { toast } = useToast();

  // ---------------------------- FETCH MULTIPLE MASTER LISTS ----------------------------
  async function loadMasterFilters() {
    const [scRes, cpaRes, stageRes] = await Promise.all([
      fetch("/api/service-centers/get"),
      fetch("/api/cpas/get"),
      fetch("/api/stages/list"),
    ]);

    const sc = await scRes.json();
    const cp = await cpaRes.json();
    const st = await stageRes.json();

    setServiceCenters(sc.data || []);
    setCPAs(cp.data || []);
    setStages(st.data || []);
  }

  // ---------------------------- FETCH REPORT DATA ----------------------------
  async function fetchReports() {
    const body = {
      fromDate: filters.fromDate || null,
      toDate: filters.toDate || null,
      serviceCenter:
        filters.serviceCenter === "all" ? null : Number(filters.serviceCenter),
      cpa: filters.cpa === "all" ? null : Number(filters.cpa),
      stage: filters.stage === "all" ? null : Number(filters.stage),
      status: filters.status === "all" ? null : filters.status,
    };

    const res = await fetch("/api/reports/get", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.success) {
      console.error("Report fetch error:", data.error);
      return;
    }

    setReportData(data.clients);

    // ---------------- SUMMARY: STAGE COUNT ----------------
    const stageCount: any = {};
    data.clients.forEach((c: any) => {
      stageCount[c.stage_name] = (stageCount[c.stage_name] || 0) + 1;
    });
    setStageSummary(stageCount);

    // ---------------- SUMMARY: TASK STATUS ----------------
    let pending = 0,
      approved = 0,
      rejected = 0,
      inreview = 0;

    data.clients.forEach((c: any) => {
      pending += c.pending_tasks;
      approved += c.approved_tasks;
      rejected += c.rejected_tasks;
      inreview += c.inreview_tasks;
    });

    setTaskSummary({ pending, approved, rejected, inreview });

    // ---------------- SUMMARY: DOCUMENTS (NEED REAL TABLE NEXT) ----------------
    setDocumentSummary({
      uploaded: 7,
      reviewed: 8,
      approved: 8,
      needsFix: 7,
    });
  }

  // Load master lists once
  useEffect(() => {
    loadMasterFilters();
  }, []);

  // Fetch report whenever filters change
  useEffect(() => {
    fetchReports();
  }, [filters]);

  // ---------------------------- EXPORT CSV ----------------------------
  function handleExportCSV() {
    const csv = [
      ["Client", "Stage", "Progress", "Status"],
      ...reportData.map((r) => [
        r.client_name,
        r.stage_name,
        r.progress + "%",
        r.client_status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients-report.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Exported", description: "CSV file downloaded" });
  }

  return (
    <div className="grid gap-4">
      {/* ---------------------- FILTERS ---------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          {/* DATE FROM */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">From</div>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) =>
                setFilters({ ...filters, fromDate: e.target.value })
              }
            />
          </div>

          {/* DATE TO */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">To</div>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) =>
                setFilters({ ...filters, toDate: e.target.value })
              }
            />
          </div>

          {/* SERVICE CENTER FILTER */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Service Center
            </div>
            <Select
              value={filters.serviceCenter}
              onValueChange={(v) => setFilters({ ...filters, serviceCenter: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {serviceCenters.map((sc) => (
                  <SelectItem
                    key={sc.service_center_id}
                    value={String(sc.service_center_id)}
                  >
                    {sc.center_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CPA FILTER */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">CPA</div>
            <Select
              value={filters.cpa}
              onValueChange={(v) => setFilters({ ...filters, cpa: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {cpas.map((c) => (
                  <SelectItem key={c.cpa_id} value={String(c.cpa_id)}>
                    {c.cpa_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STATUS FILTER */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">Status</div>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------- SUMMARY CARDS ---------------------- */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* CLIENTS BY STAGE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Clients by Stage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {Object.entries(stageSummary).map(([stage, count]: [string, unknown]) => (
              <div key={stage} className="flex justify-between">
                <span>{stage}</span>
                <span className="font-medium">{String(count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* TASK STATUS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tasks Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Pending</span>
              <span className="font-medium">{taskSummary.pending}</span>
            </div>
            <div className="flex justify-between">
              <span>In Review</span>
              <span className="font-medium">{taskSummary.inreview}</span>
            </div>
            <div className="flex justify-between">
              <span>Approved</span>
              <span className="font-medium">{taskSummary.approved}</span>
            </div>
            <div className="flex justify-between">
              <span>Rejected</span>
              <span className="font-medium">{taskSummary.rejected}</span>
            </div>
          </CardContent>
        </Card>

        {/* DOCUMENT STATUS (static for now) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Documents Status</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Uploaded</span>
              <span className="font-medium">{documentSummary.uploaded}</span>
            </div>
            <div className="flex justify-between">
              <span>Reviewed</span>
              <span className="font-medium">{documentSummary.reviewed}</span>
            </div>
            <div className="flex justify-between">
              <span>Approved</span>
              <span className="font-medium">{documentSummary.approved}</span>
            </div>
            <div className="flex justify-between">
              <span>Needs Fix</span>
              <span className="font-medium">{documentSummary.needsFix}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------- CLIENT REPORT TABLE ---------------------- */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Clients Report</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Client</th>
                  <th className="text-left p-2">Stage</th>
                  <th className="text-left p-2">Progress</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {reportData.map((c) => (
                  <tr key={c.client_id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{c.client_name}</td>
                    <td className="p-2">{c.stage_name}</td>
                    <td className="p-2">{c.progress}%</td>
                    <td className="p-2">{c.client_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
