// app/client/documents/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/data-table";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import {
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Upload,
} from "lucide-react";

export default function ClientDocuments() {
  const role = useUIStore((s) => s.role);
  const currentClientId = useUIStore((s) => s.currentClientId);
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Wait for client context from login
  useEffect(() => {
    if (role === "CLIENT" && currentClientId) {
      setClientId(currentClientId);
    }
  }, [role, currentClientId]);

  // Fetch documents using the same API as admin
  const { data: docsResponse, isLoading } = useSWR(
    clientId ? ["docs", clientId, selectedFolder] : null,
    () =>
      selectedFolder
        ? fetch(`/api/documents/get-by-client?id=${clientId}&folder=${selectedFolder}`).then((r) => r.json())
        : fetch(`/api/documents/get-by-client?id=${clientId}`).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  const docs = docsResponse?.data || [];

  // Document columns with icons
  const docCols: Column<any>[] = [
    {
      key: "name",
      header: "Name",
      render: (row: any) => {
        let Icon = FileIcon;
        const lowerName = row.name.toLowerCase();
        if (lowerName.endsWith(".pdf")) Icon = FileText;
        else if (lowerName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) Icon = FileImage;
        else if (lowerName.match(/\.(xls|xlsx|csv)$/)) Icon = FileSpreadsheet;

        return (
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md text-primary">
              <Icon className="size-4" />
            </div>
            <span className="font-medium text-gray-700">{row.name}</span>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (row: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
          {row.name.split(".").pop() || "FILE"}
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (row: any) => {
        const bytes = row.size || 0;
        if (bytes === 0) return <span className="text-muted-foreground text-xs">0 B</span>;

        const units = ["B", "KB", "MB", "GB", "TB"];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

        return (
          <span className="font-mono text-xs text-muted-foreground">
            {size} {units[i]}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: any) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(row.url, "_blank")}
          >
            Preview
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeleteDocument(row)}
          >
            <Trash2 className="w-4 h-4 text-white" />
          </Button>
        </div>
      ),
    },
  ];

  async function handleDeleteDocument(doc: any) {
    if (!confirm(`Delete document "${doc.name}"?`)) return;

    const res = await fetch("/api/documents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId,
        fullPath: doc.fullPath,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Failed to delete document", variant: "destructive" });
      return;
    }

    mutate(["docs", clientId, null]);
    mutate(["docs", clientId, selectedFolder]);
    toast({ title: "Document deleted successfully" });
  }

  if (!clientId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Folder className="size-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>My Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your onboarding files and folders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* CREATE FOLDER BUTTON */}
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
              ➕ Create Folder
            </Button>

            {/* UPLOAD DOCUMENT BUTTON */}
            <Button
              size="sm"
              onClick={() =>
                useUIStore.getState().openDrawer("uploadDoc", {
                  clientId: clientId,
                  folderName: selectedFolder,
                })
              }
            >
              <span className="flex items-center gap-2">
                <Upload className="size-4" /> Upload Document
              </span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* CREATE FOLDER MODAL */}
          {showCreateFolder && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-xl shadow-xl w-[350px] space-y-4 border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Folder className="size-5 text-amber-500" /> New Folder
                  </h2>
                </div>

                <Input
                  placeholder="Folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                  autoFocus
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!newFolderName.trim()) return;

                      const res = await fetch("/api/documents/create-folder", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId: clientId,
                          folderName: newFolderName,
                          parentFolder: selectedFolder,
                        }),
                      });

                      const data = await res.json();

                      if (data.success) {
                        toast({ title: "Folder created successfully" });
                        mutate(["docs", clientId, selectedFolder]);
                        setShowCreateFolder(false);
                        setNewFolderName("");
                      } else {
                        toast({
                          title: "Folder creation failed",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* FOLDER NAVIGATION / BREADCRUMB UI */}
          {selectedFolder && (
            <div className="mb-6 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="pl-0 hover:bg-transparent hover:text-primary"
                onClick={() => setSelectedFolder(null)}
              >
                ← All Documents
              </Button>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-gray-800 flex items-center gap-2">
                <Folder className="size-4 text-amber-500" />
                {selectedFolder.split("/").pop()}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading documents...</div>
            </div>
          ) : (
            <>
              {/* FOLDERS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {docs
                  .filter((i: any) => i.type === "folder")
                  .map((folder: any) => {
                    const fullPath = selectedFolder
                      ? `${selectedFolder}/${folder.name}`
                      : folder.name;

                    return (
                      <div
                        key={folder.name}
                        onClick={() => setSelectedFolder(fullPath)}
                        className="group relative flex flex-col items-center justify-center p-6 border rounded-xl 
                          bg-amber-50/30 hover:bg-amber-50 border-gray-100 hover:border-amber-200 
                          cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Folder className="w-12 h-12 text-amber-400 mb-3 fill-amber-100 group-hover:fill-amber-200 transition-colors" />
                        <span className="text-sm font-medium text-gray-700 text-center truncate w-full px-2">
                          {folder.name}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(`Delete folder "${folder.name}"?`)) return;

                            fetch("/api/documents/delete-folder", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                clientId: clientId,
                                folderPath: fullPath,
                              }),
                            }).then(() => mutate(["docs", clientId, selectedFolder]));
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 text-gray-400 hover:text-red-600 hover:bg-red-50 
                            opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-red-100"
                          title="Delete folder"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>

              {/* FILES TABLE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Files ({docs.filter((i: any) => i.type === "file").length})
                  </h3>
                </div>

                {docs.filter((i: any) => i.type === "file").length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <FileIcon className="size-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">No files in this folder</p>
                      <p className="text-sm text-gray-400">Upload a document to get started</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          useUIStore.getState().openDrawer("uploadDoc", {
                            clientId: clientId,
                            folderName: selectedFolder,
                          })
                        }
                      >
                        <Upload className="mr-2 size-4" />
                        Upload Document
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <DataTable
                      columns={docCols}
                      rows={docs.filter((i: any) => i.type === "file")}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
