// components/widgets/upload-doc-form.tsx
"use client";

import type React from "react";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/store/ui-store";
import { Upload, File, X } from "lucide-react";

const Schema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["PDF", "XLSX", "DOCX", "IMG", "OTHER"]),
});

export function UploadDocForm({ context }: { context?: Record<string, any> }) {
  const folderName = context?.folderName || null;

  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; folderPath: string | null }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; success: boolean; error?: string }[]>([]);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      clientId: context?.clientId || "",
      name: "",
      type: "PDF",
    },
  });

  /* ------------------------------
        FILE SELECTION HANDLERS
  ------------------------------*/
  function handleFilesSelect(files: FileList | null, fromFolderInput: boolean = false) {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).map((file) => {
      // Extract folder path from webkitRelativePath
      // webkitRelativePath format: "SelectedFolder/SubFolder/file.pdf"
      // We skip the first part (the selected folder name) and keep only subfolders
      let extractedFolderPath: string | null = null;

      if (fromFolderInput && (file as any).webkitRelativePath) {
        const relativePath = (file as any).webkitRelativePath as string;
        const pathParts = relativePath.split("/");
        // pathParts = ["SelectedFolder", "SubFolder", "file.pdf"]
        // Skip first element (selected folder) and last element (filename)
        // Keep only middle parts (subfolders)
        if (pathParts.length > 2) {
          // Has subfolders: keep them
          extractedFolderPath = pathParts.slice(1, -1).join("/");
        }
        // If pathParts.length === 2, file is directly in root folder, no subfolder needed
      }

      return {
        file,
        folderPath: extractedFolderPath,
      };
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Auto-detect type from first file for the form
    if (newFiles.length === 1) {
      type FileType = "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
      const ext = newFiles[0].file.name.split(".").pop()?.toLowerCase() || "";
      const typeMap: Record<string, FileType> = {
        pdf: "PDF",
        xlsx: "XLSX",
        xls: "XLSX",
        docx: "DOCX",
        doc: "DOCX",
        jpg: "IMG",
        jpeg: "IMG",
        png: "IMG",
        gif: "IMG",
        bmp: "IMG",
        webp: "IMG",
        svg: "IMG",
      };
      const detected: FileType = typeMap[ext] || "OTHER";
      form.setValue("name", newFiles[0].file.name);
      form.setValue("type", detected);
    } else {
      form.setValue("name", `${newFiles.length} files selected`);
    }
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFilesSelect(e.target.files, false);
    e.target.value = "";
  }

  function handleFolderInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFilesSelect(e.target.files, true);
    e.target.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  // Helper function to recursively read folder entries
  async function readEntriesRecursively(
    entry: FileSystemEntry,
    path: string = ""
  ): Promise<{ file: File; folderPath: string | null }[]> {
    const results: { file: File; folderPath: string | null }[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      results.push({
        file,
        folderPath: path || null,
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        const childPath = path ? `${path}/${childEntry.name}` : "";
        const childResults = await readEntriesRecursively(
          childEntry,
          childEntry.isDirectory ? (path ? `${path}/${childEntry.name}` : childEntry.name) : path
        );
        results.push(...childResults);
      }
    }

    return results;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    const filesWithPaths: { file: File; folderPath: string | null }[] = [];

    // Check if we can use webkitGetAsEntry (for folder support)
    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          try {
            const results = await readEntriesRecursively(entry, "");
            filesWithPaths.push(...results);
          } catch (err) {
            console.error("Error reading dropped item:", err);
          }
        }
      }

      if (filesWithPaths.length > 0) {
        setSelectedFiles(prev => [...prev, ...filesWithPaths]);
        form.setValue("name", `${filesWithPaths.length} files selected`);
        return;
      }
    }

    // Fallback: regular file handling (no folder support)
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map(file => ({
        file,
        folderPath: null,
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
      form.setValue("name", `${files.length} files selected`);
    }
  }

  /* --------------------------------
        FINAL SUBMIT → CALL API
  --------------------------------*/
  async function onSubmit(values: z.infer<typeof Schema>) {
    if (selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    const results: { name: string; success: boolean; error?: string }[] = [];
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < selectedFiles.length; i++) {
      const { file, folderPath: fileFolderPath } = selectedFiles[i];
      setUploadProgress(Math.round(((i) / totalFiles) * 100));

      // Detect file type for each file
      type FileType = "PDF" | "XLSX" | "DOCX" | "IMG" | "OTHER";
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const typeMap: Record<string, FileType> = {
        pdf: "PDF",
        xlsx: "XLSX",
        xls: "XLSX",
        docx: "DOCX",
        doc: "DOCX",
        jpg: "IMG",
        jpeg: "IMG",
        png: "IMG",
        gif: "IMG",
        bmp: "IMG",
        webp: "IMG",
        svg: "IMG",
      };
      const fileType: FileType = typeMap[ext] || "OTHER";

      // Combine context folderName with file's folder path (for folder uploads)
      let uploadFolderPath: string | null = folderName;
      if (fileFolderPath) {
        uploadFolderPath = folderName
          ? `${folderName}/${fileFolderPath}`
          : fileFolderPath;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", values.clientId);
      formData.append("fileType", fileType);
      if (uploadFolderPath) {
        formData.append("folderName", uploadFolderPath);
      }

      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        const displayName = fileFolderPath ? `${fileFolderPath}/${file.name}` : file.name;

        if (!data.success) {
          results.push({ name: displayName, success: false, error: data.error || "Upload failed" });
        } else {
          results.push({ name: displayName, success: true });
        }
      } catch (error: any) {
        const displayName = fileFolderPath ? `${fileFolderPath}/${file.name}` : file.name;
        results.push({ name: displayName, success: false, error: error.message || "Upload failed" });
      }
    }

    setUploadProgress(100);
    setUploadResults(results);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `${successCount} file(s) uploaded successfully.`,
      });
      setSelectedFiles([]);
      form.reset();
      closeDrawer();
    } else if (successCount === 0) {
      toast({
        title: "Error",
        description: `All ${failCount} file(s) failed to upload.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} file(s) uploaded, ${failCount} failed.`,
        variant: "destructive",
      });
    }

    setUploading(false);
  }

  /* --------------------------------
                UI
  --------------------------------*/
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      {/* Client ID */}
      {/* <div className="grid gap-2">
        <Label htmlFor="clientId">Client ID</Label>
        <Input {...form.register("clientId")} placeholder="2" />
      </div> */}
      {/* Client Name Header */}
      <div className="text-lg font-semibold mb-2">
        {context?.clientName || "Client"}
      </div>


      {/* Upload Box */}
      <div className="grid gap-2">
        <Label>Files or Folder</Label>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-border"
            }`}
        >
          <input
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.gif"
          />

          <div className="flex flex-col items-center gap-2">
            <Upload className="size-6 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium">Click to upload files</span> or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, XLSX, DOCX, IMG up to 10MB (multiple files supported)
            </div>
          </div>
        </div>

        {/* Folder Upload Button */}
        <div className="relative">
          <input
            type="file"
            // @ts-ignore - webkitdirectory is a non-standard attribute
            webkitdirectory=""
            // @ts-ignore
            directory=""
            multiple
            onChange={handleFolderInputChange}
            className="absolute inset-0 cursor-pointer opacity-0 w-full h-full"
            id="folder-upload"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              <path d="M12 10v6" />
              <path d="m9 13 3-3 3 3" />
            </svg>
            Upload Folder
          </Button>
        </div>
      </div>

      {/* Preview */}
      {selectedFiles.length > 0 && (
        <div className="grid gap-2 max-h-48 overflow-y-auto">
          <Label>Selected Files ({selectedFiles.length})</Label>
          {selectedFiles.map(({ file, folderPath }, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md bg-muted p-2">
              <File className="size-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 text-sm min-w-0">
                <div className="font-medium truncate">
                  {folderPath ? `${folderPath}/${file.name}` : file.name}
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  {folderPath && (
                    <span className="text-primary">📁 from folder</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}



      {/* Upload Progress */}
      {uploading && (
        <div className="grid gap-1">
          <div className="text-xs text-muted-foreground">
            Uploading... {Math.round(uploadProgress)}%
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={closeDrawer}>
          Cancel
        </Button>
        <Button type="submit" disabled={uploading || selectedFiles.length === 0}>
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </form>
  );
}
