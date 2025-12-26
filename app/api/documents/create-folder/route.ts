// /app/api/documents/create-folder/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { logAudit, AuditActions } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { clientId, folderName, parentFolder } = await req.json();

    if (!clientId || !folderName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    );
    await containerClient.createIfNotExists();

    // ✅ SUPPORT SUB-FOLDERS
    const finalFolderPath = parentFolder
      ? `client-${clientId}/${parentFolder}/${folderName}/`
      : `client-${clientId}/${folderName}/`;

    // ✅ CASE-INSENSITIVE DUPLICATE PROTECTION
    // List all folders at the parent level and check for case-insensitive matches
    const parentPath = parentFolder
      ? `client-${clientId}/${parentFolder}/`
      : `client-${clientId}/`;

    const existingFolders = containerClient.listBlobsByHierarchy("/", {
      prefix: parentPath,
    });

    const normalizedNewName = folderName.toLowerCase().trim();

    for await (const item of existingFolders) {
      // Check if this is a folder (virtual directory)
      if (item.kind === "prefix") {
        // Extract folder name from the prefix (remove parent path and trailing slash)
        const existingName = item.name
          .replace(parentPath, "")
          .replace(/\/$/, "");

        if (existingName.toLowerCase() === normalizedNewName) {
          return NextResponse.json(
            { success: false, error: `A folder named "${existingName}" already exists (case-insensitive match)` },
            { status: 409 }
          );
        }
      }
    }


    // ✅ REAL FOLDER CREATION
    const blockBlobClient = containerClient.getBlockBlobClient(
      `${finalFolderPath}.keep`
    );

    await blockBlobClient.upload("", 0);

    // Audit log
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.FOLDER_CREATED,
      actorRole: "ADMIN",
      details: folderName,
    });

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
