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
import { Upload, File } from "lucide-react";

const Schema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["PDF", "XLSX", "DOCX", "IMG", "OTHER"]),
});

export function UploadDocForm({ context }: { context?: Record<string, any> }) {
  const { toast } = useToast();
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

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
function handleFileSelect(file: File) {
  setSelectedFile(file);

  // Allowed union for the "type" field
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

  // TS now knows this is FileType, not just "string"
  const detected: FileType = typeMap[ext] || "OTHER";

  form.setValue("name", file.name);
  form.setValue("type", detected);
}


  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  /* --------------------------------
        FINAL SUBMIT → CALL API
  --------------------------------*/
  async function onSubmit(values: z.infer<typeof Schema>) {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("clientId", values.clientId);
    formData.append("fileType", values.type);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadProgress(100);

      toast({
        title: "Success",
        description: `${selectedFile.name} uploaded successfully.`,
      });

      setSelectedFile(null);
      form.reset();
      closeDrawer();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
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
        <Label>File</Label>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input
            type="file"
            onChange={handleInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.gif"
          />

          <div className="flex flex-col items-center gap-2">
            <Upload className="size-6 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, XLSX, DOCX, IMG up to 10MB
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 rounded-md bg-muted p-2">
          <File className="size-4 text-muted-foreground" />
          <div className="flex-1 text-sm">
            <div className="font-medium">{selectedFile.name}</div>
            <div className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>
      )}

      {/* File Type */}
      <div className="grid gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={form.watch("type")}
          onValueChange={(v) => form.setValue("type", v as any)}
        >
          <SelectTrigger id="type">
            <SelectValue />
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
        <Button type="submit" disabled={uploading || !selectedFile}>
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
    </form>
  );
}
