// app/admin/documents/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/data-table";
import { useUIStore } from "@/store/ui-store";
import { useToast } from "@/hooks/use-toast";
import { fetchClients } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Folder,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Trash2,
  Upload,
  CheckCircle2,
  Layers,
  Users,
  ChevronsUpDown,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// Special folder names for task completion documents
const ASSIGNED_TASK_FOLDER = "Assigned Task Completion Documents";
const ONBOARDING_FOLDER = "Onboarding Stage Completion Documents";

export default function AdminDocumentsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Read clientId and folder from URL query parameters
  const urlClientId = searchParams.get("clientId");
  const urlFolder = searchParams.get("folder");

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [clientOpen, setClientOpen] = useState(false);

  // Initialize from URL on mount
  useEffect(() => {
    if (urlClientId) {
      setSelectedClientId(urlClientId);
    }
    if (urlFolder) {
      setSelectedFolder(decodeURIComponent(urlFolder));
    }
  }, [urlClientId, urlFolder]);

  // Fetch clients list
  const { data: clientsData } = useSWR(["clients"], () =>
    fetchClients({ page: 1, pageSize: 500 })
  );
  const clients = clientsData?.data || [];

  // Fetch documents for selected client
  const { data: docsResponse, isLoading } = useSWR(
    selectedClientId ? ["docs", selectedClientId, selectedFolder] : null,
    () =>
      selectedFolder
        ? fetch(`/api/documents/get-by-client?id=${selectedClientId}&folder=${selectedFolder}`).then((r) => r.json())
        : fetch(`/api/documents/get-by-client?id=${selectedClientId}`).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  const docs = docsResponse?.data || [];

  // Get client name
  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Select a client";
    const client = clients.find((c: any) => c.client_id === Number(clientId));
    return client?.client_name || `Client #${clientId}`;
  };

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
        clientId: selectedClientId,
        fullPath: doc.fullPath,
      }),
    });

    const json = await res.json();

    if (!json.success) {
      toast({ title: "Failed to delete document", variant: "destructive" });
      return;
    }

    mutate(["docs", selectedClientId, null]);
    mutate(["docs", selectedClientId, selectedFolder]);
    toast({ title: "Document deleted successfully" });
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !selectedClientId) return;

    const res = await fetch("/api/documents/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClientId,
        folderName: newFolderName,
        parentFolder: selectedFolder,
      }),
    });

    const data = await res.json();

    if (data.success) {
      toast({ title: "Folder created successfully" });
      mutate(["docs", selectedClientId, selectedFolder]);
      setShowCreateFolder(false);
      setNewFolderName("");
    } else {
      toast({
        title: "Folder creation failed",
        description: data.error || "Unable to create folder",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Folder className="size-5 text-amber-600" />
            </div>
            <div>
              <CardTitle>Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Manage client documents and folders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* CREATE FOLDER BUTTON */}
            {selectedClientId && (
              <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
                ➕ Create Folder
              </Button>
            )}

            {/* UPLOAD DOCUMENT BUTTON */}
            {selectedClientId && (
              <Button
                size="sm"
                onClick={() =>
                  useUIStore.getState().openDrawer("uploadDoc", {
                    clientId: selectedClientId,
                    folderName: selectedFolder,
                  })
                }
              >
                <span className="flex items-center gap-2">
                  <Upload className="size-4" /> Upload Document
                </span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* PROMINENT CLIENT SELECTOR */}
          <div className={`mb-6 p-4 rounded-xl border ${selectedClientId ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${selectedClientId ? 'bg-primary/10' : 'bg-gray-100'}`}>
                <Users className={`h-6 w-6 ${selectedClientId ? 'text-primary' : 'text-gray-500'}`} />
              </div>

              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">
                  {selectedClientId ? 'Viewing Documents For:' : 'Select a Client to View Documents'}
                </Label>

                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full max-w-md justify-between h-11 text-left border-gray-300 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        {selectedClientId ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">{getClientName(selectedClientId)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">Select a client...</span>
                          </>
                        )}
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="🔍 Search clients by name..." className="h-12" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup heading="Clients">
                          {clients.map((c: any) => (
                            <CommandItem
                              key={c.client_id}
                              value={c.client_name}
                              onSelect={() => {
                                setSelectedClientId(c.client_id.toString());
                                setSelectedFolder(null);
                                setClientOpen(false);
                              }}
                              className="py-3 cursor-pointer"
                            >
                              <CheckCircle2 className={cn("mr-3 h-5 w-5", selectedClientId === String(c.client_id) ? "text-green-500 opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{c.client_name}</span>
                                {c.primary_contact_email && (
                                  <span className="text-xs text-muted-foreground">{c.primary_contact_email}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedClientId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(null);
                    setSelectedFolder(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Change Client
                </Button>
              )}
            </div>
          </div>

          {/* NO CLIENT SELECTED MESSAGE */}
          {!selectedClientId && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Folder className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700">No Client Selected</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Select a client from the dropdown above to view their documents.
              </p>
            </div>
          )}

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
                    onClick={handleCreateFolder}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* CONTENT - only show when client is selected */}
          {selectedClientId && (
            <>
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
                  {selectedFolder.split('/').map((part, idx, arr) => {
                    const isAssigned = part === ASSIGNED_TASK_FOLDER || selectedFolder.startsWith(ASSIGNED_TASK_FOLDER);
                    const isOnboarding = part === ONBOARDING_FOLDER || selectedFolder.startsWith(ONBOARDING_FOLDER);
                    const colorClass = isAssigned ? "text-green-600" : isOnboarding ? "text-blue-600" : "text-gray-700";

                    return (
                      <span key={idx} className="flex items-center gap-1">
                        {idx === arr.length - 1 ? (
                          <span className={`flex items-center gap-1 font-semibold ${colorClass}`}>
                            <Folder className="size-4" />
                            {part}
                          </span>
                        ) : (
                          <>
                            <span className={colorClass}>{part}</span>
                            <span className="text-muted-foreground">/</span>
                          </>
                        )}
                      </span>
                    );
                  })}
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

                        // Special styling for completion document folders
                        const isAssignedTaskFolder = folder.name === ASSIGNED_TASK_FOLDER ||
                          (selectedFolder && selectedFolder.startsWith(ASSIGNED_TASK_FOLDER));
                        const isOnboardingFolder = folder.name === ONBOARDING_FOLDER ||
                          (selectedFolder && selectedFolder.startsWith(ONBOARDING_FOLDER));

                        // Determine styling based on folder type
                        let folderBgClass = "bg-amber-50/30 hover:bg-amber-50 border-gray-100 hover:border-amber-200";
                        let folderIconClass = "text-amber-400 fill-amber-100 group-hover:fill-amber-200";
                        let FolderIcon = Folder;

                        if (folder.name === ASSIGNED_TASK_FOLDER) {
                          folderBgClass = "bg-green-50/50 hover:bg-green-50 border-green-200 hover:border-green-300";
                          folderIconClass = "text-green-500 fill-green-100 group-hover:fill-green-200";
                          FolderIcon = CheckCircle2;
                        } else if (folder.name === ONBOARDING_FOLDER) {
                          folderBgClass = "bg-blue-50/50 hover:bg-blue-50 border-blue-200 hover:border-blue-300";
                          folderIconClass = "text-blue-500 fill-blue-100 group-hover:fill-blue-200";
                          FolderIcon = Layers;
                        } else if (isAssignedTaskFolder) {
                          folderBgClass = "bg-green-50/30 hover:bg-green-50 border-green-100 hover:border-green-200";
                          folderIconClass = "text-green-400 fill-green-100 group-hover:fill-green-200";
                        } else if (isOnboardingFolder) {
                          folderBgClass = "bg-blue-50/30 hover:bg-blue-50 border-blue-100 hover:border-blue-200";
                          folderIconClass = "text-blue-400 fill-blue-100 group-hover:fill-blue-200";
                        }

                        return (
                          <div
                            key={folder.name}
                            onClick={() => setSelectedFolder(fullPath)}
                            className={`group relative flex flex-col items-center justify-center p-6 border rounded-xl 
                              ${folderBgClass}
                              cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md`}
                          >
                            {/* Show special icon or folder icon */}
                            {folder.name === ASSIGNED_TASK_FOLDER || folder.name === ONBOARDING_FOLDER ? (
                              <div className="relative mb-3">
                                <Folder className={`w-12 h-12 ${folderIconClass} transition-colors`} />
                                <div className={`absolute -top-1 -right-1 p-1 rounded-full ${folder.name === ASSIGNED_TASK_FOLDER ? 'bg-green-500' : 'bg-blue-500'}`}>
                                  <FolderIcon className="w-3 h-3 text-white" />
                                </div>
                              </div>
                            ) : (
                              <Folder className={`w-12 h-12 ${folderIconClass} mb-3 transition-colors`} />
                            )}
                            <span className="text-sm font-medium text-gray-700 text-center truncate w-full px-2">
                              {folder.name}
                            </span>

                            {/* Subtitle for special folders */}
                            {folder.name === ASSIGNED_TASK_FOLDER && (
                              <span className="text-xs text-green-600 mt-1">Task Completions</span>
                            )}
                            {folder.name === ONBOARDING_FOLDER && (
                              <span className="text-xs text-blue-600 mt-1">Stage Completions</span>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete folder "${folder.name}"?`)) return;

                                fetch("/api/documents/delete-folder", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    clientId: selectedClientId,
                                    folderPath: fullPath,
                                  }),
                                }).then(() => mutate(["docs", selectedClientId, selectedFolder]));
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
                                clientId: selectedClientId,
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
