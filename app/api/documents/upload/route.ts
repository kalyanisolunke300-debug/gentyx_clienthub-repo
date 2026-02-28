
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit, AuditActions, AuditActorRole } from "@/lib/audit";
import { queueDocumentUploadNotification } from "@/lib/notification-batcher";
import { getClientRootFolder } from "@/lib/storage-utils";

export const dynamic = "force-dynamic";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

type DuplicateAction = "ask" | "replace" | "skip";

function cleanSegment(input: string) {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "." && s !== "..")
    .join("/");
}

/** Check if a file already exists in Supabase Storage */
async function fileExists(blobPath: string): Promise<boolean> {
  // List with a limit=1 under the parent folder to check for the filename
  const folder = blobPath.includes("/")
    ? blobPath.slice(0, blobPath.lastIndexOf("/"))
    : "";
  const fileName = blobPath.split("/").pop() || blobPath;

  const { data } = await supabaseAdmin.storage.from(BUCKET).list(folder, {
    search: fileName,
    limit: 1,
  });

  return (data ?? []).some((f: { name: string }) => f.name === fileName);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const clientId = (formData.get("clientId") as string)?.trim();
    const rawFolderName = (formData.get("folderName") as string | null) || null;
    const file = formData.get("file") as File | null;

    const duplicateActionRaw =
      (formData.get("duplicateAction") as string | null)?.trim() || "ask";
    const duplicateAction = (["ask", "replace", "skip"].includes(duplicateActionRaw)
      ? duplicateActionRaw
      : "ask") as DuplicateAction;

    const role = ((formData.get("role") as string)?.trim() || "ADMIN") as AuditActorRole;

    let visibility = ((formData.get("visibility") as string)?.trim() || "shared") as
      | "shared"
      | "private";
    if (role !== "ADMIN") visibility = "shared";

    if (!clientId || !file) {
      return NextResponse.json(
        { success: false, error: "Client and file are required" },
        { status: 400 }
      );
    }

    if (file.name === ".keep") {
      return NextResponse.json(
        { success: false, error: "Invalid file name" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const safeFolder = rawFolderName ? cleanSegment(rawFolderName) : null;

    const rootFolder = await getClientRootFolder(clientId);
    const initialPath = safeFolder
      ? `${rootFolder}/${safeFolder}/${fileName}`
      : `${rootFolder}/${fileName}`;

    const exists = await fileExists(initialPath);

    // If duplicate & ask → tell frontend to show Replace/Skip dialog
    if (exists && duplicateAction === "ask") {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          message: "File already exists. Choose Replace or Skip.",
          existingPath: initialPath,
          fileName,
        },
        { status: 409 }
      );
    }

    // If duplicate & skip → DO NOT UPLOAD
    if (exists && duplicateAction === "skip") {
      logAudit({
        clientId: Number(clientId),
        action: AuditActions.DOCUMENT_UPLOADED,
        actorRole: role,
        details: `Skipped (duplicate): ${fileName}`,
      });

      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Upload skipped (duplicate)",
        path: initialPath,
        fileName,
      });
    }

    // Upload to Supabase Storage (upsert=true → overwrites existing)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(initialPath, buffer, {
        contentType: file.type,
        upsert: true,
        // Supabase Storage doesn't support custom metadata per object natively,
        // so visibility/uploadedBy are tracked via file path conventions.
      });

    if (uploadError) throw new Error(uploadError.message);

    // Generate a signed URL (1 hour) for the response
    const { data: signedData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(initialPath, 60 * 60);

    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_UPLOADED,
      actorRole: role,
      details: exists
        ? duplicateAction === "replace"
          ? `Replaced: ${fileName}`
          : `Saved as: ${initialPath.split("/").pop() || fileName}`
        : fileName,
    });

    // Queue email notification
    const isAdminOnlyFolder =
      safeFolder === "Admin Only" ||
      safeFolder === "Admin Restricted" ||
      (safeFolder &&
        (safeFolder.startsWith("Admin Only/") ||
          safeFolder.startsWith("Admin Restricted/")));

    if (visibility !== "private" && !isAdminOnlyFolder) {
      (async () => {
        try {
          const { data: clientData } = await supabaseAdmin
            .from("Clients")
            .select("client_name")
            .eq("client_id", Number(clientId))
            .single();

          const clientName = clientData?.client_name || `Client ${clientId}`;

          queueDocumentUploadNotification({
            clientId: Number(clientId),
            clientName,
            uploaderName: role === "ADMIN" ? "Admin" : clientName,
            uploaderRole: role as any,
            documentName: fileName,
            folderPath: safeFolder || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to queue admin notification:", emailErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: exists && duplicateAction === "replace"
        ? "File replaced successfully"
        : "File uploaded successfully",
      path: initialPath,
      url: signedData?.signedUrl || null,
      finalFileName: initialPath.split("/").pop() || fileName,
      replaced: exists && duplicateAction === "replace",
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
