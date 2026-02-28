import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit, AuditActions } from "@/lib/audit";
import { queueFolderCreatedNotification } from "@/lib/notification-batcher";
import { getClientRootFolder } from "@/lib/storage-utils";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function POST(req: Request) {
  try {
    const { clientId, folderName, parentFolder, role = "ADMIN" } = await req.json();

    if (!clientId || !folderName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const rootFolder = await getClientRootFolder(clientId);

    // Build the full folder path
    const finalFolderPath = parentFolder
      ? `${rootFolder}/${parentFolder}/${folderName}`
      : `${rootFolder}/${folderName}`;

    // ✅ Case-insensitive duplicate check — list siblings and compare
    const parentPath = parentFolder
      ? `${rootFolder}/${parentFolder}`
      : rootFolder;

    const { data: siblings } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(parentPath, { limit: 1000 });

    const normalizedNewName = folderName.toLowerCase().trim();
    if (siblings) {
      for (const item of siblings) {
        if (item.id === null && item.name.toLowerCase() === normalizedNewName) {
          return NextResponse.json(
            {
              success: false,
              error: `A folder named "${item.name}" already exists (case-insensitive match)`,
            },
            { status: 409 }
          );
        }
      }
    }

    // Create the folder by uploading an empty .keep placeholder
    const keepPath = `${finalFolderPath}/.keep`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(keepPath, new Uint8Array(0), {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    logAudit({
      clientId: Number(clientId),
      action: AuditActions.FOLDER_CREATED,
      actorRole: role,
      details: folderName,
    });

    // Queue notification (skip for Admin Only sections)
    const isAdminOnlySection =
      parentFolder === "Admin Only" ||
      parentFolder === "Admin Restricted" ||
      (parentFolder &&
        (parentFolder.startsWith("Admin Only/") ||
          parentFolder.startsWith("Admin Restricted/"))) ||
      folderName === "Admin Only" ||
      folderName === "Admin Restricted";

    if (!isAdminOnlySection) {
      (async () => {
        try {
          const { data: clientData } = await supabaseAdmin
            .from("Clients")
            .select("client_name")
            .eq("client_id", Number(clientId))
            .single();

          const clientName = clientData?.client_name || `Client ${clientId}`;

          queueFolderCreatedNotification({
            clientId: Number(clientId),
            clientName,
            creatorName: role === "ADMIN" ? "Admin" : clientName,
            creatorRole: role as any,
            folderName,
            parentPath: parentFolder || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to queue admin notification:", emailErr);
        }
      })();
    } else {
      console.log(`[CREATE-FOLDER] Skipping notification for Admin-only folder: ${folderName}`);
    }

    return NextResponse.json({
      success: true,
      message: "Folder created successfully",
      path: finalFolderPath,
    });
  } catch (err: any) {
    console.error("CREATE FOLDER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
